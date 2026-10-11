"use client";

import { Dot } from "@/components/ui/Dot";
import { useLiveStatus } from "@/hooks/useLiveStatus";
import type { LiveStatus as Status } from "@/lib/eddn/status";
import { since } from "@/lib/format";

const LABELS = { live: "EDDN live", delayed: "EDDN delayed", off: "Live updates off" } as const;
const COLOURS = { live: "var(--good)", delayed: "var(--warn)", off: "var(--muted)" } as const;

// Whether market, Powerplay and planet data is being refreshed from EDDN right now (see useLiveStatus).
export function LiveStatus({ initial }: { initial: Status }) {
  const { status, now } = useLiveStatus(initial);
  const { state, updatedAt, startedAt, totals } = status;
  const title = [
    state === "live" ? "Reading the EDDN feed." : state === "delayed" ? "The EDDN feed has gone quiet; reconnecting." : "Not reading the EDDN feed: prices, Powerplay and planet data are from the last daily dump.",
    updatedAt && `Last change from a live message: ${updatedAt.replace("T", " ").replace(/\.\d+Z$|Z$/, " UTC")}.`,
    startedAt && totals && `Since ${startedAt.replace("T", " ").replace(/\.\d+Z$|Z$/, " UTC")}: ${totals.markets} markets, ${totals.systems} systems, ${totals.signals} planets updated.`,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <p className="font-mono tabular-nums flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted" title={title} data-state={state}>
      <Dot color={COLOURS[state]} pulse={state === "live"} />
      <span>{LABELS[state]}</span>
      {state !== "off" && updatedAt && now !== null && <span>· {since(updatedAt, now)} ago</span>}
    </p>
  );
}
