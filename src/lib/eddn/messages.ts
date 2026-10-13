import { classifyBody } from "@/data/body-resources";
import { canonicalRingMaterial } from "@/data/ring-materials";
import { MAX_MARKET_AGE_DAYS } from "@/data/retention";

import { provisionalName } from "./commodity-names";
import { METRES_PER_SECOND_SQUARED_PER_G, planetSubtype, RESERVE_LEVELS, RING_CLASSES, stationType, volcanismName } from "./names";

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
const MAX_COORD = 100_000; // light years from Sol; the galaxy is about 100,000 across
const MAX_RINGS = 20;
const MAX_HOTSPOT_TYPES = 40;

export interface MarketUpdate {
  kind: "market";
  marketId: number;
  at: string; // ISO time the market was seen
  // Only what is bought: demand and a price. `provisional`: a name made from a symbol we have no name for (a commodity newer than the dump).
  commodities: { name: string; price: number; demand: number; provisional?: true }[];
  unknown?: string[]; // the symbols (lower case) behind the provisional names, so the listener can go and look for their names
}

export interface SystemUpdate {
  kind: "system";
  id64: number;
  at: string;
  name: string | null; // with `pos`, enough to add the system when it is not in the database
  pos: [number, number, number] | null;
  powerplay: boolean; // the message carries Powerplay information; when false only the system itself is added, its state is left alone
  controllingPower: string | null;
  powerState: string | null;
  powers: string[] | null;
  controlProgress: number | null;
  reinforcement: number | null;
  undermining: number | null;
  conflict: { power: string; progress: number }[] | null;
}

export interface SignalsUpdate {
  kind: "signals";
  id64: number;
  bodyId: number;
  at: string;
  miningSignals: number; // planetary mining locations
}

// A station the player docked at: where it is and what it is. Its market arrives separately.
export interface StationUpdate {
  kind: "station";
  at: string;
  marketId: number;
  id64: number; // the system's
  systemName: string;
  pos: [number, number, number];
  name: string;
  type: string;
  distanceLs: number | null;
  large: boolean | null; // null: the message did not say (settlements, some special stations), so what is stored stays
  medium: boolean | null;
}

// A scanned planet: itself, if landable, and its rings.
export interface BodyUpdate {
  kind: "body";
  at: string;
  id64: number;
  bodyId: number;
  name: string;
  landable: boolean; // landable and one of the types the app mines
  subtype: string | null;
  volcanism: string;
  gravity: number | null; // in g
  distanceLs: number | null;
  bodyClass: string | null;
  reserve: string | null;
  rings: { name: string; type: string }[];
}

// A ring that was surface-scanned: every hotspot it has.
export interface HotspotsUpdate {
  kind: "hotspots";
  at: string;
  id64: number;
  ringName: string;
  hotspots: { material: string; count: number }[];
}

export type EddnUpdate = MarketUpdate | SystemUpdate | SignalsUpdate | StationUpdate | BodyUpdate | HotspotsUpdate;
export type ParseResult = { update: EddnUpdate } | { skip: string };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
// Anyone can send to EDDN, so text is not trusted: no control characters, and none of the bidirectional overrides that make a name read as another.
const UNSAFE_TEXT = /[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/;
const str = (v: unknown, max = 80): string | null => (typeof v === "string" && v.length > 0 && v.length <= max && !UNSAFE_TEXT.test(v) ? v : null);
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
      if (message.event === "Docked") return parseDocked(message, now);
      if (message.event === "Scan") return parseScan(message, now);
      if (message.event === "SAASignalsFound") return isRing(message.BodyName) ? parseHotspots(message, now) : parseSignals(message, now);
      return { skip: "event" };
    case LIVE_SCHEMAS.fssBodySignals:
      return message.event === "FSSBodySignals" ? parseSignals(message, now) : { skip: "event" };
    default:
      return { skip: "schema" }; // includes the /test schemas, which are not real data
  }
}

