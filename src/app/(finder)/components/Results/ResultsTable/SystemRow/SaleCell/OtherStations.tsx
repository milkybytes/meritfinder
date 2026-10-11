import { DemandMeter } from "@/components/common/DemandMeter";
import { StationIcon } from "@/components/common/Icons";
import { PadTag } from "@/components/common/PadTag";
import { Price } from "@/components/common/Price";
import { age } from "@/lib/format";
import type { StationRow } from "@/lib/search/search";

const MAX_OTHER_STATIONS = 9;

// "+3 more stations", opening to the other stations that buy here (the first is the best sale, shown above).
// `stations` is every matching station in the system, best first.
export function OtherStations({ stations }: { stations: StationRow[] }) {
  if (stations.length <= 1) return null;

  return (
    <details className="mt-2 text-sm">
      <summary className="cursor-pointer select-none text-muted">+{stations.length - 1} more stations</summary>
      <ul className="mt-1">
        {stations.slice(1, 1 + MAX_OTHER_STATIONS).map((s) => (
          <li key={s.name} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-[0.15rem] border-l-2 border-line py-[0.45rem] pr-0 pl-[0.7rem] hover:border-accent">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <StationIcon type={s.type} className="h-3.5 w-3.5 shrink-0 text-muted" />
                <span className="truncate" title={s.name}>
                  {s.name}
                </span>
                <PadTag pad={s.pad} />
              </div>
              <div className="font-mono tabular-nums text-xs text-muted">
                {s.commodity} · {age(s.marketUpdated)}
              </div>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <Price amount={s.sellPrice} className="font-semibold text-accent" />
              <DemandMeter tonnes={s.demand} />
            </div>
          </li>
        ))}
      </ul>
    </details>
  );
}
