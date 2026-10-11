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
export function withDb<T>(fn: (db: Database.Database) => T): T {
  const db = new Database(getDbPath(), { readonly: true, fileMustExist: true });
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

// Whether the file's schema is the one this app expects (see migrations.ts).
export const schemaCurrent = (): boolean => withDb((db) => schemaVersion(db) === SCHEMA_VERSION);

export type DatabaseState = "missing" | "outdated" | "ok";

// Whether the app can use its database: there is one, and its schema is the expected one.
export function databaseState(): DatabaseState {
  if (!fs.existsSync(/* turbopackIgnore: true */ getDbPath())) return "missing";
  return schemaCurrent() ? "ok" : "outdated";
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
