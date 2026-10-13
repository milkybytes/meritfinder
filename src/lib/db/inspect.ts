import type Database from "better-sqlite3";

import { SCHEMA_VERSION, schemaVersion } from "./migrations";

// A look at the data, for people (npm run db:stats, db:show, db:sql). Read-only.
const one = <T>(db: Database.Database, sql: string, ...args: unknown[]) => db.prepare(sql).get(...args) as T;
const all = <T>(db: Database.Database, sql: string, ...args: unknown[]) => db.prepare(sql).all(...args) as T[];

export interface DbStats {
  schemaVersion: number;
  codeVersion: number;
  builtAt: string | null;
  dumpVersion: string | null;
  rows: Record<string, number>;
  powerStates: { state: string; systems: number }[];
  marketAges: { within: string; stations: number }[];
  newestMarket: string | null;
  oldestMarket: string | null;
  ringsWithoutHotspots: number; // 0 on a database built before every ring was stored
  commodities: number;
  commodityNames: { checkedAt: string | null; result: string | null }; // the last look for names of commodities newer than the dump
}

export function dbStats(db: Database.Database, now = Date.now()): DbStats {
  const meta = (k: string) => one<{ value: string } | undefined>(db, "SELECT value FROM meta WHERE key = ?", k)?.value ?? null;
  const rows: Record<string, number> = {};
  for (const t of ["systems", "stations", "market", "bodies", "rings", "ring_hotspots"]) rows[t] = one<{ n: number }>(db, `SELECT COUNT(*) n FROM ${t}`).n;

  const ago = (hours: number) => new Date(now - hours * 3600_000).toISOString();
  const buckets: [string, number][] = [["1 hour", 1], ["24 hours", 24], ["7 days", 168], ["30 days", 720]];
  const marketAges = buckets.map(([within, h]) => ({ within, stations: one<{ n: number }>(db, "SELECT COUNT(*) n FROM stations WHERE market_updated >= ?", ago(h)).n }));
  const range = one<{ newest: string | null; oldest: string | null }>(db, "SELECT MAX(market_updated) newest, MIN(market_updated) oldest FROM stations");

  return {
    schemaVersion: schemaVersion(db),
    codeVersion: SCHEMA_VERSION,
    builtAt: meta("built_at"),
    dumpVersion: meta("dump_version"),
    rows,
    powerStates: all<{ state: string; systems: number }>(db, "SELECT COALESCE(power_state, 'not in Powerplay') state, COUNT(*) systems FROM systems GROUP BY 1 ORDER BY 2 DESC"),
    marketAges,
    newestMarket: range.newest,
    oldestMarket: range.oldest,
    ringsWithoutHotspots: one<{ n: number }>(db, "SELECT COUNT(*) n FROM rings r WHERE NOT EXISTS (SELECT 1 FROM ring_hotspots h WHERE h.system_id64 = r.system_id64 AND h.ring_name = r.name)").n,
    commodities: (JSON.parse(meta("commodities") ?? "[]") as string[]).length,
    commodityNames: { checkedAt: meta("commodity_names_checked"), result: meta("commodity_names_result") },
  };
}

export interface SystemView {
  system: Record<string, unknown>;
  stations: (Record<string, unknown> & { top: { commodity: string; sell_price: number; demand: number }[] })[];
  rings: Record<string, unknown>[];
  bodies: Record<string, unknown>[];
}

// Everything stored about one system (by name, any case), with the ten best-paying commodities of each station.
export function showSystem(db: Database.Database, name: string): SystemView | null {
  const system = one<Record<string, unknown> | undefined>(db, "SELECT * FROM systems WHERE name = ? COLLATE NOCASE ORDER BY id64 LIMIT 1", name);
  if (!system) return null;
  const id = system.id64;
  return {
    system,
    stations: all<Record<string, unknown> & { id: number }>(db, "SELECT * FROM stations WHERE system_id64 = ? ORDER BY distance_ls", id).map((t) => ({
      ...t,
      top: all<{ commodity: string; sell_price: number; demand: number }>(db, "SELECT commodity, sell_price, demand FROM market WHERE station_id = ? ORDER BY sell_price DESC LIMIT 10", t.id),
    })),
    rings: all(db, "SELECT r.name, r.type, r.reserve, group_concat(h.material || ' x' || h.count, ', ') hotspots FROM rings r LEFT JOIN ring_hotspots h ON h.system_id64 = r.system_id64 AND h.ring_name = r.name WHERE r.system_id64 = ? GROUP BY r.name ORDER BY r.name", id),
    bodies: all(db, "SELECT body_id, name, subtype, volcanism, gravity, distance_ls, mining_signals FROM bodies WHERE system_id64 = ? ORDER BY distance_ls", id),
  };
}

// Runs one read-only statement and returns up to `limit` rows (and whether there were more). The connection is read-only,
// so nothing can be changed; a statement that returns no rows (an INSERT, say) is refused with a clear message.
export function runQuery(db: Database.Database, sql: string, limit = 50): { rows: unknown[]; more: boolean } {
  const stmt = db.prepare(sql);
  if (!stmt.reader) throw new Error("only statements that return rows (SELECT, PRAGMA, EXPLAIN) are allowed here");
  const rows: unknown[] = [];
  for (const row of stmt.iterate()) {
    if (rows.length === limit) return { rows, more: true };
    rows.push(row);
  }
  return { rows, more: false };
}
