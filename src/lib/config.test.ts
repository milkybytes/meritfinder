import { afterEach, describe, expect, it } from "vitest";

import { getConfig } from "./config";

const NAMES = ["MERITFINDER_RATE_LIMIT", "MERITFINDER_RATE_LIMIT_GLOBAL", "MERITFINDER_RATE_LIMIT_SUGGEST", "MERITFINDER_TRUST_PROXY_HOPS", "MERITFINDER_SEARCH_BUDGET_MS", "MERITFINDER_CACHE_TTL_SECONDS", "MERITFINDER_CDN_CACHE_SECONDS", "MERITFINDER_HTTPS"];
afterEach(() => NAMES.forEach((n) => delete process.env[n]));

describe("getConfig", () => {
  it("has safe defaults: rate limited, time-boxed, cached briefly, no CDN caching, no proxy trust", () => {
    expect(getConfig()).toEqual({
      rateLimitPerMinute: 30, rateLimitGlobalPerMinute: 600, rateLimitSuggestPerMinute: 120, trustProxyHops: 0, searchBudgetMs: 2000, cacheTtlSeconds: 300, cdnCacheSeconds: 0, https: false,
    });
  });

  it("clamps out-of-range values instead of trusting them", () => {
    process.env.MERITFINDER_SEARCH_BUDGET_MS = "0"; // cannot turn the time limit off, or set it to nothing
    expect(getConfig().searchBudgetMs).toBe(50);
    process.env.MERITFINDER_SEARCH_BUDGET_MS = "99999999";
    expect(getConfig().searchBudgetMs).toBe(60_000);
    process.env.MERITFINDER_TRUST_PROXY_HOPS = "-3";
    expect(getConfig().trustProxyHops).toBe(0);
    process.env.MERITFINDER_TRUST_PROXY_HOPS = "500";
    expect(getConfig().trustProxyHops).toBe(10);
  });

});
