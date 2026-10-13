// Keeps the database current from EDDN: markets, Powerplay state, and the systems, stations, planets, rings and hotspots players visit. Leave it running.
// Starts an empty database if there is none; the Spansh dump (npm run ingest) can be merged in at any time without losing what this learned.
// One listener per database: a second one finds the first one's heartbeat and refuses to start (--force starts anyway). Two would
// not corrupt anything, since every write only replaces older information, but they would do the same work twice.
//   npm run eddn-listener [-- --dry-run | --seconds N | --force]
import Database from "better-sqlite3";

import fs from "node:fs";
import path from "node:path";

import { getDbPath } from "@/lib/db/db";
import { migrate, SCHEMA_VERSION, schemaVersion } from "@/lib/db/migrations";
import { pruneStaleMarkets, repairLiveData } from "@/lib/eddn/apply";
import { MAX_MARKET_AGE_DAYS } from "@/data/retention";
import { runListener, type ListenerStats } from "@/lib/eddn/listener";
import { EDDN_RELAY, relayMessages } from "@/lib/eddn/source";

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const opt = (n: string) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : undefined);
const dryRun = flag("dry-run");
const CLAIM_EVERY_MS = 30_000;
const CLAIM_FRESH_MS = 90_000;
const CLAIM_RETRY_MS = 15_000;
const CLAIM_WAIT_MS = 120_000;
const seconds = opt("seconds") ? Number(opt("seconds")) : Infinity;

const controller = new AbortController();
for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => controller.abort());
if (Number.isFinite(seconds)) setTimeout(() => controller.abort(), seconds * 1000);

const summary = (s: ListenerStats) =>
  `${s.received} messages read: markets ${s.applied.markets} (+${s.applied.marketsIgnored} ignored), systems ${s.applied.systems} (+${s.applied.systemsIgnored}), ` +
  `stations ${s.applied.stations}, planets ${s.applied.bodies} (+${s.applied.bodiesIgnored}), hotspots ${s.applied.hotspots} (+${s.applied.hotspotsIgnored}), ` +
  `planet signals ${s.applied.signals} (+${s.applied.signalsIgnored}); skipped ${JSON.stringify(s.skipped)}; ${s.flushes} writes, ${s.flushErrors} failed`;

// The commodity names EDDN's symbols stand for come from the dump's markets, kept in the database. A new database has none, so names
// can't be resolved until a dump has been ingested; markets are skipped until then.
function loadSymbols(): Map<string, string> {
  if (!fs.existsSync(getDbPath())) return new Map();
  const db = new Database(getDbPath(), { readonly: true, fileMustExist: true });
  try {
    const hasTable = db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'commodity_symbols'").get();
    const rows = hasTable ? (db.prepare("SELECT symbol, name FROM commodity_symbols").all() as { symbol: string; name: string }[]) : [];
    return new Map(rows.map((r) => [r.symbol, r.name]));
  } finally {
    db.close();
  }
}

// An existing database must be at the schema version this code expects and have the columns the listener keeps timestamps in.
function prepareDatabase(): void {
  const file = getDbPath();
  if (!fs.existsSync(file)) {
    if (dryRun) return;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const db = new Database(file);
    try {
      migrate(db);
    } finally {
      db.close();
    }
    console.log(`Created ${file}.`);
    return;
  }
  // Opened for writing (a dry run excepted): if a listener was killed in the middle of a write, the journal it left behind can only
  // be rolled back by a connection that can write, and until then nothing can read the database, including this check.
  const db = new Database(file, { readonly: dryRun });
  try {
    const version = schemaVersion(db);
    if (version !== SCHEMA_VERSION) throw new Error(`this database is at schema version ${version}, not ${SCHEMA_VERSION}: run npm run db:migrate`);
    const has = (t: string, c: string) => (db.pragma(`table_info(${t})`) as { name: string }[]).some((x) => x.name === c);
    if (!has("bodies", "signals_at") || !has("rings", "hotspots_at")) throw new Error("this database predates live ring and signal timestamps: rebuild it with npm run ingest -- --force");
    if (!dryRun) {
      const fixed = repairLiveData(db);
      if (fixed) console.log(`Repaired ${fixed} rows an earlier version wrote in a different spelling.`);
    }
  } finally {
    db.close();
  }
}

