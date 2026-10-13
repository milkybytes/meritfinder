import { DemandMeter } from "@/components/common/DemandMeter";
import { StationIcon } from "@/components/common/Icons";
import { PadTag } from "@/components/common/PadTag";
import { Price } from "@/components/common/Price";
import { Badge } from "@/components/ui/Badge";
import { age, ageStale, formatNumber } from "@/lib/format";
import type { ResultRow } from "@/lib/search/search";

import { OtherStations } from "./OtherStations";

// The best sale in the system: price and commodity, demand and freshness, which station, then the others.
export function SaleCell({ row }: { row: ResultRow }) {
  const best = row.stations[0];

  return (
    <td className="px-5 py-4">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <Price amount={best.sellPrice} className="text-base font-semibold text-accent" />
        <span>{best.commodity}</span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <DemandMeter tonnes={best.demand} />
        <span className="font-mono tabular-nums text-xs text-muted">{age(best.marketUpdated)} ago</span>
        {ageStale(best.marketUpdated) && <Badge color="var(--warn)">stale</Badge>}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <StationIcon type={best.type} className="h-4 w-4 shrink-0 self-center text" />
        <span className="min-w-0">{best.name}</span>
        <PadTag pad={best.pad} />
        <div className="font-mono tabular-nums text-xs text-muted">{best.distanceLs != null ? `${formatNumber(Math.round(best.distanceLs))} ls` : "? ls"}</div>
      </div>
      <OtherStations stations={row.stations} />
    </td>
  );
}
