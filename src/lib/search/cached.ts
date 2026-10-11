import { createTtlCache, type TtlCache } from "@/lib/cache";
import { getConfig } from "@/lib/config";

import { dbKey } from "../db/db";

import { search, type SearchParams, type SearchResult } from "./search";

let cache: { ttl: number; entries: TtlCache<SearchResult> } | null = null;

// `search`, remembering identical searches. The key includes the database build, so a new ingest never serves stale results. Partial results are not
// remembered (they depend on server load). Callers get the stored object and must not modify it.
export function cachedSearch(p: SearchParams): SearchResult {
  const { cacheTtlSeconds } = getConfig();
  if (cacheTtlSeconds === 0) return search(p);
  if (cache?.ttl !== cacheTtlSeconds) cache = { ttl: cacheTtlSeconds, entries: createTtlCache({ ttlMs: cacheTtlSeconds * 1000, maxEntries: 200 }) };

  const key = `${dbKey()}|${JSON.stringify(p)}`;
  const hit = cache.entries.get(key);
  if (hit) return hit;
  const result = search(p);
  if (!result.partial) cache.entries.set(key, result);
  return result;
}
