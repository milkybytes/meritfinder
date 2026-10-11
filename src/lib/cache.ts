// A small in-memory cache: entries expire after `ttlMs`, and the least recently used go first beyond `maxEntries`.
export interface TtlCache<V> {
  get(key: string): V | undefined;
  set(key: string, value: V): void;
  readonly size: number;
}

export function createTtlCache<V>({ ttlMs, maxEntries, now = Date.now }: { ttlMs: number; maxEntries: number; now?: () => number }): TtlCache<V> {
  const entries = new Map<string, { value: V; expires: number }>();

  return {
    get size() {
      return entries.size;
    },
    get(key) {
      const e = entries.get(key);
      if (!e) return undefined;
      entries.delete(key);
      if (e.expires <= now()) return undefined;
      entries.set(key, e); // most recently used goes last
      return e.value;
    },
    set(key, value) {
      if (ttlMs <= 0 || maxEntries <= 0) return;
      entries.delete(key);
      entries.set(key, { value, expires: now() + ttlMs });
      while (entries.size > maxEntries) entries.delete(entries.keys().next().value as string);
    },
  };
}
