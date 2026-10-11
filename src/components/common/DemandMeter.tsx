import { demandLevel, formatNumber } from "@/lib/format";

// Five bars (like a signal meter) plus the tonnage. Bars fill at 1, 250, 800, 2,000 and 5,000 t.
export function DemandMeter({ tonnes }: { tonnes: number }) {
  const level = demandLevel(tonnes);
  return (
    <span className="inline-flex items-end gap-[0.45rem] whitespace-nowrap" title={`${formatNumber(tonnes)} t demand (${level}/5)`}>
      <span className="inline-flex h-[17px] items-end gap-[2px]" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} data-on={i <= level} className={`w-1 ${i <= level ? "bg-accent" : "bg-muted/35"}`} style={{ height: `${4 + i * 2.5}px` }} />
        ))}
      </span>
      <span className="font-mono tabular-nums">{formatNumber(tonnes)} t</span>
    </span>
  );
}
