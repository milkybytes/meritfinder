// Runtime settings from MERITFINDER_* environment variables (what each does: NOTES/PRODUCTION.md). Each is validated and clamped so a
// typo can't turn a safeguard off by accident, and read on every call so tests and the proxy see the current environment.

function int(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  return /^\d+$/.test(raw.trim()) ? Math.min(Math.max(Number(raw), min), max) : fallback; // plain digits only
}

// The public address (scheme and host, no path). Anything that is not a plain http(s) origin falls back, so a typo can't put a
// broken canonical link or sitemap in front of search engines.
function origin(name: string, fallback: string): string {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : fallback;
  } catch {
    return fallback;
  }
}

export function getConfig() {
  return {
    rateLimitPerMinute: int("MERITFINDER_RATE_LIMIT", 30, 0, 100_000),
    rateLimitGlobalPerMinute: int("MERITFINDER_RATE_LIMIT_GLOBAL", 600, 0, 1_000_000),
    rateLimitSuggestPerMinute: int("MERITFINDER_RATE_LIMIT_SUGGEST", 120, 0, 100_000),
    trustProxyHops: int("MERITFINDER_TRUST_PROXY_HOPS", 0, 0, 10),
    searchBudgetMs: int("MERITFINDER_SEARCH_BUDGET_MS", 2000, 50, 60_000),
    cacheTtlSeconds: int("MERITFINDER_CACHE_TTL_SECONDS", 300, 0, 86_400),
    cdnCacheSeconds: int("MERITFINDER_CDN_CACHE_SECONDS", 0, 0, 86_400),
    https: process.env.MERITFINDER_HTTPS === "1",
    siteUrl: origin("MERITFINDER_SITE_URL", "https://meritfinder.app"),
  };
}
