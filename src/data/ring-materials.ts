// Which ring mining technique can extract which material, in which ring type. Source: two community tables (they agree except Tritium, where the
// spreadsheet's surface column is used). Surface lasers, abrasion blasters and sub-surface missiles agree for every material (bar abrasion for Lithium
// Hydroxide, which the app has no method for), so they are one `surface` column and laser and sub-surface give the same results.
import type { RingMethod } from "./mining-methods";

export const RING_TYPES = ["Metallic", "Metal Rich", "Rocky", "Icy"] as const;

type RingType = (typeof RING_TYPES)[number];
const [METALLIC, METAL_RICH, ROCKY, ICY] = RING_TYPES;

interface RingMaterial {
  material: string; // as in the commodity market (and, for hotspots, in the ring data)
  hotspot: boolean; // has hotspots: Spansh records where they are. Without, it is only "somewhere in a ring of that type".
  core: RingType[]; // ring types where core mining (seismic charges) yields it
  surface: RingType[]; // ring types where laser, abrasion or sub-surface mining yields it
}

const hot = (material: string, core: RingType[], surface: RingType[] = []): RingMaterial => ({ material, hotspot: true, core, surface });
const rock = (material: string, surface: RingType[]): RingMaterial => ({ material, hotspot: false, core: [], surface });

export const RING_MATERIALS: RingMaterial[] = [
  hot("Alexandrite", [ROCKY, METAL_RICH, ICY]),
  rock("Bauxite", [ROCKY]),
  hot("Benitoite", [ROCKY]),
  rock("Bertrandite", [METAL_RICH, METALLIC]),
  hot("Bromellite", [ICY], [ICY]),
  rock("Cobalt", [ROCKY]),
  rock("Coltan", [ROCKY, METAL_RICH]),
  rock("Gallite", [ROCKY, METAL_RICH, METALLIC]),
  rock("Gold", [METAL_RICH, METALLIC]),
  hot("Grandidierite", [ICY]),
  rock("Hydrogen Peroxide", [ICY]),
  rock("Indite", [ROCKY, METAL_RICH, METALLIC]),
  rock("Lepidolite", [ROCKY, METAL_RICH]),
  rock("Liquid oxygen", [ICY]),
  rock("Lithium Hydroxide", [ICY]),
  hot("Low Temperature Diamonds", [ICY], [ICY]),
  rock("Methane Clathrate", [ICY]),
  rock("Methanol Monohydrate Crystals", [ICY]),
  hot("Monazite", [ROCKY, METAL_RICH, METALLIC]),
  hot("Musgravite", [ROCKY]),
  rock("Osmium", [METAL_RICH, METALLIC]),
  hot("Painite", [METAL_RICH, METALLIC], [METALLIC]),
  rock("Palladium", [METALLIC]),
  hot("Platinum", [METAL_RICH, METALLIC], [METALLIC]),
  rock("Praseodymium", [METAL_RICH, METALLIC]),
  hot("Rhodplumsite", [ROCKY, METAL_RICH, METALLIC]),
  rock("Rutile", [ROCKY]),
  rock("Samarium", [ROCKY, METAL_RICH, METALLIC]),
  hot("Serendibite", [ROCKY, METAL_RICH, METALLIC]),
  rock("Silver", [METAL_RICH, METALLIC]),
  hot("Tritium", [], [ICY]),
  rock("Uraninite", [ROCKY, METAL_RICH]),
  hot("Void Opal", [ICY]),
  rock("Water", [ICY]),
];

const COLUMN: Record<RingMethod, "core" | "surface"> = { laser: "surface", subsurface: "surface", core: "core" };
const find = (material: string) => RING_MATERIALS.find((m) => m.material === material);

// Can this technique extract this material from a ring of this type? ("any" = any technique.)
export function yieldsFrom(method: RingMethod | "any", material: string, ringType: string | null): boolean {
  const entry = find(material);
  if (!entry || !ringType) return false;
  const types: string[] = method === "any" ? [...entry.core, ...entry.surface] : entry[COLUMN[method]];
  return types.includes(ringType);
}

export const hasHotspots = (material: string) => find(material)?.hotspot ?? false;

// The materials a ring of this type can yield to this technique ("any" = any technique), in table (alphabetical) order.
export function materialsForRingType(ringType: string | null, method: RingMethod | "any"): string[] {
  if (!ringType) return [];
  return RING_MATERIALS.filter((m) => {
    const types: string[] = method === "any" ? [...m.core, ...m.surface] : m[COLUMN[method]];
    return types.includes(ringType);
  }).map((m) => m.material);
}

// The materials this technique can extract from some ring type, in table (alphabetical) order.
export const ringMaterialsFor = (method: RingMethod): string[] =>
  RING_MATERIALS.filter((m) => m[COLUMN[method]].length > 0).map((m) => m.material);

export const RING_MATERIAL_NAMES = RING_MATERIALS.map((m) => m.material);

// Spansh names some hotspot signals differently from the market ("Opal", "LowTemperatureDiamond", "HydrogenPeroxide").
const ALIASES: Record<string, string> = { LowTemperatureDiamond: "Low Temperature Diamonds", Opal: "Void Opal" };
const squash = (s: string) => s.replace(/\s+/g, "").toLowerCase();

// A Spansh ring signal name as the market name for the same material, or unchanged if it is not one we know.
export function canonicalRingMaterial(signal: string): string {
  return ALIASES[signal] ?? RING_MATERIAL_NAMES.find((n) => squash(n) === squash(signal)) ?? signal;
}
