import { StateTag } from "@/components/common/StateTag";
import { CopyButton } from "@/components/ui/CopyButton";
import type { MiningSource, SellableRow } from "@/lib/search/search";

import { MiningTargets } from "./MiningTargets";

const SOURCES_SHOWN = 3;

// Acquire: your power's systems to mine in for this row's Unoccupied system, nearest first, each with what there is to mine. The nearest few show;
// the rest are behind "Show more systems".
export function MiningSources({ sources, sellable = [] }: { sources: MiningSource[]; sellable?: SellableRow[] }) {
  const rest = sources.slice(SOURCES_SHOWN);
  return (
    <div>
      <ul className="divide-y divide-line">
        {sources.slice(0, SOURCES_SHOWN).map((s) => (
          <Source key={s.id64} source={s} sellable={sellable} />
        ))}
      </ul>
      {rest.length > 0 && (
        <details className="group border-t border-line pt-3">
          <summary className="cursor-pointer select-none text-sm text-muted hover:text-foreground">
            <span className="group-open:hidden">
              Show {rest.length} more {rest.length === 1 ? "system" : "systems"}
            </span>
            <span className="hidden group-open:inline">Show fewer</span>
          </summary>
          <ul className="mt-3 divide-y divide-line">
            {rest.map((s) => (
              <Source key={s.id64} source={s} sellable={sellable} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Source({ source: s, sellable }: { source: MiningSource; sellable: SellableRow[] }) {
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="mb-1 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className="select-all text-base font-semibold">{s.name}</span>
        <CopyButton text={s.name} label="Copy system name" className="self-center" />
        {s.powerState && <StateTag state={s.powerState} />}
        <span className="font-mono tabular-nums text-xs text-muted">{s.distance.toFixed(1)} ly away</span>
      </div>
      <MiningTargets rings={s.rings} bodies={s.bodies} systemName={s.name} sellable={sellable} tree />
    </li>
  );
}