function parseMarket(m: Obj, now: number, symbols: ReadonlyMap<string, string>): ParseResult {
  const marketId = int(m.marketId, 1, Number.MAX_SAFE_INTEGER);
  const time = stamp(m.timestamp, now);
  if (marketId === null || "skip" in time || !Array.isArray(m.commodities) || m.commodities.length > MAX_COMMODITIES) return { skip: "skip" in time ? time.skip : "malformed" };
  if (m.stationType === "FleetCarrier") return { skip: "carrier" }; // carriers are not in the database

  // Without the names the market would read as "buys nothing" and replace a real one.
  if (symbols.size === 0) return { skip: "no-names" };
  const bought = new Map<string, { name: string; price: number; demand: number; provisional?: true }>();
  const unknown = new Set<string>();
  let unnamed = 0;
  for (const c of m.commodities) {
    if (!isObj(c) || typeof c.name !== "string") continue;
    const price = int(c.sellPrice, 0, MAX_PRICE);
    const demand = int(c.demand, 0, MAX_DEMAND);
    if (!price || !demand) continue; // 0 or missing: nobody is buying
    const symbol = c.name.toLowerCase();
    const name = symbols.get(symbol);
    if (name) {
      bought.set(name, { name, price, demand });
    } else {
      // A commodity newer than our names: show it under a name made from the symbol rather than lose the price. The real name replaces it
      // once it is known (see commodity-names.ts).
      const made = provisionalName(c.name);
      if (!made || bought.has(made)) {
        unnamed++;
        continue;
      }
      bought.set(made, { name: made, price, demand, provisional: true });
      unknown.add(symbol);
    }
  }
  // Buying only things that cannot be named at all (not a symbol): not the same as buying nothing.
  if (bought.size === 0 && unnamed > 0) return { skip: "no-names" };
  return { update: { kind: "market", marketId, at: time.at, commodities: [...bought.values()], ...(unknown.size ? { unknown: [...unknown] } : {}) } };
}

function parseSystem(m: Obj, now: number): ParseResult {
  const id64 = int(m.SystemAddress, 1, Number.MAX_SAFE_INTEGER);
  const time = stamp(m.timestamp, now);
  if ("skip" in time) return time;
  if (id64 === null) return { skip: "malformed" };
  const powerplay = !(m.Powers === undefined && m.PowerplayState === undefined && m.ControllingPower === undefined);
  const name = str(m.StarSystem);
  const pos = position(m.StarPos);
  const populated = typeof m.Population === "number" && m.Population > 0;
  // A system nobody lives in and with no Powerplay presence is of no use to the search.
  if (!powerplay && !(populated && name && pos)) return { skip: "no-powerplay" };

  const powers = Array.isArray(m.Powers) ? m.Powers.map((p) => str(p, 40)).filter((p): p is string => p !== null).slice(0, MAX_POWERS) : null;
  const conflict = Array.isArray(m.PowerplayConflictProgress)
    ? m.PowerplayConflictProgress.flatMap((c) => {
        if (!isObj(c)) return [];
        const power = str(c.Power, 40);
        const progress = num(c.ConflictProgress);
        return power && progress !== null ? [{ power, progress }] : [];
      }).slice(0, MAX_POWERS)
    : null;

  return {
    update: {
      kind: "system",
      id64,
      at: time.at,
      name,
      pos,
      powerplay,
      controllingPower: str(m.ControllingPower, 40),
      powerState: str(m.PowerplayState, 40),
      powers,
      controlProgress: num(m.PowerplayStateControlProgress),
      reinforcement: num(m.PowerplayStateReinforcement),
      undermining: num(m.PowerplayStateUndermining),
      conflict,
    },
  };
}

// FSSBodySignals and SAASignalsFound both list a body's signals; the planetary mining count is what the database keeps.
function parseSignals(m: Obj, now: number): ParseResult {
  const id64 = int(m.SystemAddress, 1, Number.MAX_SAFE_INTEGER);
  const bodyId = int(m.BodyID, 0, 1_000_000);
  const time = stamp(m.timestamp, now);
  if ("skip" in time) return time;
  if (id64 === null || bodyId === null || !Array.isArray(m.Signals)) return { skip: "malformed" };
  const entry = m.Signals.find((s) => isObj(s) && s.Type === MINING_SIGNAL);
  const count = isObj(entry) ? int(entry.Count, 0, 500) : null;
  // A body listing other signals but no mining locations tells us nothing: unknown stays unknown (see NOTES/PLAN.md).
  return count === null ? { skip: "no-mining-signal" } : { update: { kind: "signals", id64, bodyId, at: time.at, miningSignals: count } };
}

const isRing = (v: unknown): boolean => typeof v === "string" && / Ring$/.test(v);

// [x, y, z] in light years from Sol, or null if it is not three plausible numbers.
function position(v: unknown): [number, number, number] | null {
  if (!Array.isArray(v) || v.length !== 3) return null;
  const [x, y, z] = v;
  return [x, y, z].every((n) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= MAX_COORD) ? [x, y, z] : null;
}

