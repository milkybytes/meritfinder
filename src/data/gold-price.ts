// What counts as a high price: a mineral that sells for at least this much per tonne, in a system, is drawn gold with a shine. One place to
// change it.
export const GOLD_PRICE = 700_000;

export const isGold = (sellPrice: number) => sellPrice >= GOLD_PRICE;

// The materials of a system's sale list that reach it.
export const goldMaterials = (sellable: { commodity: string; sellPrice: number }[]): Set<string> =>
  new Set(sellable.filter((s) => isGold(s.sellPrice)).map((s) => s.commodity));
