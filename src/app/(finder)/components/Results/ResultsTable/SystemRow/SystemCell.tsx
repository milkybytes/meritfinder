import { CopyButton } from "@/components/ui/CopyButton";
import type { ResultRow } from "@/lib/search/search";

// The system's name (with a copy button) and how far it is.
export function SystemCell({ row }: { row: ResultRow }) {
  return (
    <td className="px-5 py-4">
      <div className="flex items-center gap-1">
        <span className="select-all font-medium">{row.name}</span>
        <CopyButton text={row.name} label="Copy system name" />
      </div>
      <div className="font-mono tabular-nums mt-0.5 text-xs text-muted">{row.distance.toFixed(1)} ly</div>
    </td>
  );
}
