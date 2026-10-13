import fs from "node:fs";

import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildFixtureDb } from "../../test/galaxy";

import { applyUpdates, pruneStaleMarkets, repairLiveData } from "./apply";
import type { BodyUpdate, HotspotsUpdate, MarketUpdate, SignalsUpdate, StationUpdate, SystemUpdate } from "./messages";

// The fixture galaxy: Alpha Hub (market 20, Monazite 500,000 / Gold 9,000), Alpha (system 2), and its planets (body 2 with
// 12 signals, body 3 with no signal data). Every test gets its own copy, since each one changes it.
let built: { file: string; dir: string };
let db: Database.Database;
beforeEach(() => {
  built = buildFixtureDb();
  process.env.MERITFINDER_DB = built.file;
  db = new Database(built.file);
});
afterEach(() => {
  db.close();
  fs.rmSync(built.dir, { recursive: true, force: true });
});

const FRESH = new Date(Date.now() + 3600_000).toISOString(); // newer than anything in the fixture
const market = (over: Partial<MarketUpdate> = {}): MarketUpdate => ({
  kind: "market", marketId: 20, at: FRESH, commodities: [{ name: "Monazite", price: 800_000, demand: 50 }], ...over,
});
const system = (over: Partial<SystemUpdate> = {}): SystemUpdate => ({
  kind: "system", id64: 2, at: FRESH, name: null, pos: null, powerplay: true, controllingPower: "Yuri Grom", powerState: "Stronghold", powers: ["Yuri Grom"], controlProgress: 0.4,
  reinforcement: 10, undermining: 20, conflict: [{ power: "Edmund Mahon", progress: 0.1 }], ...over,
});
const signals = (over: Partial<SignalsUpdate> = {}): SignalsUpdate => ({ kind: "signals", id64: 2, bodyId: 3, at: FRESH, miningSignals: 9, ...over });
const station = (over: Partial<StationUpdate> = {}): StationUpdate => ({
  kind: "station", at: FRESH, marketId: 777, id64: 7000, systemName: "Newly Found", pos: [1, 2, 3], name: "Fresh Port", type: "Coriolis Starport",
  distanceLs: 500, large: true, medium: true, ...over,
});
const body = (over: Partial<BodyUpdate> = {}): BodyUpdate => ({
  kind: "body", at: FRESH, id64: 7000, bodyId: 5, name: "Newly Found 5", landable: false, subtype: null, volcanism: "No volcanism", gravity: null,
  distanceLs: 100, bodyClass: null, reserve: "Pristine", rings: [{ name: "Newly Found 5 A Ring", type: "Rocky" }], ...over,
});
const hotspots = (over: Partial<HotspotsUpdate> = {}): HotspotsUpdate => ({
  kind: "hotspots", at: FRESH, id64: 7000, ringName: "Newly Found 5 A Ring", hotspots: [{ material: "Platinum", count: 2 }], ...over,
});
const rows = (sql: string, ...args: unknown[]) => db.prepare(sql).all(...args) as Record<string, unknown>[];

describe("markets: a name made from a symbol", () => {
  it("is stored with the market but does not join the commodity menu, so the real name replaces it cleanly", () => {
    applyUpdates(db, [market({ commodities: [{ name: "Monazite", price: 1, demand: 1 }, { name: "Newthing", price: 5, demand: 2, provisional: true }, { name: "Brandnew", price: 6, demand: 2 }] })]);
    expect(rows("SELECT commodity FROM market WHERE station_id = 20 ORDER BY commodity").map((r) => r.commodity)).toEqual(["Brandnew", "Monazite", "Newthing"]);
    const list = JSON.parse((rows("SELECT value FROM meta WHERE key = 'commodities'")[0] as { value: string }).value) as string[];
    expect(list).toContain("Brandnew");
    expect(list).not.toContain("Newthing");
  });
});

describe("markets", () => {
  it("replaces a station's market, with its new best price and time", () => {
    const stats = applyUpdates(db, [market({ commodities: [{ name: "Monazite", price: 800_000, demand: 50 }, { name: "Platinum", price: 10, demand: 1 }] })]);
    expect(stats.markets).toBe(1);
    expect(rows("SELECT commodity, sell_price, demand FROM market WHERE station_id = 20 ORDER BY commodity")).toEqual([
      { commodity: "Monazite", sell_price: 800_000, demand: 50 },
      { commodity: "Platinum", sell_price: 10, demand: 1 },
    ]); // Gold and Void Opal, there before, are gone: the station no longer buys them
    expect(rows("SELECT market_updated, best_price FROM stations WHERE id = 20")).toEqual([{ market_updated: FRESH, best_price: 800_000 }]);
  });

  it("ignores a station that is not in the database", () => {
    const stats = applyUpdates(db, [market({ marketId: 999_999 })]);
    expect(stats).toMatchObject({ markets: 0, marketsIgnored: 1 });
    expect(rows("SELECT * FROM stations WHERE id = 999999")).toEqual([]);
    expect(rows("SELECT * FROM market WHERE station_id = 999999")).toEqual([]);
  });

  it("never lets an older observation replace a newer one", () => {
    applyUpdates(db, [market({ marketId: 30, at: "2026-10-01T00:00:00Z", commodities: [{ name: "Gold", price: 111, demand: 1 }] })]);
    const stats = applyUpdates(db, [
      market({ marketId: 30, at: "2026-09-01T00:00:00Z", commodities: [{ name: "Gold", price: 222, demand: 2 }] }), // older
      market({ marketId: 30, at: "2026-10-01T00:00:00Z", commodities: [{ name: "Gold", price: 333, demand: 3 }] }), // same moment
    ]);
    expect(stats).toMatchObject({ markets: 0, marketsIgnored: 2 });
    expect(rows("SELECT sell_price FROM market WHERE station_id = 30")).toEqual([{ sell_price: 111 }]);
  });

});

