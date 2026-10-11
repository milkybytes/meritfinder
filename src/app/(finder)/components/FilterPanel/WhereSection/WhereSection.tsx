import { RangeSlider } from "@/components/ui/RangeSlider";
import { MAX_RANGE } from "@/lib/search/params";

import { FilterSection, type SectionProps } from "../FilterSection";

import { SystemInput } from "./SystemInput";

export function WhereSection({ params }: SectionProps) {
  return (
    <FilterSection title="Where">
      <div className="grid items-end gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SystemInput name="ref" label="Reference system" defaultValue={params.ref} placeholder="e.g. Sol" />
        <RangeSlider name="range" label="Range" min={1} max={MAX_RANGE} initial={params.range} unit="ly" />
      </div>
    </FilterSection>
  );
}
