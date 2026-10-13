import type { ResultRow } from "@/lib/search/search";

import { MiningSources } from "./MiningSources";
import { MiningTargets } from "./MiningTargets";

// What there is to mine for this result. Usually that is in the system itself. For an Acquire target it is elsewhere, since you
// mine in one of your power's systems and sell in the Unoccupied one: then it is those systems.
export function MiningCell({ row }: { row: ResultRow }) {
  const { sellable } = row;
  return (
    <td className="px-5 py-4">
      {row.sources.length > 0 ? (
        <MiningSources sources={row.sources} sellable={sellable} />
      ) : (
        <MiningTargets rings={row.rings} bodies={row.bodies} systemName={row.name} sellable={sellable} />
      )}
    </td>
  );
}
