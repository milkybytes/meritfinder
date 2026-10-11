import { MAX_MARKET_AGE_DAYS } from "@/data/retention";

// EDDN relays what players' game clients see. Anyone can publish to it, so every message is untrusted: this turns one into a small validated update
// or says why it was not used. Nothing here touches the database. Shapes were checked against the live stream (see src/test/eddn-messages.ts).

const LIVE_SCHEMAS = {
  commodity: "https://eddn.edcd.io/schemas/commodity/3",
  journal: "https://eddn.edcd.io/schemas/journal/1",
  fssBodySignals: "https://eddn.edcd.io/schemas/fssbodysignals/1",
};
const MINING_SIGNAL = "$PlanetaryMiningLocation_Name;";
const MAX_FUTURE_MS = 10 * 60_000; // clocks differ a little; a message from tomorrow is wrong
const MAX_PRICE = 100_000_000; // per tonne, as in the search's own limit
const MAX_DEMAND = 10_000_000;
const MAX_COMMODITIES = 1000;
const MAX_POWERS = 12;
const POWER_EVENTS = ["FSDJump", "Location", "CarrierJump"];

export interface MarketUpdate {
  kind: "market";
  marketId: number;
  at: string; // ISO time the market was seen
  commodities: { name: string; price: number; demand: number }[]; // only what is bought: demand and a price
}

export interface SystemUpdate {
  kind: "system";
  id64: number;
  at: string;
  controllingPower: string | null;
  powerState: string | null;
  powers: string[] | null;
  controlProgress: number | null;
  reinforcement: number | null;
  undermining: number | null;
  conflict: { power: string; progress: number }[] | null;
  factionState: string; // the controlling faction's state, "None" when it has none
}

export interface SignalsUpdate {
  kind: "signals";
  id64: number;
  bodyId: number;
  miningSignals: number; // planetary mining locations
}

export type EddnUpdate = MarketUpdate | SystemUpdate | SignalsUpdate;
export type ParseResult = { update: EddnUpdate } | { skip: string };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, max = 80): string | null => (typeof v === "string" && v.length > 0 && v.length <= max ? v : null);
const int = (v: unknown, min: number, max: number): number | null => (typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

// ISO "…Z" text for a message's own timestamp, or why it is not acceptable.
function stamp(v: unknown, now: number): { at: string } | { skip: string } {
  const t = typeof v === "string" ? Date.parse(v) : NaN;
  if (!Number.isFinite(t)) return { skip: "malformed" };
  if (t > now + MAX_FUTURE_MS) return { skip: "future" };
  if (t < now - MAX_MARKET_AGE_DAYS * 86400_000) return { skip: "old" };
  return { at: new Date(t).toISOString().replace(".000Z", "Z") };
}

export function parseMessage(envelope: unknown, now: number, symbols: ReadonlyMap<string, string>): ParseResult {
  if (!isObj(envelope) || !isObj(envelope.message) || typeof envelope.$schemaRef !== "string") return { skip: "malformed" };
  const message = envelope.message;

  switch (envelope.$schemaRef) {
    case LIVE_SCHEMAS.commodity:
      return parseMarket(message, now, symbols);
    case LIVE_SCHEMAS.journal:
      if (typeof message.event === "string" && POWER_EVENTS.includes(message.event)) return parseSystem(message, now);
      if (message.event === "SAASignalsFound") return parseSignals(message);
      return { skip: "event" };
    case LIVE_SCHEMAS.fssBodySignals:
      return message.event === "FSSBodySignals" ? parseSignals(message) : { skip: "event" };
    default:
      return { skip: "schema" }; // includes the /test schemas, which are not real data
  }
}

function parseMarket(m: Obj, now: number, symbols: ReadonlyMap<string, string>): ParseResult {
  const marketId = int(m.marketId, 1, Number.MAX_SAFE_INTEGER);
  const time = stamp(m.timestamp, now);
  if (marketId === null || "skip" in time || !Array.isArray(m.commodities) || m.commodities.length > MAX_COMMODITIES) return { skip: "skip" in time ? time.skip : "malformed" };
  if (m.stationType === "FleetCarrier") return { skip: "carrier" }; // carriers are not in the database

  const bought = new Map<string, { name: string; price: number; demand: number }>();
  for (const c of m.commodities) {
    if (!isObj(c) || typeof c.name !== "string") continue;
    const name = symbols.get(c.name.toLowerCase());
    const price = int(c.sellPrice, 0, MAX_PRICE);
    const demand = int(c.demand, 0, MAX_DEMAND);
    if (name && price && demand) bought.set(name, { name, price, demand }); // 0 or missing: nobody is buying
  }
  return { update: { kind: "market", marketId, at: time.at, commodities: [...bought.values()] } };
}

function parseSystem(m: Obj, now: number): ParseResult {
  const id64 = int(m.SystemAddress, 1, Number.MAX_SAFE_INTEGER);
  const time = stamp(m.timestamp, now);
  if ("skip" in time) return time;
  if (id64 === null) return { skip: "malformed" };
  if (m.Powers === undefined && m.PowerplayState === undefined && m.ControllingPower === undefined) return { skip: "no-powerplay" }; // a system with no Powerplay presence

  const powers = Array.isArray(m.Powers) ? m.Powers.map((p) => str(p, 40)).filter((p): p is string => p !== null).slice(0, MAX_POWERS) : null;
  const conflict = Array.isArray(m.PowerplayConflictProgress)
    ? m.PowerplayConflictProgress.flatMap((c) => {
        if (!isObj(c)) return [];
        const power = str(c.Power, 40);
        const progress = num(c.ConflictProgress);
        return power && progress !== null ? [{ power, progress }] : [];
      }).slice(0, MAX_POWERS)
    : null;
  const faction = isObj(m.SystemFaction) ? str(m.SystemFaction.FactionState, 40) : null;

  return {
    update: {
      kind: "system",
      id64,
      at: time.at,
      controllingPower: str(m.ControllingPower, 40),
      powerState: str(m.PowerplayState, 40),
      powers,
      controlProgress: num(m.PowerplayStateControlProgress),
      reinforcement: num(m.PowerplayStateReinforcement),
      undermining: num(m.PowerplayStateUndermining),
      conflict,
      factionState: faction ?? "None",
    },
  };
}

// FSSBodySignals and SAASignalsFound both list a body's signals; the planetary mining count is what the database keeps.
function parseSignals(m: Obj): ParseResult {
  const id64 = int(m.SystemAddress, 1, Number.MAX_SAFE_INTEGER);
  const bodyId = int(m.BodyID, 0, 1_000_000);
  if (id64 === null || bodyId === null || !Array.isArray(m.Signals)) return { skip: "malformed" };
  const entry = m.Signals.find((s) => isObj(s) && s.Type === MINING_SIGNAL);
  const count = isObj(entry) ? int(entry.Count, 0, 500) : null;
  // A body listing other signals but no mining locations tells us nothing: unknown stays unknown (see NOTES/PLAN.md).
  return count === null ? { skip: "no-mining-signal" } : { update: { kind: "signals", id64, bodyId, miningSignals: count } };
}
