// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { StationRow } from "@/lib/search/search";

import { stationTip } from "./StationTip";

const station = (top: StationRow["top"]): StationRow => ({
  name: "Hub", commodity: "x", type: null, distanceLs: 1, pad: "L", sellPrice: 1, demand: 1, marketUpdated: null, top,
});
const mineral = (i: number, over: Partial<StationRow["top"][number]> = {}) => ({ commodity: `Mineral ${i}`, sellPrice: 1_000_000 - i * 1000, demand: 100, meets: true, ...over });

describe("stationTip", () => {
  it("lists everything when there are few", () => {
    const { container } = render(<>{stationTip(station([mineral(1), mineral(2), mineral(3)]), [])}</>);
    expect(container.querySelectorAll("li")).toHaveLength(3);
    expect(container.textContent).not.toContain("best of");
  });

  it("shows the ten best of a long list, those that meet the minimum first, and says how many it left out", () => {
    const top = [
      mineral(1, { commodity: "Dearest", meets: false }), // the dearest, but below the chosen minimum demand
      ...Array.from({ length: 14 }, (_, i) => mineral(i + 2)),
    ];
    const { container } = render(<>{stationTip(station(top), [])}</>);
    const names = [...container.querySelectorAll("li")].map((li) => li.textContent ?? "");
    expect(names).toHaveLength(10);
    expect(names[0]).toContain("Mineral 2"); // meeting rows lead, even though Dearest pays more
    expect(names.some((n) => n.includes("Dearest"))).toBe(false); // and with ten that meet, the one below does not make the cut
    expect(container.textContent).toContain("The 10 best of 15 minerals this station pays for.");
  });

  it("fills with those below the minimum when fewer than ten meet it, dimmed", () => {
    const top = [...Array.from({ length: 3 }, (_, i) => mineral(i + 1)), ...Array.from({ length: 12 }, (_, i) => mineral(i + 4, { meets: false }))];
    const { container } = render(<>{stationTip(station(top), [])}</>);
    expect(container.querySelectorAll("li")).toHaveLength(10);
  });
});
