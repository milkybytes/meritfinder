import { describe, expect, it } from "vitest";

import { bodySignalsFound, docked, fssBodySignals, jumpToUnoccupiedSystem, locationInFortifiedSystem, marketMessage, ringScan, scanOfLandablePlanet, scanOfRingedPlanet, SYMBOLS } from "../../test/eddn-messages";

import { parseMessage, type EddnUpdate } from "./messages";

const NOW = Date.parse("2026-10-08T09:10:00Z");
const parse = (m: unknown) => parseMessage(m, NOW, SYMBOLS);
const update = (m: unknown): EddnUpdate => {
  const r = parse(m);
  if (!("update" in r)) throw new Error(`skipped: ${r.skip}`);
  return r.update;
};
const skipped = (m: unknown) => ("skip" in parse(m) ? (parse(m) as { skip: string }).skip : null);

describe("market messages", () => {
  it("keeps what is bought, under the market's own names", () => {
    expect(update(marketMessage())).toEqual({
      kind: "market",
      marketId: 3225348096,
      at: "2026-10-08T09:06:45Z",
      commodities: [
        { name: "Platinum", price: 237109, demand: 642 },
        { name: "Palladium", price: 58097, demand: 2426 },
        { name: "Energy Grid Assembly", price: 3900, demand: 12 }, // "powergridassembly" in the feed; Gold has no demand
      ],
    });
  });

  it("an emptied market is still an update: the station now buys nothing", () => {
    expect(update(marketMessage({ commodities: [] }))).toMatchObject({ kind: "market", commodities: [] });
  });

  it("ignores values that make no sense, and names a commodity it does not know provisionally", () => {
    const u = update(
      marketMessage({
        commodities: [
          { name: "notarealthing", sellPrice: 100, demand: 5 },
          { name: "platinum", sellPrice: 999_999_999_999, demand: 5 }, // absurd price
          { name: "gold", sellPrice: 100.5, demand: 5 }, // not whole credits
          { name: "silver", sellPrice: -5, demand: 5 },
          { name: "palladium", sellPrice: 50, demand: "lots" },
          { name: 7, sellPrice: 50, demand: 5 },
          null,
          { name: "indite", sellPrice: 1234, demand: 9 },
        ],
      }),
    );
    expect(u).toMatchObject({
      commodities: [{ name: "Notarealthing", price: 100, demand: 5, provisional: true }, { name: "Indite", price: 1234, demand: 9 }],
      unknown: ["notarealthing"],
    });
  });

});

describe("a market that cannot be named", () => {
  it("is not read at all without commodity names, so it cannot empty a real market", () => {
    expect(parseMessage(marketMessage(), NOW, new Map())).toEqual({ skip: "no-names" });
  });

  it("is not read when everything it buys has no usable name at all, which is not the same as buying nothing", () => {
    expect(skipped(marketMessage({ commodities: [{ name: "not a symbol!", sellPrice: 100, demand: 5 }] }))).toBe("no-names");
  });

  it("is read when it buys only a commodity newer than our names, under a name made from the symbol", () => {
    expect(update(marketMessage({ commodities: [{ name: "newthing", sellPrice: 100, demand: 5 }] }))).toMatchObject({
      commodities: [{ name: "Newthing", price: 100, demand: 5, provisional: true }],
      unknown: ["newthing"],
    });
  });
});

describe("when a message was sent", () => {
  it("rejects one from the future, but allows for slightly different clocks", () => {
    expect(skipped(marketMessage({ timestamp: "2026-10-09T09:10:00Z" }))).toBe("future");
    expect(update(marketMessage({ timestamp: "2026-10-08T09:15:00Z" }))).toMatchObject({ kind: "market" }); // five minutes ahead
  });

});

