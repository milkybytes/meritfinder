import fs from "node:fs";

import { afterAll, afterEach, describe, expect, it } from "vitest";

import { buildFixtureDb } from "@/test/galaxy";

import { GET } from "./route";

const { file, dir } = buildFixtureDb();
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));
afterEach(() => delete process.env.MERITFINDER_DB);

const get = (q?: string) => GET(new Request(`http://localhost/api/systems${q === undefined ? "" : `?q=${encodeURIComponent(q)}`}`));

describe("GET /api/systems", () => {
  it("returns matching systems as JSON, which a CDN or the browser may keep for a while", async () => {
    process.env.MERITFINDER_DB = file;
    const res = get("alp");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ name: "Alpha", power: "Aisling Duval" }]);
    expect(res.headers.get("cache-control")).toBe("public, max-age=60, s-maxage=3600");
  });

});
