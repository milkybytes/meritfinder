import type { SearchParams } from "@/lib/search/search";

// "50+ systems within 100 ly of Dalevard", plus a hint when nothing matched, when the search ran out of time, or when counts are partly unknown.
export function ResultsSummary({ count, truncated, partial, refName, params }: { count: number; truncated: boolean; partial: boolean; refName: string; params: SearchParams }) {
  return (
    <>
      <p className="text-sm">
        <strong className="font-mono tabular-nums text-accent">
          {count}
          {truncated ? "+" : ""}
        </strong>{" "}
        systems within <span className="font-mono tabular-nums">{params.range}</span> ly of {refName}
        {truncated && <span className="text-muted"> (showing the first {params.limit})</span>}
      </p>
      {partial && (
        <p className="mt-2 text-sm text-warn">
          This search was stopped early because it was taking too long, so some systems may be missing. Narrow it down with a smaller range, a
          shorter market age, or fewer filters.
        </p>
      )}
      {count === 0 && !partial && (
        <p className="mt-2 text-sm text-muted">
          Nothing matched. Try a larger range, clear the commodity or power filters, raise the max market age (most markets are stale;
          blank means any age up to a year, the oldest we keep), or set the landing pad to Any.
        </p>
      )}
      {params.mining !== "known" && params.method === "planetary" && (
        <p className="mt-1 text-sm text-muted">
          Mining signal counts are unknown for many planets: Spansh has none for planets scanned before the feature existed.
        </p>
      )}
    </>
  );
}
