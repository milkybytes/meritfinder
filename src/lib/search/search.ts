import type Database from "better-sqlite3";

import { ACQUISITION_RANGE_LY } from "@/data/acquisition";
import { likelihoodFor, MATERIALS, type BodyClass } from "@/data/body-resources";
import { isRingMethod, MINABLE_MATERIALS, PLANETARY_MATERIALS, type MiningMethod } from "@/data/mining-methods";
import { RING_MATERIAL_NAMES, hasHotspots, yieldsFrom } from "@/data/ring-materials";
import { getConfig } from "@/lib/config";

import { dbKey, withDb } from "../db/db";

import { isContested } from "./contested";
import { BODIES_OF_SYSTEM, REF_SYSTEM, RINGS_OF_SYSTEM } from "./queries";

// "any" (no Powerplay filter) is not offered in the page or the URL; tests and tools use it to search without one.
export type Goal = "undermine" | "reinforce" | "acquire" | "any";
export type MiningMode = "any" | "known" | "possible";
export type Pad = "S" | "M" | "L";

export interface SearchParams {
  ref: string;            // reference system name
  range: number;          // ly
  power: string;          // your power ("" = none)
  goal: Goal;
  target: string[];       // for undermine: only these opposing powers ([] = any)
  commodity: string[];    // what you sell ([] = any)
  minPrice: number;
  minDemand: number;
  pad: Pad;
  maxStationLs: number;   // 0 = no limit
  maxAgeDays: number;     // market data age, 0 = no limit
  method: MiningMethod;   // how you'll mine; "any" = a system with something to mine (rings or planets)
  material: string[];     // what to mine ([] = any)
  ringTypes: string[];    // ring method: Metallic / Rocky / ... ([] = any)
  mining: MiningMode;     // planetary method: require known signals, or known-or-unknown
  sort: "price" | "distance";
  limit: number;          // max systems returned
  reserve: string[];      // ring method: reserve level (Pristine, Major...) ([] = any)
}

export interface BodyRow {
  bodyId: number;
  name: string;
  subtype: string | null;
  volcanism: string | null;
  bodyClass: BodyClass | null;
  gravity: number | null;
  distanceLs: number | null;
  miningSignals: number | null; // null = unknown
  // Which of the system's top sale commodities (ResultRow.sellable) the survey lists this kind of body for, and the share of its mining
  // locations that show it. A commodity missing here is lower or unknown, not ruled out.
  carries: { material: string; percent: number }[];
}

export interface RingRow {
  name: string;
  type: string | null;
  reserve: string | null;
  hotspots: { material: string; count: number | null }[]; // count is null for a material with no hotspots: it is somewhere in the ring
  // Which of the system's top sale commodities this ring yields to the chosen technique: at a hotspot (count), or null for anywhere in
  // a ring of this type.
  carries: { material: string; hotspots: number | null }[];
}

// A commodity that sells in the system (at any of its stations) and that the app can mine, best price first.
export interface SellableRow {
  commodity: string;
  sellPrice: number;
  demand: number;
  station: string;  // the station that pays most for it
  meets: boolean;   // at some station, at or above the chosen minimum price and demand (the others are shown with their price, dimmed)
  places: number;   // rings and planets (in this system, or for Acquire in your power's systems) that carry it
  ringPlaces: number;   // of which rings
  planetPlaces: number; // of which planets
}

export interface StationRow {
  name: string;
  commodity: string;      // best-paying matching commodity at this station
  type: string | null;
  distanceLs: number | null;
  pad: "L" | "M" | "S";
  sellPrice: number;
  demand: number;
  marketUpdated: string | null;
  // every commodity this station pays for that the app can mine, best first, with whether it meets the chosen minimum price and demand
  top: { commodity: string; sellPrice: number; demand: number; meets: boolean }[];
}

// Where to mine for an Acquire target: a Fortified or Stronghold system of your power with something to mine. Acquisition
// works in two places: you mine in a system your power already holds, and sell in the Unoccupied system you are acquiring.
export interface MiningSource {
  id64: number;
  name: string;
  distance: number;     // ly from the system you would sell in
  powerState: string | null;
  powers: string[];
  bodies: BodyRow[];    // landable planets matching the planetary filters
  miningBodies: number;
  unknownBodies: number;
  rings: RingRow[];     // rings with hotspots matching the ring filters
}

