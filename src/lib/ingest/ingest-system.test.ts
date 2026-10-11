/* eslint-disable @typescript-eslint/no-explicit-any */
import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";

import { migrate } from "../db/migrations";

import { createIngester } from "./ingest-system";

let db: Database.Database;
let ingest: ReturnType<typeof createIngester>;
const all = (sql: string) => db.prepare(sql).all() as any[];

beforeEach(() => {
  db = new Database(":memory:");
  migrate(db);
  ingest = createIngester(db);
});

const daysAgo = (d: number) => new Date(Date.now() - d * 86400_000).toISOString();
const RECENT = daysAgo(1);
const stn = (over: any = {}) => ({
  id: 1, name: "Hub", type: "Orbis Starport", landingPads: { large: 2, medium: 2 }, distanceToArrival: 12.5,
  market: { updateTime: RECENT, commodities: [{ name: "Gold", demand: 10, sellPrice: 9000 }] },
  ...over,
});
const sys = (over: any = {}) => ({ id64: 1, name: "S", coords: { x: 1, y: 2, z: 3 }, stations: [stn()], bodies: [], ...over });

describe("createIngester", () => {
  it("returns false and writes nothing for a system with no market", () => {
    expect(ingest(sys({ stations: [] }))).toBe(false);
    expect(ingest(sys({ stations: [{ id: 2, name: "Dock", type: "Outpost" }] }))).toBe(false);
    expect(all("select * from systems")).toHaveLength(0);
  });

  it("stores coordinates and Powerplay fields", () => {
    ingest(sys({
      controllingPower: "Edmund Mahon", powerState: "Fortified", powers: ["Edmund Mahon", "Aisling Duval"],
      powerStateControlProgress: 0.5, powerStateReinforcement: 12, powerStateUndermining: 3,
      controllingFaction: { state: "Boom" }, powerConflictProgress: [{ power: "Aisling Duval", progress: 0.2 }],
    }));
    expect(all("select * from systems")[0]).toMatchObject({
      id64: 1, name: "S", x: 1, y: 2, z: 3, controlling_power: "Edmund Mahon", power_state: "Fortified",
      control_progress: 0.5, reinforcement: 12, undermining: 3, faction_state: "Boom",
    });
    expect(JSON.parse(all("select powers from systems")[0].powers)).toEqual(["Edmund Mahon", "Aisling Duval"]);
    expect(JSON.parse(all("select conflict from systems")[0].conflict)).toEqual([{ power: "Aisling Duval", progress: 0.2 }]);
  });

  it("learns each commodity's EDDN symbol and market name, from every usable market", () => {
    ingest(sys({ stations: [stn({ market: { updateTime: RECENT, commodities: [{ name: "Energy Grid Assembly", symbol: "PowerGridAssembly", demand: 0, sellPrice: 0 }, { name: "Gold", symbol: "Gold", demand: 10, sellPrice: 9000 }] } })] }));
    expect([...ingest.symbols]).toEqual([["powergridassembly", "Energy Grid Assembly"], ["gold", "Gold"]]);
  });

  it("skips fleet carriers and stations with an empty market", () => {
    ingest(sys({ stations: [stn(), stn({ id: 2, name: "FC", type: "Drake-Class Carrier" }), stn({ id: 3, name: "Empty", market: { commodities: [] } })] }));
    expect(all("select name from stations").map((r) => r.name)).toEqual(["Hub"]);
  });

  describe("which stations are kept", () => {
    const kept = () => all("select name from stations order by id").map((r) => r.name);
    const market = (over: any = {}) => ({ updateTime: RECENT, commodities: [{ name: "Gold", demand: 10, sellPrice: 9000 }], ...over });

    it("keeps a market updated within a year, and skips an older or undated one", () => {
      ingest(sys({ stations: [
        stn({ id: 1, name: "Fresh", market: market({ updateTime: daysAgo(3) }) }),
        stn({ id: 2, name: "NearlyAYear", market: market({ updateTime: daysAgo(364) }) }),
        stn({ id: 3, name: "Stale", market: market({ updateTime: daysAgo(366) }) }),
        stn({ id: 4, name: "Undated", market: market({ updateTime: undefined }) }),
        stn({ id: 5, name: "Garbage", market: market({ updateTime: "not a date" }) }),
      ] }));
      expect(kept()).toEqual(["Fresh", "NearlyAYear"]);
    });

  });

  it("keeps only commodities with demand and a sell price", () => {
    ingest(sys({ stations: [stn({ market: { updateTime: RECENT, commodities: [
      { name: "Gold", demand: 10, sellPrice: 9000 },
      { name: "NoDemand", demand: 0, sellPrice: 500 },
      { name: "NoPrice", demand: 5, sellPrice: 0 },
    ] } })] }));
    expect(all("select commodity from market").map((r) => r.commodity)).toEqual(["Gold"]);
  });

  describe("planets", () => {
    const planet = (over: any = {}) => ({ bodyId: 1, id64: 10, name: "S 1", type: "Planet", subType: "Rocky body", isLandable: true, volcanismType: "No volcanism", gravity: 0.2, distanceToArrival: 100, ...over });

    it("stores landable planets only, classified by body class", () => {
      ingest(sys({ bodies: [
        planet({ bodyId: 1, name: "A", volcanismType: "Metallic Magma volcanism" }),
        planet({ bodyId: 2, name: "B", isLandable: false }),
        { bodyId: 3, name: "Star", type: "Star" },
        planet({ bodyId: 4, name: "C", subType: "Icy body" }),
      ] }));
      expect(all("select name, body_class from bodies order by body_id")).toEqual([
        { name: "A", body_class: "volcanic-magma" },
        { name: "C", body_class: "icy" },
      ]);
    });

    it("reads the planetary mining signal count; no data stays NULL (unknown, not zero)", () => {
      ingest(sys({ bodies: [
        planet({ bodyId: 1, name: "With", signals: { signals: { "$PlanetaryMiningLocation_Name;": 17, "$SAA_SignalType_Biological;": 2 } } }),
        planet({ bodyId: 2, name: "Other", signals: { signals: { "$SAA_SignalType_Biological;": 2 } } }),
        planet({ bodyId: 3, name: "None" }),
      ] }));
      expect(all("select name, mining_signals from bodies order by body_id")).toEqual([
        { name: "With", mining_signals: 17 },
        { name: "Other", mining_signals: null },
        { name: "None", mining_signals: null },
      ]);
    });

    it("keys bodies by (system, bodyId): Spansh id64s above 2^53 collide as JS numbers", () => {
      // Parsed from JSON text, these two different ids become the same double.
      const parsed = JSON.parse('[{"bodyId":1,"id64":36028797019783487},{"bodyId":2,"id64":36028797019783488}]');
      expect(parsed[0].id64).toBe(parsed[1].id64);
      ingest(sys({ bodies: parsed.map((p: any, i: number) => planet({ ...p, name: `P${i}` })) }));
      expect(all("select name from bodies order by body_id").map((r) => r.name)).toEqual(["P0", "P1"]);
    });
  });

  describe("rings", () => {
    const ringBody = (rings: any[], reserveLevel: string | null = "Pristine") => ({ bodyId: 1, name: "S 1", type: "Planet", subType: "Gas giant", reserveLevel, rings });

    it("stores rings with hotspots, with type and reserve level", () => {
      ingest(sys({ bodies: [ringBody([
        { name: "S 1 A Ring", type: "Metallic", signals: { signals: { Platinum: 3, Painite: 1 } } },
      ])] }));
      expect(all("select * from rings")[0]).toMatchObject({ name: "S 1 A Ring", type: "Metallic", reserve: "Pristine" });
      expect(all("select material, count from ring_hotspots order by material")).toEqual([
        { material: "Painite", count: 1 }, { material: "Platinum", count: 3 },
      ]);
    });

    it("stores rings without hotspots too, with no hotspot rows (materials without hotspots are found by ring type)", () => {
      ingest(sys({ bodies: [ringBody([{ name: "Plain Ring", type: "Rocky" }, { name: "Empty", type: "Icy", signals: { signals: {} } }])] }));
      expect(all("select name, type, reserve from rings order by name")).toEqual([
        { name: "Empty", type: "Icy", reserve: "Pristine" },
        { name: "Plain Ring", type: "Rocky", reserve: "Pristine" },
      ]);
      expect(all("select * from ring_hotspots")).toHaveLength(0);
    });

    it("renames hotspot signals to their market commodity names", () => {
      ingest(sys({ bodies: [ringBody([{ name: "R", type: "Icy", signals: { signals: { LowTemperatureDiamond: 2, Opal: 1, Tritium: 4 } } }])] }));
      expect(all("select material from ring_hotspots order by material").map((r) => r.material)).toEqual(["Low Temperature Diamonds", "Tritium", "Void Opal"]);
    });

  });

  it("re-ingesting the same system replaces rather than duplicates", () => {
    ingest(sys());
    ingest(sys({ name: "Renamed" }));
    expect(all("select name from systems")).toEqual([{ name: "Renamed" }]);
    expect(all("select * from stations")).toHaveLength(1);
  });
});
