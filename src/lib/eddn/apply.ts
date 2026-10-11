import type Database from "better-sqlite3";

import type { EddnUpdate } from "./messages";

export interface ApplyStats {
  markets: number; // updated
  marketsIgnored: number; // station not in the database, or the stored market is as new or newer
  systems: number;
  systemsIgnored: number;
  signals: number;
  signalsIgnored: number; // body not in the database
}

export const emptyStats = (): ApplyStats => ({ markets: 0, marketsIgnored: 0, systems: 0, systemsIgnored: 0, signals: 0, signalsIgnored: 0 });

// Writes updates in one transaction. Only things already in the database change (a live message lacks pad sizes, coordinates and the rest), and only to
// information newer than what is stored.
export function applyUpdates(db: Database.Database, updates: EddnUpdate[]): ApplyStats {
  const stats = emptyStats();
  const stationAge = db.prepare("SELECT market_updated FROM stations WHERE id = ?");
  const clearMarket = db.prepare("DELETE FROM market WHERE station_id = ?");
  const addMarket = db.prepare("INSERT INTO market (station_id, commodity, demand, sell_price) VALUES (?, ?, ?, ?)");
  const touchStation = db.prepare("UPDATE stations SET market_updated = ?, best_price = ? WHERE id = ?");
  const setSystem = db.prepare(
    `UPDATE systems SET controlling_power = @controllingPower, power_state = @powerState, powers = @powers, control_progress = @controlProgress,
       reinforcement = @reinforcement, undermining = @undermining, faction_state = @factionState, conflict = @conflict, updated_at = @at
     WHERE id64 = @id64 AND (updated_at IS NULL OR updated_at < @at)`,
  );
  const setSignals = db.prepare("UPDATE bodies SET mining_signals = ? WHERE system_id64 = ? AND body_id = ?");

  db.transaction(() => {
    for (const u of updates) {
      if (u.kind === "market") {
        const known = stationAge.get(u.marketId) as { market_updated: string | null } | undefined;
        if (!known || (known.market_updated !== null && known.market_updated >= u.at)) {
          stats.marketsIgnored++;
          continue;
        }
        clearMarket.run(u.marketId);
        for (const c of u.commodities) addMarket.run(u.marketId, c.name, c.demand, c.price);
        touchStation.run(u.at, Math.max(0, ...u.commodities.map((c) => c.price)), u.marketId);
        stats.markets++;
      } else if (u.kind === "system") {
        const changed = setSystem.run({
          id64: u.id64, at: u.at, controllingPower: u.controllingPower, powerState: u.powerState, powers: u.powers ? JSON.stringify(u.powers) : null,
          controlProgress: u.controlProgress, reinforcement: u.reinforcement, undermining: u.undermining, factionState: u.factionState,
          conflict: u.conflict?.length ? JSON.stringify(u.conflict) : null,
        }).changes;
        if (changed) stats.systems++;
        else stats.systemsIgnored++;
      } else {
        if (setSignals.run(u.miningSignals, u.id64, u.bodyId).changes) stats.signals++;
        else stats.signalsIgnored++;
      }
    }
    db.prepare("INSERT OR REPLACE INTO meta VALUES ('eddn_updated', ?)").run(new Date().toISOString());
  })();
  return stats;
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
