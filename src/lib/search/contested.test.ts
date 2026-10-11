import { describe, expect, it } from "vitest";

import { CONFLICT_THRESHOLD, isContested } from "./contested";

const conflict = (...progress: number[]) => JSON.stringify(progress.map((p, i) => ({ power: `Power ${i}`, progress: p })));

describe("isContested", () => {
  it("is when an Unoccupied system has two powers at 35,000 points of 120,000 or more (HP Cancri, Wolf 866)", () => {
    expect(isContested("Unoccupied", conflict(0.061142, 0.394933, 0.44725, 0.435767))).toBe(true);
    expect(isContested("Unoccupied", conflict(0.240267, 0.260017, 0.324242, 0.845092))).toBe(true);
  });

  it("is not when only one power has got that far, or none (Vanayeb Hua)", () => {
    expect(isContested("Unoccupied", conflict(0.845092, 0.2, 0.1, 0.05))).toBe(false);
    expect(isContested("Unoccupied", conflict(0.001258, 0.005592))).toBe(false);
  });

  it("counts a power exactly at the threshold", () => {
    expect(isContested("Unoccupied", conflict(CONFLICT_THRESHOLD, CONFLICT_THRESHOLD))).toBe(true);
  });

  it("is only about Unoccupied systems: a held system with conflict progress is not contested", () => {
    for (const state of ["Fortified", "Stronghold", "Exploited", null]) expect(isContested(state, conflict(0.5, 0.6)), String(state)).toBe(false);
  });

});
