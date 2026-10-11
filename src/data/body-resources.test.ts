import { describe, expect, it } from "vitest";

import { REAL_SUBTYPES, REAL_VOLCANISM } from "../test/spansh-bodies";

import { classifyBody, type BodyClass } from "./body-resources";

describe("classifyBody", () => {
  it.each([
    ["Metal-rich body", "No volcanism", "metal-rich"],
    ["High metal content world", "No volcanism", "high-metal-content"],
    ["Icy body", "No volcanism", "icy"],
    ["Rocky Ice world", "No volcanism", "rocky-ice"],
    ["Rocky body", "No volcanism", "rocky"],
    ["Rocky body", null, "rocky"],
    ["Rocky body", "Metallic Magma volcanism", "volcanic-magma"],
    ["Rocky body", "Minor Rocky Magma volcanism", "volcanic-magma"],
    ["Rocky body", "Major Silicate Vapour Geysers volcanism", "volcanic-silicate"],
  ] as const)("%s + %s -> %s", (subtype, volcanism, expected) => {
    expect(classifyBody(subtype, volcanism)).toBe(expected);
  });

  it("body type wins over volcanism for metal-rich, HMC, icy and rocky-ice", () => {
    expect(classifyBody("Metal-rich body", "Metallic Magma volcanism")).toBe("metal-rich");
    expect(classifyBody("High metal content world", "Silicate Vapour Geysers volcanism")).toBe("high-metal-content");
    expect(classifyBody("Icy body", "Rocky Magma volcanism")).toBe("icy");
    expect(classifyBody("Rocky Ice world", "Metallic Magma volcanism")).toBe("rocky-ice");
  });

  it("returns null for anything that is not a recognised planet type", () => {
    expect(classifyBody("Gas giant with water-based life", null)).toBeNull();
    expect(classifyBody(null, null)).toBeNull();
  });
});

describe("classifyBody follows the chart, for every real body type and volcanism", () => {
  // Chart rules: body type first. Metal-rich, HMC, icy and rocky ice always own their group, volcanic or not.
  // Only rocky bodies split: Metallic/Rocky Magma -> the magma group; Silicate Vapour Geysers -> the silicate group;
  // anything else (no volcanism, or e.g. silicate magma) stays plain rocky.
  const oracle = (subtype: string, volcanism: string): BodyClass => {
    if (subtype === "Metal-rich body") return "metal-rich";
    if (subtype === "High metal content world") return "high-metal-content";
    if (subtype === "Rocky Ice world") return "rocky-ice";
    if (subtype === "Icy body") return "icy";
    if (/metallic magma|rocky magma/i.test(volcanism)) return "volcanic-magma";
    if (/silicate vapour/i.test(volcanism)) return "volcanic-silicate";
    return "rocky";
  };

  it("agrees with the chart on all body type x volcanism combinations", () => {
    for (const subtype of REAL_SUBTYPES) {
      for (const volcanism of REAL_VOLCANISM) expect(classifyBody(subtype, volcanism), `${subtype} + ${volcanism}`).toBe(oracle(subtype, volcanism));
    }
  });

});