export interface ResultRow {
  id64: number;
  name: string;
  distance: number;
  controllingPower: string | null;
  powerState: string | null;
  contested: boolean;       // Unoccupied, with two or more powers competing for it (worked out: see contested.ts)
  powers: string[];         // every power with a presence in the system, controller first
  stations: StationRow[];   // best price first
  sellable: SellableRow[];  // every minable commodity any of the stations pays for, best price first
  bodies: BodyRow[];        // landable planets matching the planetary filters
  miningBodies: number;     // planets with known mining signals
  unknownBodies: number;    // planets with no signal data
  rings: RingRow[];         // rings with hotspots matching the ring filters
  sources: MiningSource[];  // acquire only: your power's systems to mine in for this one to sell in, nearest first
}

export interface SearchResult {
  ref: { name: string; x: number; y: number; z: number } | null;
  rows: ResultRow[];
  truncated: boolean;
  partial: boolean; // the time budget ran out before every candidate was looked at: results may be missing or not the best
}

interface BodyDbRow {
  body_id: number; name: string; subtype: string | null; volcanism: string | null; body_class: BodyClass | null;
  gravity: number | null; distance_ls: number | null; mining_signals: number | null;
}
interface RingDbRow { name: string; type: string | null; reserve: string | null; material: string | null; count: number | null }

const CONTROLLED = ["Exploited", "Fortified", "Stronghold"];

// Best to worst, as the game ranks ring reserves.
const RESERVE_LEVELS = ["Pristine", "Major", "Common", "Low", "Depleted"];

// Build "@t0,@t1,..." placeholders for an IN list, adding the values to bind.
function inList(prefix: string, values: string[], bind: Record<string, unknown>): string {
  return values
    .map((v, i) => {
      bind[prefix + i] = v;
      return "@" + prefix + i;
    })
    .join(",");
}

// Spansh lists the powers present in a system; put the controlling power first.
function orderPowers(json: string | null, controller: string | null): string[] {
  let list: string[] = [];
  try {
    list = json ? (JSON.parse(json) as string[]) : [];
  } catch {
    // ignore malformed value
  }
  return controller ? [controller, ...list.filter((x) => x !== controller)] : list;
}

function bodyClassesFor(materials: string[]): BodyClass[] {
  const classes = new Set<BodyClass>();
  for (const e of MATERIALS) {
    if (materials.includes(e.material)) for (const c of Object.keys(e.likelihood) as BodyClass[]) classes.add(c);
  }
  return [...classes];
}

let metaCache: { key: string; value: ReturnType<typeof metaWith> } | null = null;

// Everything here is constant for a given database file, so compute it once per build, not per page load.
export type SearchInfo = ReturnType<typeof meta>;

export function meta() {
  const key = dbKey();
  if (metaCache?.key !== key) metaCache = { key, value: withDb(metaWith) };
  return metaCache.value;
}

function metaWith(db: Database.Database) {
  const get = (k: string) => (db.prepare("SELECT value FROM meta WHERE key=?").get(k) as { value: string } | undefined)?.value ?? null;
  // The ring materials this database can find. Those with hotspots are found by their hotspots. The rest (Gold, Water...)
  // only by ring type, which needs every ring stored (a database that holds only the rings with hotspots cannot).
  const withHotspots = new Set((db.prepare("SELECT DISTINCT material m FROM ring_hotspots").all() as { m: string }[]).map((r) => r.m));
  const allRings = !!db.prepare("SELECT 1 FROM rings r WHERE NOT EXISTS (SELECT 1 FROM ring_hotspots h WHERE h.system_id64 = r.system_id64 AND h.ring_name = r.name) LIMIT 1").get();
  const ringMaterials = RING_MATERIAL_NAMES.filter((m) => (hasHotspots(m) ? withHotspots.has(m) : allRings));
  // Stored at ingest (scanning the market table for it takes seconds).
  const commodities = JSON.parse(get("commodities") ?? "[]") as string[];
  return {
    builtAt: get("built_at"),
    systemCount: (db.prepare("SELECT COUNT(*) n FROM systems").get() as { n: number }).n,
    powers: (db.prepare("SELECT DISTINCT controlling_power p FROM systems WHERE controlling_power IS NOT NULL ORDER BY 1").all() as { p: string }[]).map((r) => r.p),
    commodities,
    ringMaterials,
    allRings,
    reserves: RESERVE_LEVELS,
  };
}

