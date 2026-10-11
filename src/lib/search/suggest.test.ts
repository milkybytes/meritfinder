import fs from "node:fs";

import { afterAll, describe, expect, it } from "vitest";

import { buildFixtureDb } from "../../test/galaxy";

import { MIN_SUGGEST_CHARS, suggestSystems } from "./suggest";
const { file, dir } = buildFixtureDb();
process.env.MERITFINDER_DB = file;
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe("suggestSystems", () => {
  it("lists systems whose name starts with the text, alphabetically, with their controlling power", () => {
    expect(suggestSystems("al")).toEqual([{ name: "Alpha", power: "Aisling Duval" }]);
    expect(suggestSystems("ga")).toEqual([{ name: "Gamma", power: "Zemina Torval" }]);
  });

  it("suggests nothing for text that is too short to be useful", () => {
    expect(MIN_SUGGEST_CHARS).toBe(2);
    expect(suggestSystems("a")).toEqual([]);
    expect(suggestSystems("")).toEqual([]);
    expect(suggestSystems(null)).toEqual([]);
    expect(suggestSystems("  a  ")).toEqual([]);
  });

  it("is not fooled by SQL in the text", () => {
    for (const q of ["x'; DROP TABLE systems; --", "' OR 1=1 --", "Al' UNION SELECT name,name FROM sqlite_master --"]) expect(suggestSystems(q), q).toEqual([]);
    expect(suggestSystems("alpha")).toHaveLength(1); // nothing was dropped
  });

});
