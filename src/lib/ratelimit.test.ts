import { describe, expect, it } from "vitest";

import { clientKey, createRateLimiter } from "./ratelimit";

function limiter(over: Partial<Parameters<typeof createRateLimiter>[0]> = {}) {
  let t = 1_000_000;
  const l = createRateLimiter({ limit: 5, windowMs: 60_000, now: () => t, ...over });
  return { l, advance: (ms: number) => (t += ms) };
}

describe("createRateLimiter", () => {
  it("allows a burst up to the limit, then refuses", () => {
    const { l } = limiter();
    const results = Array.from({ length: 7 }, () => l.take("a").allowed);
    expect(results).toEqual([true, true, true, true, true, false, false]);
  });

  it("tells a refused client how long to wait, and is right", () => {
    const { l, advance } = limiter();
    for (let i = 0; i < 5; i++) l.take("a");
    const refused = l.take("a");
    expect(refused).toMatchObject({ allowed: false, remaining: 0 });
    expect(refused.retryAfterSeconds).toBe(12); // 5 per minute = one every 12 s
    advance(11_000);
    expect(l.take("a").allowed).toBe(false);
    advance(1_100);
    expect(l.take("a").allowed).toBe(true);
  });

  it("refills steadily, never above the limit", () => {
    const { l, advance } = limiter();
    for (let i = 0; i < 5; i++) l.take("a");
    advance(24_000); // two tokens
    expect([l.take("a").allowed, l.take("a").allowed, l.take("a").allowed]).toEqual([true, true, false]);
    advance(10 * 60_000); // a long idle spell refills to the limit, not beyond it
    expect(Array.from({ length: 7 }, () => l.take("a").allowed).filter(Boolean)).toHaveLength(5);
  });

  it("remembers a bounded number of clients, forgetting the least recently seen", () => {
    const { l } = limiter({ maxKeys: 3 });
    for (let i = 0; i < 1000; i++) l.take("client-" + i);
    expect(l.size).toBe(3);
    for (let i = 0; i < 5; i++) l.take("old");
    l.take("x1");
    l.take("x2");
    l.take("x3"); // pushes "old" out
    expect(l.take("old").remaining).toBe(4); // it starts again with a full allowance
  });
});

describe("clientKey", () => {
  const h = (xff?: string) => new Headers(xff ? { "x-forwarded-for": xff } : {});

  it("takes the address the trusted proxy saw: the last entry for one proxy", () => {
    expect(clientKey(h("203.0.113.9"), 1)).toBe("203.0.113.9");
    expect(clientKey(h("1.2.3.4, 203.0.113.9"), 1)).toBe("203.0.113.9"); // the client's own "1.2.3.4" is ignored
  });

  it("counts back from the right for several proxies", () => {
    expect(clientKey(h("9.9.9.9, 203.0.113.9, 10.0.0.2"), 2)).toBe("203.0.113.9");
    expect(clientKey(h("203.0.113.9, 10.0.0.2"), 2)).toBe("203.0.113.9");
  });

});
