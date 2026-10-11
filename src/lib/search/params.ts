import { METHODS, type MiningMethod } from "@/data/mining-methods";
import { POWER_COLORS } from "@/data/powers";
import { MAX_MARKET_AGE_DAYS } from "@/data/retention";
import { RING_TYPES } from "@/data/ring-materials";

import type { Goal, MiningMode, Pad, SearchParams } from "./search";

// Everything in the URL is untrusted. Each value is bounded here, once, so nothing downstream has to worry about a
// 10,000-item list, a 1 MB string or a negative range.
export const MAX_RANGE = 500;
export const LIMITS = [10, 25, 50, 100];
const DEFAULT_LIMIT = 25;

export const MAX_NAME_LENGTH = 80; // longest system name is about 60
const MAX_LIST_ITEMS = 24; // chips in one field
const MAX_LIST_TOTAL = 60; // chips across the whole query
const MAX_PRICE = 100_000_000; // credits per tonne
const MAX_DEMAND = 10_000_000; // tonnes
const MAX_STATION_LS = 1_000_000;
const MAX_AGE_DAYS = MAX_MARKET_AGE_DAYS; // the database holds nothing older

export type RawParams = Record<string, string | string[] | undefined>;

const RESERVES = ["Pristine", "Major", "Common", "Low", "Depleted"];
const KNOWN_POWERS = Object.keys(POWER_COLORS);

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const clean = (s: string) => s.replace(/[\u0000-\u001f\u007f]/g, "").trim();
const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);
const num = (v: string, d: number, lo: number, hi: number) => (v.trim() !== "" && Number.isFinite(Number(v)) ? clamp(Number(v), lo, hi) : d);
const oneOf = <T extends string>(v: string, allowed: readonly T[], d: T): T => (allowed.includes(v as T) ? (v as T) : d);

// A repeated field (chips): cleaned, no empties, no duplicates, no over-long values, capped in length.
// `allowed` drops anything that is not a known value.
const many = (v: string | string[] | undefined, allowed?: readonly string[]): string[] => {
  const items = (Array.isArray(v) ? v : v ? [v] : []).slice(0, MAX_LIST_ITEMS * 2).map(clean);
  const kept = items.filter((s) => s && s.length <= MAX_NAME_LENGTH && (!allowed || allowed.includes(s)));
  return [...new Set(kept)].slice(0, MAX_LIST_ITEMS);
};

// URL query -> search parameters, with defaults, validation and clamping. Never throws on bad input.
export function parseParams(raw: RawParams): SearchParams {
  const limit = Math.round(num(first(raw.limit), DEFAULT_LIMIT, 1, Math.max(...LIMITS)));
  const p: SearchParams = {
    ref: clean(first(raw.ref)).slice(0, MAX_NAME_LENGTH),
    range: Math.round(num(first(raw.range), 50, 1, MAX_RANGE)),
    power: oneOf(clean(first(raw.power)), KNOWN_POWERS, ""),
    goal: oneOf<Goal>(first(raw.goal), ["undermine", "reinforce", "acquire"], "undermine"),
    target: many(raw.target, KNOWN_POWERS),
    commodity: many(raw.commodity),
    minPrice: Math.round(num(first(raw.minPrice), 0, 0, MAX_PRICE)),
    minDemand: Math.round(num(first(raw.minDemand), 0, 0, MAX_DEMAND)),
    pad: oneOf<Pad>(first(raw.pad), ["S", "M", "L"], "L"),
    maxStationLs: Math.round(num(first(raw.maxLs), 0, 0, MAX_STATION_LS)),
    maxAgeDays: raw.maxAge === undefined ? 7 : Math.round(num(first(raw.maxAge), 0, 0, MAX_AGE_DAYS)), // default 7 days; blank = no limit
    method: oneOf<MiningMethod>(first(raw.method), METHODS.map((m) => m.id), "any"),
    ringTypes: many(raw.ringType, RING_TYPES),
    reserve: many(raw.reserve, RESERVES),
    mining: oneOf<MiningMode>(first(raw.mining), ["any", "known", "possible"], "possible"),
    material: many(raw.material),
    states: many(raw.state),
    sort: oneOf(first(raw.sort), ["price", "distance"] as const, "price"),
    limit: LIMITS.includes(limit) ? limit : DEFAULT_LIMIT,
  };
  // One query may not carry an absurd number of chips overall.
  let budget = MAX_LIST_TOTAL;
  for (const k of ["target", "commodity", "ringTypes", "reserve", "material", "states"] as const) {
    p[k] = p[k].slice(0, Math.max(budget, 0));
    budget -= p[k].length;
  }
  return p;
}
