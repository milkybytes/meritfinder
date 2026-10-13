import { FIELD_LABEL } from "@/components/ui/styles";
import type { LiveStatus as Status } from "@/lib/eddn/status";
import { formatNumber } from "@/lib/format";

import { LiveStatus } from "./LiveStatus";
import { ThemePicker } from "./ThemePicker";

// The brand and the number of systems on the left; on the right whether live updates are arriving, then the colour theme.
export function Header({ systemCount, live }: { systemCount: number; live: Status }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3.5">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase leading-none tracking-[0.2em]">
            merit<span className="text-accent">finder</span>
          </h1>
          <p className={`${FIELD_LABEL} mt-1.5`}>
            Powerplay mining targets · {formatNumber(systemCount)} systems
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <LiveStatus initial={live} />
        <ThemePicker />
      </div>
    </header>
  );
}
