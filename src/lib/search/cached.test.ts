import fs from "node:fs";

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildFixtureDb } from "../../test/galaxy";

import { cachedSearch } from "./cached";
import { search, type SearchParams } from "./search";

// The real search, wrapped so the tests can count how often the database is actually read.
vi.mock("./search", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./search")>();
  return { ...actual, search: vi.fn(actual.search) };
});
const reads = vi.mocked(search);

const { file, dir } = buildFixtureDb();
process.env.MERITFINDER_DB = file;
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

// The cache is rebuilt whenever the time to live changes, so a new value per test gives each a fresh, empty cache.
let ttl = 1000;
beforeEach(() => {
  process.env.MERITFINDER_CACHE_TTL_SECONDS = String(ttl++);
  reads.mockClear();
});
afterEach(() => {
  delete process.env.MERITFINDER_CACHE_TTL_SECONDS;
});

const base: SearchParams = {
  ref: "Origin", range: 200, power: "", goal: "any", target: [], commodity: [], minPrice: 0, minDemand: 0,
  pad: "S", maxStationLs: 0, maxAgeDays: 0, method: "any", material: [], ringTypes: [], mining: "possible",
  sort: "distance", limit: 50, states: [], reserve: [],
};

describe("cachedSearch", () => {
  it("answers an identical search from memory, without reading the database again", () => {
    const first = cachedSearch(base);
    const second = cachedSearch({ ...base });
    expect(second).toBe(first);
    expect(reads).toHaveBeenCalledTimes(1);
  });

  it("does not serve results from an older build of the database", () => {
    cachedSearch(base);
    const fresh = file + ".new";
    fs.copyFileSync(file, fresh);
    fs.renameSync(fresh, file); // what the ingest does: a new file takes the old one's place
    cachedSearch(base);
    expect(reads).toHaveBeenCalledTimes(2);
  });

  it("does not remember a partial result, which depends on how busy the server was", () => {
    reads.mockReturnValue({ ref: null, rows: [], truncated: false, partial: true });
    cachedSearch(base);
    cachedSearch(base);
    expect(reads).toHaveBeenCalledTimes(2);
    reads.mockRestore();
  });
});
