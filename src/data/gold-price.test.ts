import { describe, expect, it } from "vitest";

import { GOLD_PRICE, goldMaterials, isGold } from "./gold-price";

describe("gold price", () => {
  it("a price at or above the threshold is gold, below it is not", () => {
    expect(GOLD_PRICE).toBe(700_000);
    expect(isGold(700_000)).toBe(true);
    expect(isGold(699_999)).toBe(false);
  });

  it("picks out every material of a sale list that reaches it, not only the best", () => {
    const gold = goldMaterials([
      { commodity: "Monazite", sellPrice: 728_248 },
      { commodity: "Painite", sellPrice: 705_000 },
      { commodity: "Platinum", sellPrice: 223_980 },
    ]);
    expect([...gold]).toEqual(["Monazite", "Painite"]);
  });
});
