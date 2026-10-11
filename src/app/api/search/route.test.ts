import fs from "node:fs";

import { afterAll, afterEach, describe, expect, it } from "vitest";

import { buildFixtureDb } from "@/test/galaxy";

import { GET } from "./route";

const { file, dir } = buildFixtureDb();
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));
afterEach(() => delete process.env.MERITFINDER_DB);

const get = (query: string) => GET(new Request(`http://localhost/api/search?${query}`));

describe("GET /api/search", () => {
  it("answers the same query the page has with the systems found, as JSON", async () => {
    process.env.MERITFINDER_DB = file;
    const res = get("goal=undermine&power=Edmund+Mahon&pad=S&maxAge=&ref=Origin&range=200");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ref.name).toBe("Origin");
    expect(body.rows.map((r: { name: string }) => r.name)).toContain("Alpha");
  });

  it("answers 503 and says nothing about why when the database cannot be read", async () => {
    process.env.MERITFINDER_DB = `${dir}/missing.sqlite`;
    const res = get("ref=Origin");
    expect(res.status).toBe(503);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ error: "search failed" });
  });
});
