"use client";

import { ChipSelect } from "@/components/ui/ChipSelect";
import { Dropdown } from "@/components/ui/Dropdown";
import { isRingMethod, materialsFor } from "@/data/mining-methods";
import { RING_TYPES } from "@/data/ring-materials";

import { useMethod } from "../FilterFormState";
import type { SectionProps } from "../FilterSection";

const SIGNAL_OPTIONS = [
  { value: "possible", label: "Known or unknown" },
  { value: "known", label: "Known signals only" },
  { value: "any", label: "Don't filter" },
];

// The fields that follow from the chosen method: ring type and reserve for rings, signal knowledge for planets,
// and the material to mine, whose choices depend on what the method can yield.
export function MiningOptions({ params, info }: SectionProps) {
  const [method] = useMethod();
  const ring = isRingMethod(method);
  const options = materialsFor(method, info.ringMaterials);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {ring && (
          <>
            <ChipSelect name="ringType" label="Ring type" options={[...RING_TYPES]} initial={params.ringTypes} />
            <ChipSelect name="reserve" label="Reserve level" options={info.reserves} initial={params.reserve} />
          </>
        )}
        {method === "planetary" && <Dropdown label="Planets with mining signals" name="mining" defaultValue={params.mining} options={SIGNAL_OPTIONS} />}
        <div className={ring ? "lg:col-span-2" : "md:col-span-1 lg:col-span-3"}>
          {/* key remounts the picker so selections the new method can't yield are dropped */}
          <ChipSelect
            key={method}
            name="material"
            label={
              method === "planetary"
                ? "Material to mine (planet types that can hold it)"
                : ring
                  ? "Material to mine"
                  : "Material to mine"
            }
            options={options}
            initial={params.material.filter((m) => options.includes(m))}
          />
        </div>
      </div>
      {ring && info.ringMaterials.length === 0 && <p className="mt-2 text-sm text-warn">No ring data in this database yet.</p>}
    </>
  );
}
