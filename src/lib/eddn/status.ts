import { withDb } from "../db/db";

// Whether live updates are arriving, as the page shows it. The listener (npm run eddn-listener) records a heartbeat in the database
// while messages are flowing, and removes it when it stops, so this reflects what is true now, not what was once configured.
type LiveState = "live" | "delayed" | "off";

export interface LiveStatus {
  state: LiveState;
  heartbeatAt: string | null; // the listener last confirmed it was receiving
  updatedAt: string | null; // the database last changed because of a live message
  startedAt: string | null;
  totals: { markets: number; systems: number; signals: number } | null; // applied since the listener started
}

const LIVE_WITHIN_MS = 2 * 60_000; // a heartbeat is written every 30 s
const DELAYED_WITHIN_MS = 30 * 60_000;

export const OFF: LiveStatus = { state: "off", heartbeatAt: null, updatedAt: null, startedAt: null, totals: null };

function readTotals(raw: string | undefined): LiveStatus["totals"] {
  try {
    const t = JSON.parse(raw ?? "null");
    return t && ["markets", "systems", "signals"].every((k) => Number.isInteger(t[k])) ? { markets: t.markets, systems: t.systems, signals: t.signals } : null;
  } catch {
    return null;
  }
}

// From the database's meta values. "live": a heartbeat in the last two minutes. "delayed": the listener was last heard from
// within half an hour (the connection is quiet or recovering). Otherwise "off" (not running, or stopped).
export function liveStatusFrom(meta: Record<string, string | undefined>, now: number): LiveStatus {
  const heartbeatAt = meta.eddn_heartbeat ?? null;
  const beat = heartbeatAt ? Date.parse(heartbeatAt) : NaN;
  const since = Number.isFinite(beat) ? now - beat : Infinity;
  const state: LiveState = since <= LIVE_WITHIN_MS ? "live" : since <= DELAYED_WITHIN_MS ? "delayed" : "off";
  return {
    state,
    heartbeatAt: state === "off" ? null : heartbeatAt,
    updatedAt: meta.eddn_updated ?? null,
    startedAt: state === "off" ? null : (meta.eddn_started ?? null),
    totals: state === "off" ? null : readTotals(meta.eddn_totals),
  };
}

// Read fresh from the database on every call (it is a few rows, and the page asks for it per request). An unreadable
// database is the same as no live updates.
export function getLiveStatus(now = Date.now()): LiveStatus {
  try {
    const meta = withDb((db) => {
      const rows = db.prepare("SELECT key, value FROM meta WHERE key IN ('eddn_heartbeat', 'eddn_updated', 'eddn_started', 'eddn_totals')").all() as { key: string; value: string }[];
      return Object.fromEntries(rows.map((r) => [r.key, r.value]));
    });
    return liveStatusFrom(meta, now);
  } catch {
    return OFF;
  }
}
