// Builds the SQLite database from the Spansh galaxy_stations dump (~4.5 GB, one system per line).
//   npm run ingest [-- --force | --file dump.json[.gz] [--max-systems N]]
// Writes <db>.new and renames it over the live file when done, so the app never sees a half-built database.
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { Readable } from "node:stream";
import zlib from "node:zlib";

import { getDbPath, openWritable } from "../src/lib/db/db";
import { resumableDownload } from "../src/lib/ingest/download";
import { storeCommoditySymbols, storeCommodities } from "../src/lib/ingest/finalize";
import { createIngester } from "../src/lib/ingest/ingest-system";

const DUMP_URL = "https://downloads.spansh.co.uk/galaxy_stations.json.gz";

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const opt = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};

async function openSource(): Promise<{ stream: Readable; version: string }> {
  const file = opt("file");
  if (file) {
    const raw = fs.createReadStream(file);
    return { stream: file.endsWith(".gz") ? raw.pipe(zlib.createGunzip()) : raw, version: `file:${path.basename(file)}` };
  }
  const head = await fetch(DUMP_URL, { method: "HEAD" });
  const version = `${head.headers.get("etag")}|${head.headers.get("last-modified")}`;
  const prev = (() => {
    try {
      return fs.readFileSync(getDbPath() + ".version", "utf8");
    } catch {
      return "";
    }
  })();
  if (!flag("force") && prev === version) {
    console.log("Dump unchanged; nothing to do.");
    process.exit(0);
  }
  // Resumes after dropped connections; errors (including a dump that changed mid-download) surface through gunzip.
  const download = resumableDownload(DUMP_URL);
  const gunzip = zlib.createGunzip();
  download.on("error", (e) => gunzip.destroy(e));
  return { stream: download.pipe(gunzip), version };
}

async function main() {
  const maxSystems = Number(opt("max-systems") ?? Infinity);
  const { stream, version } = await openSource();
  fs.mkdirSync(path.dirname(getDbPath()), { recursive: true });
  const tmp = getDbPath() + ".new";
  fs.rmSync(tmp, { force: true });
  const db = openWritable(tmp);

  const addSystem = createIngester(db);

  let seen = 0;
  let kept = 0;
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const raw of rl) {
    const line = raw.trim();
    if (!line.startsWith("{")) continue; // "[" and "]"
    let s;
    try {
      s = JSON.parse(line.endsWith(",") ? line.slice(0, -1) : line);
    } catch {
      continue;
    }
    seen++;
    if (addSystem(s)) kept++;
    if (seen % 20000 === 0) console.log(`${seen} systems read, ${kept} kept`);
    if (seen >= maxSystems) {
      rl.close();
      stream.destroy();
      break;
    }
  }

  console.log(`${storeCommodities(db)} commodities, ${storeCommoditySymbols(db, addSystem.symbols)} symbols`);
  db.prepare(`INSERT OR REPLACE INTO meta VALUES ('dump_version', ?), ('built_at', ?)`).run(version, new Date().toISOString());
  db.close();
  fs.renameSync(tmp, getDbPath());
  if (!opt("file")) fs.writeFileSync(getDbPath() + ".version", version);
  console.log(`Done: ${seen} systems read, ${kept} kept -> ${getDbPath()}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
