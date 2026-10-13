// How the journal (EDDN) names things, and the names the database uses (those of the Spansh dump).

// Station types. A type not listed is kept as the journal gives it.
const STATION_TYPES: Record<string, string> = {
  Coriolis: "Coriolis Starport",
  Orbis: "Orbis Starport",
  Ocellus: "Ocellus Starport",
  Bernal: "Ocellus Starport", // the journal's name for an Ocellus
  Dodec: "Dodec Starport",
  Outpost: "Outpost",
  CraterPort: "Planetary Port",
  CraterOutpost: "Planetary Outpost",
  AsteroidBase: "Asteroid base",
  MegaShip: "Mega ship",
  SurfaceStation: "Settlement",
  OnFootSettlement: "Settlement",
  PlanetaryConstructionDepot: "Planetary Construction Depot",
  SpaceConstructionDepot: "Space Construction Depot",
};
export const stationType = (journal: string): string => STATION_TYPES[journal] ?? journal;

// Planet classes the app draws and classifies; any other class (gas giants, water worlds...) is not a mining target.
const PLANET_CLASSES: Record<string, string> = {
  "Rocky body": "Rocky body",
  "Icy body": "Icy body",
  "High metal content body": "High metal content world",
  "Metal rich body": "Metal-rich body",
  "Rocky ice body": "Rocky Ice world",
};
export const planetSubtype = (journal: string): string | null => PLANET_CLASSES[journal] ?? null;

export const RING_CLASSES: Record<string, string> = {
  eRingClass_Icy: "Icy",
  eRingClass_Rocky: "Rocky",
  eRingClass_MetalRich: "Metal Rich",
  eRingClass_Metalic: "Metallic", // the journal's own spelling
  eRingClass_Metallic: "Metallic",
};

export const RESERVE_LEVELS: Record<string, string> = {
  PristineResources: "Pristine",
  MajorResources: "Major",
  CommonResources: "Common",
  LowResources: "Low",
  DepletedResources: "Depleted",
};

// "minor silicate vapour geysers volcanism" -> "Minor Silicate Vapour Geysers"; none -> "No volcanism" (as the dump writes them).
export function volcanismName(journal: string): string {
  const text = journal.replace(/\s*volcanism$/i, "").trim();
  if (!text) return "No volcanism";
  return text.replace(/\b\w/g, (c) => c.toUpperCase());
}

export const METRES_PER_SECOND_SQUARED_PER_G = 9.80665;
