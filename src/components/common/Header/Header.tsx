import { FIELD_LABEL } from "@/components/ui/styles";
import type { LiveStatus as Status } from "@/lib/eddn/status";
import { formatNumber } from "@/lib/format";

import { LiveStatus } from "./LiveStatus";
import { ThemePicker } from "./ThemePicker";

// The brand on the left; on the right whether live updates are arriving, the colour theme, and how old the daily dump is.
export function Header({ builtAt, systemCount, live }: { builtAt: string | null; systemCount: number; live: Status }) {
  const built = builtAt ? new Date(builtAt) : null;

  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3.5">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase leading-none tracking-[0.2em]">
            merit<span className="text-accent">finder</span>
          </h1>
          <p className={`${FIELD_LABEL} mt-1.5`}>Powerplay mining targets</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <LiveStatus initial={live} />
        <ThemePicker />
        <p className="font-mono tabular-nums text-xs uppercase tracking-wider text-muted">
          Spansh {built ? built.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "?"} · {formatNumber(systemCount)} systems
        </p>
      </div>
    </header>
  );
}