describe("Powerplay state from the journal", () => {
  it("takes the full state from a system the player is in", () => {
    expect(update(locationInFortifiedSystem())).toMatchObject({
      kind: "system",
      powerplay: true,
      id64: 1457973629642,
      at: "2026-10-08T09:06:49Z",
      controllingPower: "Pranav Antal",
      powerState: "Fortified",
      powers: ["Li Yong-Rui", "Pranav Antal", "Jerome Archer"],
      controlProgress: 0.263395,
      reinforcement: 0,
      undermining: 1793,
      conflict: null,
    });
  });

  it("an unoccupied system has no controller, and its contest progress is kept", () => {
    expect(update(jumpToUnoccupiedSystem())).toMatchObject({
      id64: 7268024329673,
      controllingPower: null,
      powerState: "Unoccupied",
      conflict: [{ power: "Edmund Mahon", progress: 0.000067 }, { power: "Yuri Grom", progress: 0.001375 }],
    });
  });

  it("reads jumps, locations and carrier jumps alike, and nothing else", () => {
    expect(update(jumpToUnoccupiedSystem({ event: "CarrierJump" }))).toMatchObject({ kind: "system" });
    expect(skipped(jumpToUnoccupiedSystem({ event: "FSSDiscoveryScan" }))).toBe("event");
    expect(skipped(jumpToUnoccupiedSystem({ event: "StartJump" }))).toBe("event");
  });

});

describe("a system with no Powerplay presence", () => {
  it("is added when someone lives there, but its state is left alone", () => {
    const u = update(jumpToUnoccupiedSystem({ Powers: undefined, PowerplayState: undefined, PowerplayConflictProgress: undefined }));
    expect(u).toMatchObject({ kind: "system", powerplay: false, name: "Alrai Sector OS-T b3-3", pos: [7.84375, 34.71875, 86.46875] });
  });

  it("is skipped when nobody lives there", () => {
    expect(skipped(jumpToUnoccupiedSystem({ Powers: undefined, PowerplayState: undefined, PowerplayConflictProgress: undefined, Population: 0 }))).toBe("no-powerplay");
  });
});

