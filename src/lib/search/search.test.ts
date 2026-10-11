import fs from "node:fs";

import { afterAll, describe, expect, it } from "vitest";

import { buildFixtureDb } from "../../test/galaxy";
import { openWritable, schemaCurrent } from "../db/db";

import { search, meta, type SearchParams } from "./search";
// The app resolves its database path on every query, so point it at the fixture.
const { file, dir } = buildFixtureDb();
process.env.MERITFINDER_DB = file;

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const base: SearchParams = {
  ref: "Origin", range: 200, power: "", goal: "any", target: [], commodity: [], minPrice: 0, minDemand: 0,
  pad: "S", maxStationLs: 0, maxAgeDays: 0, method: "any", material: [], ringTypes: [], mining: "possible",
  sort: "distance", limit: 50, states: [], reserve: [],
};
// A search that names a mining method is about mining; one that does not is testing the market filters on their own, so it
// does not need the fixture's systems to have something to mine.
const marketSearch = (o: Partial<SearchParams>) => search({ ...base, ...o }, { requireMining: false });
const names = (o: Partial<SearchParams>) => search({ ...base, ...o }, { requireMining: o.method !== undefined }).rows.map((r) => r.name);

describe("database", () => {
  it("only keeps systems with a usable market (no market, no row)", () => {
    expect(names({})).not.toContain("Ghost");
    expect(meta().systemCount).toBe(6);
  });

  it("lists powers, states and ring materials for the filters", () => {
    const m = meta();
    expect(m.powers).toEqual(["Aisling Duval", "Edmund Mahon", "Zemina Torval"]);
    expect(m.states).toEqual(["Boom", "Bust"]); // "None" is not offered as a state
    expect(m.allRings).toBe(true);
    // hotspot materials only if some ring has them; materials without hotspots because every ring is stored
    expect(m.ringMaterials).toEqual(expect.arrayContaining(["Monazite", "Painite", "Void Opal", "Gold", "Water"]));
    expect(m.ringMaterials).not.toContain("Benitoite"); // a hotspot material no ring here has // Opal is renamed to the market name
  });
});

describe("reference system", () => {
  it("matches case-insensitively", () => expect(search({ ...base, ref: "oRiGiN" }).ref?.name).toBe("Origin"));
});

describe("range", () => {
  it("includes systems inside the sphere and excludes those outside", () => {
    expect(names({ range: 25 })).toEqual(["Origin", "Alpha", "Delta"]);
    expect(names({ range: 30 })).toContain("Beta"); // exactly on the edge counts
    expect(names({ range: 99 })).not.toContain("Gamma");
    expect(names({ range: 100 })).toContain("Gamma");
  });
});

describe("powerplay goals", () => {
  it("undermine: rival-controlled systems only, whether or not you are present", () => {
    // Edmund Mahon is present in Alpha but does not control it: still undermine-able.
    expect(names({ goal: "undermine", power: "Edmund Mahon" })).toEqual(["Alpha", "Gamma"]);
  });
  it("undermine can be narrowed to opposing powers", () => {
    expect(names({ goal: "undermine", power: "Edmund Mahon", target: ["Zemina Torval"] })).toEqual(["Gamma"]);
    expect(names({ goal: "undermine", power: "Edmund Mahon", target: ["Zemina Torval", "Aisling Duval"] })).toEqual(["Alpha", "Gamma"]);
  });
  it("reinforce: your own controlled systems; nothing without a power", () => {
    expect(names({ goal: "reinforce", power: "Edmund Mahon" })).toEqual(["Beta"]);
    expect(names({ goal: "reinforce", power: "" })).toEqual([]);
  });
});

