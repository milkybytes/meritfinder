import zlib from "node:zlib";

import type Database from "better-sqlite3";

import { applyUpdates, clearHeartbeat, emptyStats, recordHeartbeat, type ApplyStats } from "./apply";
import { parseMessage, type EddnUpdate } from "./messages";

export interface ListenerStats {
  received: number;
  accepted: { market: number; system: number; signals: number }; // valid updates read, before being merged and written
  skipped: Record<string, number>; // why messages were not used, by reason
  applied: ApplyStats;
  flushes: number;
  flushErrors: number;
}

export interface ListenerOptions {
  source: AsyncIterable<Uint8Array>; // compressed EDDN messages, as the relay sends them
  symbols: ReadonlyMap<string, string>; // EDDN's commodity symbols and the market names they stand for
  openDb?: () => Database.Database; // a writable handle; opened and closed around each flush. Omit for a dry run.
  now?: () => number;
  flushMs?: number; // write what has arrived at least this often
  heartbeatMs?: number; // say the feed is flowing this often, if messages have arrived since the last time
  maxBatch?: number; // ...or as soon as this many distinct updates are waiting
  log?: (line: string) => void;
  signal?: AbortSignal;
}

const MAX_MESSAGE_BYTES = 5_000_000; // inflated; a bigger one is a bomb or a mistake
const MAX_WAITING = 5000; // if the database is unreachable, keep this many and drop the oldest

// Is `a` at least as recent as `b`? Both describe the same market, system or body.
const newer = (a: EddnUpdate, b: EddnUpdate) => a.kind === "signals" || b.kind === "signals" || a.at >= b.at;

const keyOf = (u: EddnUpdate) => (u.kind === "market" ? `m${u.marketId}` : u.kind === "system" ? `s${u.id64}` : `b${u.id64}:${u.bodyId}`);

// Reads the feed, keeps the newest update per market, system and body, and writes in batches. The database is opened only for each write, so the web
// app and the ingest can use it in between. Returns when the source ends or the signal aborts, after a final write.
export async function runListener(opts: ListenerOptions): Promise<ListenerStats> {
  const { source, symbols, openDb, now = Date.now, flushMs = 10_000, heartbeatMs = 30_000, maxBatch = 500, log = () => {}, signal } = opts;
  const stats: ListenerStats = { received: 0, accepted: { market: 0, system: 0, signals: 0 }, skipped: {}, applied: emptyStats(), flushes: 0, flushErrors: 0 };
  let waiting = new Map<string, EddnUpdate>();

  const flush = () => {
    if (waiting.size === 0) return;
    const batch = [...waiting.values()];
    if (!openDb) {
      waiting = new Map(); // dry run
      return;
    }
    let db: Database.Database | undefined;
    try {
      db = openDb();
      const done = applyUpdates(db, batch);
      for (const k of Object.keys(done) as (keyof ApplyStats)[]) stats.applied[k] += done[k];
      stats.flushes++;
      waiting = new Map();
    } catch (e) {
      stats.flushErrors++;
      log(`could not write ${batch.length} updates, will retry: ${(e as Error).message}`);
      while (waiting.size > MAX_WAITING) waiting.delete(waiting.keys().next().value as string);
    } finally {
      db?.close();
    }
  };

  const startedAt = new Date(now()).toISOString();
  let beatAtCount = 0;
  // Only while messages are arriving: a connection that has gone quiet must not look alive.
  const beat = () => {
    if (!openDb || stats.received === beatAtCount) return;
    beatAtCount = stats.received;
    let db: Database.Database | undefined;
    try {
      db = openDb();
      recordHeartbeat(db, { startedAt, totals: stats.applied, now: now() });
    } catch (e) {
      log(`could not record the heartbeat: ${(e as Error).message}`);
    } finally {
      db?.close();
    }
  };

  const timer = setInterval(flush, flushMs);
  const heartbeat = setInterval(beat, heartbeatMs);
  try {
    for await (const raw of source) {
      if (signal?.aborted) break;
      stats.received++;
      let envelope: unknown;
      try {
        envelope = JSON.parse(zlib.inflateSync(raw, { maxOutputLength: MAX_MESSAGE_BYTES }).toString("utf8"));
      } catch {
        stats.skipped.malformed = (stats.skipped.malformed ?? 0) + 1;
        continue;
      }
      const parsed = parseMessage(envelope, now(), symbols);
      if ("skip" in parsed) {
        stats.skipped[parsed.skip] = (stats.skipped[parsed.skip] ?? 0) + 1;
        continue;
      }
      stats.accepted[parsed.update.kind]++;
      const key = keyOf(parsed.update);
      const prior = waiting.get(key);
      // the newest observation of the same thing wins; arrival order is not observation order (signal counts are timeless)
      if (!prior || newer(parsed.update, prior)) {
        waiting.delete(key);
        waiting.set(key, parsed.update);
      }
      if (waiting.size >= maxBatch) flush();
    }
  } finally {
    clearInterval(timer);
    clearInterval(heartbeat);
    flush();
    if (openDb) {
      let db: Database.Database | undefined;
      try {
        db = openDb();
        clearHeartbeat(db);
      } catch {
        // the heartbeat will simply time out
      } finally {
        db?.close();
      }
    }
  }
  return stats;
}
