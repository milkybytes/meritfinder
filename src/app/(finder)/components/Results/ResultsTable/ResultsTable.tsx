import { PANEL } from "@/components/ui/styles";
import type { ResultRow } from "@/lib/search/search";

import { SystemRow } from "./SystemRow/SystemRow";

// The scroll container sits inside the panel: the panel's corner brackets overhang by 1px and would add a scrollbar of their own.
export function ResultsTable({ rows }: { rows: ResultRow[] }) {
  return (
    <div className={`${PANEL} mt-4`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[66rem] table-fixed text-sm">
          <colgroup>
            <col style={{ width: "17%" }} />
            <col style={{ width: "21%" }} />
            <col style={{ width: "28%" }} />
            <col style={{ width: "34%" }} />
          </colgroup>
          <thead className="border-b border-line">
            <tr className="*:px-5 *:py-3 *:text-left *:font-display *:text-[0.75rem] *:font-semibold *:uppercase *:tracking-[0.14em] *:text-muted">
              <th>System</th>
              <th>Power</th>
              <th>Best sale</th>
              <th>Mining</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <SystemRow key={row.id64} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