// Which commodities count as "what you sell": chosen chips win, else the materials you picked to mine, else any (null). The planetary method can only
// yield its survey materials.
function effectiveCommodities(p: Pick<SearchParams, "commodity" | "material" | "method">): string[] | null {
  let list: string[] | null = p.commodity.length ? p.commodity : p.material.length ? p.material : null;
  if (p.method === "planetary") list = (list ?? PLANETARY_MATERIALS).filter((c) => PLANETARY_MATERIALS.includes(c));
  return list;
}

export interface SearchOptions {
  budgetMs?: number; // how long to spend reading candidate systems (default from MERITFINDER_SEARCH_BUDGET_MS)
  // Whether a system must have something to mine to be listed (default yes: merits are earned by selling where you mine). Not
  // exposed in the page; it lets the market filters be tested on their own, and suits a mode that is not about mining.
  requireMining?: boolean;
}

export function search(p: SearchParams, { budgetMs = getConfig().searchBudgetMs, requireMining = true }: SearchOptions = {}): SearchResult {
  return withDb((db) => searchWith(db, p, budgetMs, requireMining));
}

interface Candidate {
  id64: number; name: string; cp: string | null; ps: string | null; pw: string | null; cf: string | null;
  x: number; y: number; z: number;
  dist: number;
  bound: number; // highest price any station here could pay: ranks systems without reading markets
}
interface StationDbRow {
  tid: number; station: string; stype: string | null; sls: number | null; hl: number; hm: number; mu: string | null;
}

