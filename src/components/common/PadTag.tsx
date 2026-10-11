import type { StationRow } from "@/lib/search/search";

const NAMES = { L: "Large", M: "Medium", S: "Small" } as const;

// "[L]": the largest landing pad a station has, shown beside its name.
export function PadTag({ pad }: { pad: StationRow["pad"] }) {
  return (
    <span className="font-mono tabular-nums shrink-0 text-xs font-semibold text-muted" title={`Largest landing pad: ${NAMES[pad]}`}>
      [{pad}]
    </span>
  );
}