describe("Powerplay state", () => {
  it("replaces the system's state", () => {
    const stats = applyUpdates(db, [system()]);
    expect(stats.systems).toBe(1);
    expect(rows("SELECT controlling_power, power_state, control_progress, reinforcement, undermining, updated_at FROM systems WHERE id64 = 2")).toEqual([
      { controlling_power: "Yuri Grom", power_state: "Stronghold", control_progress: 0.4, reinforcement: 10, undermining: 20, updated_at: FRESH },
    ]);
    expect(JSON.parse(rows("SELECT powers FROM systems WHERE id64 = 2")[0].powers as string)).toEqual(["Yuri Grom"]);
    expect(JSON.parse(rows("SELECT conflict FROM systems WHERE id64 = 2")[0].conflict as string)).toEqual([{ power: "Edmund Mahon", progress: 0.1 }]);
  });

  it("ignores a system that is not in the database, and an older observation", () => {
    applyUpdates(db, [system()]); // the system now has an observation, from FRESH
    const stats = applyUpdates(db, [system({ id64: 424242 }), system({ at: "2020-01-01T00:00:00Z", controllingPower: "Nobody" })]);
    expect(stats).toMatchObject({ systems: 0, systemsIgnored: 2 });
    expect(rows("SELECT controlling_power FROM systems WHERE id64 = 2")).toEqual([{ controlling_power: "Yuri Grom" }]);
  });
});

describe("planetary mining signals", () => {
  it("turns an unknown planet into a known one", () => {
    expect(rows("SELECT mining_signals FROM bodies WHERE system_id64 = 2 AND body_id = 3")).toEqual([{ mining_signals: null }]);
    expect(applyUpdates(db, [signals()]).signals).toBe(1);
    expect(rows("SELECT mining_signals FROM bodies WHERE system_id64 = 2 AND body_id = 3")).toEqual([{ mining_signals: 9 }]);
  });

});

describe("a batch", () => {
  it("is all or nothing, and says when it was applied", () => {
    const before = rows("SELECT COUNT(*) n FROM market")[0].n;
    expect(() => applyUpdates(db, [market({ commodities: [{ name: "Gold", price: 1, demand: 1 }, { name: "Gold", price: 2, demand: 2 }] })])).toThrow(); // a repeated commodity violates the key
    expect(rows("SELECT COUNT(*) n FROM market")[0].n).toBe(before); // the station's old rows were not lost with the failed write
    applyUpdates(db, [signals()]);
    expect(rows("SELECT value FROM meta WHERE key = 'eddn_updated'")).toHaveLength(1);
  });
});

