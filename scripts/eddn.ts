// Keeps the database current from EDDN (markets, Powerplay state, planetary signals) for what it already holds. Leave it running.
//   npm run eddn [-- --dry-run | --seconds N]
import Database from "better-sqlite3";

import { getDbPath } from "@/lib/db/db";
import { SCHEMA_VERSION, schemaVersion } from "@/lib/db/migrations";
import { runListener, type ListenerStats } from "@/lib/eddn/listener";
import { EDDN_RELAY, relayMessages } from "@/lib/eddn/source";

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const opt = (n: string) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : undefined);
const dryRun = flag("dry-run");
const seconds = opt("seconds") ? Number(opt("seconds")) : Infinity;

const controller = new AbortController();
for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => controller.abort());
if (Number.isFinite(seconds)) setTimeout(() => controller.abort(), seconds * 1000);

const summary = (s: ListenerStats) =>
  `${s.received} messages, ${s.accepted.market} market / ${s.accepted.system} system / ${s.accepted.signals} signal updates read: markets ${s.applied.markets} (+${s.applied.marketsIgnored} ignored), systems ${s.applied.systems} (+${s.applied.systemsIgnored}), ` +
  `planet signals ${s.applied.signals} (+${s.applied.signalsIgnored}); skipped ${JSON.stringify(s.skipped)}; ${s.flushes} writes, ${s.flushErrors} failed`;

// The database must be at the schema version this code expects, and the ingest must have recorded the commodity names EDDN's symbols stand for.
function loadSymbols(): Map<string, string> {
  const db = new Database(getDbPath(), { readonly: true, fileMustExist: true });
  try {
    const version = schemaVersion(db);
    if (version !== SCHEMA_VERSION) throw new Error(`this database is at schema version ${version}, not ${SCHEMA_VERSION}: run npm run db:migrate`);
    const hasTable = db.prepare("SELECT 1 FROM sqlite_master WHERE name = 'commodity_symbols'").get();
    const rows = hasTable ? (db.prepare("SELECT symbol, name FROM commodity_symbols").all() as { symbol: string; name: string }[]) : [];
    if (rows.length === 0) throw new Error("the database has no commodity names for EDDN's symbols: rebuild it with npm run ingest -- --force");
    return new Map(rows.map((r) => [r.symbol, r.name]));
  } finally {
    db.close();
  }
}

async function main() {
  const symbols = loadSymbols();
  console.log(`${dryRun ? "Dry run: reading" : "Updating " + getDbPath() + " from"} ${EDDN_RELAY}. Ctrl+C to stop.`);

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
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