// A running listener renews a claim in the database every 30 s, whether or not messages are arriving (the heartbeat says something
// else: that they are). One that stopped cleanly removes its claim; one that died leaves it, and it goes stale within 90 s.
function anotherListenerIsRunning(): boolean {
  if (dryRun || flag("force") || !fs.existsSync(getDbPath())) return false;
  const db = new Database(getDbPath(), { readonly: true, fileMustExist: true });
  try {
    const row = db.prepare("SELECT value FROM meta WHERE key = 'eddn_claimed'").get() as { value: string } | undefined;
    const age = row ? Date.now() - Date.parse(row.value) : Infinity;
    return age >= 0 && age < CLAIM_FRESH_MS;
  } finally {
    db.close();
  }
}

function setClaim(on: boolean): void {
  if (dryRun) return;
  try {
    const db = new Database(getDbPath(), { fileMustExist: true });
    try {
      if (on) db.prepare("INSERT OR REPLACE INTO meta VALUES ('eddn_claimed', ?)").run(new Date().toISOString());
      else db.prepare("DELETE FROM meta WHERE key = 'eddn_claimed'").run();
    } finally {
      db.close();
    }
  } catch {
    // the database is being replaced by an ingest; the next renewal will do
  }
}

async function main() {
  prepareDatabase();
  // One that has just died (or is being restarted) leaves its claim for up to 90 s: wait for it to go stale rather than give up.
  for (let waited = 0; anotherListenerIsRunning(); waited += CLAIM_RETRY_MS) {
    if (waited >= CLAIM_WAIT_MS) throw new Error("another listener is still writing to this database (it renewed its claim under 90 s ago). Stop it, or pass --force.");
    if (waited === 0) console.log("Another listener holds this database; checking again every 15 s for up to 2 minutes.");
    await new Promise((r) => setTimeout(r, CLAIM_RETRY_MS));
    if (controller.signal.aborted) return;
  }
  const symbols = loadSymbols();
  if (symbols.size === 0) console.log("No commodity names yet (no dump ingested): markets are skipped until one has been.");
  // An ingest can finish while this runs: pick up the names it recorded without a restart.
  const refresh = setInterval(() => {
    try {
      const fresh = loadSymbols();
      if (fresh.size === 0) return;
      if (symbols.size === 0) console.log(`Commodity names found (${fresh.size}): reading markets.`);
      symbols.clear();
      fresh.forEach((v, k) => symbols.set(k, v));
    } catch {
      // the database is being replaced; try again next time
    }
  }, 10 * 60_000);
  refresh.unref();
  console.log(`${dryRun ? "Dry run: reading" : "Updating " + getDbPath() + " from"} ${EDDN_RELAY}. Ctrl+C to stop.`);

  setClaim(true);
  const claim = setInterval(() => setClaim(true), CLAIM_EVERY_MS);
  claim.unref();

  // With no ingest to drop them, markets older than the retention window would sit in the database for good.
  const prune = () => {
    if (dryRun) return;
    try {
      const db = new Database(getDbPath(), { fileMustExist: true });
      try {
        const n = pruneStaleMarkets(db, new Date(Date.now() - MAX_MARKET_AGE_DAYS * 86400_000).toISOString());
        if (n) console.log(`Dropped ${n} markets older than ${MAX_MARKET_AGE_DAYS} days.`);
      } finally {
        db.close();
      }
    } catch {
      // busy or being replaced: next time
    }
  };
  prune();
  const pruner = setInterval(prune, 6 * 3600_000);
  pruner.unref();

  let backoff = 5000;
  while (!controller.signal.aborted) {
    const started = Date.now();
    let stats: ListenerStats | undefined;
    try {
      stats = await runListener({
        source: relayMessages(EDDN_RELAY, controller.signal),
        symbols,
        openDb: dryRun ? undefined : () => new Database(getDbPath(), { fileMustExist: true }),
        log: (l) => console.log(l),
        report: (s) => console.log(summary(s)),
        signal: controller.signal,
      });
    } catch (e) {
      console.log(`feed interrupted: ${(e as Error).message}`);
    }
    if (stats) console.log(summary(stats));
    if (controller.signal.aborted) break;
    backoff = Date.now() - started > 60_000 ? 5000 : Math.min(backoff * 2, 300_000); // a long-lived connection resets the wait
    console.log(`reconnecting in ${backoff / 1000} s`);
    await new Promise((r) => setTimeout(r, backoff));
  }
  clearInterval(claim);
  clearInterval(pruner);
  setClaim(false);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
