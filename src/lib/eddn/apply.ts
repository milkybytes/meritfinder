import type Database from "better-sqlite3";

import type { EddnUpdate } from "./messages";

export interface ApplyStats {
  markets: number; // updated
  marketsIgnored: number; // station not in the database, or the stored market is as new or newer
  systems: number; // added, or their state updated
  systemsIgnored: number;
  signals: number;
  signalsIgnored: number; // body not in the database, or the stored count is as new or newer
  stations: number; // added or updated
  bodies: number; // planets added or updated (with their rings)
  bodiesIgnored: number; // system not in the database
  hotspots: number; // rings whose hotspots were replaced
  hotspotsIgnored: number; // ring not in the database, or the stored hotspots are as new or newer
}

export const emptyStats = (): ApplyStats => ({
  markets: 0, marketsIgnored: 0, systems: 0, systemsIgnored: 0, signals: 0, signalsIgnored: 0,
  stations: 0, bodies: 0, bodiesIgnored: 0, hotspots: 0, hotspotsIgnored: 0,
});

// A system and the things in it come before what refers to them.
const ORDER: Record<EddnUpdate["kind"], number> = { system: 0, station: 1, body: 2, hotspots: 3, market: 4, signals: 5 };

// Writes updates in one transaction. A system, station, planet or ring that is not there is added when the message says enough about it
// (a jump gives a system, a docking a station, a scan a planet and its rings). What is there changes only to information newer than what is
// stored: a late message never overwrites a fresher one, and neither does the dump (see ingest/carry-forward.ts).
export function applyUpdates(db: Database.Database, updates: EddnUpdate[]): ApplyStats {
  const stats = emptyStats();
  const hasSystem = db.prepare("SELECT 1 FROM systems WHERE id64 = ?");
  const addSystem = db.prepare("INSERT OR IGNORE INTO systems (id64, name, x, y, z) VALUES (?, ?, ?, ?, ?)");
  const setSystem = db.prepare(
    `UPDATE systems SET controlling_power = @controllingPower, power_state = @powerState, powers = @powers, control_progress = @controlProgress,
       reinforcement = @reinforcement, undermining = @undermining, conflict = @conflict, updated_at = @at
     WHERE id64 = @id64 AND (updated_at IS NULL OR updated_at < @at)`,
  );
  const setStation = db.prepare(
    `INSERT INTO stations (id, system_id64, name, type, has_large, has_medium, distance_ls) VALUES (@id, @system, @name, @type, COALESCE(@large, 0), COALESCE(@medium, 0), @ls)
     ON CONFLICT(id) DO UPDATE SET system_id64 = excluded.system_id64, name = excluded.name, type = excluded.type,
       has_large = COALESCE(@large, has_large), has_medium = COALESCE(@medium, has_medium), distance_ls = COALESCE(excluded.distance_ls, distance_ls)`,
  );
  const setBody = db.prepare(
    `INSERT INTO bodies (system_id64, body_id, name, subtype, volcanism, body_class, gravity, distance_ls) VALUES (@system, @bodyId, @name, @subtype, @volcanism, @cls, @gravity, @ls)
     ON CONFLICT(system_id64, body_id) DO UPDATE SET name = excluded.name, subtype = excluded.subtype, volcanism = excluded.volcanism, body_class = excluded.body_class,
       gravity = COALESCE(excluded.gravity, gravity), distance_ls = COALESCE(excluded.distance_ls, distance_ls)`,
  );
  const setRing = db.prepare(
    `INSERT INTO rings (system_id64, name, type, reserve) VALUES (@system, @name, @type, @reserve)
     ON CONFLICT(system_id64, name) DO UPDATE SET type = excluded.type, reserve = COALESCE(excluded.reserve, reserve)`,
  );
  const addRing = db.prepare("INSERT OR IGNORE INTO rings (system_id64, name) VALUES (?, ?)"); // its type arrives with a scan of its planet
  const touchHotspots = db.prepare("UPDATE rings SET hotspots_at = @at WHERE system_id64 = @system AND name = @name AND (hotspots_at IS NULL OR hotspots_at < @at)");
  const clearHotspots = db.prepare("DELETE FROM ring_hotspots WHERE system_id64 = ? AND ring_name = ?");
  const addHotspot = db.prepare("INSERT OR REPLACE INTO ring_hotspots VALUES (?, ?, ?, ?)");
  const stationAge = db.prepare("SELECT market_updated FROM stations WHERE id = ?");
  const clearMarket = db.prepare("DELETE FROM market WHERE station_id = ?");
  const addMarket = db.prepare("INSERT INTO market (station_id, commodity, demand, sell_price) VALUES (?, ?, ?, ?)");
  const touchStation = db.prepare("UPDATE stations SET market_updated = ?, best_price = ? WHERE id = ?");
  const setSignals = db.prepare("UPDATE bodies SET mining_signals = @count, signals_at = @at WHERE system_id64 = @system AND body_id = @bodyId AND (signals_at IS NULL OR signals_at < @at)");
  const newCommodities = new Set<string>();

  db.transaction(() => {
    for (const u of [...updates].sort((a, b) => ORDER[a.kind] - ORDER[b.kind])) {
      switch (u.kind) {
        case "system": {
          let changed = 0;
          if (u.name && u.pos) changed += addSystem.run(u.id64, u.name, u.pos[0], u.pos[1], u.pos[2]).changes;
          if (u.powerplay) {
            changed += setSystem.run({
              id64: u.id64, at: u.at, controllingPower: u.controllingPower, powerState: u.powerState, powers: u.powers ? JSON.stringify(u.powers) : null,
              controlProgress: u.controlProgress, reinforcement: u.reinforcement, undermining: u.undermining,
              conflict: u.conflict?.length ? JSON.stringify(u.conflict) : null,
            }).changes;
          }
          if (changed) stats.systems++;
          else stats.systemsIgnored++;
          break;
        }
        case "station": {
          addSystem.run(u.id64, u.systemName, u.pos[0], u.pos[1], u.pos[2]);
          setStation.run({ id: u.marketId, system: u.id64, name: u.name, type: u.type, large: u.large === null ? null : u.large ? 1 : 0, medium: u.medium === null ? null : u.medium ? 1 : 0, ls: u.distanceLs });
          stats.stations++;
          break;
        }
        case "body": {
          if (!hasSystem.get(u.id64)) {
            stats.bodiesIgnored++;
            break;
          }
          if (u.landable) setBody.run({ system: u.id64, bodyId: u.bodyId, name: u.name, subtype: u.subtype, volcanism: u.volcanism, cls: u.bodyClass, gravity: u.gravity, ls: u.distanceLs });
          for (const r of u.rings) setRing.run({ system: u.id64, name: r.name, type: r.type, reserve: u.reserve });
          stats.bodies++;
          break;
        }
        case "hotspots": {
          if (!hasSystem.get(u.id64)) {
            stats.hotspotsIgnored++;
            break;
          }
          addRing.run(u.id64, u.ringName);
          if (touchHotspots.run({ at: u.at, system: u.id64, name: u.ringName }).changes) {
            clearHotspots.run(u.id64, u.ringName);
            for (const h of u.hotspots) addHotspot.run(u.id64, u.ringName, h.material, h.count);
            stats.hotspots++;
          } else stats.hotspotsIgnored++;
          break;
        }
        case "market": {
          const known = stationAge.get(u.marketId) as { market_updated: string | null } | undefined;
          if (!known || (known.market_updated !== null && known.market_updated >= u.at)) {
            stats.marketsIgnored++;
            break;
          }
          clearMarket.run(u.marketId);
          for (const c of u.commodities) {
            addMarket.run(u.marketId, c.name, c.demand, c.price);
            if (!c.provisional) newCommodities.add(c.name); // a made-up name must not join the menu: the real one will replace it
          }
          touchStation.run(u.at, Math.max(0, ...u.commodities.map((c) => c.price)), u.marketId);
          stats.markets++;
          break;
        }
        case "signals": {
          if (setSignals.run({ count: u.miningSignals, at: u.at, system: u.id64, bodyId: u.bodyId }).changes) stats.signals++;
          else stats.signalsIgnored++;
          break;
        }
      }
    }
    addToCommodityList(db, newCommodities);
    db.prepare("INSERT OR REPLACE INTO meta VALUES ('eddn_updated', ?)").run(new Date().toISOString());
  })();
  return stats;
}

