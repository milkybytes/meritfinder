import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";

import { config as proxyConfig, proxy } from "./proxy";

const ENV = ["MERITFINDER_RATE_LIMIT", "MERITFINDER_RATE_LIMIT_GLOBAL", "MERITFINDER_RATE_LIMIT_SUGGEST", "MERITFINDER_TRUST_PROXY_HOPS", "MERITFINDER_CDN_CACHE_SECONDS", "MERITFINDER_HTTPS"];
afterEach(() => ENV.forEach((n) => delete process.env[n]));

// The limiter state lives in the proxy module and is rebuilt when the limits change, so each test uses its own numbers.
let unique = 100;
function setup(over: Record<string, string> = {}) {
  process.env.MERITFINDER_RATE_LIMIT = String(unique++);
  process.env.MERITFINDER_RATE_LIMIT_GLOBAL = "0";
  process.env.MERITFINDER_TRUST_PROXY_HOPS = "1";
  Object.assign(process.env, over);
}
const get = (path: string, headers: Record<string, string> = {}) => proxy(new NextRequest(`http://localhost:3000${path}`, { headers }));
const from = (ip: string) => ({ "x-forwarded-for": ip });
const statuses = (n: number, path: string, headers: Record<string, string>) => Array.from({ length: n }, () => get(path, headers).status);

describe("rate limiting", () => {
  it("lets a client search up to the limit, then answers 429 with when to retry", () => {
    setup({ MERITFINDER_RATE_LIMIT: "3" });
    expect(statuses(5, "/api/search?ref=Sol", from("203.0.113.1"))).toEqual([200, 200, 200, 429, 429]);
    const refused = get("/api/search?ref=Sol", from("203.0.113.1"));
    expect(Number(refused.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(refused.headers.get("cache-control")).toBe("no-store");
  });

  it("limits each client separately", () => {
    setup({ MERITFINDER_RATE_LIMIT: "2" });
    statuses(4, "/api/search?ref=Sol", from("203.0.113.1"));
    expect(get("/api/search?ref=Sol", from("203.0.113.1")).status).toBe(429);
    expect(get("/api/search?ref=Sol", from("203.0.113.2")).status).toBe(200);
  });

  it("is not fooled by a made-up X-Forwarded-For prefix: only the address the proxy added counts", () => {
    setup({ MERITFINDER_RATE_LIMIT: "2" });
    expect(statuses(4, "/api/search?ref=Sol", from("6.6.6.6, 203.0.113.77"))).toEqual([200, 200, 429, 429]);
    expect(get("/api/search?ref=Sol", from("7.7.7.7, 203.0.113.77")).status).toBe(429); // still the same client
  });

  it("only counts searches: the pages themselves are free, even with a search in the address", () => {
    setup({ MERITFINDER_RATE_LIMIT: "1" });
    expect(statuses(5, "/", from("203.0.113.1"))).toEqual([200, 200, 200, 200, 200]);
    expect(statuses(3, "/?ref=Sol", from("203.0.113.1"))).toEqual([200, 200, 200]); // the page only draws the form; /api/search does the work
    expect(statuses(3, "/?range=50", from("203.0.113.1"))).toEqual([200, 200, 200]);
  });
});

describe("rate limiting suggestions", () => {
  it("limits /api/systems per client, separately from searches", () => {
    setup({ MERITFINDER_RATE_LIMIT_SUGGEST: "3", MERITFINDER_RATE_LIMIT: "1000" });
    expect(statuses(5, "/api/systems?q=hya", from("203.0.113.30"))).toEqual([200, 200, 200, 429, 429]);
    expect(get("/api/systems?q=hya", from("203.0.113.31")).status).toBe(200); // another client
    expect(get("/api/search?ref=Sol", from("203.0.113.30")).status).toBe(200); // searching is unaffected
  });
});

describe("request sanity", () => {
  it("refuses an absurdly long query with 414", () => {
    setup();
    const res = get(`/?ref=Sol&x=${"a".repeat(5000)}`, from("203.0.113.1"));
    expect(res.status).toBe(414);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

describe("Content Security Policy", () => {
  const header = (res: Response) => res.headers.get("content-security-policy")!;
  const nonceOf = (csp: string) => /'nonce-([^']+)'/.exec(csp)![1];

  it("gives every page a policy that only lets scripts with its own nonce run", () => {
    setup();
    const csp = header(get("/"));
    expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(csp).not.toMatch(/script-src[^;]*unsafe-eval/); // development only
  });

  it("uses a different nonce for every request", () => {
    setup();
    const nonces = new Set(Array.from({ length: 20 }, () => nonceOf(header(get("/")))));
    expect(nonces.size).toBe(20);
  });

});

describe("transport and caching headers", () => {
  it("sends HSTS only when the site is served over HTTPS", () => {
    setup();
    expect(get("/").headers.get("strict-transport-security")).toBeNull();
    setup({ MERITFINDER_HTTPS: "1" });
    expect(get("/").headers.get("strict-transport-security")).toMatch(/max-age=\d+/);
  });

});

describe("what the proxy runs on", () => {
  const source = (proxyConfig.matcher[0] as { source: string }).source;
  const re = new RegExp(`^${source}$`);

  it("covers pages and the suggestions API, but not static files, the health check, robots.txt or the icon", () => {
    expect(re.test("/")).toBe(true);
    expect(re.test("/anything")).toBe(true);
    expect(re.test("/api/systems")).toBe(true);
    expect(re.test("/api/search")).toBe(true);
    for (const p of ["/_next/static/chunks/a.js", "/_next/image", "/api/health", "/robots.txt", "/icon.svg"]) expect(re.test(p), p).toBe(false);
  });
});
