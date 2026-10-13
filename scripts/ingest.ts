// Builds the SQLite database from the Spansh galaxy_stations dump (~4.5 GB, one system per line).
//   npm run ingest [-- --force | --file dump.json[.gz] [--max-systems N] | --discard-live | --download | --no-keep]
// The dump is read from data/galaxy_stations.json.gz if it is there (drop it in by hand, or let a download leave it), so re-running costs
// no download. Without that file it is fetched from Spansh, once, and kept there. --download fetches it again; --no-keep does not leave a copy.
// Writes <db>.new and renames it over the live file when done, so the app never sees a half-built database. What the live database
// learned from EDDN is carried into the new one (newer observations win); if it can't be (a different schema: run db:migrate first),
// this stops before the download unless --discard-live says to build without it.
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { Readable } from "node:stream";
import zlib from "node:zlib";

import { getDbPath, openWritable } from "../src/lib/db/db";
import { resumableDownload, USER_AGENT } from "../src/lib/ingest/download";
import { MAX_MARKET_AGE_DAYS } from "../src/data/retention";
import { carryForward, carryForwardBlocker } from "../src/lib/ingest/carry-forward";
import { storeCommoditySymbols, storeCommodities } from "../src/lib/ingest/finalize";
import { createIngester } from "../src/lib/ingest/ingest-system";

const DUMP_URL = "https://downloads.spansh.co.uk/galaxy_stations.json.gz";

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const opt = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};

// Where a dump kept for next time lives: beside the database, so in Docker it is in the data volume.
const LOCAL_DUMP = path.join(path.dirname(getDbPath()), "galaxy_stations.json.gz");

const previousVersion = (): string => {
  try {
    return fs.readFileSync(getDbPath() + ".version", "utf8");
  } catch {
    return "";
  }
};

// A kept or dropped-in file is identified by what it is, so the same file is not built twice and a new one is.
const fileVersion = (file: string): string => {
  const st = fs.statSync(file);
  return `file:${path.basename(file)}:${st.size}:${Math.round(st.mtimeMs)}`;
};

// `record`: whether the dump's version is remembered, so an unchanged one is skipped next time (not for --file, which always builds).
async function openSource(): Promise<{ stream: Readable; version: string; record: boolean }> {
  const file = opt("file");
  if (file) {
    const raw = fs.createReadStream(file);
    return { stream: file.endsWith(".gz") ? raw.pipe(zlib.createGunzip()) : raw, version: `file:${path.basename(file)}`, record: false };
  }

  if (fs.existsSync(LOCAL_DUMP) && !flag("download")) {
    const version = fileVersion(LOCAL_DUMP);
    if (!flag("force") && previousVersion() === version) {
      console.log(`${LOCAL_DUMP} has not changed since it was last built; nothing to do. (--force builds it again.)`);
      process.exit(0);
    }
    console.log(`Reading the dump from ${LOCAL_DUMP}; nothing is downloaded.`);
    return { stream: fs.createReadStream(LOCAL_DUMP).pipe(zlib.createGunzip()), version, record: true };
  }

  const head = await fetch(DUMP_URL, { method: "HEAD", headers: { "User-Agent": USER_AGENT } });
  const version = `${head.headers.get("etag")}|${head.headers.get("last-modified")}`;
  if (!flag("force") && previousVersion() === version) {
    console.log("Dump unchanged; nothing to do.");
    process.exit(0);
  }
  console.log(`Downloading ${DUMP_URL}${flag("no-keep") ? "" : ` (a copy is kept at ${LOCAL_DUMP} so this is not repeated)`}.`);
  // Resumes after dropped connections; errors (including a dump that changed mid-download) surface through gunzip.
  const download = resumableDownload(DUMP_URL);
  const gunzip = zlib.createGunzip();
  download.on("error", (e) => gunzip.destroy(e));
  if (!flag("no-keep")) {
    const part = LOCAL_DUMP + ".part";
    fs.mkdirSync(path.dirname(LOCAL_DUMP), { recursive: true });
    const out = fs.createWriteStream(part);
    download.on("error", () => {
      out.destroy();
      fs.rmSync(part, { force: true });
    });
    out.on("finish", () => fs.renameSync(part, LOCAL_DUMP));
    download.pipe(out);
  }
  return { stream: download.pipe(gunzip), version, record: true };
}

// One ingest at a time: two would write the same <db>.new. The lock is a file beside the database; a crash leaves it behind.
const lockFile = getDbPath() + ".ingest.lock";
function takeLock(): void {
  fs.mkdirSync(path.dirname(lockFile), { recursive: true });
  try {
    fs.writeFileSync(lockFile, `${process.pid} ${new Date().toISOString()}
`, { flag: "wx" });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    throw new Error(`another ingest is running, or died without cleaning up (${lockFile}: ${fs.readFileSync(lockFile, "utf8").trim()}). If none is running, delete that file.`);
  }
  process.on("exit", () => fs.rmSync(lockFile, { force: true }));
  for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => process.exit(130));
}

async function main() {
  takeLock();
  if (fs.existsSync(getDbPath()) && !flag("discard-live")) {
    const why = carryForwardBlocker(getDbPath());
    if (why) throw new Error(`${why}. Run npm run db:migrate first so what it learned can be kept, or pass --discard-live to build without it.`);
  }
  const maxSystems = Number(opt("max-systems") ?? Infinity);
  const { stream, version, record } = await openSource();
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

  // What the live listener has learned since: new places, and anything it saw more recently than the dump did. Never replaced by older data.
  if (fs.existsSync(getDbPath()) && !flag("discard-live")) {
    try {
      const carried = carryForward(db, getDbPath(), new Date(Date.now() - MAX_MARKET_AGE_DAYS * 86400_000).toISOString());
      console.log(`kept from the live database: ${carried.systems} systems, ${carried.stations} stations, ${carried.bodies} bodies, ${carried.rings} rings`);
    } catch (e) {
      console.log(`not keeping anything from the live database: ${(e as Error).message}`);
    }
    storeCommodities(db); // again: carried markets can hold commodities the dump did not
  }
  db.prepare(`INSERT OR REPLACE INTO meta VALUES ('dump_version', ?), ('built_at', ?)`).run(version, new Date().toISOString());
  db.close();
  fs.renameSync(tmp, getDbPath());
  // A dump kept from this download is what the next run will find, so that is the version to remember.
  if (record) fs.writeFileSync(getDbPath() + ".version", fs.existsSync(LOCAL_DUMP) && !flag("no-keep") ? fileVersion(LOCAL_DUMP) : version);
  console.log(`Done: ${seen} systems read, ${kept} kept -> ${getDbPath()}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
