import { Dropdown } from "@/components/ui/Dropdown";
import { NumberField } from "@/components/ui/NumberField";

import { FilterSection, type SectionProps } from "../FilterSection";

import { CommodityPicker } from "./CommodityPicker";

const PADS = [
  { value: "L", label: "Large" },
  { value: "M", label: "Medium or larger" },
  { value: "S", label: "Any" },
];

export function MarketSection({ params, info }: SectionProps) {
  return (
    <FilterSection title="Market">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <div className="md:col-span-2 lg:col-span-5">
          <CommodityPicker all={info.commodities} initial={params.commodity} />
        </div>
        <NumberField label="Min price (cr)" name="minPrice" defaultValue={params.minPrice} />
        <NumberField label="Min demand (t)" name="minDemand" defaultValue={params.minDemand} />
        <Dropdown label="Landing pad" name="pad" defaultValue={params.pad} options={PADS} />
        <NumberField label="Max station distance (ls)" name="maxLs" defaultValue={params.maxStationLs} />
        <NumberField label="Max market age (days)" name="maxAge" defaultValue={params.maxAgeDays} />
      </div>
    </FilterSection>
  );
}
