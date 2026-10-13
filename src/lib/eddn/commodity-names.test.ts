import Database from "better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { migrate } from "../db/migrations";

import { fetchCommodityNames, namesDue, namesState, NAMES_INTERVAL_MS, parseCommodityCsv, provisionalName, recordNames, refreshCommodityNames } from "./commodity-names";

// A table of the size the checks want, with the one new entry the tests look for.
const csv = (extra = "") =>
  ["id,symbol,category,name", ...Array.from({ length: 60 }, (_, i) => `${100 + i},Thing${i},Metals,Thing ${i}`), "7,PowerGridAssembly,Machinery,Energy Grid Assembly", extra].join("\r\n");

describe("parseCommodityCsv", () => {
  it("reads symbol and name, with symbols in lower case", () => {
    const m = parseCommodityCsv(csv("9,LowTemperatureDiamond,Minerals,Low Temperature Diamonds"));
    expect(m.get("powergridassembly")).toBe("Energy Grid Assembly");
    expect(m.get("lowtemperaturediamond")).toBe("Low Temperature Diamonds");
  });

  it("reads quoted fields", () => {
    expect(parseCommodityCsv(csv('9,Quoted,Metals,"Quoted Name"')).get("quoted")).toBe("Quoted Name");
  });

  it("drops rows that are not a plausible symbol and name, and refuses a file that is not the table", () => {
    const m = parseCommodityCsv(csv(["9,bad symbol,Metals,Name", "10,Fine,Metals,<script>", "11,,Metals,Nothing"].join("\r\n")));
    expect([...m.keys()].filter((k) => ["bad symbol", "fine", ""].includes(k))).toEqual([]);
    expect(() => parseCommodityCsv("<html>not found</html>")).toThrow(/columns/);
    expect(() => parseCommodityCsv("id,symbol,category,name\r\n1,Gold,Metals,Gold")).toThrow(/usable rows/);
  });
});

describe("provisionalName", () => {
  it("makes a readable name from a symbol, and refuses what is not one", () => {
    expect(provisionalName("newthing")).toBe("Newthing");
    expect(provisionalName("NewThing_two")).toBe("New Thing two");
    for (const bad of ["", "a", "9lives", "x y", "../etc", "a".repeat(61)]) expect(provisionalName(bad)).toBeNull();
  });
});

describe("looking for names", () => {
  let db: Database.Database;
  const NOW = Date.parse("2026-10-12T12:00:00Z");
  const withDb = <T>(fn: (d: Database.Database) => T) => fn(db);
  const ok = (body: string, etag = '"abc"') => new Response(body, { status: 200, headers: { etag } });

  beforeEach(() => {
    db = new Database(":memory:");
    migrate(db);
  });

  it("adds new names, keeps the ones the dump gave, and records the attempt and the file's tag", async () => {
    db.prepare("INSERT INTO commodity_symbols VALUES ('powergridassembly', 'Energy Grid Assembly (dump)')").run();
    const fetchFn = vi.fn(async () => ok(csv("9,LowTemperatureDiamond,Minerals,Low Temperature Diamonds")));
    const r = await refreshCommodityNames({ withDb, userAgent: "t", now: () => NOW, fetchFn: fetchFn as unknown as typeof fetch });
    expect(r).toMatchObject({ ran: true, added: 61 });
    expect(db.prepare("SELECT name FROM commodity_symbols WHERE symbol = 'powergridassembly'").get()).toEqual({ name: "Energy Grid Assembly (dump)" });
    expect(namesState(db)).toEqual({ checkedAt: new Date(NOW).toISOString(), result: expect.stringMatching(/^ok: 61 new/), etag: '"abc"' });
  });

  it("looks at most once a week, even after a failure, unless a person asks", async () => {
    const fetchFn = vi.fn(async () => new Response("", { status: 503 }));
    const call = (now: number, force = false) => refreshCommodityNames({ withDb, userAgent: "t", now: () => now, fetchFn: fetchFn as unknown as typeof fetch, force });
    expect(await call(NOW)).toMatchObject({ ran: true, result: "FAILED: HTTP 503" });
    expect(await call(NOW + 6 * 86400_000)).toMatchObject({ ran: false });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(await call(NOW + 6 * 86400_000, true)).toMatchObject({ ran: true });
    expect(await call(NOW + 6 * 86400_000 + 7 * 86400_000 + 1000)).toMatchObject({ ran: true }); // a week after the forced one
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it("sends the tag it has, and a 304 changes nothing but the record of looking", async () => {
    db.prepare("INSERT INTO meta VALUES ('commodity_names_etag', '\"abc\"')").run();
    const fetchFn = vi.fn(async (_u: unknown, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>)["If-None-Match"]).toBe('"abc"');
      return new Response(null, { status: 304 });
    });
    const r = await refreshCommodityNames({ withDb, userAgent: "t", now: () => NOW, fetchFn: fetchFn as unknown as typeof fetch });
    expect(r).toMatchObject({ ran: true, added: 0, result: "ok: the file has not changed" });
    expect(db.prepare("SELECT COUNT(*) n FROM commodity_symbols").get()).toEqual({ n: 0 });
  });

  it("records a file that is not the table as a failure, and stores nothing from it", async () => {
    const r = await refreshCommodityNames({ withDb, userAgent: "t", now: () => NOW, fetchFn: (async () => ok("<html>moved</html>")) as unknown as typeof fetch });
    expect(r).toMatchObject({ ran: true, added: 0, result: expect.stringMatching(/^FAILED: unexpected columns/) });
    expect(db.prepare("SELECT COUNT(*) n FROM commodity_symbols").get()).toEqual({ n: 0 });
  });

  it("treats a network error as a failure, not a crash", async () => {
    const out = await fetchCommodityNames(null, "t", (async () => { throw new Error("getaddrinfo ENOTFOUND"); }) as unknown as typeof fetch);
    expect(out).toEqual({ kind: "failed", reason: "getaddrinfo ENOTFOUND" });
  });

  it("is due when never looked, a week on, or when the record is from the future", () => {
    expect(namesDue({ checkedAt: null, result: null, etag: null }, NOW)).toBe(true);
    expect(namesDue({ checkedAt: new Date(NOW - NAMES_INTERVAL_MS + 1000).toISOString(), result: "", etag: null }, NOW)).toBe(false);
    expect(namesDue({ checkedAt: new Date(NOW + 86400_000).toISOString(), result: "", etag: null }, NOW)).toBe(true);
    expect(recordNames(db, { kind: "unchanged" }, NOW).added).toBe(0);
  });
});
