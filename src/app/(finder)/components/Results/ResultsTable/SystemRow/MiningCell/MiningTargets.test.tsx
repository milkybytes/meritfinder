// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { RingRow } from "@/lib/search/search";

import { MiningTargets } from "./MiningTargets";

const ring = (name: string, over: Partial<RingRow> = {}): RingRow => ({ name, type: "Rocky", reserve: "Major", hotspots: [], ...over });

describe("MiningTargets: rings", () => {
  it("puts a planet's rings under the planet, so a ring is not read as a moon of a similar name", () => {
    const { container } = render(
      <MiningTargets
        systemName="Col 285 Sector CY-N b21-8"
        bodies={[]}
        rings={[
          ring("Col 285 Sector CY-N b21-8 B 15 A Ring", { type: "Metal Rich", hotspots: [{ material: "Monazite", count: 1 }] }),
          ring("Col 285 Sector CY-N b21-8 B 15 B Ring", { type: "Icy" }),
          ring("Col 285 Sector CY-N b21-8 B 14 A Ring"),
        ]}
      />,
    );
    const groups = [...container.querySelectorAll("[data-ring-group]")];
    expect(groups).toHaveLength(2); // planets B 15 and B 14
    expect(groups[0].textContent).toContain("B 15");
    expect([...groups[0].querySelectorAll("[data-ring]")].map((r) => r.textContent)).toEqual([expect.stringMatching(/^A Ring/), expect.stringMatching(/^B Ring/)]);
    expect(groups[1].textContent).toContain("B 14");
    expect(container.textContent).not.toContain("B 15 A Ring"); // the full name is no longer repeated on each line
  });

  it("marks a mineral that has a hotspot, and leaves one that is only somewhere in the ring plain", () => {
    const { container } = render(
      <MiningTargets
        systemName="Sol"
        bodies={[]}
        rings={[ring("Sol 4 A Ring", { hotspots: [{ material: "Monazite", count: 2 }, { material: "Painite", count: null }] })]}
      />,
    );
    const marked = [...container.querySelectorAll("[data-hotspot]")];
    expect(marked.map((m) => m.textContent)).toEqual(["Monazite ×2"]);
    expect(container.textContent).toContain("Painite");
  });

  it("lists a ring whose name does not say its planet on its own", () => {
    const { container } = render(<MiningTargets systemName="Prism" bodies={[]} rings={[ring("Prism Mestra r1")]} />);
    expect(container.querySelectorAll("[data-ring-group]")).toHaveLength(1);
    expect(container.textContent).toContain("Mestra r1");
  });
});