// Acquire is two places: sell in an Unoccupied system, mine in a Fortified or Stronghold system of your power.
// Delta (20 ly from Alpha) is Unoccupied and sells Water. Alpha is Aisling Duval's Fortified system, with rings and planets.
// Gamma (80 ly from Delta) is Zemina Torval's Stronghold, with a planet that has signals. Beta is Exploited.
// The game's ranges: Fortified within 20 ly of the system you sell in, Stronghold within 30 ly. A test that needs a system nearer or farther
// moves it along the x axis (Delta is at x = 20) for the length of the test.
describe("acquire", () => {
  const acquire = (o: Partial<SearchParams>) => search({ ...base, goal: "acquire", power: "Aisling Duval", ...o }, { requireMining: false });
  const moved = (id64: number, x: number, fn: () => void) => {
    const setX = (to: number) => {
      const db = openWritable(file);
      const was = (db.prepare("SELECT x FROM systems WHERE id64 = ?").get(id64) as { x: number }).x;
      db.prepare("UPDATE systems SET x = ? WHERE id64 = ?").run(to, id64);
      db.close();
      return was;
    };
    const was = setX(x);
    try {
      fn();
    } finally {
      setX(was);
    }
  };
  const ALPHA = 2;
  const GAMMA = 4;

  it("lists the Unoccupied system to sell in, with where of yours to mine, which need not be mineable itself", () => {
    const [delta, ...rest] = acquire({}).rows;
    expect(rest).toEqual([]);
    expect(delta).toMatchObject({ name: "Delta", powerState: "Unoccupied", rings: [], bodies: [] }); // nothing to mine at Delta, and it does not matter
    expect(delta.sources.map((s) => s.name)).toEqual(["Alpha"]);
    expect(delta.sources[0]).toMatchObject({ powerState: "Fortified", distance: 10 });
    expect(delta.sources[0].rings.length).toBeGreaterThan(0);
    expect(delta.sources[0].bodies.length).toBeGreaterThan(0);
  });

  it("mines in a Fortified system only within 20 ly of the selling system", () => {
    moved(ALPHA, 40, () => expect(acquire({}).rows[0].sources.map((s) => s.name)).toEqual(["Alpha"])); // exactly 20 ly
    moved(ALPHA, 40.5, () => expect(acquire({}).rows).toEqual([])); // 20.5 ly
  });

  it("mines in a Stronghold system within 30 ly, which is further than a Fortified one may be", () => {
    const torval = { power: "Zemina Torval" };
    expect(acquire(torval).rows).toEqual([]); // Gamma is 80 ly from Delta
    moved(GAMMA, 50, () => {
      const rows = acquire(torval).rows; // exactly 30 ly
      expect(rows.map((r) => r.name)).toEqual(["Delta"]);
      expect(rows[0].sources.map((s) => [s.name, s.powerState])).toEqual([["Gamma", "Stronghold"]]);
    });
    moved(GAMMA, 50.5, () => expect(acquire(torval).rows).toEqual([])); // 30.5 ly
  });

  it("only mines in Fortified or Stronghold systems of your power, not another power's", () => {
    expect(acquire({ power: "Yuri Grom" }).rows).toEqual([]); // holds nothing
    moved(GAMMA, 40, () => expect(acquire({ power: "Zemina Torval" }).rows[0].sources.map((s) => s.name)).toEqual(["Gamma"])); // not Aisling Duval's Alpha, 10 ly away
  });

  it("does not mine in an Exploited system, even one with something to mine", () => {
    // Beta is Edmund Mahon's, Exploited, 10 ly from Delta. Give it a planet with signals, so only its state rules it out.
    const db = openWritable(file);
    db.prepare("INSERT INTO bodies (system_id64, body_id, name, subtype, volcanism, body_class, gravity, distance_ls, mining_signals) VALUES (3, 1, 'Beta 1', 'Rocky body', 'No volcanism', 'rocky', 0.2, 100, 7)").run();
    db.close();
    try {
      expect(acquire({ power: "Edmund Mahon" }).rows).toEqual([]);
    } finally {
      const back = openWritable(file);
      back.prepare("DELETE FROM bodies WHERE system_id64 = 3").run();
      back.close();
    }
  });

  it("applies the mining method and material to where you mine, not to where you sell", () => {
    const sells = { commodity: ["Water"] }; // what Delta buys, whatever is mined
    expect(acquire({ ...sells, method: "core", material: ["Void Opal"] }).rows.map((r) => r.name)).toEqual(["Delta"]); // Void Opal: core, in Alpha's Icy ring
    expect(acquire({ ...sells, method: "laser", material: ["Void Opal"] }).rows).toEqual([]); // laser cannot extract it
    const ring = acquire({ ...sells, method: "core" }).rows[0].sources[0];
    expect(ring.rings.length).toBeGreaterThan(0); // a ring method lists rings...
    expect(ring.bodies).toEqual([]); // ...and no planets
  });

});

