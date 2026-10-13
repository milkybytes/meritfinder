// The commodity names the messages below use, as the ingest records them: EDDN's symbol (lower case) -> the market's name.
export const SYMBOLS: ReadonlyMap<string, string> = new Map([
  ["platinum", "Platinum"],
  ["palladium", "Palladium"],
  ["gold", "Gold"],
  ["monazite", "Monazite"],
  ["indite", "Indite"],
  ["powergridassembly", "Energy Grid Assembly"],
]);

// Real EDDN messages, captured from the live relay on 2026-10-08 and trimmed (uploader ids and unrelated fields removed).
// Tests change the ids and times to match what they set up.
export const marketMessage = (over: Record<string, unknown> = {}) => ({
  header: { softwareName: "EDDLite", softwareVersion: "3.3.0.0", gameversion: "4.4.1.1", gatewayTimestamp: "2026-10-08T09:06:50.625185Z" },
  $schemaRef: "https://eddn.edcd.io/schemas/commodity/3",
  message: {
    systemName: "Ngurii",
    stationName: "Cheranovsky City",
    stationType: "Coriolis",
    marketId: 3225348096,
    timestamp: "2026-10-08T09:06:45Z",
    commodities: [
      { name: "platinum", meanPrice: 55505, buyPrice: 0, stock: 0, stockBracket: 0, sellPrice: 237109, demand: 642, demandBracket: 2, statusFlags: ["Consumer"] },
      { name: "palladium", meanPrice: 50356, buyPrice: 0, stock: 0, stockBracket: 0, sellPrice: 58097, demand: 2426, demandBracket: 1, statusFlags: ["Consumer"] },
      { name: "gold", meanPrice: 47113, buyPrice: 0, stock: 0, stockBracket: 0, sellPrice: 54779, demand: 0, demandBracket: 1, statusFlags: ["Consumer"] }, // sells here at 0 demand: nobody is buying
      { name: "powergridassembly", meanPrice: 4000, buyPrice: 4100, stock: 50, stockBracket: 2, sellPrice: 3900, demand: 12, demandBracket: 1 }, // internal name differs from the market's
    ],
    odyssey: false,
    horizons: true,
    ...over,
  },
});

const journal = (message: Record<string, unknown>) => ({
  header: { softwareName: "EDDiscovery", softwareVersion: "19.1.11.0", gameversion: "4.4.1.1", gatewayTimestamp: "2026-10-08T09:07:09.009012Z" },
  $schemaRef: "https://eddn.edcd.io/schemas/journal/1",
  message,
});

export const jumpToUnoccupiedSystem = (over: Record<string, unknown> = {}) =>
  journal({
    timestamp: "2026-10-08T09:07:05Z",
    event: "FSDJump",
    StarSystem: "Alrai Sector OS-T b3-3",
    SystemAddress: 7268024329673,
    StarPos: [7.84375, 34.71875, 86.46875],
    Population: 158433,
    Powers: ["Edmund Mahon", "Yuri Grom", "Nakato Kaine"],
    PowerplayState: "Unoccupied",
    PowerplayConflictProgress: [
      { Power: "Edmund Mahon", ConflictProgress: 0.000067 },
      { Power: "Yuri Grom", ConflictProgress: 0.001375 },
    ],
    Factions: [{ Name: "10th Legion Industries", FactionState: "None", Influence: 0.498498 }],
    SystemFaction: { Name: "10th Legion Industries" },
    ...over,
  });

export const locationInFortifiedSystem = (over: Record<string, unknown> = {}) =>
  journal({
    timestamp: "2026-10-08T09:06:49Z",
    event: "Location",
    Docked: false,
    StarSystem: "Pegasi Sector BL-X c1-5",
    SystemAddress: 1457973629642,
    StarPos: [-162.28125, -19.65625, -31.6875],
    Population: 3448045130,
    ControllingPower: "Pranav Antal",
    Powers: ["Li Yong-Rui", "Pranav Antal", "Jerome Archer"],
    PowerplayState: "Fortified",
    PowerplayStateControlProgress: 0.263395,
    PowerplayStateReinforcement: 0,
    PowerplayStateUndermining: 1793,
    SystemFaction: { Name: "Stellanebula Project", FactionState: "Expansion" },
    Factions: [{ Name: "Stellanebula Project", FactionState: "Expansion", ActiveStates: [{ State: "Expansion" }] }],
    ...over,
  });

