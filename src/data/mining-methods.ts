// Mining methods the app can search for. A user picks a method first, then the materials
// offered depend on what that method can yield.
import { MATERIALS } from "./body-resources";
import { RING_MATERIAL_NAMES, ringMaterialsFor } from "./ring-materials";

export type MiningMethod = "any" | "laser" | "subsurface" | "core" | "planetary";
export type RingMethod = "laser" | "subsurface" | "core";

export interface MethodInfo {
  id: MiningMethod;
  label: string;
  blurb: string;
}

export const METHODS: MethodInfo[] = [
  { id: "any", label: "Any method", blurb: "Systems with something to mine: ring hotspots, or planets that may have mining signals." },
  { id: "laser", label: "Laser", blurb: "Mining lasers on ring asteroids. Ring hotspot data." },
  { id: "subsurface", label: "Sub-surface", blurb: "Sub-surface displacement missiles on ring asteroids. Ring hotspot data." },
  { id: "core", label: "Core", blurb: "Seismic charges on ring asteroids with cores. Ring hotspot data." },
  {
    id: "planetary",
    label: "Planetary (Rhino SRV)",
    blurb: "Landable planets with mining locations. Only a signal count is known, not the material.",
  },
];

export const isRingMethod = (m: MiningMethod): m is RingMethod => m === "laser" || m === "subsurface" || m === "core";

// Materials the planetary method supports at all (from the community survey).
export const PLANETARY_MATERIALS = MATERIALS.map((m) => m.material);

// Materials offered for a method. Ring materials are those the technique can extract (see ring-materials.ts) that the
// database can find (`ringMaterials`, from meta()); planetary ones come from the survey.
export function materialsFor(method: MiningMethod, ringMaterials: string[]): string[] {
  const findable = (names: string[]) => names.filter((m) => ringMaterials.includes(m));
  if (isRingMethod(method)) return findable(ringMaterialsFor(method));
  if (method === "planetary") return PLANETARY_MATERIALS;
  return [...new Set([...findable(RING_MATERIAL_NAMES), ...PLANETARY_MATERIALS])].sort();
}