describe("market filters", () => {
  it("commodity chips are OR-ed and empty means any", () => {
    expect(names({ commodity: ["Gold"] })).toEqual(["Alpha", "Zeta"]);
    expect(names({ commodity: ["Gold", "Water"] })).toEqual(["Origin", "Alpha", "Delta", "Zeta"]);
    expect(names({ commodity: [] }).length).toBe(6);
  });
  it("min price and min demand", () => {
    expect(names({ commodity: ["Monazite"], minPrice: 400000 })).toEqual(["Alpha", "Beta"]);
    expect(names({ commodity: ["Monazite"], minDemand: 1500 })).toEqual(["Gamma"]);
  });
  it("max market age drops stale markets", () => {
    expect(names({ commodity: ["Monazite"], maxAgeDays: 7 })).toEqual(["Alpha", "Gamma"]);
    expect(names({ commodity: ["Monazite"], maxAgeDays: 0 })).toContain("Beta"); // 0 = no limit
  });
  it("ignores fleet carriers", () => {
    const g = search({ ...base, commodity: ["Monazite"] }).rows.find((r) => r.name === "Gamma")!;
    expect(g.stations.map((s) => s.name)).toEqual(["Gamma Station"]);
    expect(g.stations[0].sellPrice).toBe(300000);
  });
  it("filters by the system's controlling faction state", () => {
    expect(names({ states: ["Boom"] })).toEqual(["Alpha"]);
    expect(names({ states: ["Boom", "Bust"] })).toEqual(["Alpha", "Beta"]);
  });
});

describe("sorting and limits", () => {
  it("sorts by distance or by best price", () => {
    expect(names({ commodity: ["Monazite"], sort: "distance" })).toEqual(["Alpha", "Beta", "Gamma"]);
    expect(names({ commodity: ["Monazite"], sort: "price" })).toEqual(["Beta", "Alpha", "Gamma"]);
  });
  it("applies the max-results limit and flags truncation", () => {
    const r = marketSearch({ commodity: ["Monazite"], limit: 2 });
    expect(r.rows).toHaveLength(2);
    expect(r.truncated).toBe(true);
    expect(marketSearch({ commodity: ["Monazite"], limit: 3 }).truncated).toBe(false);
  });
});

describe("ring methods", () => {
  const ringsOf = (o: Partial<SearchParams>) => search({ ...base, ...o }).rows.find((r) => r.name === "Alpha")?.rings.map((r) => r.name) ?? [];

  it("only systems with matching ring hotspots, showing only the wanted materials", () => {
    const r = search({ ...base, method: "core", material: ["Monazite"] }).rows;
    expect(r.map((x) => x.name)).toEqual(["Alpha"]);
    expect(r[0].rings[0].hotspots).toEqual([{ material: "Monazite", count: 2 }]);
    expect(r[0].bodies).toEqual([]); // ring methods don't list planets
  });

  it("laser and sub-surface mining find only what the technique can extract in that ring type", () => {
    // Monazite and Void Opal are core-only; Painite in a Metallic ring is also minable by laser.
    expect(ringsOf({ method: "laser" })).toEqual(["Alpha 1 C Ring"]);
    expect(ringsOf({ method: "subsurface" })).toEqual(["Alpha 1 C Ring"]);
  });

  it("a material only core mining can extract is not found by laser, whatever the ring", () => {
    expect(names({ method: "core", material: ["Void Opal"] })).toEqual(["Alpha"]);
    expect(names({ method: "laser", material: ["Void Opal"] })).toEqual([]);
    expect(names({ method: "subsurface", material: ["Monazite"] })).toEqual([]);
  });

  it("any method is not limited by technique", () => {
    expect(ringsOf({ method: "any" })).toEqual(["Alpha 1 A Ring", "Alpha 1 B Ring", "Alpha 1 C Ring"]);
    expect(names({ method: "any", material: ["Void Opal"] })).toEqual(["Alpha"]);
  });

  it("ring type and reserve level filters", () => {
    expect(ringsOf({ method: "core", ringTypes: ["Rocky"] })).toEqual(["Alpha 1 A Ring"]);
    expect(names({ method: "core", ringTypes: ["Metal Rich"] })).toEqual([]);
    expect(names({ method: "core", reserve: ["Pristine"] })).toEqual(["Alpha"]);
    expect(names({ method: "core", reserve: ["Depleted"] })).toEqual([]);
  });

});

describe("ring materials without hotspots", () => {
  const ringsOf = (o: Partial<SearchParams>) => search({ ...base, ...o }).rows.find((r) => r.name === "Alpha")?.rings ?? [];

  it("are found in every ring of a type the technique can extract them from, with no hotspot count", () => {
    // Gold: laser and sub-surface in Metal Rich and Metallic rings. Alpha has a Metal Rich ring and a Metallic one.
    const rings = ringsOf({ method: "laser", material: ["Gold"] });
    expect(rings.map((r) => r.name)).toEqual(["Alpha 1 C Ring", "Alpha 1 D Ring"]);
    expect(rings.every((r) => r.hotspots.length === 1 && r.hotspots[0].count === null && r.hotspots[0].material === "Gold")).toBe(true);
    expect(names({ method: "subsurface", material: ["Gold"] })).toEqual(["Alpha"]);
  });

  it("are not found by core mining, which cannot extract them", () => {
    expect(names({ method: "core", material: ["Gold"] })).toEqual([]);
  });

  it("rings without hotspots never appear when no material is chosen", () => {
    expect(ringsOf({ method: "any" }).map((r) => r.name)).not.toContain("Alpha 1 D Ring");
    expect(ringsOf({ method: "core" }).map((r) => r.name)).not.toContain("Alpha 1 D Ring");
  });
});

