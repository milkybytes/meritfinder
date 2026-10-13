import { ChipSelect } from "@/components/ui/ChipSelect";
import { Dropdown } from "@/components/ui/Dropdown";
import { POWER_COLORS } from "@/data/powers";

import { FilterSection, type SectionProps } from "../FilterSection";

const GOALS = [
  { value: "undermine", label: "Undermine" },
  { value: "reinforce", label: "Reinforce" },
  { value: "acquire", label: "Acquire" },
];

export function PowerplaySection({ params, info }: SectionProps) {
  return (
    <FilterSection title="Powerplay">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Dropdown label="Your power" name="power" defaultValue={params.power} options={[{ value: "", label: "-" }, ...info.powers]} dots={POWER_COLORS} />
        <Dropdown label="Goal" name="goal" options={GOALS} defaultValue={params.goal} />
        <ChipSelect name="target" label="Opposing power (undermine)" options={info.powers} initial={params.target} dots={POWER_COLORS} />
      </div>
    </FilterSection>
  );
}
