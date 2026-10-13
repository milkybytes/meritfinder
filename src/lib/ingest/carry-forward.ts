import Database from "better-sqlite3";

import { migrate } from "../db/migrations";

export interface CarryStats {
  systems: number; // live systems the new database did not have, or whose Powerplay state the live one saw more recently
  stations: number; // likewise for stations: new ones, and ones whose market is newer
  bodies: number;
  rings: number; // new rings, and rings whose hotspots were scanned more recently
}

const TABLES = ["systems", "stations", "market", "bodies", "rings", "ring_hotspots", "commodity_symbols"];

// Whether the live database has the same tables and columns, in the same order: rows are copied across by position.
function sameShape(db: Database.Database): boolean {
  const cols = (schema: "main" | "live", table: string) => (db.pragma(`${schema}.table_info(${table})`) as { name: string }[]).map((c) => c.name).join(",");
  return TABLES.every((t) => cols("main", t) !== "" && cols("main", t) === cols("live", t));
}

// Why the live database at `livePath` could not be carried into a database built by this version, or null if it can. Cheap, so the ingest
// asks before a 1.5 hour build, not after.
export function carryForwardBlocker(livePath: string): string | null {
  const fresh = new Database(":memory:");
  let live: Database.Database | undefined;
  try {
    live = new Database(livePath, { readonly: true, fileMustExist: true });
    migrate(fresh);
    const cols = (d: Database.Database, t: string) => (d.pragma(`table_info(${t})`) as { name: string }[]).map((c) => c.name).join(",");
    const table = TABLES.find((t) => cols(live!, t) !== cols(fresh, t));
    return table ? `the live database's ${table} table is not the shape this version builds (it was made by another version)` : null;
  } catch (e) {
    const code = (e as { code?: string }).code;
    const hint = code === "SQLITE_READONLY_ROLLBACK" ? " (a write to it was cut short; start the listener once, or anything that can write to it, and it repairs itself)" : "";
    return `the live database could not be read: ${(e as Error).message}${hint}`;
  } finally {
    live?.close();
    fresh.close();
  }
}

// Brings what the live database knows, and a freshly built one from the dump does not, into the new one before it replaces the live one:
//   - systems, stations, bodies and rings only the live database has (EDDN added them since the dump was made);
//   - markets, Powerplay state, mining signals and ring hotspots the live database observed more recently than the dump did.
// A newer observation always wins and an older one never overwrites. Live stations whose market is older than `cutoff` are not carried,
// so what the dump drops for being stale stays dropped. `live` is only read.
export function carryForward(db: Database.Database, livePath: string, cutoff: string): CarryStats {
  db.prepare("ATTACH DATABASE ? AS live").run(livePath);
  try {
    if (!sameShape(db)) throw new Error("the live database was built by an older version (its tables differ), so there is nothing safe to carry forward");
    const run = (sql: string, params: Record<string, unknown> = {}) => db.prepare(sql).run(params).changes;
    const stats: CarryStats = { systems: 0, stations: 0, bodies: 0, rings: 0 };

    db.transaction(() => {
      // Systems: those only the live database has, and the Powerplay state where the live one is newer.
      stats.systems += run("INSERT INTO main.systems SELECT l.* FROM live.systems l WHERE l.id64 NOT IN (SELECT id64 FROM main.systems)");
      stats.systems += run(
        `UPDATE main.systems SET controlling_power = l.controlling_power, power_state = l.power_state, powers = l.powers, control_progress = l.control_progress,
           reinforcement = l.reinforcement, undermining = l.undermining, updated_at = l.updated_at, conflict = l.conflict
         FROM live.systems l WHERE l.id64 = main.systems.id64 AND l.updated_at > COALESCE(main.systems.updated_at, '')`,
      );

      // Stations: those only the live database has (with a fresh market, or none yet), and those whose market it saw more recently.
      db.exec("CREATE TEMP TABLE carry (id INTEGER PRIMARY KEY)");
      run(
        `INSERT INTO carry SELECT l.id FROM live.stations l WHERE l.id NOT IN (SELECT id FROM main.stations)
           AND (l.market_updated IS NULL OR l.market_updated >= @cutoff) AND l.system_id64 IN (SELECT id64 FROM main.systems)`,
        { cutoff },
      );
      run(
        `INSERT OR IGNORE INTO carry SELECT l.id FROM live.stations l JOIN main.stations s ON s.id = l.id
           WHERE l.market_updated > COALESCE(s.market_updated, '')`,
      );
      run("DELETE FROM main.market WHERE station_id IN (SELECT id FROM carry)");
      stats.stations += run("INSERT OR REPLACE INTO main.stations SELECT l.* FROM live.stations l WHERE l.id IN (SELECT id FROM carry)");
      run("INSERT INTO main.market SELECT m.* FROM live.market m WHERE m.station_id IN (SELECT id FROM carry)");
      db.exec("DROP TABLE carry");

      // Bodies: those only the live database has, and mining signals where it observed them more recently.
      stats.bodies += run(
        `INSERT INTO main.bodies SELECT l.* FROM live.bodies l WHERE l.system_id64 IN (SELECT id64 FROM main.systems)
           AND NOT EXISTS (SELECT 1 FROM main.bodies b WHERE b.system_id64 = l.system_id64 AND b.body_id = l.body_id)`,
      );
      stats.bodies += run(
        `UPDATE main.bodies SET mining_signals = l.mining_signals, signals_at = l.signals_at
         FROM live.bodies l WHERE l.system_id64 = main.bodies.system_id64 AND l.body_id = main.bodies.body_id
           AND l.signals_at > COALESCE(main.bodies.signals_at, '')`,
      );

      // Rings: those only the live database has, with their hotspots; and the hotspots of rings it scanned more recently.
      db.exec("CREATE TEMP TABLE carry_rings (system_id64 INTEGER, name TEXT, PRIMARY KEY (system_id64, name))");
      run(
        `INSERT INTO carry_rings SELECT l.system_id64, l.name FROM live.rings l WHERE l.system_id64 IN (SELECT id64 FROM main.systems)
           AND NOT EXISTS (SELECT 1 FROM main.rings r WHERE r.system_id64 = l.system_id64 AND r.name = l.name)`,
      );
      run(
        `INSERT OR IGNORE INTO carry_rings SELECT l.system_id64, l.name FROM live.rings l JOIN main.rings r ON r.system_id64 = l.system_id64 AND r.name = l.name
           WHERE l.hotspots_at > COALESCE(r.hotspots_at, '')`,
      );
      run("DELETE FROM main.ring_hotspots WHERE EXISTS (SELECT 1 FROM carry_rings c WHERE c.system_id64 = ring_hotspots.system_id64 AND c.name = ring_hotspots.ring_name)");
      stats.rings += run(
        `INSERT OR REPLACE INTO main.rings SELECT l.* FROM live.rings l WHERE EXISTS (SELECT 1 FROM carry_rings c WHERE c.system_id64 = l.system_id64 AND c.name = l.name)`,
      );
      run(
        `INSERT INTO main.ring_hotspots SELECT h.* FROM live.ring_hotspots h
         WHERE EXISTS (SELECT 1 FROM carry_rings c WHERE c.system_id64 = h.system_id64 AND c.name = h.ring_name)`,
      );
      db.exec("DROP TABLE carry_rings");

      run("INSERT OR IGNORE INTO main.commodity_symbols SELECT * FROM live.commodity_symbols");
    })();
    return stats;
  } finally {
    db.exec("DETACH DATABASE live");
  }
}