describe("planetary method", () => {
  it("known signals only vs known-or-unknown", () => {
    expect(names({ method: "planetary", mining: "known" })).toEqual(["Alpha", "Gamma"]);
    const possible = search({ ...base, method: "planetary", mining: "possible" }).rows;
    expect(possible.find((r) => r.name === "Alpha")!.bodies.map((b) => b.name)).toEqual(["Alpha 2", "Alpha 3"]); // Alpha 3 = unknown
  });
  it("a wanted material narrows planets to body classes that can hold it", () => {
    // Monazite: volcanic-magma / volcanic-silicate. Gamma's high-metal-content planet is out.
    const r = search({ ...base, method: "planetary", material: ["Monazite"], mining: "known" }).rows;
    expect(r.map((x) => x.name)).toEqual(["Alpha"]);
    expect(r[0].bodies[0]).toMatchObject({ name: "Alpha 2", bodyClass: "volcanic-magma", miningSignals: 12 });
  });
});

describe("any method", () => {
  it("with no material, needs something to mine: a ring with hotspots, or a planet that may have signals", () => {
    // Alpha has rings and planets; Gamma has a planet with signals. Origin, Beta, Delta, Zeta have nothing to mine.
    expect(names({ method: "any" })).toEqual(["Alpha", "Gamma"]);
  });

  it("does not list a system just because goods sell well there: a market with nothing to mine is left out", () => {
    expect(search({ ...base, commodity: ["Monazite"] }, { requireMining: false }).rows.map((r) => r.name)).toContain("Beta"); // sells Monazite, nothing to mine
    expect(search({ ...base, method: "any", commodity: ["Monazite"] }).rows.map((r) => r.name)).not.toContain("Beta");
  });

  it("with a material, a ring OR a planet match qualifies", () => {
    expect(names({ method: "any", material: ["Monazite"] })).toEqual(["Alpha"]);
    expect(names({ method: "any", material: ["Void Opal"] })).toEqual(["Alpha"]);
  });
});

describe("ranking with price bounds", () => {
  // Zeta's station pays 900,000 for Platinum (the bound) but only 100 for Gold; Alpha pays 9,000 for Gold.
  it("orders by the ACTUAL price for the chosen commodity, not the station's best price", () => {
    expect(names({ commodity: ["Gold"], sort: "price" })).toEqual(["Alpha", "Zeta"]);
  });
  it("never lets a high bound crowd out a better real price when limited", () => {
    const r = marketSearch({ commodity: ["Gold"], sort: "price", limit: 1 });
    expect(r.rows.map((x) => x.name)).toEqual(["Alpha"]);
    expect(r.truncated).toBe(true);
  });
});

describe("what you sell follows what you mine", () => {
  it("a chosen material becomes the commodity when none is picked", () => {
    const a = search({ ...base, method: "core", material: ["Void Opal"] }).rows[0];
    expect(a.stations[0]).toMatchObject({ commodity: "Void Opal", sellPrice: 100000 });
  });
});

describe("time budget", () => {
  it("returns what it has, marked partial, when the budget is spent", () => {
    const spent = search({ ...base, sort: "price" }, { budgetMs: 0 });
    expect(spent.partial).toBe(true);
    expect(spent.rows.length).toBeLessThan(search(base).rows.length);
  });

});

describe("hostile input reaching the database layer", () => {
  const HOSTILE = ["'; DROP TABLE systems; --", "\" OR 1=1 --", "Sol' UNION SELECT name,0,0,0 FROM sqlite_master --", "%", "_", "\\", "\u0000", "💥".repeat(50)];

  it("finds nothing, changes nothing and never throws, whichever field it is in", () => {
    for (const bad of HOSTILE) {
      expect(() => search({ ...base, ref: bad })).not.toThrow();
      expect(search({ ...base, ref: bad }).ref).toBeNull();
      for (const field of ["commodity", "material", "target", "states", "ringTypes", "reserve"] as const) {
        expect(() => search({ ...base, [field]: [bad] }), `${field}: ${bad}`).not.toThrow();
      }
      expect(() => search({ ...base, power: bad, goal: "reinforce" })).not.toThrow();
    }
    expect(schemaCurrent()).toBe(true);
    expect(meta().systemCount).toBe(6); // nothing was dropped or altered
  });
});