// What earlier versions wrote that should not be there: stations named by an unlocalised key, and construction depots. Safe to run any time; returns how many rows it changed.
export function repairLiveData(db: Database.Database): number {
  return db.transaction(() => {
    let changed = 0;
    changed += db.prepare("DELETE FROM stations WHERE name LIKE '$%' AND NOT EXISTS (SELECT 1 FROM market m WHERE m.station_id = stations.id)").run().changes;
    // Construction depots take deliveries for a build; they buy nothing, whatever an older dump said.
    db.prepare("DELETE FROM market WHERE station_id IN (SELECT id FROM stations WHERE type LIKE '%Construction Depot')").run();
    changed += db.prepare("DELETE FROM stations WHERE type LIKE '%Construction Depot'").run().changes;
    return changed;
  })();
}

// Markets older than the retention window are not trusted by any search, and a listener-only database has no ingest to drop them.
// The station stays (it can be docked at again); its stale market and best price go.
export function pruneStaleMarkets(db: Database.Database, cutoff: string): number {
  return db.transaction(() => {
    db.prepare("DELETE FROM market WHERE station_id IN (SELECT id FROM stations WHERE market_updated < ?)").run(cutoff);
    return db.prepare("UPDATE stations SET market_updated = NULL, best_price = NULL WHERE market_updated < ?").run(cutoff).changes;
  })();
}

// The "Commodity to sell" menu reads a stored list; a commodity first seen in a live market joins it.
function addToCommodityList(db: Database.Database, names: Set<string>): void {
  if (names.size === 0) return;
  const row = db.prepare("SELECT value FROM meta WHERE key = 'commodities'").get() as { value: string } | undefined;
  const list = new Set<string>(row ? (JSON.parse(row.value) as string[]) : []);
  const before = list.size;
  names.forEach((n) => list.add(n));
  if (list.size !== before) db.prepare("INSERT OR REPLACE INTO meta VALUES ('commodities', ?)").run(JSON.stringify([...list].sort()));
}

// Says the listener is receiving, and how much it has applied since it started. Called every few seconds while messages flow.
export function recordHeartbeat(db: Database.Database, { startedAt, totals, now = Date.now() }: { startedAt: string; totals: Pick<ApplyStats, "markets" | "systems" | "signals">; now?: number }): void {
  const put = db.prepare("INSERT OR REPLACE INTO meta VALUES (?, ?)");
  db.transaction(() => {
    put.run("eddn_heartbeat", new Date(now).toISOString());
    put.run("eddn_started", startedAt);
    put.run("eddn_totals", JSON.stringify({ markets: totals.markets, systems: totals.systems, signals: totals.signals }));
  })();
}

// The listener has stopped: the page should say so at once, not after the heartbeat times out.
export function clearHeartbeat(db: Database.Database): void {
  db.prepare("DELETE FROM meta WHERE key = 'eddn_heartbeat'").run();
}
