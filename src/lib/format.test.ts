import { describe, expect, it } from "vitest";

import { REAL_VOLCANISM } from "@/test/spansh-bodies";

import { since, age, demandLevel, describeBody, shortBodyName } from "./format";
describe("shortBodyName", () => {
  it("drops the system name prefix", () => {
    expect(shortBodyName("Hyades Sector HI-G a12-3 4 a", "Hyades Sector HI-G a12-3")).toBe("4 a");
    expect(shortBodyName("58 Eridani DE 2 A Ring", "58 Eridani")).toBe("DE 2 A Ring");
    expect(shortBodyName("LHS 1499 B 9", "LHS 1499")).toBe("B 9");
  });
});

describe("demandLevel", () => {
  it("maps tonnes to 0-5 bars", () => {
    expect([0, 1, 249, 250, 799, 800, 1999, 2000, 4999, 5000, 1_000_000].map(demandLevel)).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  });
});

describe("age", () => {
  const now = Date.parse("2026-10-07T12:00:00Z");
  it("shows hours under two days, then days", () => {
    expect(age("2026-10-07T11:30:00Z", now)).toBe("1h"); // never 0h
    expect(age("2026-10-07T05:00:00Z", now)).toBe("7h");
    expect(age("2026-10-05T13:00:00Z", now)).toBe("47h");
    expect(age("2026-10-04T12:00:00Z", now)).toBe("3d");
  });
});

describe("describeBody: the game's own words", () => {
  it.each([
    ["Icy body", "No volcanism", "Icy body", null],
    ["Icy body", null, "Icy body", null],
    ["Rocky body", "No volcanism", "Rocky body", null],
    ["Icy body", "Major Water Geysers", "Icy body", "Water geysers (major)"],
    ["Rocky body", "Major Silicate Vapour Geysers", "Rocky body", "Silicate vapour geysers (major)"],
    ["Rocky body", "Silicate Vapour Geysers", "Rocky body", "Silicate vapour geysers"],
    ["Icy body", "Minor Carbon Dioxide Geysers", "Icy body", "Carbon dioxide geysers (minor)"],
    ["Icy body", "Carbon Dioxide Geysers", "Icy body", "Carbon dioxide geysers"],
    ["Icy body", "Major Water Magma", "Icy body", "Water magma (major)"],
    ["Rocky body", "Minor Metallic Magma", "Rocky body", "Metallic magma (minor)"],
    ["Rocky body", "Metallic Magma", "Rocky body", "Metallic magma"],
    ["Rocky body", "Major Rocky Magma", "Rocky body", "Rocky magma (major)"],
    ["Rocky Ice world", "No volcanism", "Rocky ice world", null],
    ["High metal content world", "Minor Metallic Magma", "High metal content world", "Metallic magma (minor)"],
    ["High metal content world", "Major Rocky Magma", "High metal content world", "Rocky magma (major)"],
    ["Metal-rich body", "Major Metallic Magma", "Metal-rich body", "Metallic magma (major)"],
    ["Icy body", "Minor Nitrogen Magma", "Icy body", "Nitrogen magma (minor)"],
  ])("%s + %s -> %s, %s", (subtype, volcanism, type, volc) => {
    expect(describeBody(subtype, volcanism)).toEqual({ type, volcanism: volc });
  });

  it("writes every real volcanism string cleanly: no Major/Minor prefix, no 'volcanism' suffix, sentence case", () => {
    for (const raw of REAL_VOLCANISM) {
      const { volcanism } = describeBody("Rocky body", raw);
      if (raw === "No volcanism") {
        expect(volcanism).toBeNull();
        continue;
      }
      expect(volcanism, raw).toMatch(/^[A-Z][a-z]+( [a-z]+)*( \((major|minor)\))?$/);
      expect(volcanism!, raw).not.toMatch(/volcanism/i);
      expect(volcanism!.startsWith("Major") || volcanism!.startsWith("Minor"), raw).toBe(false);
    }
  });

});

describe("since", () => {
  const now = Date.parse("2026-10-08T12:00:00Z");
  const before = (ms: number) => new Date(now - ms).toISOString();

  it("counts seconds, minutes, hours and days", () => {
    expect([0, 12_000, 59_000, 60_000, 3_599_000, 3_600_000, 86_399_000, 86_400_000, 5 * 86_400_000].map((ms) => since(before(ms), now))).toEqual(["0 s", "12 s", "59 s", "1 min", "59 min", "1 h", "23 h", "1 d", "5 d"]);
  });

});
