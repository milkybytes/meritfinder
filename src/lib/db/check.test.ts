import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { afterAll, describe, expect, it } from "vitest";

import { buildFixtureDb } from "../../test/galaxy";

import { checkDatabase } from "./check";

const built = buildFixtureDb();
afterAll(() => fs.rmSync(built.dir, { recursive: true, force: true }));

// Each test damages its own copy of the fixture database, then runs the check against it.
let n = 0;
function damaged(sql: string, kind: "problems" | "warnings" = "problems"): string[] {
  const file = path.join(built.dir, `copy-${n++}.sqlite`);
  fs.copyFileSync(built.file, file);
  const db = new Database(file);
  try {
    db.pragma("foreign_keys = OFF");
    db.exec(sql);
    return checkDatabase(db)[kind];
  } finally {
    db.close(); // an open handle would stop the folder being removed on Windows
  }
}

describe("checkDatabase", () => {
  it("passes a database built by the ingest, and counts its rows", () => {
    const db = new Database(built.file, { readonly: true });
    const r = checkDatabase(db, { full: true });
    db.close();
    expect(r.problems).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.counts).toMatchObject({ systems: 6, stations: 6 });
    expect(r.counts.market).toBeGreaterThan(0);
  });

  describe("shape", () => {

    it("notices a missing column", () => {
      expect(damaged("ALTER TABLE stations DROP COLUMN best_price")).toContain('stations: missing column "best_price"');
    });

  });

  describe("lookups use indexes", () => {
    it("notices when the search's per-system lookup would read the whole table", () => {
      // without this index the rings of a system can only be found by scanning every ring
      const problems = damaged("DROP TABLE bodies; CREATE TABLE bodies (system_id64 INTEGER NOT NULL, body_id INTEGER NOT NULL, name TEXT NOT NULL, subtype TEXT, volcanism TEXT, body_class TEXT, gravity REAL, distance_ls REAL, mining_signals INTEGER);");
      expect(problems.join("\n")).toMatch(/missing index "bodies_system"|bodies of a system: reads a whole table/);
    });
  });

  describe("data", () => {
    it("notices rows that point at nothing", () => {
      expect(damaged("INSERT INTO stations VALUES (999, 424242, 'Nowhere', 'Outpost', 1, 0, 1, NULL, 100)")).toContain("1 stations without a system");
      expect(damaged("DELETE FROM systems WHERE id64 = 2")).toEqual(expect.arrayContaining([expect.stringMatching(/without a system/)]));
      expect(damaged("INSERT INTO market VALUES (31337, 'Gold', 10, 100)")).toContain("1 market rows without a station");
      expect(damaged("INSERT INTO ring_hotspots VALUES (2, 'No Such Ring', 'Monazite', 1)")).toContain("1 hotspots without a ring");
    });

    it("notices a best_price below what the market pays: the price ranking would skip the system", () => {
      const problems = damaged("UPDATE stations SET best_price = 1");
      expect(problems.join()).toMatch(/best_price below what their market pays/);
    });

  });
});
