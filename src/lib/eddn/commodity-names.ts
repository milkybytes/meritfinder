import type Database from "better-sqlite3";

// EDDN names a commodity by an internal symbol ("powergridassembly"); the market shows "Energy Grid Assembly". The ingest learns the pairs from
// the dump. A commodity added to the game after that dump has no name here until someone supplies it, and the one public source is the
// community's FDevIDs table. The listener fetches it, at most once a week, when it sees a symbol it cannot name (or on request: npm run db:names).

const COMMODITY_CSV_URL = "https://raw.githubusercontent.com/EDCD/FDevIDs/master/commodity.csv";
export const NAMES_USER_AGENT = "meritfinder/0.1 (personal Elite Dangerous Powerplay tool; looks up commodity names, at most weekly)";
export const NAMES_INTERVAL_MS = 7 * 86400_000;
const MAX_BYTES = 1_000_000; // the file is about 14 KB
const MIN_ROWS = 50; // a file with fewer is not the table
const FETCH_TIMEOUT_MS = 20_000;

const SYMBOL = /^[A-Za-z][A-Za-z0-9_]{1,59}$/;
const NAME = /^[\p{L}\p{N} .'()&-]{1,60}$/u;

// A stand-in made from the symbol, so a new commodity's price is kept while its name is looked for. Null when it is not a plausible symbol.
export function provisionalName(symbol: string): string | null {
  if (!SYMBOL.test(symbol)) return null;
  const spaced = symbol.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
  return spaced[0].toUpperCase() + spaced.slice(1);
}

// One CSV record's fields, with double quotes respected.
function fields(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

// symbol (lower case) -> name, from FDevIDs' commodity.csv (id,symbol,category,name). Rows that are not a plausible symbol and name are dropped;
// a file with another header, or hardly any valid rows, is refused whole.
export function parseCommodityCsv(text: string): Map<string, string> {
  const lines = text.split(/\r?\n/);
  const header = fields(lines[0] ?? "").map((h) => h.trim().toLowerCase());
  const at = (n: string) => header.indexOf(n);
  const [iSymbol, iName] = [at("symbol"), at("name")];
  if (iSymbol < 0 || iName < 0) throw new Error(`unexpected columns: ${header.join(",").slice(0, 80)}`);
  const names = new Map<string, string>();
  for (const line of lines.slice(1)) {
    const f = fields(line);
    const symbol = f[iSymbol]?.trim();
    const name = f[iName]?.trim();
    if (symbol && name && SYMBOL.test(symbol) && NAME.test(name)) names.set(symbol.toLowerCase(), name);
  }
  if (names.size < MIN_ROWS) throw new Error(`only ${names.size} usable rows`);
  return names;
}

export type NamesFetch = { kind: "names"; names: Map<string, string>; etag: string | null } | { kind: "unchanged" } | { kind: "failed"; reason: string };

export async function fetchCommodityNames(etag: string | null, userAgent: string, fetchFn: typeof fetch = fetch): Promise<NamesFetch> {
  try {
    const headers: Record<string, string> = { "User-Agent": userAgent };
    if (etag) headers["If-None-Match"] = etag;
    const res = await fetchFn(COMMODITY_CSV_URL, { headers, redirect: "error", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (res.status === 304) return { kind: "unchanged" };
    if (!res.ok) return { kind: "failed", reason: `HTTP ${res.status}` };
    const length = Number(res.headers.get("content-length") ?? 0);
    if (length > MAX_BYTES) return { kind: "failed", reason: `file is ${length} bytes` };
    const text = await res.text();
    if (text.length > MAX_BYTES) return { kind: "failed", reason: `file is ${text.length} characters` };
    return { kind: "names", names: parseCommodityCsv(text), etag: res.headers.get("etag") };
  } catch (e) {
    return { kind: "failed", reason: (e as Error).message };
  }
}

export interface NamesState {
  checkedAt: string | null; // the last attempt, whatever came of it
  result: string | null; // what it came to, in words
  etag: string | null;
}

export function namesState(db: Database.Database): NamesState {
  const rows = db.prepare("SELECT key, value FROM meta WHERE key IN ('commodity_names_checked', 'commodity_names_result', 'commodity_names_etag')").all() as { key: string; value: string }[];
  const m = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return { checkedAt: m.commodity_names_checked ?? null, result: m.commodity_names_result ?? null, etag: m.commodity_names_etag ?? null };
}

export function namesDue(state: NamesState, now: number): boolean {
  const at = state.checkedAt ? Date.parse(state.checkedAt) : NaN;
  return !Number.isFinite(at) || now - at >= NAMES_INTERVAL_MS || at > now;
}

// Records the attempt, and adds the names. A name the database already has is kept: the dump's is what the market itself called it.
export function recordNames(db: Database.Database, outcome: NamesFetch, now: number): { added: number; result: string } {
  let added = 0;
  let result: string;
  db.transaction(() => {
    const put = db.prepare("INSERT OR REPLACE INTO meta VALUES (?, ?)");
    if (outcome.kind === "names") {
      const insert = db.prepare("INSERT OR IGNORE INTO commodity_symbols VALUES (?, ?)");
      outcome.names.forEach((name, symbol) => (added += insert.run(symbol, name).changes));
      if (outcome.etag) put.run("commodity_names_etag", outcome.etag);
      result = `ok: ${added} new of ${outcome.names.size} names`;
    } else if (outcome.kind === "unchanged") {
      result = "ok: the file has not changed";
    } else {
      result = `FAILED: ${outcome.reason}`;
    }
    put.run("commodity_names_checked", new Date(now).toISOString());
    put.run("commodity_names_result", result);
  })();
  return { added, result: result! };
}

export interface RefreshOptions {
  withDb: <T>(fn: (db: Database.Database) => T) => T; // a writable handle for the duration of fn
  userAgent: string;
  force?: boolean; // ignore the weekly limit (a person asked)
  now?: () => number;
  fetchFn?: typeof fetch;
}

// Looks for names, unless it already looked within the week. The network is not touched while a database handle is held.
export async function refreshCommodityNames(opts: RefreshOptions): Promise<{ ran: false; state: NamesState } | { ran: true; added: number; result: string }> {
  const { withDb, userAgent, force = false, now = Date.now, fetchFn } = opts;
  const state = withDb((db) => namesState(db));
  if (!force && !namesDue(state, now())) return { ran: false, state };
  const outcome = await fetchCommodityNames(force ? null : state.etag, userAgent, fetchFn);
  const done = withDb((db) => recordNames(db, outcome, now()));
  return { ran: true, ...done };
}
