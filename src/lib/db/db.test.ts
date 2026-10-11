import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { afterAll, afterEach, describe, expect, it } from "vitest";

import { buildFixtureDb } from "@/test/galaxy";

import { databaseState } from "./db";
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