describe("what a feed alone can build", () => {
  it("adds a system, its station, a ringed planet and the ring's hotspots, whatever order they arrive in", () => {
    const stats = applyUpdates(db, [hotspots(), market({ marketId: 777, commodities: [{ name: "Platinum", price: 900, demand: 5 }] }), body(), station()]);
    expect(stats).toMatchObject({ stations: 1, bodies: 1, hotspots: 1, markets: 1 });
    expect(rows("SELECT name, x, y, z FROM systems WHERE id64 = 7000")).toEqual([{ name: "Newly Found", x: 1, y: 2, z: 3 }]);
    expect(rows("SELECT name, type, has_large, best_price FROM stations WHERE id = 777")).toEqual([{ name: "Fresh Port", type: "Coriolis Starport", has_large: 1, best_price: 900 }]);
    expect(rows("SELECT name, type, reserve, hotspots_at FROM rings WHERE system_id64 = 7000")).toEqual([
      { name: "Newly Found 5 A Ring", type: "Rocky", reserve: "Pristine", hotspots_at: FRESH },
    ]);
    expect(rows("SELECT material, count FROM ring_hotspots WHERE system_id64 = 7000")).toEqual([{ material: "Platinum", count: 2 }]);
  });

  it("adds a landable planet without losing a gravity or distance it already had when a later scan lacks them", () => {
    applyUpdates(db, [station(), body({ landable: true, subtype: "Rocky body", gravity: 0.3, rings: [] })]);
    applyUpdates(db, [body({ landable: true, subtype: "Rocky body", gravity: null, distanceLs: null, rings: [] })]);
    expect(rows("SELECT gravity, distance_ls FROM bodies WHERE system_id64 = 7000 AND body_id = 5")).toEqual([{ gravity: 0.3, distance_ls: 100 }]);
  });

  it("ignores planets of systems nobody has been to, and a ring scan older than the stored one", () => {
    expect(applyUpdates(db, [body({ id64: 123456789 })])).toMatchObject({ bodies: 0, bodiesIgnored: 1 });
    applyUpdates(db, [station(), body(), hotspots({ at: "2026-10-01T00:00:00Z" })]);
    const stats = applyUpdates(db, [hotspots({ at: "2026-09-01T00:00:00Z", hotspots: [{ material: "Painite", count: 9 }] })]);
    expect(stats).toMatchObject({ hotspots: 0, hotspotsIgnored: 1 });
    expect(rows("SELECT material FROM ring_hotspots WHERE system_id64 = 7000")).toEqual([{ material: "Platinum" }]);
  });

  it("adds a system from a jump without touching its state", () => {
    const stats = applyUpdates(db, [system({ id64: 7001, name: "Quiet Place", pos: [4, 5, 6], powerplay: false })]);
    expect(stats.systems).toBe(1);
    expect(rows("SELECT name, controlling_power, updated_at FROM systems WHERE id64 = 7001")).toEqual([{ name: "Quiet Place", controlling_power: null, updated_at: null }]);
  });
});

describe("what a later message must not take away", () => {
  it("keeps a station's pads when a docking does not report them, and takes them when it does", () => {
    applyUpdates(db, [station({ large: true, medium: true })]);
    applyUpdates(db, [station({ large: null, medium: null, name: "Fresh Port II" })]);
    expect(rows("SELECT name, has_large, has_medium FROM stations WHERE id = 777")).toEqual([{ name: "Fresh Port II", has_large: 1, has_medium: 1 }]);
    applyUpdates(db, [station({ large: false, medium: true })]);
    expect(rows("SELECT has_large, has_medium FROM stations WHERE id = 777")).toEqual([{ has_large: 0, has_medium: 1 }]);
  });

  it("adds a ring from its surface scan when the system is known but its planet was never scanned here, and learns its type later", () => {
    applyUpdates(db, [station(), hotspots()]);
    expect(rows("SELECT name, type FROM rings WHERE system_id64 = 7000")).toEqual([{ name: "Newly Found 5 A Ring", type: null }]);
    applyUpdates(db, [body()]);
    expect(rows("SELECT type, hotspots_at FROM rings WHERE system_id64 = 7000")).toEqual([{ type: "Rocky", hotspots_at: FRESH }]);
  });

  it("does not add a ring in a system it has never seen", () => {
    expect(applyUpdates(db, [hotspots({ id64: 123456789 })])).toMatchObject({ hotspots: 0, hotspotsIgnored: 1 });
  });
});

describe("pruneStaleMarkets", () => {
  it("drops markets past the cutoff and the best price with them, and leaves fresh ones and the station alone", () => {
    db.prepare("UPDATE stations SET market_updated = '2025-01-01T00:00:00Z' WHERE id = 20").run();
    const n = pruneStaleMarkets(db, "2025-06-01T00:00:00Z");
    expect(n).toBeGreaterThanOrEqual(1);
    expect(rows("SELECT market_updated, best_price FROM stations WHERE id = 20")).toEqual([{ market_updated: null, best_price: null }]);
    expect(rows("SELECT * FROM market WHERE station_id = 20")).toEqual([]);
    expect(rows("SELECT COUNT(*) AS n FROM market WHERE station_id <> 20")[0].n).toBeGreaterThan(0); // the rest stays
  });
});

describe("repairLiveData", () => {
  it("drops stations named by an unlocalised key and construction depots, and leaves the rest", () => {
    db.prepare("INSERT INTO stations (id, system_id64, name, type, has_large, has_medium) VALUES (900, 2, '$EXT_PANEL_ColonisationShip; X', 'Settlement', 0, 0)").run();
    expect(repairLiveData(db)).toBe(1);
    expect(rows("SELECT id FROM stations WHERE id = 900")).toEqual([]);
    db.prepare("INSERT INTO stations (id, system_id64, name, type, has_large, has_medium, market_updated, best_price) VALUES (901, 2, 'Planetary Construction Site: X', 'Planetary Construction Depot', 1, 1, '2026-10-01T00:00:00Z', 5000)").run();
    db.prepare("INSERT INTO market VALUES (901, 'Steel', 10, 5000)").run();
    expect(repairLiveData(db)).toBe(1);
    expect(rows("SELECT id FROM stations WHERE id = 901")).toEqual([]);
    expect(rows("SELECT * FROM market WHERE station_id = 901")).toEqual([]);
    expect(repairLiveData(db)).toBe(0); // nothing left to do
  });
});

