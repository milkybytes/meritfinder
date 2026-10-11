import fs from "node:fs";

import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildFixtureDb } from "../../test/galaxy";

import { applyUpdates } from "./apply";
import type { MarketUpdate, SignalsUpdate, SystemUpdate } from "./messages";

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
  kind: "system", id64: 2, at: FRESH, controllingPower: "Yuri Grom", powerState: "Stronghold", powers: ["Yuri Grom"], controlProgress: 0.4,
  reinforcement: 10, undermining: 20, conflict: [{ power: "Edmund Mahon", progress: 0.1 }], factionState: "War", ...over,
});
const signals = (over: Partial<SignalsUpdate> = {}): SignalsUpdate => ({ kind: "signals", id64: 2, bodyId: 3, miningSignals: 9, ...over });
const rows = (sql: string, ...args: unknown[]) => db.prepare(sql).all(...args) as Record<string, unknown>[];

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
    expect(rows("SELECT controlling_power, power_state, control_progress, reinforcement, undermining, faction_state, updated_at FROM systems WHERE id64 = 2")).toEqual([
      { controlling_power: "Yuri Grom", power_state: "Stronghold", control_progress: 0.4, reinforcement: 10, undermining: 20, faction_state: "War", updated_at: FRESH },
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
