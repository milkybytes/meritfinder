import { describe, expect, it } from "vitest";

import { canonicalRingMaterial, RING_MATERIAL_NAMES, RING_MATERIALS, yieldsFrom } from "./ring-materials";
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

describe("canonicalRingMaterial: Spansh's signal names as market names", () => {
  it("renames the signals Spansh abbreviates", () => {
    expect(canonicalRingMaterial("Opal")).toBe("Void Opal");
    expect(canonicalRingMaterial("LowTemperatureDiamond")).toBe("Low Temperature Diamonds");
  });

});
