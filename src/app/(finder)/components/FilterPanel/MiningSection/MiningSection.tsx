import { FilterSection, type SectionProps } from "../FilterSection";

import { MethodTabs } from "./MethodTabs";
import { MiningOptions } from "./MiningOptions";

// Pick a mining method first; the material list and extra filters follow from it.
export function MiningSection({ params, info }: SectionProps) {
  return (
    <FilterSection title="Mining">
      <div className="space-y-4">
        <MethodTabs />
        <MiningOptions params={params} info={info} />
      </div>
    </FilterSection>
  );
}
