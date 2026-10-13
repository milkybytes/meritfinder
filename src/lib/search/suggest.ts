import { withDb } from "../db/db";

import { MAX_NAME_LENGTH } from "./params";
import { SUGGEST_SYSTEMS } from "./queries";

export const MIN_SUGGEST_CHARS = 2; // a one-letter prefix matches thousands of systems
const MAX_SUGGESTIONS = 10;
const HIGHEST_CHARACTER = String.fromCharCode(0xffff); // sorts after any name that starts with the text

export interface SystemSuggestion {
  name: string;
  power: string | null; // controlling power, so the list can show whose system it is
}

// The text typed so far, as safe to look up: no control characters, single spaces, bounded length.
const cleanSystemQuery = (raw: string | null | undefined): string =>
  (raw ?? "").replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LENGTH);

// Systems in the database (the only ones a search can start from) whose name starts
// with what was typed, alphabetically. A name shared by several systems is listed once.
export function suggestSystems(raw: string | null | undefined): SystemSuggestion[] {
  const q = cleanSystemQuery(raw);
  if (q.length < MIN_SUGGEST_CHARS) return [];

  const rows = withDb((db) =>
    db.prepare(SUGGEST_SYSTEMS).all({ lo: q, hi: q + HIGHEST_CHARACTER, n: MAX_SUGGESTIONS * 2 }) as { name: string; power: string | null }[],
  );
  const seen = new Set<string>();
  const out: SystemSuggestion[] = [];
  for (const r of rows) {
    const key = r.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: r.name, power: r.power });
  }
  return out.slice(0, MAX_SUGGESTIONS);
}