function searchWith(db: Database.Database, p: SearchParams, budgetMs: number, requireMining: boolean): SearchResult {
  const ref = db
    .prepare(REF_SYSTEM)
    .get(p.ref) as { name: string; x: number; y: number; z: number } | undefined;
  if (!ref) return { ref: null, rows: [], truncated: false, partial: false };
  const none: SearchResult = { ref, rows: [], truncated: false, partial: false };

  const commodities = effectiveCommodities(p);
  if (commodities && commodities.length === 0) return none;
  if ((p.goal === "reinforce" || p.goal === "acquire") && !p.power) return none; // both are about your power's systems

  // Stage 1: candidate systems from system and station columns only, one row per system, so no market rows are read (40 million of them).
  const sysWhere: string[] = [];
  const stWhere: string[] = ["t.best_price >= MAX(@minPrice, 1)"];
  const bind: Record<string, unknown> = {
    minPrice: p.minPrice, x: ref.x, y: ref.y, z: ref.z, r2: p.range * p.range, range: p.range,
  };
  sysWhere.push("(s.x-@x)*(s.x-@x)+(s.y-@y)*(s.y-@y)+(s.z-@z)*(s.z-@z) <= @r2");
  sysWhere.push("s.x BETWEEN @x-@range AND @x+@range", "s.y BETWEEN @y-@range AND @y+@range", "s.z BETWEEN @z-@range AND @z+@range");

  if (p.goal === "undermine") {
    sysWhere.push(`s.power_state IN ('${CONTROLLED.join("','")}')`);
    if (p.power) sysWhere.push("s.controlling_power <> @power");
    if (p.target.length) sysWhere.push(`s.controlling_power IN (${inList("t", p.target, bind)})`);
  } else if (p.goal === "reinforce") {
    sysWhere.push(`s.power_state IN ('${CONTROLLED.join("','")}')`, "s.controlling_power = @power");
  } else if (p.goal === "acquire") {
    sysWhere.push("s.power_state = 'Unoccupied'");
  }
  if (p.power) bind.power = p.power;

  if (p.pad === "L") stWhere.push("t.has_large = 1");
  if (p.pad === "M") stWhere.push("(t.has_large = 1 OR t.has_medium = 1)");
  if (p.maxStationLs > 0) { stWhere.push("t.distance_ls <= @maxLs"); bind.maxLs = p.maxStationLs; }
  if (p.maxAgeDays > 0) {
    stWhere.push("t.market_updated >= @cutoff");
    bind.cutoff = new Date(Date.now() - p.maxAgeDays * 86400_000).toISOString();
  }

  // Price: best possible price first (a true upper bound on any filtered price). Distance: exact.
  const order = p.sort === "price" ? "bound DESC, dist ASC" : "dist ASC";
  const candidates = db
    .prepare(
      `SELECT s.id64, s.name, s.controlling_power cp, s.power_state ps, s.powers pw, s.conflict cf, s.x, s.y, s.z,
              MAX(t.best_price) bound,
              sqrt((s.x-@x)*(s.x-@x)+(s.y-@y)*(s.y-@y)+(s.z-@z)*(s.z-@z)) dist
       FROM systems s JOIN stations t ON t.system_id64 = s.id64
       WHERE ${[...sysWhere, ...stWhere].join(" AND ")}
       GROUP BY s.id64 ORDER BY ${order}`,
    )
    .all(bind) as Candidate[];
  const stationsStmt = db.prepare(
    `SELECT t.id tid, t.name station, t.type stype, t.distance_ls sls, t.has_large hl, t.has_medium hm, t.market_updated mu
     FROM stations t WHERE t.system_id64 = @sid AND ${stWhere.join(" AND ")}`,
  );

  // Stage 2: look at candidates in that order, reading each station's market only for systems we
  // actually consider, and stop as soon as nothing left can enter the top `limit`.
  const mBind: Record<string, unknown> = { minPrice: p.minPrice, minDemand: p.minDemand };
  const cWhere = commodities ? `AND commodity IN (${inList("c", commodities, mBind)})` : "";
  const bestRow = db.prepare(
    `SELECT commodity, sell_price price, demand FROM market
     WHERE station_id = @tid AND sell_price >= @minPrice AND demand >= @minDemand ${cWhere}
     ORDER BY sell_price DESC LIMIT 1`,
  );
  // Every commodity a station pays for that can be mined, best first (the headline sale above is whatever pays most, mineable or not).
  const sellableNames = commodities ? commodities.filter((c) => MINABLE_MATERIALS.includes(c)) : MINABLE_MATERIALS;
  // Every one a station pays for, whatever the minimum price and demand: those below it are shown too, dimmed, with their real price.
  const tBind: Record<string, unknown> = {};
  const topRows = sellableNames.length
    ? db.prepare(
        `SELECT commodity, sell_price price, demand FROM market
         WHERE station_id = @tid AND commodity IN (${inList("m", sellableNames, tBind)})
         ORDER BY sell_price DESC`,
      )
    : null;
  const mining = miningFilter(db, p, requireMining);
  const sourcesNear = p.goal === "acquire" ? sourceFinder(db, p) : null; // acquire: what you sell in and what you mine in are different systems

  // Heavy filters can leave a very large number of candidates to read, one at a time, on a thread that serves every
  // request. Stop when the budget is spent and say so, rather than stall the server.
  const deadline = performance.now() + budgetMs;
  let partial = false;
  const results: ResultRow[] = [];
  const kth = () => results[p.limit]?.stations[0].sellPrice; // (limit+1)th best actual price so far
  for (const c of candidates) {
    if (results.length > p.limit) {
      if (p.sort === "distance") break;
      if (c.bound <= (kth() ?? Infinity)) break; // nothing remaining can beat what we have
    }
    if (performance.now() > deadline) {
      partial = true;
      break;
    }
    const found: { station: StationRow; tid: number }[] = [];
    for (const t of stationsStmt.all({ ...bind, sid: c.id64 }) as StationDbRow[]) {
      const m = bestRow.get({ ...mBind, tid: t.tid }) as { commodity: string; price: number; demand: number } | undefined;
      if (m) {
        found.push({
          tid: t.tid,
          station: {
            name: t.station, commodity: m.commodity, type: t.stype, distanceLs: t.sls, pad: t.hl ? "L" : t.hm ? "M" : "S",
            sellPrice: m.price, demand: m.demand, marketUpdated: t.mu, top: [],
          },
        });
      }
    }
    if (!found.length) continue;
    found.sort((a, b) => b.station.sellPrice - a.station.sellPrice);
    const stations = found.map((f) => f.station);

    const sys: ResultRow = {
      id64: c.id64, name: c.name, distance: c.dist, controllingPower: c.cp, powerState: c.ps, contested: isContested(c.ps, c.cf),
      powers: orderPowers(c.pw, c.cp),
      stations, sellable: [], bodies: [], miningBodies: 0, unknownBodies: 0, rings: [], sources: [],
    };
    if (sourcesNear) {
      sys.sources = sourcesNear(c); // nowhere of yours to mine within reach: not a target
      if (!sys.sources.length) continue;
    } else if (!mining(sys)) continue;
    // Only systems that are listed: the extra market reads are for what is shown, not for every candidate.
    if (topRows) {
      for (const f of found) {
        f.station.top = (topRows.all({ ...tBind, tid: f.tid }) as { commodity: string; price: number; demand: number }[]).map((r) => ({
          commodity: r.commodity, sellPrice: r.price, demand: r.demand, meets: r.price >= p.minPrice && r.demand >= p.minDemand,
        }));
      }
    }
    sys.sellable = topSellable(stations);
    annotate(sys, p.method);
    // Selling where you mine: when what can be mined here is known, a system is listed only if something it pays for (at the chosen price and
    // demand) can be yielded by one of the rings or planets shown, and what it is listed for is that. A market full of Monazite beside
    // nothing but icy bodies is not a place to earn from Monazite. (Not applied when only non-minable commodities were asked for.)
    if (requireMining && topRows) {
      const carried = new Set(sys.sellable.filter((s) => s.meets && s.places > 0).map((s) => s.commodity));
      if (carried.size === 0) continue;
      sys.stations = sys.stations
        .map((st) => {
          const best = st.top.find((t) => t.meets && carried.has(t.commodity));
          return best ? { ...st, commodity: best.commodity, sellPrice: best.sellPrice, demand: best.demand } : null;
        })
        .filter((st): st is StationRow => st !== null)
        .sort((a, b) => b.sellPrice - a.sellPrice);
      sys.sources = sys.sources.filter((s) => [...s.rings, ...s.bodies].some((x) => x.carries.some((c) => carried.has(c.material))));
    }
    results.push(sys);
    if (p.sort === "price") results.sort((a, b) => b.stations[0].sellPrice - a.stations[0].sellPrice || a.distance - b.distance);
  }

  return { ref, rows: results.slice(0, p.limit), truncated: results.length > p.limit, partial };
}