// A station the player docked at. Fleet carriers are not in the database.
function parseDocked(m: Obj, now: number): ParseResult {
  const time = stamp(m.timestamp, now);
  if ("skip" in time) return time;
  if (m.StationType === "FleetCarrier") return { skip: "carrier" };
  const marketId = int(m.MarketID, 1, Number.MAX_SAFE_INTEGER);
  const id64 = int(m.SystemAddress, 1, Number.MAX_SAFE_INTEGER);
  const name = str(m.StationName);
  if (name?.startsWith("$")) return { skip: "unlocalised" }; // "$EXT_PANEL_ColonisationShip; Name": the game's own key, not a name; EDDN carries no localised one
  const systemName = str(m.StarSystem);
  const type = str(m.StationType, 40);
  // Takes deliveries for a build and buys nothing: a depot by its type, or any station (a colonisation ship, say) offering to take contributions.
  if ((type && /ConstructionDepot/.test(type)) || (Array.isArray(m.StationServices) && m.StationServices.includes("colonisationcontribution"))) return { skip: "construction-site" };
  const pos = position(m.StarPos);
  if (marketId === null || id64 === null || !name || !systemName || !type || !pos) return { skip: "malformed" };
  const pads = isObj(m.LandingPads) ? m.LandingPads : null;
  const distance = num(m.DistFromStarLS);
  return {
    update: {
      kind: "station",
      at: time.at,
      marketId,
      id64,
      systemName,
      pos,
      name,
      type: stationType(type),
      distanceLs: distance !== null && distance >= 0 && distance < 1e9 ? distance : null,
      large: pads ? (num(pads.Large) ?? 0) > 0 : null,
      medium: pads ? (num(pads.Medium) ?? 0) > 0 : null,
    },
  };
}

// A scanned planet: only the types the app mines, and only if it is landable or has rings. Stars and their belts are ignored.
function parseScan(m: Obj, now: number): ParseResult {
  if (typeof m.PlanetClass !== "string") return { skip: "not-a-planet" };
  const subtype = planetSubtype(m.PlanetClass);
  const landable = m.Landable === true && subtype !== null;
  const ringList = Array.isArray(m.Rings) ? m.Rings.slice(0, MAX_RINGS) : [];
  const rings = ringList.flatMap((r) => {
    const ringName = isObj(r) ? str(r.Name) : null;
    const type = isObj(r) && typeof r.RingClass === "string" ? RING_CLASSES[r.RingClass] : undefined;
    return ringName && type ? [{ name: ringName, type }] : [];
  });
  if (!landable && rings.length === 0) return { skip: "nothing-to-mine" };

  const time = stamp(m.timestamp, now);
  if ("skip" in time) return time;
  const id64 = int(m.SystemAddress, 1, Number.MAX_SAFE_INTEGER);
  const bodyId = int(m.BodyID, 0, 1_000_000);
  const name = str(m.BodyName);
  if (id64 === null || bodyId === null || !name) return { skip: "malformed" };

  const gravity = num(m.SurfaceGravity);
  const distance = num(m.DistanceFromArrivalLS);
  const volcanism = volcanismName(typeof m.Volcanism === "string" ? m.Volcanism : "");
  return {
    update: {
      kind: "body",
      at: time.at,
      id64,
      bodyId,
      name,
      landable,
      subtype,
      volcanism,
      gravity: gravity !== null && gravity >= 0 && gravity < 1000 ? gravity / METRES_PER_SECOND_SQUARED_PER_G : null,
      distanceLs: distance !== null && distance >= 0 && distance < 1e9 ? distance : null,
      bodyClass: subtype ? classifyBody(subtype, volcanism) : null,
      reserve: typeof m.ReserveLevel === "string" ? (RESERVE_LEVELS[m.ReserveLevel] ?? null) : null,
      rings,
    },
  };
}

// The hotspots of one ring, from its surface scan: the whole list, so it replaces what was there.
function parseHotspots(m: Obj, now: number): ParseResult {
  const time = stamp(m.timestamp, now);
  if ("skip" in time) return time;
  const id64 = int(m.SystemAddress, 1, Number.MAX_SAFE_INTEGER);
  const ringName = str(m.BodyName);
  if (id64 === null || !ringName || !Array.isArray(m.Signals)) return { skip: "malformed" };
  const hotspots = new Map<string, number>();
  for (const s of m.Signals.slice(0, MAX_HOTSPOT_TYPES)) {
    if (!isObj(s) || typeof s.Type !== "string" || s.Type.startsWith("$")) continue; // "$SAA_SignalType_..." are not ring materials
    const count = int(s.Count, 1, 500);
    const material = str(s.Type, 40);
    if (material && count !== null) hotspots.set(canonicalRingMaterial(material), count);
  }
  return { update: { kind: "hotspots", at: time.at, id64, ringName, hotspots: [...hotspots].map(([material, count]) => ({ material, count })) } };
}