describe("stations, planets and rings", () => {
  it("reads a docking: where the station is, what it is, and its pads", () => {
    expect(update(docked())).toMatchObject({
      kind: "station", marketId: 3225348096, id64: 4999999999, systemName: "Ngurii", pos: [12.5, -40.25, 900.75],
      name: "Cheranovsky City", type: "Coriolis Starport", distanceLs: 1234.5, large: true, medium: true,
    });
    expect(update(docked({ StationType: "Outpost", LandingPads: { Small: 2, Medium: 2, Large: 0 } }))).toMatchObject({ type: "Outpost", large: false, medium: true });
    expect(update(docked({ StationType: "Dodec" }))).toMatchObject({ type: "Dodec Starport" });
    expect(update(docked({ StationType: "Bernal" }))).toMatchObject({ type: "Ocellus Starport" });
    expect(skipped(docked({ StationName: "Safe\u202eelbaT" }))).toBe("malformed"); // a bidirectional override
    expect(skipped(docked({ StationName: "Line\nbreak" }))).toBe("malformed");
    expect(update(docked({ LandingPads: undefined }))).toMatchObject({ large: null, medium: null }); // not said: not the same as none
    expect(skipped(docked({ StationName: "$EXT_PANEL_ColonisationShip; Liman Enterprise" }))).toBe("unlocalised");
    expect(skipped(docked({ StationType: "PlanetaryConstructionDepot" }))).toBe("construction-site");
    expect(skipped(docked({ StationType: "SpaceConstructionDepot" }))).toBe("construction-site");
    expect(skipped(docked({ StationType: "Outpost", StationServices: ["dock", "commodities", "colonisationcontribution"] }))).toBe("construction-site");
    expect(update(docked({ StationType: "Outpost", StationServices: ["dock", "commodities", "registeringcolonisation"] }))).toMatchObject({ kind: "station" }); // a normal station, just named like one
    expect(skipped(docked({ StationType: "FleetCarrier" }))).toBe("carrier");
    expect(skipped(docked({ StarPos: [1e9, 0, 0] }))).toBe("malformed"); // not a place in the galaxy
  });

  it("reads a scanned planet's rings with their type and reserve", () => {
    expect(update(scanOfRingedPlanet())).toMatchObject({
      kind: "body", id64: 4999999999, bodyId: 22, landable: false, reserve: "Pristine",
      rings: [{ name: "Ngurii 5 A Ring", type: "Rocky" }, { name: "Ngurii 5 B Ring", type: "Metal Rich" }],
    });
  });

  it("reads a landable planet in the dump's own words: type, volcanism and gravity in g", () => {
    expect(update(scanOfLandablePlanet())).toMatchObject({
      kind: "body", landable: true, subtype: "High metal content world", volcanism: "Minor Silicate Vapour Geysers", gravity: 0.5, bodyClass: "high-metal-content",
    });
  });

  it("skips what cannot be mined: stars, and planets that are neither landable nor ringed", () => {
    expect(skipped(scanOfRingedPlanet({ PlanetClass: undefined }))).toBe("not-a-planet");
    expect(skipped(scanOfRingedPlanet({ Rings: undefined }))).toBe("nothing-to-mine");
    expect(skipped(scanOfLandablePlanet({ Landable: false }))).toBe("nothing-to-mine");
    expect(skipped(scanOfLandablePlanet({ PlanetClass: "Gas giant with water based life" }))).toBe("nothing-to-mine");
  });

  it("reads a ring's hotspots, by their market names, and a body's signals as before", () => {
    expect(update(ringScan())).toMatchObject({
      kind: "hotspots", id64: 4999999999, ringName: "Ngurii 5 A Ring",
      hotspots: [{ material: "Serendibite", count: 2 }, { material: "Platinum", count: 3 }, { material: "Monazite", count: 1 }],
    });
    expect(update(bodySignalsFound())).toMatchObject({ kind: "signals" }); // a planet, not a ring
  });
});

describe("planetary mining signals", () => {
  it("reads the count from a first scan and from a detailed surface scan", () => {
    expect(update(fssBodySignals())).toMatchObject({ kind: "signals", id64: 22970021858168, bodyId: 27, miningSignals: 8 });
    expect(update(bodySignalsFound())).toMatchObject({ kind: "signals", id64: 9465168405905, bodyId: 14, miningSignals: 14 });
  });

  it("learns nothing from a body whose signals are of other kinds: unknown stays unknown", () => {
    expect(skipped(bodySignalsFound({ Signals: [{ Type: "$SAA_SignalType_Biological;", Count: 6 }] }))).toBe("no-mining-signal");
    expect(skipped(bodySignalsFound({ Signals: [] }))).toBe("no-mining-signal");
  });

});

describe("anything else", () => {
  it("skips other schemas, and the relay's test schemas, which are not real data", () => {
    expect(skipped({ ...marketMessage(), $schemaRef: "https://eddn.edcd.io/schemas/outfitting/2" })).toBe("schema");
    expect(skipped({ ...marketMessage(), $schemaRef: "https://eddn.edcd.io/schemas/commodity/3/test" })).toBe("schema");
    expect(skipped({ ...marketMessage(), $schemaRef: "https://evil.example/schemas/commodity/3" })).toBe("schema");
  });

  it("never throws, whatever it is given", () => {
    const odd: unknown[] = [null, undefined, 0, "market", [], [1, 2], {}, { message: {} }, { $schemaRef: 5, message: {} }, { $schemaRef: "https://eddn.edcd.io/schemas/commodity/3", message: null }, { $schemaRef: "https://eddn.edcd.io/schemas/journal/1", message: { event: ["FSDJump"] } }];
    for (const m of odd) expect(() => parse(m)).not.toThrow();
    for (const m of odd) expect(skipped(m), JSON.stringify(m)).not.toBeNull();
  });
});
