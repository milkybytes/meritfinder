import { ChipSelect } from "@/components/ui/ChipSelect";
import { Dropdown } from "@/components/ui/Dropdown";
import { POWER_COLORS } from "@/data/powers";
import { FACTION_STATE_COLORS } from "@/data/state-colors";

import { FilterSection, type SectionProps } from "../FilterSection";

const GOALS = [
  { value: "undermine", label: "Undermine" },
  { value: "reinforce", label: "Reinforce" },
  { value: "acquire", label: "Acquire" },
];

export function PowerplaySection({ params, info }: SectionProps) {
  return (
    <FilterSection title="Powerplay">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Dropdown label="Your power" name="power" defaultValue={params.power} options={[{ value: "", label: "-" }, ...info.powers]} dots={POWER_COLORS} />
        <Dropdown label="Goal" name="goal" options={GOALS} defaultValue={params.goal} />
        <ChipSelect name="target" label="Opposing power (undermine)" options={info.powers} initial={params.target} dots={POWER_COLORS} />
        <ChipSelect name="state" label="System state" options={info.states} initial={params.states} dots={FACTION_STATE_COLORS} />
      </div>
    </FilterSection>
  );
}
