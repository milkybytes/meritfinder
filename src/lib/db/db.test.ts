import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { afterAll, afterEach, describe, expect, it } from "vitest";

import { buildFixtureDb } from "@/test/galaxy";

import { databaseState, withDb } from "./db";
import { SCHEMA_VERSION } from "./migrations";

const { file, dir } = buildFixtureDb();
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));
afterEach(() => delete process.env.MERITFINDER_DB);

describe("databaseState", () => {
  it("is missing when there is no file", () => {
    process.env.MERITFINDER_DB = path.join(dir, "nothing.sqlite");
    expect(databaseState()).toBe("missing");
  });

  it("is ok for a database at the schema version the app expects", () => {
    process.env.MERITFINDER_DB = file;
    expect(databaseState()).toBe("ok");
  });

  it("is unreadable, not an error, for a file that is not a database", () => {
    const broken = path.join(dir, "broken.sqlite");
    fs.writeFileSync(broken, "this is not a sqlite file, but it is long enough to be mistaken for one ".repeat(100));
    process.env.MERITFINDER_DB = broken;
    expect(databaseState()).toBe("unreadable");
  });

  it.each([0, SCHEMA_VERSION + 1])("is outdated for one at version %i", (version) => {
    const copy = path.join(dir, `v${version}.sqlite`);
    fs.copyFileSync(file, copy);
    const db = new Database(copy);
    db.pragma(`user_version = ${version}`);
    db.close();
    process.env.MERITFINDER_DB = copy;
    expect(databaseState()).toBe("outdated");
  });
});

describe("a write that was cut short", () => {
  // The writer is killed in the middle of a transaction big enough to have spilled to the file, as when the listener is OOM-killed.
  const killedMidWrite = (name: string) => {
    const copy = path.join(dir, name);
    fs.copyFileSync(file, copy);
    const script = [
      'const D = require("better-sqlite3"); const db = new D(process.argv[1]);',
      'db.pragma("cache_size = 20"); db.exec("BEGIN");',
      'const ins = db.prepare("INSERT INTO meta VALUES (?, ?)");',
      'for (let i = 0; i < 20000; i++) ins.run("k" + i, "x".repeat(200));',
      'process.kill(process.pid, "SIGKILL");',
    ].join(" ");
    spawnSync(process.execPath, ["-e", script, copy]);
    return copy;
  };

  it("leaves a database no read-only connection can read (the failure being guarded against)", () => {
    const copy = killedMidWrite("cut-a.sqlite");
    expect(fs.existsSync(copy + "-journal")).toBe(true);
    const db = new Database(copy, { readonly: true });
    try {
      expect(() => db.pragma("user_version")).toThrow(/readonly/);
    } finally {
      db.close();
    }
  });

  it("is repaired by the app's own read, so a dead listener does not take the page down", () => {
    const copy = killedMidWrite("cut-b.sqlite");
    process.env.MERITFINDER_DB = copy;
    expect(withDb((db) => db.pragma("user_version", { simple: true }))).toBe(SCHEMA_VERSION);
    expect(fs.existsSync(copy + "-journal")).toBe(false);
    expect(databaseState()).toBe("ok");
  });
});
