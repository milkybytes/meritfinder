import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import { migrate, SCHEMA_VERSION, schemaVersion } from "./migrations";

// Resolved on each call so tests (and tools) can point MERITFINDER_DB elsewhere after import.
export const getDbPath = () => process.env.MERITFINDER_DB ?? path.join(process.cwd(), "data", "meritfinder.sqlite");

// Identifies this build of the database file, for anything cached from it: it changes when the ingest replaces the file, not when live updates write
// into it (results cached across those are at most the cache lifetime out of date).
export const dbKey = () => {
  const st = fs.statSync(/* turbopackIgnore: true */ getDbPath());
  return `${st.ino}:${st.birthtimeMs}`;
};

// Web app: run fn against a read-only handle that is closed straight afterwards. Never keep
// the handle open between requests: on Windows an open handle stops the ingest replacing the file.
//
// A writer killed mid-transaction (the listener: OOM, kill -9, a power cut) leaves a journal that has to be rolled back before anything
// can read the file, and a read-only handle can't do that. SQLite never corrupts the database this way; the file is just unreadable until
// a connection that may write opens it. So on that one error this opens one writable connection, which repairs it, and tries again.
// That needs write access to the data folder; where there is none, the error stands and the page says the database can't be read.
export function withDb<T>(fn: (db: Database.Database) => T): T {
  try {
    return readOnly(fn);
  } catch (e) {
    if ((e as { code?: string }).code !== "SQLITE_READONLY_ROLLBACK" || !repairInterruptedWrite()) throw e;
    return readOnly(fn);
  }
}

function readOnly<T>(fn: (db: Database.Database) => T): T {
  const db = new Database(getDbPath(), { readonly: true, fileMustExist: true });
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

// Opening for writing is what rolls a hot journal back. Returns whether it could.
function repairInterruptedWrite(): boolean {
  try {
    const db = new Database(getDbPath(), { fileMustExist: true });
    try {
      db.pragma("user_version");
    } finally {
      db.close();
    }
    return true;
  } catch {
    return false;
  }
}

// Whether the file's schema is the one this app expects (see migrations.ts).
export const schemaCurrent = (): boolean => withDb((db) => schemaVersion(db) === SCHEMA_VERSION);

// "unreadable": there is a file but it can not be read right now, typically a write that was cut short (a listener killed mid-write
// leaves a journal that only a writer can roll back, see scripts/eddn-listener.ts).
export type DatabaseState = "missing" | "outdated" | "unreadable" | "ok";

// Whether the app can use its database: there is one, it can be read, and its schema is the expected one.
export function databaseState(): DatabaseState {
  if (!fs.existsSync(/* turbopackIgnore: true */ getDbPath())) return "missing";
  try {
    return schemaCurrent() ? "ok" : "outdated";
  } catch {
    return "unreadable";
  }
}

// A new database, or one being built (the ingest): all migrations run, so it has the current shape. Journal off for speed: use
// this for files nobody else is reading. To change a database in use, see scripts/db.ts (migrate).
export function openWritable(file: string): Database.Database {
  const w = new Database(file);
  w.pragma("journal_mode = OFF");
  w.pragma("synchronous = OFF");
  migrate(w);
  return w;
}
