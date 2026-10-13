import { describe, expect, it } from "vitest";

import { canonicalRingMaterial, materialsForRingType, RING_MATERIAL_NAMES, RING_MATERIALS, yieldsFrom } from "./ring-materials";
describe("the ring material table", () => {
  it("has one row per material, and every row can be mined somehow", () => {
    expect(new Set(RING_MATERIAL_NAMES).size).toBe(RING_MATERIAL_NAMES.length);
    for (const m of RING_MATERIALS) expect(m.core.length + m.surface.length, m.material).toBeGreaterThan(0);
  });

});

describe("yieldsFrom: what a technique can extract from a ring", () => {
  it("core mining and laser mining differ", () => {
    expect(yieldsFrom("core", "Monazite", "Rocky")).toBe(true);
    expect(yieldsFrom("laser", "Monazite", "Rocky")).toBe(false);
    expect(yieldsFrom("laser", "Platinum", "Metallic")).toBe(true);
    expect(yieldsFrom("core", "Platinum", "Metallic")).toBe(true);
  });

  it("any technique: extractable by core or by the surface techniques", () => {
    expect(yieldsFrom("any", "Monazite", "Rocky")).toBe(true); // core
    expect(yieldsFrom("any", "Gold", "Metallic")).toBe(true); // surface
    expect(yieldsFrom("any", "Gold", "Icy")).toBe(false);
  });

});

describe("materialsForRingType: what a ring of a type can yield", () => {
  it("lists the materials a technique can extract from that type, and every technique for 'any'", () => {
    expect(materialsForRingType("Metallic", "laser")).toEqual(expect.arrayContaining(["Platinum", "Gold", "Painite"]));
    expect(materialsForRingType("Metallic", "laser")).not.toContain("Monazite"); // core only
    expect(materialsForRingType("Metallic", "any")).toContain("Monazite");
    expect(materialsForRingType("Icy", "any")).toEqual(expect.arrayContaining(["Water", "Void Opal", "Tritium"]));
    expect(materialsForRingType(null, "any")).toEqual([]);
  });

  it("agrees with yieldsFrom for every material", () => {
    for (const type of ["Metallic", "Metal Rich", "Rocky", "Icy"]) {
      const listed = new Set(materialsForRingType(type, "any"));
      for (const m of RING_MATERIAL_NAMES) expect(listed.has(m), `${m} in ${type}`).toBe(yieldsFrom("any", m, type));
    }
  });
});

describe("canonicalRingMaterial: Spansh's signal names as market names", () => {
  it("renames the signals Spansh abbreviates", () => {
    expect(canonicalRingMaterial("Opal")).toBe("Void Opal");
    expect(canonicalRingMaterial("LowTemperatureDiamond")).toBe("Low Temperature Diamonds");
  });

});
