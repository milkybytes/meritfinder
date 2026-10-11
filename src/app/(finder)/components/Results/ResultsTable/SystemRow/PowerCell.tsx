import { PowerName } from "@/components/common/PowerName";
import { StateTag } from "@/components/common/StateTag";
import { FIELD_LABEL } from "@/components/ui/styles";
import type { ResultRow } from "@/lib/search/search";

// Who holds the system and in what state, then the other powers with a presence in it.
export function PowerCell({ row }: { row: ResultRow }) {
  const others = row.powers.slice(1);

  return (
    <td className="px-5 py-4 text-sm">
      <PowerName name={row.controllingPower || "Uncontrolled"} />
      {row.powerState && (
        <div className="mt-1">
          <StateTag state={row.contested ? "Contested" : row.powerState} />
        </div>
      )}
      {others.length > 0 && (
        <div className="mt-2 space-y-0.5" title="Other powers with a presence in this system">
          <div className={FIELD_LABEL}>Also present</div>
          {others.map((x) => (
            <div key={x}>
              <PowerName name={x} small />
            </div>
          ))}
        </div>
      )}
    </td>
  );
}