// The minable commodities across a system's stations: one entry per commodity, at the station that pays most for it.
function topSellable(stations: StationRow[]): SellableRow[] {
  // For each commodity: the best price that meets the minimum if any station's does, else the best price at all.
  const best = new Map<string, SellableRow>();
  for (const station of stations) {
    for (const r of station.top) {
      const row: SellableRow = { commodity: r.commodity, sellPrice: r.sellPrice, demand: r.demand, station: station.name, meets: r.meets, places: 0, ringPlaces: 0, planetPlaces: 0 };
      const have = best.get(r.commodity);
      if (!have || (r.meets && !have.meets) || (r.meets === have.meets && r.sellPrice > have.sellPrice)) best.set(r.commodity, row);
    }
  }
  // Those that meet the minimum first: they are what the rings and planets are matched and ranked against.
  return [...best.values()].sort((a, b) => Number(b.meets) - Number(a.meets) || b.sellPrice - a.sellPrice || b.demand - a.demand);
}

// Marks which rings and planets carry what the system's stations buy, counts the places for each, and puts the relevant ones first (the
// page shows only the first few). Acquire's rings and planets are in the mining systems, which are shared between rows, so they are copied.
function annotate(sys: ResultRow, method: MiningMethod): void {
  const wanted = sys.sellable.map((s) => s.commodity);
  const technique = isRingMethod(method) ? method : "any";
  const rank = (carried: { material: string }[]) => (carried.length ? Math.min(...carried.map((c) => wanted.indexOf(c.material))) : wanted.length);

  const ring = (r: RingRow): RingRow => ({
    ...r,
    carries: wanted.flatMap((material) => {
      const spot = r.hotspots.find((h) => h.material === material);
      if (spot) return [{ material, hotspots: spot.count }];
      return yieldsFrom(technique, material, r.type) ? [{ material, hotspots: null }] : [];
    }),
  });
  const body = (b: BodyRow): BodyRow => ({
    ...b,
    carries: wanted.flatMap((material) => {
      const percent = b.bodyClass ? likelihoodFor(material, b.bodyClass) : null;
      return percent === null ? [] : [{ material, percent }];
    }),
  });
  const rings = (list: RingRow[]) => list.map(ring).sort((a, b) => rank(a.carries) - rank(b.carries));
  const bodies = (list: BodyRow[]) => list.map(body).sort((a, b) => rank(a.carries) - rank(b.carries));

  sys.rings = rings(sys.rings);
  sys.bodies = bodies(sys.bodies);
  sys.sources = sys.sources.map((s) => ({ ...s, rings: rings(s.rings), bodies: bodies(s.bodies) }));

  for (const s of sys.sellable) {
    const here = (c: { carries: { material: string }[] }) => c.carries.some((x) => x.material === s.commodity);
    s.ringPlaces = [...sys.rings, ...sys.sources.flatMap((x) => x.rings)].filter(here).length;
    s.planetPlaces = [...sys.bodies, ...sys.sources.flatMap((x) => x.bodies)].filter(here).length;
    s.places = s.ringPlaces + s.planetPlaces;
  }
}

