// Powerplay powers: Spansh name -> the leader's in-game colour, in the order of the theme picker. Kept in step with ../edeh. Spansh has exactly
// these twelve (Zachary Hudson is gone in Powerplay 2.0).
export const POWER_COLORS: Record<string, string> = {
  "Aisling Duval": "#19b5e6",
  "Archon Delaine": "#df0d0f",
  "A. Lavigny-Duval": "#8f1ad8", // Arissa
  "Denton Patreus": "#4ad4da",
  "Edmund Mahon": "#1a961e",
  "Felicia Winters": "#f0af28",
  "Jerome Archer": "#e01ce2",
  "Li Yong-Rui": "#2df598",
  "Nakato Kaine": "#b6f837",
  "Pranav Antal": "#f8f62e",
  "Yuri Grom": "#e87e25",
  "Zemina Torval": "#146ada",
};

// Theme names: leader's first name + the colour's name ("Aisling Blue", "Felicia Amber"), as in ../edeh.
// Arissa is A. Lavigny-Duval.
export const THEME_NAMES: Record<string, string> = {
  "Aisling Duval": "Aisling Blue",
  "Archon Delaine": "Archon Red",
  "A. Lavigny-Duval": "Arissa Purple",
  "Denton Patreus": "Denton Cyan",
  "Edmund Mahon": "Edmund Green",
  "Felicia Winters": "Felicia Amber",
  "Jerome Archer": "Jerome Magenta",
  "Li Yong-Rui": "Li Mint",
  "Nakato Kaine": "Nakato Lime",
  "Pranav Antal": "Pranav Yellow",
  "Yuri Grom": "Yuri Orange",
  "Zemina Torval": "Zemina Blue",
};

const DEFAULT_COLOR = POWER_COLORS["Felicia Winters"]; // the default theme: the classic Elite HUD amber

export const powerColor = (power: string | null | undefined): string | null =>
  (power && POWER_COLORS[power]) || null;

type Rgb = [number, number, number];

function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance([r, g, b]: Rgb): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function hue([r, g, b]: Rgb): number {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const d = max - Math.min(rn, gn, bn);
  if (d === 0) return 30;
  const h = max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
  return Math.round(h * 60);
}

const BACKGROUND: Rgb = [10, 8, 7];

// Theme for a page: an accent readable on the dark background (lightened if needed, as in
// edeh) and a hue the greys are tinted with.
export function themeFor(power: string | null | undefined): { accent: string; hue: number } {
  const base = hexToRgb(powerColor(power) ?? DEFAULT_COLOR);
  let c = base;
  for (let i = 0; i < 40 && contrast(c, BACKGROUND) < 4.5; i++) {
    // round every step: the page uses the rounded colour, so that is what must meet the contrast bar
    c = [c[0] + (255 - c[0]) * 0.05, c[1] + (255 - c[1]) * 0.05, c[2] + (255 - c[2]) * 0.05].map(Math.round) as Rgb;
  }
  return { accent: `rgb(${c.map(Math.round).join(" ")})`, hue: hue(base) };
}

export const DEFAULT_THEME = "Felicia Winters";
export const THEME_STORAGE_KEY = "meritfinder.theme";

// Every selectable theme (power name -> hue and accent), for the picker and the pre-paint script.
export function themeMap(): Record<string, { hue: number; accent: string }> {
  return Object.fromEntries(Object.keys(POWER_COLORS).map((p) => [p, themeFor(p)]));
}
