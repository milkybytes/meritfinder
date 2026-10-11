import { NextResponse, type NextRequest } from "next/server";

import { getConfig } from "@/lib/config";
import { clientKey, createRateLimiter, type RateLimiter } from "@/lib/ratelimit";

// Runs before every page request (not static files, prefetches or the health check): refuses absurdly long URLs; rate-limits searches (/api/search) and
// suggestions and live status (/api/systems, /api/live) per client, and searches across all clients; and gives each page a CSP with a fresh nonce.
// Limiter state is in this process's memory (lib/ratelimit.ts).

const MAX_QUERY_LENGTH = 4096;

let limiters: { perClient: RateLimiter | null; global: RateLimiter | null; suggest: RateLimiter | null; key: string } | null = null;
function getLimiters() {
  const c = getConfig();
  const key = `${c.rateLimitPerMinute}:${c.rateLimitGlobalPerMinute}:${c.rateLimitSuggestPerMinute}`;
  if (limiters?.key !== key) {
    limiters = {
      key,
      perClient: c.rateLimitPerMinute ? createRateLimiter({ limit: c.rateLimitPerMinute, windowMs: 60_000 }) : null,
      global: c.rateLimitGlobalPerMinute ? createRateLimiter({ limit: c.rateLimitGlobalPerMinute, windowMs: 60_000, maxKeys: 1 }) : null,
      suggest: c.rateLimitSuggestPerMinute ? createRateLimiter({ limit: c.rateLimitSuggestPerMinute, windowMs: 60_000 }) : null,
    };
  }
  return limiters;
}

export function contentSecurityPolicy(nonce: string, { dev, https }: { dev: boolean; https: boolean }): string {
  return [
    "default-src 'self'",
    // The nonce lets this page's own scripts run; 'strict-dynamic' lets those load their chunks. React needs eval in development only.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // Inline style attributes (colours and sizes set in components) can't carry a nonce.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

function tooMany(retryAfterSeconds: number) {
  return new NextResponse("Too many searches. Please wait a moment and try again.\n", {
    status: 429,
    headers: { "Retry-After": String(retryAfterSeconds), "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" },
  });
}

export function proxy(request: NextRequest) {
  const { nextUrl, headers } = request;
  const config = getConfig();

  if (nextUrl.search.length > MAX_QUERY_LENGTH) {
    return new NextResponse("Request too long.\n", { status: 414, headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" } });
  }

  if (nextUrl.pathname === "/api/systems" || nextUrl.pathname === "/api/live") {
    const mine = getLimiters().suggest?.take(clientKey(headers, config.trustProxyHops));
    return mine && !mine.allowed ? tooMany(mine.retryAfterSeconds) : NextResponse.next(); // JSON: no page, so no nonce
  }

  if (nextUrl.pathname === "/api/search") {
    const { perClient, global } = getLimiters();
    const global_ = global?.take("all");
    if (global_ && !global_.allowed) return tooMany(global_.retryAfterSeconds);
    const mine = perClient?.take(clientKey(headers, config.trustProxyHops));
    if (mine && !mine.allowed) return tooMany(mine.retryAfterSeconds);
    const response = NextResponse.next(); // JSON: no page, so no nonce
    // Search results only change when the database is rebuilt, so a CDN or reverse proxy may keep them briefly.
    if (config.cdnCacheSeconds > 0) {
      response.headers.set("Cache-Control", `public, s-maxage=${config.cdnCacheSeconds}, stale-while-revalidate=${config.cdnCacheSeconds * 6}`);
    }
    return response;
  }

  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce, { dev: process.env.NODE_ENV === "development", https: config.https });
  const requestHeaders = new Headers(headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  if (config.https) response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api/health|_next/static|_next/image|icon.svg|robots.txt).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
