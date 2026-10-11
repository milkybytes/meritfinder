import Form from "next/form";

import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { PANEL } from "@/components/ui/styles";
import { LIMITS } from "@/lib/search/params";

import { FilterFormState } from "./FilterFormState";
import type { SectionProps } from "./FilterSection";
import { MarketSection } from "./MarketSection/MarketSection";
import { MiningSection } from "./MiningSection/MiningSection";
import { PowerplaySection } from "./PowerplaySection/PowerplaySection";
import { ResetLink } from "./ResetLink";
import { WhereSection } from "./WhereSection/WhereSection";

const SORTS = [
  { value: "price", label: "Best price" },
  { value: "distance", label: "Nearest" },
];

// The search form. Submitting it (next/form) navigates on the client, so the form stays put and only the results reload.
export function FilterPanel({ params, info }: SectionProps) {
  const needsPower = (params.goal === "reinforce" || params.goal === "acquire") && !params.power; // both work from your power's own systems

  return (
    <>
      <FilterFormState method={params.method}>
        <Form action="/" className={`${PANEL} mt-6 space-y-8 p-6`}>
          <PowerplaySection params={params} info={info} />
          <WhereSection params={params} info={info} />
          <MarketSection params={params} info={info} />
          <MiningSection params={params} info={info} />

          <div className="flex items-center gap-5">
            <Button>Find targets</Button>
            <ResetLink />
            <div className="ml-auto flex gap-4">
              <Dropdown label="Sort by" name="sort" defaultValue={params.sort} options={SORTS} />
              <Dropdown label="Max results" name="limit" defaultValue={params.limit} options={LIMITS} />
            </div>
          </div>
        </Form>
      </FilterFormState>

      {needsPower && <p className="mt-6 text-sm text-warn">Pick your power to {params.goal} with.</p>}
    </>
  );
}