// For Acquire: given a system to sell in, the nearest Fortified systems of your power within 20 ly of it, or Stronghold systems
// within 30 ly (ACQUISITION_RANGE_LY), that have something to mine (by the chosen method and material). Your power's systems are read once; there are a few hundred.
const MAX_SOURCES = 8; // found; the page shows the first few and folds the rest
const MAX_SOURCES_CHECKED = 25;
function sourceFinder(db: Database.Database, p: SearchParams): (from: { x: number; y: number; z: number }) => MiningSource[] {
  const yours = db
    .prepare("SELECT id64, name, x, y, z, controlling_power cp, power_state ps, powers pw FROM systems WHERE controlling_power = ? AND power_state IN ('Fortified', 'Stronghold')")
    .all(p.power) as { id64: number; name: string; x: number; y: number; z: number; cp: string; ps: string; pw: string | null }[];
  const mining = miningFilter(db, p, true); // a place to mine must have something to mine

  // What there is to mine in each of your systems does not depend on where you sell, so it is worked out once for each.
  const mined = new Map<number, Omit<MiningSource, "distance"> | null>();
  const minedAt = (s: (typeof yours)[number]) => {
    if (!mined.has(s.id64)) {
      const row: ResultRow = {
        id64: s.id64, name: s.name, distance: 0, controllingPower: s.cp, powerState: s.ps, contested: false, powers: orderPowers(s.pw, s.cp),
        stations: [], sellable: [], bodies: [], miningBodies: 0, unknownBodies: 0, rings: [], sources: [],
      };
      mined.set(
        s.id64,
        mining(row) ? { id64: row.id64, name: row.name, powerState: row.powerState, powers: row.powers, bodies: row.bodies, miningBodies: row.miningBodies, unknownBodies: row.unknownBodies, rings: row.rings } : null,
      );
    }
    return mined.get(s.id64)!;
  };

  return (from) => {
    const near = yours
      .map((s) => ({ s, d: Math.hypot(s.x - from.x, s.y - from.y, s.z - from.z) }))
      .filter((c) => c.d <= (ACQUISITION_RANGE_LY[c.s.ps as keyof typeof ACQUISITION_RANGE_LY] ?? 0))
      .sort((a, b) => a.d - b.d)
      .slice(0, MAX_SOURCES_CHECKED);
    const found: MiningSource[] = [];
    for (const { s, d } of near) {
      if (found.length >= MAX_SOURCES) break;
      const here = minedAt(s);
      if (here) found.push({ ...here, distance: d });
    }
    return found;
  };
}

