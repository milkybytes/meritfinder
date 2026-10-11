/* eslint-disable @typescript-eslint/no-explicit-any -- fixtures mimic untyped Spansh dump JSON */
// A tiny synthetic galaxy in Spansh dump shape. Systems sit on the x axis so distances from
// Origin are exact: Alpha 10 ly, Delta 20, Beta 30, Gamma 100.
//
//  Alpha  Fortified, Aisling Duval (+ Edmund Mahon present), Boom.
//         L-pad hub: Monazite 500,000 / 1000 t (fresh), Gold 9,000. Three rings (Pristine): Rocky
//         with Monazite x2 (core only), Icy with Opal x1 (core only), Metallic with Painite x1
//         (core or laser); and a Metal Rich ring with no hotspots at all (where Gold can be found). Landable volcanic-magma planet (12 mining signals) and an icy
//         planet with no signal data.
//  Beta   Exploited, Edmund Mahon, Bust. Medium-pad only, stale (40 d) Monazite 700,000 / 5 t.
//  Gamma  Stronghold, Zemina Torval. L pad: Monazite 300,000 / 2000 t (fresh) plus a fleet
//         carrier that must be ignored. High-metal-content planet with 5 signals.
//  Delta  Unoccupied. L pad: Water 100.
//  Zeta   150 ly up the y axis, uncontrolled. Platinum 900,000 / Gold 100: its price BOUND (best
//         price at the station) is far above what Gold alone pays, which exercises the ranking.
//  Origin the reference system. Has a market but no Powerplay state.
//  Ghost  station with no market: must not appear in the database.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { openWritable } from "../lib/db/db";
import { storeCommoditySymbols, storeCommodities } from "../lib/ingest/finalize";
import { createIngester } from "../lib/ingest/ingest-system";

const ago = (days: number) => new Date(Date.now() - days * 86400_000).toISOString();

const station = (id: number, name: string, pads: { large?: number; medium?: number }, ls: number, commodities: any[], days: number, extra: any = {}) => ({
  id, name, type: "Orbis Starport", landingPads: { small: 1, ...pads }, distanceToArrival: ls,
  market: { commodities, updateTime: ago(days) }, ...extra,
});
const c = (name: string, demand: number, sellPrice: number) => ({ name, symbol: name.replace(/ /g, ""), demand, sellPrice });

const SYSTEMS: any[] = [
  {
    id64: 1, name: "Origin", coords: { x: 0, y: 0, z: 0 },
    stations: [station(10, "Origin Port", { large: 1 }, 50, [c("Water", 10, 100)], 1)],
    bodies: [],
  },
  {
    id64: 2, name: "Alpha", coords: { x: 10, y: 0, z: 0 },
    controllingPower: "Aisling Duval", powerState: "Fortified",
    powers: ["Edmund Mahon", "Aisling Duval"], // controller deliberately not first
    controllingFaction: { name: "Alpha Co", state: "Boom" },
    stations: [station(20, "Alpha Hub", { large: 1 }, 100, [c("Monazite", 1000, 500000), c("Gold", 500, 9000), c("Void Opal", 10, 100000)], 1, { controllingFactionState: "Boom" })],
    bodies: [
      {
        bodyId: 1, id64: 100, name: "Alpha 1", type: "Planet", subType: "Gas giant with water-based life", stations: [],
        reserveLevel: "Pristine",
        rings: [
          { name: "Alpha 1 A Ring", type: "Rocky", signals: { signals: { Monazite: 2 }, updateTime: ago(30) } },
          { name: "Alpha 1 B Ring", type: "Icy", signals: { signals: { Opal: 1 }, updateTime: ago(30) } },
          { name: "Alpha 1 C Ring", type: "Metallic", signals: { signals: { Painite: 1 }, updateTime: ago(30) } },
          { name: "Alpha 1 D Ring", type: "Metal Rich" },
        ],
      },
      {
        bodyId: 2, id64: 101, name: "Alpha 2", type: "Planet", subType: "Rocky body", isLandable: true,
        volcanismType: "Rocky Magma volcanism", gravity: 0.15, distanceToArrival: 500,
        signals: { signals: { "$PlanetaryMiningLocation_Name;": 12 }, updateTime: ago(5) },
      },
      { bodyId: 3, id64: 102, name: "Alpha 3", type: "Planet", subType: "Icy body", isLandable: true, volcanismType: "No volcanism", gravity: 0.1, distanceToArrival: 800 },
      { bodyId: 4, id64: 103, name: "Alpha 4", type: "Planet", subType: "Rocky body", isLandable: false },
    ],
  },
  {
    id64: 3, name: "Beta", coords: { x: 30, y: 0, z: 0 },
    controllingPower: "Edmund Mahon", powerState: "Exploited", powers: ["Edmund Mahon"],
    controllingFaction: { name: "Beta Co", state: "Bust" },
    stations: [station(30, "Beta Outpost", { medium: 1 }, 20, [c("Monazite", 5, 700000)], 40)],
    bodies: [],
  },
  {
    id64: 4, name: "Gamma", coords: { x: 100, y: 0, z: 0 },
    controllingPower: "Zemina Torval", powerState: "Stronghold", powers: ["Zemina Torval"],
    controllingFaction: { name: "Gamma Co", state: "None" },
    stations: [
      station(40, "Gamma Station", { large: 1 }, 10, [c("Monazite", 2000, 300000)], 2),
      { ...station(41, "Carrier XYZ-123", { large: 1 }, 10, [c("Monazite", 9999, 999999)], 0), type: "Drake-Class Carrier" },
    ],
    bodies: [
      {
        bodyId: 1, id64: 400, name: "Gamma 1", type: "Planet", subType: "High metal content world", isLandable: true,
        volcanismType: "No volcanism", gravity: 0.9, distanceToArrival: 300,
        signals: { signals: { "$PlanetaryMiningLocation_Name;": 5 }, updateTime: ago(5) },
      },
    ],
  },
  {
    id64: 5, name: "Delta", coords: { x: 20, y: 0, z: 0 },
    controllingPower: undefined, powerState: "Unoccupied", powers: [],
    stations: [station(50, "Delta Port", { large: 1 }, 30, [c("Water", 100, 100)], 1)],
    bodies: [],
  },
  {
    id64: 7, name: "Zeta", coords: { x: 0, y: 150, z: 0 },
    stations: [station(70, "Zeta Post", { large: 1 }, 40, [c("Platinum", 50, 900000), c("Gold", 50, 100)], 1)],
    bodies: [],
  },
  {
    id64: 6, name: "Ghost", coords: { x: 5, y: 0, z: 0 },
    stations: [{ id: 60, name: "Ghost Dock", type: "Outpost", landingPads: { large: 1 } }],
    bodies: [],
  },
];

// Builds a temp SQLite file from SYSTEMS and returns its path. Caller removes the directory.
export function buildFixtureDb(): { file: string; dir: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "meritfinder-test-"));
  const file = path.join(dir, "fixture.sqlite");
  const db = openWritable(file);
  const ingest = createIngester(db);
  for (const s of SYSTEMS) ingest(s);
  storeCommodities(db);
  storeCommoditySymbols(db, ingest.symbols);
  db.close();
  return { file, dir };
}
