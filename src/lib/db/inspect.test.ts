import fs from "node:fs";

import Database from "better-sqlite3";
import { afterAll, describe, expect, it } from "vitest";

import { buildFixtureDb } from "@/test/galaxy";

import { dbStats, runQuery, showSystem } from "./inspect";

const { file, dir } = buildFixtureDb();
const db = new Database(file, { readonly: true });
afterAll(() => {
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("dbStats", () => {
  const s = dbStats(db);

  it("counts the rows of each table", () => {
    expect(s.rows.systems).toBeGreaterThan(3);
    expect(s.rows.market).toBeGreaterThan(5);
    expect(Object.keys(s.rows)).toEqual(["systems", "stations", "market", "bodies", "rings", "ring_hotspots"]);
  });

});

describe("showSystem", () => {
  it("finds a system by name in any case, with its stations, best prices, rings and planets", () => {
    const v = showSystem(db, "aLpHa")!;
    expect(v.system.name).toBe("Alpha");
    expect(v.stations[0].top[0]).toMatchObject({ commodity: "Monazite", sell_price: 500000 });
    expect(v.stations[0].top.map((t) => t.sell_price)).toEqual([...v.stations[0].top.map((t) => t.sell_price)].sort((a, b) => b - a));
    expect(v.rings).toHaveLength(4);
    expect(v.rings.find((r) => r.type === "Rocky")?.hotspots).toBe("Monazite x2");
    expect(v.bodies.length).toBeGreaterThan(0);
  });

});

describe("runQuery", () => {

  it("refuses a statement that is not a query, and changes nothing even if it got that far", () => {
    expect(() => runQuery(db, "DELETE FROM systems")).toThrow(/only statements that return rows/);
    expect(runQuery(db, "SELECT COUNT(*) n FROM systems").rows[0]).not.toEqual({ n: 0 });
  });
});
