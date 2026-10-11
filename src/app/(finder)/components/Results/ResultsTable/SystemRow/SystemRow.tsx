import type { ResultRow } from "@/lib/search/search";

import { MiningCell } from "./MiningCell/MiningCell";
import { PowerCell } from "./PowerCell";
import { SaleCell } from "./SaleCell/SaleCell";
import { SystemCell } from "./SystemCell";

// One system: who holds it, what it pays, and what there is to mine.
export function SystemRow({ row }: { row: ResultRow }) {
  return (
    <tr className="border-b border-line align-top shadow-[inset_2px_0_0_transparent] last:border-0 hover:bg-accent/5 hover:shadow-[inset_2px_0_0_var(--accent)] *:wrap-anywhere">
      <SystemCell row={row} />
      <PowerCell row={row} />
      <SaleCell row={row} />
      <MiningCell row={row} />
    </tr>
  );
}
