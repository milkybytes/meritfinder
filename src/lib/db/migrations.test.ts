import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

import { MIGRATIONS, migrate, SCHEMA_VERSION, schemaVersion, type Migration } from "./migrations";
import { SCHEMA } from "./schema";

const memory = () => new Database(":memory:");
const columnsOf = (db: Database.Database, table: string) => (db.pragma(`table_info(${table})`) as { name: string }[]).map((c) => c.name);

describe("migrations", () => {
  it("are numbered 1, 2, 3 ... with names, and the app's version is the last", () => {
    expect(MIGRATIONS.map((m) => m.version)).toEqual(MIGRATIONS.map((_, i) => i + 1));
    for (const m of MIGRATIONS) expect(m.name).not.toBe("");
    expect(SCHEMA_VERSION).toBe(MIGRATIONS.length);
  });

  it("build a new database with every table, at the current version", () => {
    const db = memory();
    const result = migrate(db);
    expect(result).toEqual({ from: 0, to: SCHEMA_VERSION, applied: MIGRATIONS.map((m) => m.name) });
    expect(schemaVersion(db)).toBe(SCHEMA_VERSION);
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map((t) => t.name);
    expect(tables).toEqual(expect.arrayContaining(["meta", "systems", "bodies", "rings", "ring_hotspots", "stations", "market"]));
  });

  it("do nothing to a database that is up to date", () => {
    const db = memory();
    migrate(db);
    expect(migrate(db)).toEqual({ from: SCHEMA_VERSION, to: SCHEMA_VERSION, applied: [] });
  });

  it("take in a database built before migrations existed, keeping its data", () => {
    const db = memory();
    db.exec(SCHEMA); // as the old ingest made it: tables, but no version
    db.prepare("INSERT INTO systems (id64, name, x, y, z) VALUES (1, 'Sol', 0, 0, 0)").run();
    expect(schemaVersion(db)).toBe(0);
    migrate(db);
    expect(schemaVersion(db)).toBe(SCHEMA_VERSION);
    expect(db.prepare("SELECT name FROM systems").all()).toEqual([{ name: "Sol" }]);
  });

  describe("later ones", () => {
    const addColumn: Migration = { version: SCHEMA_VERSION + 1, name: "add stations.fuel", up: (db) => db.exec("ALTER TABLE stations ADD COLUMN fuel INTEGER") };
    const list = [...MIGRATIONS, addColumn];

    it("run on an existing database without touching what was already there", () => {
      const db = memory();
      migrate(db);
      db.prepare("INSERT INTO systems (id64, name, x, y, z) VALUES (1, 'Sol', 0, 0, 0)").run();
      db.prepare("INSERT INTO stations (id, system_id64, name) VALUES (7, 1, 'Daedalus')").run();

      const result = migrate(db, list);
      expect(result).toEqual({ from: SCHEMA_VERSION, to: SCHEMA_VERSION + 1, applied: ["add stations.fuel"] });
      expect(columnsOf(db, "stations")).toContain("fuel");
      expect(db.prepare("SELECT name, fuel FROM stations").all()).toEqual([{ name: "Daedalus", fuel: null }]);
      expect(schemaVersion(db)).toBe(SCHEMA_VERSION + 1);
    });

    it("leave the database as it was when one fails, at the version of the last that worked", () => {
      const db = memory();
      migrate(db);
      const broken: Migration = {
        version: SCHEMA_VERSION + 1,
        name: "half done",
        up: (d) => {
          d.exec("ALTER TABLE stations ADD COLUMN fuel INTEGER");
          throw new Error("boom");
        },
      };
      expect(() => migrate(db, [...MIGRATIONS, broken])).toThrow("boom");
      expect(schemaVersion(db)).toBe(SCHEMA_VERSION);
      expect(columnsOf(db, "stations")).not.toContain("fuel"); // the half that ran was undone
    });

  });

  it("refuse a database from a newer version of the app", () => {
    const db = memory();
    db.pragma(`user_version = ${SCHEMA_VERSION + 1}`);
    expect(() => migrate(db)).toThrow(/newer than this app knows/);
  });

});