// Fills in sys.rings / bodies / miningBodies / unknownBodies and says whether the system satisfies the mining method. Ring and planetary matches are computed
// independently; the method decides which one the system must satisfy.
function miningFilter(db: Database.Database, p: SearchParams, requireMining: boolean): (sys: ResultRow) => boolean {
  const classes = bodyClassesFor(p.material);
  const wantMaterial = p.material.length > 0;
  const bodyStmt = db.prepare(BODIES_OF_SYSTEM);
  const ringStmt = db.prepare(RINGS_OF_SYSTEM);

  return (sys) => {
    // With no mining requirement there is nothing to look up before deciding; still fill the display fields.
    const ringMap = new Map<string, RingRow>();
    for (const h of ringStmt.all(sys.id64) as RingDbRow[]) {
      let ring = ringMap.get(h.name);
      if (!ring) ringMap.set(h.name, (ring = { name: h.name, type: h.type, reserve: h.reserve, hotspots: [], carries: [] }));
      if (h.material) ring.hotspots.push({ material: h.material, count: h.count });
    }
    const technique = isRingMethod(p.method) ? p.method : "any";
    const ringsMatching = [...ringMap.values()]
      .filter((r) => !p.ringTypes.length || (r.type != null && p.ringTypes.includes(r.type)))
      .filter((r) => !p.reserve.length || (r.reserve != null && p.reserve.includes(r.reserve)))
      .map((r) => {
        const located = r.hotspots
          .filter((h) => !isRingMethod(p.method) || yieldsFrom(p.method, h.material, r.type)) // the technique can extract it from this ring
          .filter((h) => !wantMaterial || p.material.includes(h.material));
        // A wanted material can be in any ring of a type the technique can extract it from, not only at a hotspot: a ring with no
        // recorded hotspot for it is listed without a count.
        const found = new Set(located.map((h) => h.material));
        const unlocated = p.material.filter((m) => !found.has(m) && yieldsFrom(technique, m, r.type)).map((m) => ({ material: m, count: null }));
        return { ...r, hotspots: [...located, ...unlocated] };
      })
      .filter((r) => r.hotspots.length > 0);

    const all = (bodyStmt.all(sys.id64) as BodyDbRow[]).map<BodyRow>((b) => ({
      bodyId: b.body_id, name: b.name, subtype: b.subtype, volcanism: b.volcanism, bodyClass: b.body_class,
      gravity: b.gravity, distanceLs: b.distance_ls, miningSignals: b.mining_signals, carries: [],
    }));
    // A wanted material the planetary method can't yield (e.g. a ring-only material) matches no planet.
    const planetsMatching = all.filter((b) => {
      if (wantMaterial && !classes.length) return false;
      if (classes.length && !(b.bodyClass && classes.includes(b.bodyClass))) return false;
      if (p.mining === "known") return (b.miningSignals ?? 0) > 0;
      if (p.mining === "possible") return b.miningSignals === null || b.miningSignals > 0;
      return true;
    });

    let ok: boolean;
    if (!requireMining) ok = true;
    else if (isRingMethod(p.method)) ok = ringsMatching.length > 0;
    else if (p.method === "planetary") ok = planetsMatching.length > 0;
    else ok = ringsMatching.length > 0 || planetsMatching.length > 0; // any: a system with at least something to mine
    if (!ok) return false;

    const minesRings = p.method === "any" || isRingMethod(p.method);
    const minesPlanets = p.method === "any" || p.method === "planetary";
    sys.rings = minesRings ? ringsMatching : [];
    sys.bodies = minesPlanets ? planetsMatching : [];
    sys.miningBodies = all.filter((b) => (b.miningSignals ?? 0) > 0).length;
    sys.unknownBodies = all.filter((b) => b.miningSignals === null).length;
    return true;
  };
}
