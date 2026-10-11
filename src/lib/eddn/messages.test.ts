import { describe, expect, it } from "vitest";

import { bodySignalsFound, fssBodySignals, jumpToUnoccupiedSystem, locationInFortifiedSystem, marketMessage, SYMBOLS } from "../../test/eddn-messages";

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

  it("ignores commodities it does not know, and values that make no sense", () => {
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
    expect(u).toMatchObject({ commodities: [{ name: "Indite", price: 1234, demand: 9 }] });
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
    expect(update(locationInFortifiedSystem())).toEqual({
      kind: "system",
      id64: 1457973629642,
      at: "2026-10-08T09:06:49Z",
      controllingPower: "Pranav Antal",
      powerState: "Fortified",
      powers: ["Li Yong-Rui", "Pranav Antal", "Jerome Archer"],
      controlProgress: 0.263395,
      reinforcement: 0,
      undermining: 1793,
      conflict: null,
      factionState: "Expansion",
    });
  });

  it("an unoccupied system has no controller, and its contest progress is kept", () => {
    expect(update(jumpToUnoccupiedSystem())).toMatchObject({
      id64: 7268024329673,
      controllingPower: null,
      powerState: "Unoccupied",
      conflict: [{ power: "Edmund Mahon", progress: 0.000067 }, { power: "Yuri Grom", progress: 0.001375 }],
      factionState: "None", // the faction listed no state
    });
  });

  it("reads jumps, locations and carrier jumps alike, and nothing else", () => {
    expect(update(jumpToUnoccupiedSystem({ event: "CarrierJump" }))).toMatchObject({ kind: "system" });
    expect(skipped(jumpToUnoccupiedSystem({ event: "Docked" }))).toBe("event");
    expect(skipped(jumpToUnoccupiedSystem({ event: "Scan" }))).toBe("event");
  });

});

describe("planetary mining signals", () => {
  it("reads the count from a first scan and from a detailed surface scan", () => {
    expect(update(fssBodySignals())).toEqual({ kind: "signals", id64: 22970021858168, bodyId: 27, miningSignals: 8 });
    expect(update(bodySignalsFound())).toEqual({ kind: "signals", id64: 9465168405905, bodyId: 14, miningSignals: 14 });
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
