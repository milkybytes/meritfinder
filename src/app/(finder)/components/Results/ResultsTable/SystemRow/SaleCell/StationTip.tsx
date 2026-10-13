import { TipList, type TipRowData } from "@/components/ui/Tip";
import { isGold } from "@/data/gold-price";
import { formatNumber, spotsLabel } from "@/lib/format";
import type { SellableRow, StationRow } from "@/lib/search/search";

const MAX_ROWS = 10;

// The hover card on a station: what it pays for among the things that can be mined, best price first. `sellable` is the whole system's list,
// which says how many spots in the system can yield each. A station that buys a great many of them shows the ten best, those that meet the
// chosen minimum price and demand first, and says how many it left out.
export function stationTip(station: StationRow, sellable: SellableRow[]) {
  if (station.top.length === 0) return null;
  const places = new Map(sellable.map((s) => [s.commodity, s.places]));
  const ordered = [...station.top.filter((t) => t.meets), ...station.top.filter((t) => !t.meets)]; // each group is already best price first
  const shown = ordered.slice(0, MAX_ROWS);
  const rows: TipRowData[] = shown.map((t) => {
    const n = places.get(t.commodity) ?? 0;
    return {
      label: t.commodity,
      value: `${formatNumber(t.sellPrice)} CR`,
      aside: n === 0 ? undefined : spotsLabel(n), // nothing to say when no ring or planet in the results can yield it
      demand: t.demand,
      mark: t.meets && n > 0, // dimmed when below the chosen minimum price or demand, or when nothing here can yield it
      gold: isGold(t.sellPrice),
    };
  });
  const left = station.top.length - shown.length;
  const note = left > 0 ? `The ${shown.length} best of ${station.top.length} minerals this station pays for.` : undefined;
  return <TipList title={station.name} subtitle="What it pays for, of what can be mined" rows={rows} note={note} />;
}
