// Planetary (Rhino SRV) mining: which materials show up on which kind of body. Source: a community survey (100+ planets, 4000+ mining locations),
// fuller table at https://wiknow.pages.dev/ref/ground-mining (EDIntel). "likelihood" is the share of mining locations on that class showing the
// material; each class has its own denominator. Only the top two classes per material are listed, so a missing class means lower or unknown.
// Signals carry only a count in game data: "can have", never "has".

// The survey's groupings of landable bodies (its shorthand, stored in the database; "volcanic-magma" is not a game term). Never show a slug:
// show the body's own type and volcanism (describeBody in format.ts).
export type BodyClass =
  | "metal-rich"
  | "high-metal-content"
  | "rocky"
  | "rocky-ice"
  | "icy"
  | "volcanic-magma"      // rocky body with metallic or rocky magma volcanism
  | "volcanic-silicate";  // rocky body with silicate vapour geysers

type SourceGroup = "Volcanic ground" | "Metal-bearing ground" | "Rocky ground" | "Icy ground";

export interface MaterialEntry {
  material: string;
  group: SourceGroup;
  likelihood: Partial<Record<BodyClass, number>>; // percent
  perTonne: { mean: number; median: number; best: number }; // credits, survey sell prices
}

const m = (
  material: string,
  group: SourceGroup,
  likelihood: Partial<Record<BodyClass, number>>,
  mean: number, median: number, best: number,
): MaterialEntry => ({ material, group, likelihood, perTonne: { mean, median, best } });

export const MATERIALS: MaterialEntry[] = [
  m("Diamond", "Volcanic ground", { "metal-rich": 30, "volcanic-magma": 9 }, 112865, 109197, 627383),
  m("Ruby", "Volcanic ground", { "volcanic-magma": 12, "metal-rich": 6 }, 92382, 89463, 513551),
  m("Sapphire", "Volcanic ground", { "volcanic-magma": 18, "metal-rich": 8 }, 103743, 102317, 605872),

  m("Iridium", "Metal-bearing ground", { "metal-rich": 30, "high-metal-content": 16 }, 196612, 182156, 967856),
  m("Osmium", "Metal-bearing ground", { "high-metal-content": 39, "metal-rich": 33 }, 50853, 46638, 273000),
  m("Platinum", "Metal-bearing ground", { "metal-rich": 46, "high-metal-content": 34 }, 65087, 58486, 302844),
  m("Rhodplumsite", "Metal-bearing ground", { "metal-rich": 10, "high-metal-content": 4 }, 175155, 179266, 851591),

  m("Alexandrite", "Rocky ground", { "volcanic-magma": 35, "volcanic-silicate": 8 }, 186173, 209603, 713305),
  m("Bastnasite", "Rocky ground", { "volcanic-magma": 42, rocky: 9 }, 76572, 67605, 351568),
  m("Grandidierite", "Rocky ground", { rocky: 12, "volcanic-silicate": 12 }, 170264, 191709, 642217),
  m("Helium", "Rocky ground", { "volcanic-silicate": 51, rocky: 10 }, 99952, 86564, 487501),
  m("Jadeite", "Rocky ground", { "volcanic-silicate": 56, rocky: 22 }, 33694, 28881, 178014),
  m("Low Temperature Diamonds", "Rocky ground", { icy: 27, "rocky-ice": 7 }, 123084, 112616, 575767),
  m("Magnesite", "Rocky ground", { rocky: 43, "volcanic-silicate": 31 }, 36913, 32856, 170946),
  m("Monazite", "Rocky ground", { "volcanic-magma": 46, "volcanic-silicate": 8 }, 244125, 208001, 896105),
  m("Olivine", "Rocky ground", { "volcanic-magma": 56, "rocky-ice": 14 }, 30310, 27038, 140720),
  m("Periclase Dunite", "Rocky ground", { rocky: 12, "volcanic-silicate": 4 }, 165913, 162967, 967856),
  m("Quartz Pyroxenite", "Rocky ground", { "volcanic-magma": 18, "volcanic-silicate": 4 }, 45114, 39965, 207868),
  m("Serendibite", "Rocky ground", { "volcanic-magma": 32, "volcanic-silicate": 5 }, 150673, 168195, 570948),
  m("Thortveitite", "Rocky ground", { "volcanic-silicate": 10, rocky: 10 }, 165626, 162273, 967856),

  m("Deuterium", "Icy ground", { icy: 54, "rocky-ice": 36 }, 39401, 35045, 182440),
  m("Helium-3", "Icy ground", { icy: 17 }, 93432, 80969, 456092),
];

// Class precedence from the survey: metal-rich, HMC, icy and rocky-ice get their own class even if volcanic; only rocky bodies split by volcanism,
// and silicate magma (not geysers) stays plain "rocky". Inputs are Spansh strings.
export function classifyBody(subtype: string | null, volcanism: string | null): BodyClass | null {
  const s = (subtype ?? "").toLowerCase();
  if (s.includes("metal-rich") || s.includes("metal rich")) return "metal-rich";
  if (s.includes("high metal")) return "high-metal-content";
  if (s.includes("rocky ice") || s.includes("rocky-ice")) return "rocky-ice";
  if (s.includes("icy")) return "icy";
  if (s.includes("rocky")) {
    const v = (volcanism ?? "").toLowerCase();
    if (v.includes("metallic magma") || v.includes("rocky magma")) return "volcanic-magma";
    if (v.includes("silicate vapour") || v.includes("silicate vapor")) return "volcanic-silicate";
    return "rocky";
  }
  return null;
}

