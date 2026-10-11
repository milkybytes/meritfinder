import type Database from "better-sqlite3";

import { SCHEMA } from "./schema";

// The database's shape over time. The file keeps the number of the last migration applied (PRAGMA user_version); a change to the tables is a new
// entry at the end of MIGRATIONS, never an edit to an old one, and `npm run db:migrate` updates an existing database in place.
export interface Migration {
  version: number; // 1, 2, 3 ... with no gaps
  name: string;
  up: (db: Database.Database) => void;
}

export const MIGRATIONS: Migration[] = [
  // The schema (schema.ts). Everything in it is "if not exists", so a database built before migrations existed, which has no number,
  // is brought under them by this one doing nothing to it.
  { version: 1, name: "baseline schema", up: (db) => db.exec(SCHEMA) },
];

export const SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

export const schemaVersion = (db: Database.Database): number => db.pragma("user_version", { simple: true }) as number;

export interface MigrationResult {
  from: number;
  to: number;
  applied: string[]; // names, in the order they ran
}

// Applies the migrations a database has not had. Each runs in its own transaction with the version, so a failure leaves the database as it was before
// that one. A database from a newer app is refused.
export function migrate(db: Database.Database, migrations: Migration[] = MIGRATIONS): MigrationResult {
  migrations.forEach((m, i) => {
    if (m.version !== i + 1) throw new Error(`migrations must be numbered 1, 2, 3 ... in order: found ${m.version} at position ${i + 1}`);
  });
  const from = schemaVersion(db);
  const latest = migrations.length;
  if (from > latest) throw new Error(`the database is at version ${from}, newer than this app knows (${latest}): update the app`);

  const applied: string[] = [];
  for (const m of migrations.slice(from)) {
    db.transaction(() => {
      m.up(db);
      db.pragma(`user_version = ${m.version}`);
    })();
    applied.push(m.name);
  }
  return { from, to: latest, applied };
}
