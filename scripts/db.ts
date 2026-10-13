// The database tools: npm run db:stats | db:check | db:show -- <system> | db:sql -- <select> | db:migrate [-- --backup --dry-run] | db:names
// All but migrate and names open the file read-only, so they are safe while the app and the listener run.
import fs from "node:fs";

import Database from "better-sqlite3";

import { getDbPath } from "@/lib/db/db";
import { dbStats, runQuery, showSystem } from "@/lib/db/inspect";
import { MIGRATIONS, migrate, SCHEMA_VERSION, schemaVersion } from "@/lib/db/migrations";
import { NAMES_USER_AGENT, refreshCommodityNames } from "@/lib/eddn/commodity-names";

const [command, ...rest] = process.argv.slice(2);
const flag = (n: string) => rest.includes(`--${n}`);
const value = (n: string) => {
  const i = rest.indexOf(`--${n}`);
  return i >= 0 ? rest[i + 1] : undefined;
};
const positional = rest.filter((a, i) => !a.startsWith("--") && rest[i - 1] !== "--limit");
const file = getDbPath();
const n = (x: number) => x.toLocaleString("en-US");

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function open(readonly: boolean) {
  if (!fs.existsSync(file)) fail(`No database at ${file}. Run: npm run ingest`);
  return new Database(file, { readonly, fileMustExist: true });
}

switch (command) {
  case "stats": {
    const db = open(true);
    const s = dbStats(db);
    db.close();
    console.log(`${file}  (${(fs.statSync(file).size / 1024 ** 3).toFixed(2)} GB)`);
    console.log(`schema version ${s.schemaVersion}${s.schemaVersion === s.codeVersion ? " (current)" : ` (this app expects ${s.codeVersion}: run npm run db:migrate)`}`);
    console.log(`built ${s.builtAt ?? "?"} from dump ${s.dumpVersion ?? "?"}`);
    console.log("rows:", Object.entries(s.rows).map(([t, c]) => `${t} ${n(c)}`).join(", "));
    console.log(`${n(s.commodities)} commodities; ${n(s.ringsWithoutHotspots)} rings without hotspots${s.ringsWithoutHotspots === 0 ? " (a database built before every ring was stored has none: re-ingest)" : ""}`);
    console.log(`commodity names: ${s.commodityNames.checkedAt ? `last looked for ${s.commodityNames.checkedAt}, ${s.commodityNames.result}` : "never looked for (they come from the dump; the listener looks when it sees one it cannot name)"}`);
    console.log("systems by Powerplay state:");
    console.table(Object.fromEntries(s.powerStates.map((p) => [p.state, p.systems])));
    console.log(`market updates, newest ${s.newestMarket ?? "-"}, oldest ${s.oldestMarket ?? "-"}; stations updated within:`);
    console.table(Object.fromEntries(s.marketAges.map((a) => [a.within, a.stations])));
    break;
  }
  case "show": {
    const name = positional.join(" ");
    if (!name) fail('Usage: npm run db:show -- "System name"');
    const db = open(true);
    const view = showSystem(db, name);
    db.close();
    if (!view) fail(`No system called "${name}".`);
    console.log("SYSTEM");
    console.log(view.system);
    for (const t of view.stations) {
      const { top, ...station } = t;
      console.log(`\nSTATION ${station.name}`);
      console.log(station);
      console.table(top);
    }
    console.log(`\nRINGS (${view.rings.length})`);
    console.table(view.rings);
    console.log(`\nLANDABLE BODIES (${view.bodies.length})`);
    console.table(view.bodies);
    break;
  }
  case "sql": {
    const sql = positional.join(" ");
    if (!sql) fail('Usage: npm run db:sql -- "SELECT name FROM systems LIMIT 5"');
    const db = open(true);
    try {
      const { rows, more } = runQuery(db, sql, Number(value("limit") ?? 50));
      console.table(rows);
      if (more) console.log(`(more rows than shown: --limit ${value("limit") ?? 50})`);
    } catch (e) {
      fail(e instanceof Error ? e.message : String(e));
    } finally {
      db.close();
    }
    break;
  }
  case "migrate": {
    const db = open(false);
    const from = schemaVersion(db);
    const pending = MIGRATIONS.slice(from);
    if (from > SCHEMA_VERSION) fail(`The database is at version ${from}, newer than this app knows (${SCHEMA_VERSION}). Update the app.`);
    if (!pending.length) {
      console.log(`Already at version ${from}: nothing to do.`);
      db.close();
      break;
    }
    console.log(`Version ${from} -> ${SCHEMA_VERSION}:\n${pending.map((m) => `  ${m.version}. ${m.name}`).join("\n")}`);
    if (flag("dry-run")) {
      db.close();
      break;
    }
    // A migration is atomic (it all happens or none of it does), but a copy is the way back from a migration that was wrong.
    if (flag("backup")) {
      const backup = `${file}.v${from}.bak`;
      console.log(`Backing up to ${backup} ...`);
      db.close();
      fs.copyFileSync(file, backup);
      const again = open(false);
      console.log(migrate(again));
      again.close();
    } else {
      console.log(migrate(db));
      db.close();
    }
    break;
  }
  case "names": {
    // Looks for the names of commodities newer than the dump now, ignoring the listener's once-a-week limit.
    refreshCommodityNames({
      withDb: (fn) => {
        const db = open(false);
        try {
          return fn(db);
        } finally {
          db.close();
        }
      },
      userAgent: NAMES_USER_AGENT,
      force: true,
    })
      .then((done) => {
        if (!done.ran) return;
        console.log(done.result);
        if (done.result.startsWith("FAILED")) process.exitCode = 1;
      })
      .catch((e) => fail(e instanceof Error ? e.message : String(e)));
    break;
  }
  case "check":
    void import("./check-db"); // runs the check (also `npm run db:check`); takes --full
    break;
  default:
    fail("Usage: npm run db:stats | db:check | db:show -- <system> | db:sql -- <select> | db:migrate [-- --backup --dry-run] | db:names");
}
