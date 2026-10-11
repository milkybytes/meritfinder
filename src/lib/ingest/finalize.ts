import type Database from "better-sqlite3";

// Work done once after a build instead of on every page load.

// Distinct commodity names for the "Commodity to sell" dropdown. Scanning the market table for these takes
// seconds, so the web app reads this stored list.
export function storeCommodities(db: Database.Database): number {
  const rows = db.prepare("SELECT DISTINCT commodity c FROM market").all() as { c: string }[];
  const list = rows.map((r) => r.c).sort();
  db.prepare("INSERT OR REPLACE INTO meta VALUES ('commodities', ?)").run(JSON.stringify(list));
  return list.length;
}

// The pairs the ingest saw, for the live listener to name what EDDN sends.
export function storeCommoditySymbols(db: Database.Database, symbols: Map<string, string>): number {
  const insert = db.prepare("INSERT OR REPLACE INTO commodity_symbols VALUES (?, ?)");
  db.transaction(() => symbols.forEach((name, symbol) => insert.run(symbol, name)))();
  return symbols.size;
}
