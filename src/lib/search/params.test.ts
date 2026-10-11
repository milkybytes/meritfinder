import { describe, expect, it } from "vitest";

import { MAX_NAME_LENGTH, MAX_RANGE, parseParams, type RawParams } from "./params";
describe("parseParams", () => {
  it("applies sensible defaults to an empty query", () => {
    expect(parseParams({})).toEqual({
      ref: "", range: 50, power: "", goal: "undermine", target: [], commodity: [], minPrice: 0, minDemand: 0,
      pad: "L", maxStationLs: 0, maxAgeDays: 7, method: "any", ringTypes: [], reserve: [], mining: "possible",
      material: [], states: [], sort: "price", limit: 25,
    });
  });

  it("clamps the range to 1..500", () => {
    expect(MAX_RANGE).toBe(500);
    expect(parseParams({ range: "9999" }).range).toBe(500);
    expect(parseParams({ range: "500" }).range).toBe(500);
    expect(parseParams({ range: "-5" }).range).toBe(1);
    expect(parseParams({ range: "0" }).range).toBe(1);
    expect(parseParams({ range: "abc" }).range).toBe(50);
    expect(parseParams({ range: "250" }).range).toBe(250);
  });

  it("market age: 7 days when absent, no limit when blank or 0", () => {
    expect(parseParams({}).maxAgeDays).toBe(7);
    expect(parseParams({ maxAge: "" }).maxAgeDays).toBe(0);
    expect(parseParams({ maxAge: "0" }).maxAgeDays).toBe(0);
    expect(parseParams({ maxAge: "30" }).maxAgeDays).toBe(30);
  });

  it("accepts one or many values for multi-select fields, dropping empties", () => {
    expect(parseParams({ commodity: "Monazite" }).commodity).toEqual(["Monazite"]);
    expect(parseParams({ commodity: ["Monazite", "Gold"] }).commodity).toEqual(["Monazite", "Gold"]);
    expect(parseParams({ commodity: ["", "Gold"] }).commodity).toEqual(["Gold"]);
    expect(parseParams({ state: ["Boom", "Bust"] }).states).toEqual(["Boom", "Bust"]);
    expect(parseParams({ ringType: "Icy", reserve: "Pristine", target: "Yuri Grom", material: ["Tritium"] })).toMatchObject({
      ringTypes: ["Icy"], reserve: ["Pristine"], target: ["Yuri Grom"], material: ["Tritium"],
    });
  });

  it("falls back to defaults for invalid enum values", () => {
    const p = parseParams({ goal: "conquer", pad: "XL", method: "dynamite", mining: "maybe", sort: "random" });
    expect(parseParams({ goal: "any" }).goal).toBe("undermine"); // not offered: an unknown goal is the default
    expect(p).toMatchObject({ goal: "undermine", pad: "L", method: "any", mining: "possible", sort: "price" });
  });
});

describe("parseParams: hostile input", () => {
  const SQL = "x'; DROP TABLE systems; --";

  it("keeps every number inside a sane range, whatever it is given", () => {
    for (const v of ["-1", "-1e308", "1e308", "Infinity", "-Infinity", "NaN", "0x10", "1e3", " 5 ", "9".repeat(400), "3.7"]) {
      const p = parseParams({ range: v, minPrice: v, minDemand: v, maxLs: v, maxAge: v, limit: v });
      for (const n of [p.range, p.minPrice, p.minDemand, p.maxStationLs, p.maxAgeDays, p.limit]) {
        expect(Number.isFinite(n), v).toBe(true);
        expect(Number.isInteger(n), v).toBe(true);
        expect(n, v).toBeGreaterThanOrEqual(0);
      }
      expect(p.range).toBeLessThanOrEqual(MAX_RANGE);
      expect(p.range).toBeGreaterThanOrEqual(1);
      expect(p.maxAgeDays).toBeLessThanOrEqual(3650);
    }
  });

  it("caps the length of the reference system and strips control characters", () => {
    expect(parseParams({ ref: "A".repeat(10_000) }).ref).toHaveLength(MAX_NAME_LENGTH);
    expect(parseParams({ ref: "Sol\u0000\n\u001b[31m" }).ref).toBe("Sol[31m");
  });

  it("only accepts known powers, ring types and reserve levels", () => {
    const p = parseParams({ power: "Mallory Vance", target: ["Yuri Grom", SQL], ringType: ["Icy", "Plasma"], reserve: ["Pristine", "Mythic"] });
    expect(p.power).toBe("");
    expect(p.target).toEqual(["Yuri Grom"]);
    expect(p.ringTypes).toEqual(["Icy"]);
    expect(p.reserve).toEqual(["Pristine"]);
    expect(parseParams({ power: "Yuri Grom" }).power).toBe("Yuri Grom");
  });

  it("never throws, and always returns the same shape, for odd keys and values", () => {
    const shape = Object.keys(parseParams({})).sort();
    const odd: RawParams[] = [
      { __proto__: "x", constructor: "y", toString: "z" } as unknown as RawParams,
      { ref: [] as string[], commodity: undefined, range: [] as string[] },
      { ref: SQL, power: SQL, goal: SQL, method: SQL, sort: SQL },
      Object.fromEntries(Array.from({ length: 2000 }, (_, i) => ["k" + i, "v"])),
    ];
    for (const raw of odd) expect(Object.keys(parseParams(raw)).sort()).toEqual(shape);
  });
});
