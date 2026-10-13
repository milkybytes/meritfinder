import { DemandMeter } from "@/components/common/DemandMeter";
import { StationIcon } from "@/components/common/Icons";
import { PadTag } from "@/components/common/PadTag";
import { Price } from "@/components/common/Price";
import { Badge } from "@/components/ui/Badge";
import { useHoverTip } from "@/components/ui/Tip";
import { isGold } from "@/data/gold-price";
import { age, ageStale, describePlaces, formatNumber, spotsLabel } from "@/lib/format";
import type { ResultRow, SellableRow, StationRow } from "@/lib/search/search";

import { OtherStations } from "./OtherStations";
import { stationTip } from "./StationTip";

// The best sale in the system: price and commodity, demand and freshness, which station, then the others.
export function SaleCell({ row }: { row: ResultRow }) {
  const best = row.stations[0];
  const headline = row.sellable.find((s) => s.commodity === best.commodity);

  return (
    <td className="px-5 py-4">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <Price amount={best.sellPrice} className="text-base font-semibold text-accent" />
        <span className={isGold(best.sellPrice) ? "gold-shine font-medium" : undefined}>{best.commodity}</span>
        <MineableTag commodity={best.commodity} sellable={headline} />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <DemandMeter tonnes={best.demand} />
        <span className="font-mono tabular-nums text-xs text-muted">{age(best.marketUpdated)} ago</span>
        {ageStale(best.marketUpdated) && <Badge color="var(--warn)">stale</Badge>}
      </div>
      <BestStation station={best} sellable={row.sellable} />
      <OtherStations stations={row.stations} sellable={row.sellable} />
    </td>
  );
}

// Whether what sells best here can be mined where the results point: a place to mine it, none known, or not something with mining data.
function MineableTag({ commodity, sellable }: { commodity: string; sellable: SellableRow | undefined }) {
  if (!sellable) {
    return (
      <Badge title={`${commodity} is not a mineral the app has mining data for`} color="var(--muted)">
        not minable
      </Badge>
    );
  }
  if (sellable.places === 0) {
    return (
      <Badge title={`Nothing listed here is known to yield ${commodity} (for planets, only the survey's top classes count)`} color="var(--warn)">
        No known spots
      </Badge>
    );
  }
  return ( // acquire can have multiple sourcing systems
    <Badge title={`${describePlaces(sellable.ringPlaces, sellable.planetPlaces)} can yield ${commodity}`} color="var(--good)">
      {spotsLabel(sellable.places)}
    </Badge>
  );
}

// The station that pays most. Hovering it shows what else it pays well for that can be mined.
function BestStation({ station, sellable }: { station: StationRow; sellable: SellableRow[] }) {
  const { triggerProps, tip } = useHoverTip(stationTip(station, sellable));
  return (
    <div className="mt-2 flex items-baseline gap-1.5 hover:text-accent focus-visible:outline-none focus-visible:text-accent" {...triggerProps}>
      <StationIcon type={station.type} className="h-4 w-4 shrink-0 self-center text" />
      <span className="min-w-0">{station.name}</span>
      <PadTag pad={station.pad} />
      <div className="font-mono tabular-nums text-xs text-muted">{station.distanceLs != null ? `${formatNumber(Math.round(station.distanceLs))} ls` : "? ls"}</div>
      {tip}
    </div>
  );
}
