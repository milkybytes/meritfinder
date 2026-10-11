// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { MiningMethod } from "@/data/mining-methods";
import { parseParams } from "@/lib/search/params";
import type { SearchInfo } from "@/lib/search/search";

import { FilterFormState } from "../FilterFormState";
import { MarketSection } from "../MarketSection/MarketSection";

import { MiningSection } from "./MiningSection";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(), useRouter: () => ({ replace: () => {} }) }));

const INFO = {
  ringMaterials: ["Monazite", "Painite", "Void Opal", "Gold", "Water"],
  allRings: true,
  reserves: ["Pristine", "Major"],
  commodities: ["Gold", "Monazite", "Painite"],
} as unknown as SearchInfo;

// The Market and Mining sections share the method, so test them together in a plain form.
function setup(method: MiningMethod = "any", extra: Record<string, string | string[]> = {}) {
  const params = parseParams({ ref: "Sol", method, ...extra });
  const utils = render(
    <FilterFormState method={params.method}>
      <form>
        <MarketSection params={params} info={INFO} />
        <MiningSection params={params} info={INFO} />
      </form>
    </FilterFormState>,
  );
  const form = utils.container.querySelector("form")!;
  return { user: userEvent.setup(), data: () => new FormData(form), ...utils };
}

describe("fields follow the method", () => {
  it.each(["laser", "subsurface", "core"] as const)("%s shows ring type and reserve, not the planet signal filter", (m) => {
    setup(m);
    expect(screen.getByText("Ring type")).toBeTruthy();
    expect(screen.getByText("Reserve level")).toBeTruthy();
    expect(screen.queryByText("Planets with mining signals")).toBeNull();
  });

  it("planetary shows the planet signal filter, not the ring fields", () => {
    setup("planetary");
    expect(screen.getByText("Planets with mining signals")).toBeTruthy();
    expect(screen.queryByText("Ring type")).toBeNull();
  });

});

describe("the material and commodity lists follow the method", () => {
  it("drops a selected material the new method cannot yield", async () => {
    const { user, data } = setup("core", { material: ["Void Opal"] });
    expect(data().getAll("material")).toEqual(["Void Opal"]);
    await user.click(screen.getByLabelText("Planetary (Rhino SRV)")); // Void Opal has no planetary source
    expect(data().getAll("material")).toEqual([]);
  });

});
