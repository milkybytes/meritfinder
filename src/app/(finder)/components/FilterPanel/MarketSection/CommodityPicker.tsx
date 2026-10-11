"use client";

import { ChipSelect } from "@/components/ui/ChipSelect";
import { PLANETARY_MATERIALS } from "@/data/mining-methods";

import { useMethod } from "../FilterFormState";

// "Commodity to sell". Planetary mining can only ever yield the survey materials, so for that
// method nothing else is offered (and the server ignores anything else).
export function CommodityPicker({ all, initial }: { all: string[]; initial: string[] }) {
  const [method] = useMethod();
  const planetary = method === "planetary";
  const options = planetary ? all.filter((c) => PLANETARY_MATERIALS.includes(c)) : all;
  return (
    <div>
      <ChipSelect
        key={planetary ? "planetary" : "all"}
        name="commodity"
        label={planetary ? "Commodity to sell (planetary materials only)" : "Commodity to sell"}
        options={options}
        initial={initial.filter((c) => options.includes(c))}
        anyLabel={planetary ? "Any planetary material" : "Any"}
      />
    </div>
  );
}
