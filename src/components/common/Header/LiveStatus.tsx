"use client";

import { Dot } from "@/components/ui/Dot";
import { useLiveStatus } from "@/hooks/useLiveStatus";
import type { LiveStatus as Status } from "@/lib/eddn/status";

const LABELS = { live: "EDDN live", delayed: "EDDN delayed", off: "Live updates off" } as const;
const COLOURS = { live: "var(--good)", delayed: "var(--warn)", off: "var(--muted)" } as const;

// Whether market, Powerplay and planet data is being refreshed from EDDN right now (see useLiveStatus).
export function LiveStatus({ initial }: { initial: Status }) {
  const { state } = useLiveStatus(initial);

  return (
    <p className="font-mono tabular-nums flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted" data-state={state}>
      <Dot color={COLOURS[state]} pulse={state === "live"} />
      <span>{LABELS[state]}</span>
    </p>
  );
}
