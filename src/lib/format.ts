export const formatNumber = (n: number) => n.toLocaleString("en-GB");

// "7h" under two days, then whole days.
export function age(iso: string | null, now = Date.now()): string {
  if (!iso) return "?";
  const h = (now - Date.parse(iso)) / 3600_000;
  return h < 48 ? `${Math.max(1, Math.round(h))}h` : `${Math.round(h / 24)}d`;
}

// A short span for how long ago something happened: "12 s", "5 min", "3 h", "2 d".
export function since(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  return `${Math.floor(s / 86400)} d`;
}

export const ageStale = (iso: string | null, now = Date.now()) => !iso || now - Date.parse(iso) > 7 * 86400_000;

// Demand in tonnes -> 0..5 bars. Steps are roughly "a small haul", "a cargo-rack load", and so on
// up to "more than you will ever fill": 1+, 250+, 800+, 2000+, 5000+ t.
const DEMAND_STEPS = [1, 250, 800, 2000, 5000];
export const demandLevel = (tonnes: number): number => DEMAND_STEPS.filter((s) => tonnes >= s).length;

// Bodies and rings are named after their system ("Hyades Sector HI-G a12-3 4 a"); inside a
// system's own row the prefix is noise, so show "4 a".
export function shortBodyName(name: string, systemName: string): string {
  const prefix = systemName + " ";
  return name.length > prefix.length && name.toLowerCase().startsWith(prefix.toLowerCase()) ? name.slice(prefix.length) : name;
}

const sentenceCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

export interface BodyDescription {
  /** The body's type as the game words it: "Rocky ice world", "High metal content world". */
  type: string;
  /** Its volcanism as the game words it, or null for none: "Metallic magma (minor)", "Silicate vapour geysers". */
  volcanism: string | null;
}

// Spansh writes "Rocky Ice world" and "Major Silicate Vapour Geysers"; the game says "Rocky ice world" and
// "silicate vapour geysers", with Major/Minor as an intensity. "No volcanism" is simply no volcanism.
export function describeBody(subtype: string | null | undefined, volcanism: string | null | undefined): BodyDescription {
  const type = subtype?.trim() ? sentenceCase(subtype.trim()) : "Landable planet";
  const raw = (volcanism ?? "").trim();
  if (!raw || /^no volcanism$/i.test(raw)) return { type, volcanism: null };
  const m = /^(major|minor)\s+(.+)$/i.exec(raw);
  const name = sentenceCase((m ? m[2] : raw).replace(/\s*volcanism$/i, "").trim());
  return { type, volcanism: m ? `${name} (${m[1].toLowerCase()})` : name };
}