export const bodySignalsFound = (over: Record<string, unknown> = {}) =>
  journal({
    timestamp: "2026-10-08T09:06:39Z",
    event: "SAASignalsFound",
    BodyName: "Pegasi Sector BL-W b2-4 5 a",
    SystemAddress: 9465168405905,
    BodyID: 14,
    Signals: [
      { Type: "$PlanetaryMiningLocation_Name;", Count: 14 },
      { Type: "$SAA_SignalType_Human;", Count: 6 },
    ],
    ...over,
  });

export const fssBodySignals = (over: Record<string, unknown> = {}) => ({
  header: { softwareName: "EDDiscovery", softwareVersion: "19.1.11.0", gatewayTimestamp: "2026-10-08T09:06:44.000000Z" },
  $schemaRef: "https://eddn.edcd.io/schemas/fssbodysignals/1",
  message: {
    timestamp: "2026-10-08T09:06:43Z",
    event: "FSSBodySignals",
    BodyName: "Hermoth 8 c",
    BodyID: 27,
    SystemAddress: 22970021858168,
    Signals: [{ Type: "$PlanetaryMiningLocation_Name;", Count: 8 }],
    StarSystem: "Hermoth",
    ...over,
  },
});

// A docking, as captured on 2026-10-11 and trimmed.
export const docked = (over: Record<string, unknown> = {}) =>
  journal({
    timestamp: "2026-10-08T09:07:10Z",
    event: "Docked",
    StationName: "Cheranovsky City",
    StationType: "Coriolis",
    StarSystem: "Ngurii",
    SystemAddress: 4999999999,
    MarketID: 3225348096,
    StarPos: [12.5, -40.25, 900.75],
    DistFromStarLS: 1234.5,
    LandingPads: { Small: 17, Medium: 18, Large: 9 },
    ...over,
  });

// A planet with rings, scanned.
export const scanOfRingedPlanet = (over: Record<string, unknown> = {}) =>
  journal({
    timestamp: "2026-10-08T09:07:20Z",
    event: "Scan",
    BodyName: "Ngurii 5",
    BodyID: 22,
    StarSystem: "Ngurii",
    SystemAddress: 4999999999,
    DistanceFromArrivalLS: 812.5,
    PlanetClass: "Rocky body",
    Landable: false,
    Volcanism: "",
    SurfaceGravity: 9.80665,
    ReserveLevel: "PristineResources",
    Rings: [
      { Name: "Ngurii 5 A Ring", RingClass: "eRingClass_Rocky", MassMT: 1e10, InnerRad: 1e8, OuterRad: 2e8 },
      { Name: "Ngurii 5 B Ring", RingClass: "eRingClass_MetalRich", MassMT: 1e10, InnerRad: 3e8, OuterRad: 4e8 },
    ],
    StarPos: [12.5, -40.25, 900.75],
    ...over,
  });

// A landable planet, scanned.
export const scanOfLandablePlanet = (over: Record<string, unknown> = {}) =>
  journal({
    timestamp: "2026-10-08T09:07:30Z",
    event: "Scan",
    BodyName: "Ngurii 5 a",
    BodyID: 23,
    StarSystem: "Ngurii",
    SystemAddress: 4999999999,
    DistanceFromArrivalLS: 815,
    PlanetClass: "High metal content body",
    Landable: true,
    Volcanism: "minor silicate vapour geysers volcanism",
    SurfaceGravity: 4.903325,
    StarPos: [12.5, -40.25, 900.75],
    ...over,
  });

// The surface scan of a ring: its hotspots.
export const ringScan = (over: Record<string, unknown> = {}) =>
  journal({
    timestamp: "2026-10-08T09:07:40Z",
    event: "SAASignalsFound",
    BodyName: "Ngurii 5 A Ring",
    SystemAddress: 4999999999,
    BodyID: 24,
    Signals: [
      { Type: "Serendibite", Count: 2 },
      { Type: "Platinum", Count: 3 },
      { Type: "Monazite", Count: 1 },
    ],
    Genuses: [],
    StarSystem: "Ngurii",
    ...over,
  });
