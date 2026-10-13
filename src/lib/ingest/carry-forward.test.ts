import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { openWritable } from "../db/db";
import { carryForward, carryForwardBlocker } from "./carry-forward";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "meritfinder-carry-"));
const opened: Database.Database[] = [];
afterAll(() => {
  for (const db of opened) if (db.open) db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

const CUTOFF = "2026-01-01T00:00:00Z";
let n = 0;

// A database with one system, one station with a market, one landable body and one ring with a hotspot.
function build(over: { market?: string; marketAt?: string | null; state?: string | null; stateAt?: string | null; signals?: number | null; signalsAt?: string | null; hotspot?: number; hotspotsAt?: string | null }) {
  const file = path.join(dir, `db-${n++}.sqlite`);
  const db = openWritable(file);
  opened.push(db);
  db.prepare("INSERT INTO systems (id64, name, x, y, z, power_state, updated_at) VALUES (1, 'Sol', 0, 0, 0, ?, ?)").run(over.state ?? "Fortified", over.stateAt ?? "2026-05-01T00:00:00Z");
  db.prepare("INSERT INTO stations (id, system_id64, name, type, has_large, has_medium, market_updated, best_price) VALUES (10, 1, 'Hub', 'Coriolis Starport', 1, 1, ?, 100)").run(over.marketAt ?? "2026-05-01T00:00:00Z");
  db.prepare("INSERT INTO market VALUES (10, ?, 5, 100)").run(over.market ?? "Gold");
  db.prepare("INSERT INTO bodies (system_id64, body_id, name, mining_signals, signals_at) VALUES (1, 4, 'Sol 4', ?, ?)").run(over.signals ?? 3, over.signalsAt ?? "2026-05-01T00:00:00Z");
  db.prepare("INSERT INTO rings (system_id64, name, type, hotspots_at) VALUES (1, 'Sol 4 A Ring', 'Rocky', ?)").run(over.hotspotsAt ?? "2026-05-01T00:00:00Z");
  db.prepare("INSERT INTO ring_hotspots VALUES (1, 'Sol 4 A Ring', 'Monazite', ?)").run(over.hotspot ?? 1);
  db.prepare("INSERT INTO commodity_symbols VALUES ('gold', 'Gold')").run();
  return { file, db };
}

function carry(fresh: ReturnType<typeof build>, live: ReturnType<typeof build>) {
  live.db.close();
  const stats = carryForward(fresh.db, live.file, CUTOFF);
  return { stats, q: (sql: string) => fresh.db.prepare(sql).all() as Record<string, unknown>[] };
}

describe("carryForward", () => {
  it("keeps what the live database saw more recently than the dump", () => {
    const fresh = build({});
    const live = build({ market: "Painite", marketAt: "2026-09-01T00:00:00Z", state: "Stronghold", stateAt: "2026-09-01T00:00:00Z", signals: 12, signalsAt: "2026-09-01T00:00:00Z", hotspot: 4, hotspotsAt: "2026-09-01T00:00:00Z" });
    const { q } = carry(fresh, live);
    expect(q("SELECT commodity FROM market")).toEqual([{ commodity: "Painite" }]);
    expect(q("SELECT power_state FROM systems")).toEqual([{ power_state: "Stronghold" }]);
    expect(q("SELECT mining_signals FROM bodies")).toEqual([{ mining_signals: 12 }]);
    expect(q("SELECT count FROM ring_hotspots")).toEqual([{ count: 4 }]);
  });

  it("never replaces what the dump saw more recently with older live data", () => {
    const fresh = build({ market: "Painite", marketAt: "2026-09-01T00:00:00Z", state: "Stronghold", stateAt: "2026-09-01T00:00:00Z", signals: 12, signalsAt: "2026-09-01T00:00:00Z", hotspot: 4, hotspotsAt: "2026-09-01T00:00:00Z" });
    const live = build({});
    const { q } = carry(fresh, live);
    expect(q("SELECT commodity FROM market")).toEqual([{ commodity: "Painite" }]);
    expect(q("SELECT power_state FROM systems")).toEqual([{ power_state: "Stronghold" }]);
    expect(q("SELECT mining_signals FROM bodies")).toEqual([{ mining_signals: 12 }]);
    expect(q("SELECT count FROM ring_hotspots")).toEqual([{ count: 4 }]);
  });

  it("adds systems, stations, bodies, rings and hotspots only the live database has", () => {
    const fresh = build({});
    const live = build({});
    const l = new Database(live.file);
    opened.push(l);
    l.prepare("INSERT INTO systems (id64, name, x, y, z) VALUES (2, 'New', 5, 5, 5)").run();
    l.prepare("INSERT INTO stations (id, system_id64, name, market_updated, best_price) VALUES (20, 2, 'Depot', ?, 50)").run("2026-09-02T00:00:00Z");
    l.prepare("INSERT INTO market VALUES (20, 'Water', 9, 50)").run();
    l.prepare("INSERT INTO bodies (system_id64, body_id, name) VALUES (2, 1, 'New 1')").run();
    l.prepare("INSERT INTO rings (system_id64, name, type, hotspots_at) VALUES (2, 'New 1 A Ring', 'Icy', ?)").run("2026-09-02T00:00:00Z");
    l.prepare("INSERT INTO ring_hotspots VALUES (2, 'New 1 A Ring', 'Painite', 2)").run();
    l.close();
    const { stats, q } = carry(fresh, { ...live, db: { close() {} } as never });
    expect(stats).toMatchObject({ systems: 1, stations: 1, bodies: 1, rings: 1 });
    expect(q("SELECT name FROM systems ORDER BY id64").map((r) => r.name)).toEqual(["Sol", "New"]);
    expect(q("SELECT commodity FROM market WHERE station_id = 20")).toEqual([{ commodity: "Water" }]);
    expect(q("SELECT material FROM ring_hotspots WHERE system_id64 = 2")).toEqual([{ material: "Painite" }]);
  });

  it("does not carry a live station whose market is older than the cutoff", () => {
    const fresh = build({});
    const live = build({});
    const l = new Database(live.file);
    opened.push(l);
    l.prepare("INSERT INTO stations (id, system_id64, name, market_updated, best_price) VALUES (30, 1, 'Old', ?, 50)").run("2025-06-01T00:00:00Z");
    l.close();
    const { q } = carry(fresh, { ...live, db: { close() {} } as never });
    expect(q("SELECT name FROM stations ORDER BY id").map((r) => r.name)).toEqual(["Hub"]);
  });

  it("says before a build whether the live database can be carried: yes for this version's own, no for another's", () => {
    const ok = build({});
    ok.db.close();
    expect(carryForwardBlocker(ok.file)).toBeNull();
    const file = path.join(dir, `older-${n++}.sqlite`);
    const old = new Database(file);
    old.exec("CREATE TABLE systems (id64 INTEGER, name TEXT)");
    old.close();
    expect(carryForwardBlocker(file)).toMatch(/another version/);
    expect(carryForwardBlocker(path.join(dir, "missing.sqlite"))).toMatch(/could not be read/);
  });

  it("refuses a live database with different tables, instead of copying rows by position", () => {
    const fresh = build({});
    const file = path.join(dir, `old-${n++}.sqlite`);
    const old = new Database(file);
    opened.push(old);
    old.exec("CREATE TABLE systems (id64 INTEGER, name TEXT)");
    old.close();
    expect(() => carryForward(fresh.db, file, CUTOFF)).toThrow(/older version/);
  });
});
