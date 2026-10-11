import { isIP } from "node:net";

interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number; // 0 when allowed
}

export interface RateLimiter {
  take(key: string): RateLimitResult;
  readonly size: number;
}

interface Options {
  limit: number; // requests allowed per window, also the burst size
  windowMs: number;
  maxKeys?: number; // clients tracked at once; the least recently seen are forgotten beyond this
  now?: () => number; // injectable clock for tests
}

// A token bucket per key: up to `limit` tokens, refilled at limit/windowMs, so a client can burst to the limit then sustain the average. State is in this
// process's memory (per instance); put a shared store behind this interface to change that.
export function createRateLimiter({ limit, windowMs, maxKeys = 10_000, now = Date.now }: Options): RateLimiter {
  const buckets = new Map<string, { tokens: number; at: number }>();
  const perMs = limit / windowMs;

  return {
    get size() {
      return buckets.size;
    },
    take(key) {
      const t = now();
      const b = buckets.get(key) ?? { tokens: limit, at: t };
      b.tokens = Math.min(limit, b.tokens + (t - b.at) * perMs);
      b.at = t;
      buckets.delete(key); // re-insert so Map order is least-recently-seen first
      buckets.set(key, b);
      while (buckets.size > maxKeys) buckets.delete(buckets.keys().next().value as string); // bound memory

      if (b.tokens >= 1) {
        b.tokens -= 1;
        return { allowed: true, limit, remaining: Math.floor(b.tokens), retryAfterSeconds: 0 };
      }
      return { allowed: false, limit, remaining: 0, retryAfterSeconds: Math.max(1, Math.ceil((1 - b.tokens) / perMs / 1000)) };
    },
  };
}

// Who is asking. With no trusted proxy every request shares one key (X-Forwarded-For is whatever the client wrote). With `hops` proxies in front, the
// address the outermost trusted one saw is the hops-th entry from the right; anything to its left came from the client.
export function clientKey(headers: Pick<Headers, "get">, hops: number): string {
  if (hops < 1) return "shared";
  const parts = (headers.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const candidate = parts[parts.length - hops];
  return candidate && isIP(candidate) ? candidate : "shared";
}
