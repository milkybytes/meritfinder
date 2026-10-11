import { describe, expect, it } from "vitest";

import { createTtlCache } from "./cache";

function cache(over: Partial<Parameters<typeof createTtlCache>[0]> = {}) {
  let t = 0;
  const c = createTtlCache<string>({ ttlMs: 1000, maxEntries: 3, now: () => t, ...over });
  return { c, advance: (ms: number) => (t += ms) };
}

describe("createTtlCache", () => {
  it("returns what was stored, and nothing for an unknown key", () => {
    const { c } = cache();
    c.set("a", "1");
    expect(c.get("a")).toBe("1");
    expect(c.get("b")).toBeUndefined();
  });

  it("forgets an entry after its time to live", () => {
    const { c, advance } = cache();
    c.set("a", "1");
    advance(999);
    expect(c.get("a")).toBe("1");
    advance(2);
    expect(c.get("a")).toBeUndefined();
    expect(c.size).toBe(0);
  });

  it("holds at most maxEntries, dropping the least recently used", () => {
    const { c } = cache();
    c.set("a", "1");
    c.set("b", "2");
    c.set("c", "3");
    c.get("a"); // a is now the most recently used
    c.set("d", "4");
    expect(c.size).toBe(3);
    expect(c.get("b")).toBeUndefined();
    expect(c.get("a")).toBe("1");
    expect(c.get("d")).toBe("4");
  });

});
