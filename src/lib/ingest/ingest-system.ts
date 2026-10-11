/* eslint-disable @typescript-eslint/no-explicit-any -- raw Spansh dump JSON is untyped */
import type Database from "better-sqlite3";

import { classifyBody } from "@/data/body-resources";
import { MAX_MARKET_AGE_DAYS } from "@/data/retention";
import { canonicalRingMaterial } from "@/data/ring-materials";

const MINING = "$PlanetaryMiningLocation_Name;";
// Returns a function that writes one Spansh system into `db`, or returns false and writes nothing if the system has no usable market. A station is usable
// if it is not a fleet carrier, buys something (demand and a price), and its market was updated within MAX_MARKET_AGE_DAYS.
export function createIngester(
  db: Database.Database,
  { now = Date.now, maxMarketAgeDays = MAX_MARKET_AGE_DAYS }: { now?: () => number; maxMarketAgeDays?: number } = {},
): ((s: any) => boolean) & { symbols: Map<string, string> } {
  const symbols = new Map<string, string>(); // EDDN's commodity symbol (lower case) -> the market's name, from every usable market
  const insSystem = db.prepare(
    `INSERT OR REPLACE INTO systems (id64,name,x,y,z,controlling_power,power_state,powers,control_progress,reinforcement,undermining,updated_at,faction_state,conflict)
     VALUES (@id64,@name,@x,@y,@z,@power,@state,@powers,@control,@reinf,@under,@updated,@fstate,@conflict)`,
  );
  const insBody = db.prepare(
    `INSERT OR REPLACE INTO bodies (system_id64,body_id,name,subtype,volcanism,body_class,gravity,distance_ls,mining_signals)
     VALUES (@sys,@bodyId,@name,@subtype,@volc,@cls,@g,@ls,@mining)`,
  );
  const insRing = db.prepare(`INSERT OR REPLACE INTO rings (system_id64,name,type,reserve) VALUES (@sys,@name,@type,@reserve)`);
  const insHot = db.prepare(`INSERT OR REPLACE INTO ring_hotspots VALUES (@sys,@ring,@material,@n)`);
  const insStation = db.prepare(`INSERT OR REPLACE INTO stations (id,system_id64,name,type,has_large,has_medium,distance_ls,market_updated,best_price)
     VALUES (@id,@sys,@name,@type,@large,@medium,@ls,@updated,@best)`);
  const insMarket = db.prepare(`INSERT OR REPLACE INTO market VALUES (@station,@commodity,@demand,@price)`);

  const add = db.transaction((s: any): boolean => {
    const stations: any[] = [...(s.stations ?? [])];
    for (const b of s.bodies ?? []) for (const t of b.stations ?? []) stations.push(t);
    const oldest = now() - maxMarketAgeDays * 86400_000;
    const usable = stations.filter(
      (t) =>
        t.id != null &&
        t.type !== "Drake-Class Carrier" &&
        t.market?.commodities?.some((c: any) => c.demand > 0 && c.sellPrice > 0) &&
        Date.parse(t.market.updateTime) >= oldest, // NaN (no date) is not >= anything
    );
    if (!usable.length) return false;

    insSystem.run({
      id64: s.id64, name: s.name, x: s.coords?.x, y: s.coords?.y, z: s.coords?.z,
      power: s.controllingPower ?? null, state: s.powerState ?? null,
      powers: s.powers ? JSON.stringify(s.powers) : null,
      control: s.powerStateControlProgress ?? null, reinf: s.powerStateReinforcement ?? null,
      under: s.powerStateUndermining ?? null, updated: s.date ?? null,
      fstate: s.controllingFaction?.state ?? null,
      conflict: s.powerConflictProgress?.length ? JSON.stringify(s.powerConflictProgress) : null,
    });
    for (const b of s.bodies ?? []) {
      for (const r of b.rings ?? []) {
        // Every ring is stored, with or without hotspots: materials that have none can only be found by ring type.
        insRing.run({ sys: s.id64, name: r.name, type: r.type ?? null, reserve: b.reserveLevel ?? null });
        for (const [k, n] of Object.entries(r.signals?.signals ?? {})) insHot.run({ sys: s.id64, ring: r.name, material: canonicalRingMaterial(k), n });
      }
      if (b.type !== "Planet" || !b.isLandable) continue;
      insBody.run({
        bodyId: b.bodyId, sys: s.id64, name: b.name, subtype: b.subType ?? null, volc: b.volcanismType ?? null,
        cls: classifyBody(b.subType ?? null, b.volcanismType ?? null), g: b.gravity ?? null,
        ls: b.distanceToArrival ?? null, mining: b.signals?.signals?.[MINING] ?? null,
      });
    }
    for (const t of usable) {
      const best = Math.max(0, ...t.market.commodities.filter((c: any) => c.demand > 0 && c.sellPrice > 0).map((c: any) => c.sellPrice));
      insStation.run({
        id: t.id, sys: s.id64, name: t.name, type: t.type ?? null,
        large: t.landingPads?.large ? 1 : 0, medium: t.landingPads?.medium ? 1 : 0,
        ls: t.distanceToArrival ?? null, updated: t.market.updateTime ?? null,
        best,
      });
      for (const c of t.market.commodities) {
        if (typeof c.symbol === "string" && c.name) symbols.set(c.symbol.toLowerCase(), c.name);
        if (c.demand > 0 && c.sellPrice > 0) insMarket.run({ station: t.id, commodity: c.name, demand: c.demand, price: c.sellPrice });
      }
    }
    return true;
  });
  return Object.assign(add, { symbols });
}
