import Database from "better-sqlite3";

import { MAX_MARKET_AGE_DAYS } from "@/data/retention";

import { BODIES_OF_SYSTEM, REF_SYSTEM, RINGS_OF_SYSTEM, SUGGEST_SYSTEMS } from "../search/queries";

import { migrate } from "./migrations";

export interface DbCheck {
  ok: boolean;
  problems: string[]; // each says what is wrong and where
  warnings: string[]; // things the app does not need (columns or indexes from an older schema): harmless, but a rebuild drops them
  counts: Record<string, number>;
}

interface Column { name: string; type: string; notnull: number; pk: number }
const columns = (db: Database.Database, table: string) => db.pragma(`table_info(${table})`) as Column[];
const indexes = (db: Database.Database, table: string) =>
  (db.pragma(`index_list(${table})`) as { name: string }[]).map((i) => i.name).filter((n) => !n.startsWith("sqlite_autoindex")).sort();
const tables = (db: Database.Database) =>
  (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[]).map((t) => t.name);
const count = (db: Database.Database, sql: string) => (db.prepare(sql).get() as { n: number }).n;

// What the search needs the database to be (checked against the migrations), plus a look at the data for things that would make results wrong.
// Read-only. `full` adds SQLite's integrity check, which takes minutes on the full database.
export function checkDatabase(db: Database.Database, { full = false }: { full?: boolean } = {}): DbCheck {
  const problems: string[] = [];
  const warnings: string[] = [];
  const counts: Record<string, number> = {};

  // 1. Shape: the same tables, columns and indexes the migrations create.
  const reference = new Database(":memory:");
  migrate(reference);
  const expected = tables(reference);
  for (const extra of tables(db).filter((t) => !expected.includes(t))) warnings.push(`unexpected table "${extra}"`);
  for (const table of expected) {
    if (!tables(db).includes(table)) {
      problems.push(`missing table "${table}"`);
      continue;
    }
    const have = new Map(columns(db, table).map((c) => [c.name, c]));
    for (const want of columns(reference, table)) {
      const got = have.get(want.name);
      if (!got) problems.push(`${table}: missing column "${want.name}"`);
      else if (got.type !== want.type || got.notnull !== want.notnull || got.pk !== want.pk) {
        problems.push(`${table}.${want.name}: is ${got.type}${got.notnull ? " NOT NULL" : ""}${got.pk ? " PK" : ""}, expected ${want.type}${want.notnull ? " NOT NULL" : ""}${want.pk ? " PK" : ""}`);
      }
    }
    for (const col of have.keys()) if (!columns(reference, table).some((c) => c.name === col)) warnings.push(`${table}: unused column "${col}" (from an older schema)`);
    const haveIdx = indexes(db, table);
    for (const idx of indexes(reference, table)) if (!haveIdx.includes(idx)) problems.push(`${table}: missing index "${idx}"`);
    for (const idx of haveIdx) if (!indexes(reference, table).includes(idx)) warnings.push(`${table}: unused index "${idx}" (from an older schema)`);
  }
  reference.close();
  if (problems.length) return { ok: false, problems, warnings, counts }; // later checks assume the right shape

  // 2. The fixed per-system lookups are answered from an index, not by scanning a table for each candidate.
  const lookups: Record<string, [sql: string, args: unknown[] | Record<string, unknown>]> = {
    "reference system": [REF_SYSTEM, ["Sol"]],
    "system suggestions": [SUGGEST_SYSTEMS, { lo: "So", hi: "So" + String.fromCharCode(0xffff), n: 10 }],
    "bodies of a system": [BODIES_OF_SYSTEM, [1]],
    "rings of a system": [RINGS_OF_SYSTEM, [1]],
    "stations of a system": ["SELECT id FROM stations WHERE system_id64 = ?", [1]],
    "market of a station": ["SELECT commodity FROM market WHERE station_id = ? ORDER BY sell_price DESC LIMIT 1", [1]],
  };
  for (const [what, [sql, args]] of Object.entries(lookups)) {
    const plan = (db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(args) as { detail: string }[]).map((r) => r.detail);
    const scan = plan.find((d) => /^SCAN /.test(d) && !/USING (COVERING )?INDEX/.test(d));
    if (scan) problems.push(`${what}: reads a whole table (${scan})`);
  }

  // 3. Rows that refer to something that is not there.
  const orphans: Record<string, string> = {
    "stations without a system": "SELECT COUNT(*) n FROM stations t LEFT JOIN systems s ON s.id64 = t.system_id64 WHERE s.id64 IS NULL",
    "bodies without a system": "SELECT COUNT(*) n FROM bodies b LEFT JOIN systems s ON s.id64 = b.system_id64 WHERE s.id64 IS NULL",
    "rings without a system": "SELECT COUNT(*) n FROM rings r LEFT JOIN systems s ON s.id64 = r.system_id64 WHERE s.id64 IS NULL",
    "hotspots without a ring": "SELECT COUNT(*) n FROM ring_hotspots h LEFT JOIN rings r ON r.system_id64 = h.system_id64 AND r.name = h.ring_name WHERE r.name IS NULL",
    "market rows without a station": "SELECT COUNT(*) n FROM (SELECT DISTINCT station_id FROM market) m LEFT JOIN stations t ON t.id = m.station_id WHERE t.id IS NULL",
  };
  for (const [what, sql] of Object.entries(orphans)) {
    const n = count(db, sql);
    if (n) problems.push(`${n} ${what}`);
  }

  // 4. Values the search relies on.
  const bad: Record<string, string> = {
    "systems without a name or position": "SELECT COUNT(*) n FROM systems WHERE name = '' OR x IS NULL OR y IS NULL OR z IS NULL",
    "stations whose pad flags are not 0 or 1": "SELECT COUNT(*) n FROM stations WHERE has_large NOT IN (0, 1) OR has_medium NOT IN (0, 1)",
    "stations without a best price": "SELECT COUNT(*) n FROM stations WHERE best_price IS NULL OR best_price < 0",
    "market rows with no demand or a non-positive price": "SELECT COUNT(*) n FROM market WHERE demand <= 0 OR sell_price <= 0",
  };
  for (const [what, sql] of Object.entries(bad)) {
    const n = count(db, sql);
    if (n) problems.push(`${n} ${what}`);
  }

  // 5. best_price ranks systems without reading their markets, so it must never be below what a station really pays.
  // (A station can be higher if its dearest commodity has no demand; never lower.) Checked on a sample.
  const lower = db
    .prepare(
      `SELECT COUNT(*) n FROM (SELECT t.best_price bp, (SELECT MAX(sell_price) FROM market m WHERE m.station_id = t.id) mx FROM stations t ORDER BY RANDOM() LIMIT 500) WHERE mx IS NOT NULL AND bp < mx`,
    )
    .get() as { n: number };
  if (lower.n) problems.push(`${lower.n} of 500 sampled stations have a best_price below what their market pays (the price ranking would be wrong)`);

  for (const t of ["systems", "stations", "market", "bodies", "rings", "ring_hotspots", "commodity_symbols"]) counts[t] = count(db, `SELECT COUNT(*) n FROM ${t}`);
  if (!counts.systems) problems.push("the database has no systems");
  const stored = (db.prepare("SELECT value FROM meta WHERE key = 'commodities'").get() as { value: string } | undefined)?.value;
  if (!stored || !(JSON.parse(stored) as string[]).length) problems.push("meta has no commodity list (the Commodity to sell menu would be empty)");

  if (!counts.commodity_symbols) warnings.push("commodity_symbols is empty: live updates cannot name commodities until the next ingest");

  // Nothing stale: the ingest keeps only markets within MAX_MARKET_AGE_DAYS.
  const cutoff = new Date(Date.now() - MAX_MARKET_AGE_DAYS * 86400_000).toISOString();
  const old = count(db, `SELECT COUNT(*) n FROM stations WHERE market_updated < '${cutoff}'`);
  if (old) warnings.push(`${old} stations have a market older than ${MAX_MARKET_AGE_DAYS} days (a rebuild drops them)`);

  if (full) {
    const rows = db.pragma("integrity_check") as { integrity_check: string }[];
    if (!(rows.length === 1 && rows[0].integrity_check === "ok")) problems.push(`integrity check: ${rows.slice(0, 5).map((r) => r.integrity_check).join("; ")}`);
  }
  return { ok: problems.length === 0, problems, warnings, counts };
}
