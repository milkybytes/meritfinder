// @vitest-environment jsdom
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { BodyRow, RingRow, SellableRow } from "@/lib/search/search";

import { MiningTargets } from "./MiningTargets";

const ring = (name: string, over: Partial<RingRow> = {}): RingRow => ({ name, type: "Rocky", reserve: "Major", hotspots: [], carries: [], ...over });
let nextBodyId = 1;
const body = (name: string, over: Partial<BodyRow> = {}): BodyRow => ({
  bodyId: nextBodyId++, name, subtype: "Rocky body", volcanism: null, bodyClass: "rocky", gravity: 0.3, distanceLs: 100, miningSignals: 4, carries: [], ...over,
});

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

const sells = (commodity: string, over: Partial<SellableRow> = {}): SellableRow => ({ commodity, sellPrice: 165913, demand: 800, station: "Sol Hub", meets: true, places: 1, ringPlaces: 0, planetPlaces: 1, ...over });

describe("MiningTargets: what sells here", () => {
  it("lists only the planets that can carry what sells, with the survey's share", () => {
    const { container } = render(
      <MiningTargets
        systemName="Sol"
        rings={[]}
        sellable={[sells("Periclase Dunite")]}
        bodies={[
          body("Sol 1", { carries: [{ material: "Periclase Dunite", percent: 12 }] }),
          body("Sol 2", { subtype: "Icy body", bodyClass: "icy" }),
        ]}
      />,
    );
    const lines = [...container.querySelectorAll(":scope > ul > li")];
    expect(lines).toHaveLength(1); // the icy body cannot yield anything this system pays for: it is not listed
    expect(lines[0].querySelector("[data-carries]")?.textContent).toBe("Periclase Dunite12%");
    expect(container.textContent).not.toContain("Sol 2");
  });

  it("when nothing can carry what sells, keeps the lines (dimmed) rather than showing nothing", () => {
    const { container } = render(<MiningTargets systemName="Sol" rings={[]} sellable={[sells("Monazite")]} bodies={[body("Sol 1"), body("Sol 2")]} />);
    const lines = [...container.querySelectorAll(":scope > ul > li")];
    expect(lines).toHaveLength(2);
    expect(lines.every((l) => l.hasAttribute("data-dim"))).toBe(true);
  });

  it("does not dim anything when nothing is known to sell (no commodity to compare with)", () => {
    const { container } = render(<MiningTargets systemName="Sol" rings={[]} bodies={[body("Sol 1")]} />);
    expect(container.querySelector("[data-dim]")).toBeNull();
  });

  it("highlights a ring's hotspot that sells here, and names a material the ring type yields without a hotspot", () => {
    const { container } = render(
      <MiningTargets
        systemName="Sol"
        bodies={[]}
        sellable={[sells("Monazite"), sells("Gold")]}
        rings={[
          ring("Sol 4 A Ring", {
            type: "Metal Rich",
            hotspots: [{ material: "Monazite", count: 2 }, { material: "Painite", count: 1 }],
            carries: [{ material: "Monazite", hotspots: 2 }, { material: "Gold", hotspots: null }],
          }),
          ring("Sol 4 B Ring", { type: "Icy" }),
        ]}
      />,
    );
    expect([...container.querySelectorAll("[data-ring] [data-sells]")].map((s) => s.textContent)).toEqual(["Monazite ×2", "Gold"]);
    expect(container.querySelectorAll("[data-ring]")).toHaveLength(1); // the Icy ring yields nothing this system pays for: not listed
  });
});

describe("MiningTargets: the hover card", () => {
  const card = () => document.body.querySelector('[role="tooltip"]');

  it("follows the pointer over a planet and lists what that kind of body can hold, what sells here first and marked", () => {
    const { container } = render(
      <MiningTargets
        systemName="Sol"
        rings={[]}
        sellable={[
          sells("Periclase Dunite", { sellPrice: 165913, station: "Sol Hub" }),
          sells("Magnesite", { sellPrice: 36913, station: "Sol Hub", meets: false, places: 1 }), // paid, but below the minimum price
        ]}
        bodies={[body("Sol 1", { carries: [{ material: "Periclase Dunite", percent: 12 }, { material: "Magnesite", percent: 43 }] })]}
      />,
    );
    expect(card()).toBeNull(); // nothing until the pointer is over it
    const line = container.querySelector("li > div")!;
    fireEvent.mouseEnter(line, { clientX: 40, clientY: 50 });
    expect(card()).not.toBeNull();
    expect(card()!.parentElement).toBe(document.body); // in a portal: the table's scroll box cannot clip it
    const rows = [...card()!.querySelectorAll("li")];
    expect(rows[0].textContent).toContain("Periclase Dunite");
    expect(rows[0].textContent).toContain("12%");
    expect(rows[0].textContent).toContain("165,913 CR at Sol Hub");
    expect(rows[0].hasAttribute("data-mark")).toBe(true);
    expect(rows[1].textContent).toContain("Magnesite"); // below the minimum: still shown, with its real price
    expect(rows[1].textContent).toContain("36,913 CR at Sol Hub");
    expect(rows[1].hasAttribute("data-mark")).toBe(false); // but not counted as selling here
    expect(card()!.textContent).not.toContain("Jadeite"); // a rocky body can hold it, but nothing here pays for it: no price, no row

    const before = (card() as HTMLElement).style.left;
    fireEvent.mouseMove(line, { clientX: 300, clientY: 90 });
    expect((card() as HTMLElement).style.left).not.toBe(before); // it moved with the pointer
    fireEvent.mouseLeave(line);
    expect(card()).toBeNull();
  });

  it("over a ring lists its hotspots and what it can yield that sells here, and leaves out the rest of its type", () => {
    const { container } = render(
      <MiningTargets
        systemName="Sol"
        bodies={[]}
        sellable={[sells("Gold", { sellPrice: 90_000, station: "Sol Hub" })]}
        rings={[ring("Sol 4 A Ring", { type: "Metallic", hotspots: [{ material: "Painite", count: 1 }], carries: [{ material: "Gold", hotspots: null }] })]}
      />,
    );
    fireEvent.mouseEnter(container.querySelector("[data-ring]")!, { clientX: 10, clientY: 10 });
    const rows = [...card()!.querySelectorAll("li")].map((r) => r.textContent ?? "");
    expect(rows).toHaveLength(2); // Silver, Osmium... also come from this type of ring, but nothing is known of them here
    expect(rows[0]).toContain("Gold"); // sells here
    expect(rows[0]).toContain("90,000 CR at Sol Hub");
    expect(rows[1]).toContain("Painite");
    expect(rows[1]).toContain("1 hotspot");
    expect(card()!.textContent).toContain("Metallic ring");
  });

  it("shows a ring's reserve level as a badge, not as loose text", () => {
    const { container } = render(<MiningTargets systemName="Sol" bodies={[]} rings={[ring("Sol 4 A Ring", { reserve: "Pristine" }), ring("Sol 4 B Ring", { reserve: "Depleted" })]} />);
    const badges = [...container.querySelectorAll("[data-reserve]")];
    expect(badges.map((b) => b.textContent)).toEqual(["Pristine", "Depleted"]);
    const colour = (el: Element) => (el.firstElementChild as HTMLElement).style.color;
    expect(colour(badges[0])).not.toBe(colour(badges[1])); // richer and poorer read differently
  });

  it("draws every material that fetches 700,000 or more in gold, not only the best, and none below that", () => {
    const { container } = render(
      <MiningTargets
        systemName="Sol"
        rings={[]}
        sellable={[sells("Monazite", { sellPrice: 728_248 }), sells("Painite", { sellPrice: 710_000 }), sells("Platinum", { sellPrice: 223_980 })]}
        bodies={[
          body("Sol 1", {
            carries: [{ material: "Monazite", percent: 46 }, { material: "Painite", percent: 5 }, { material: "Platinum", percent: 30 }],
          }),
        ]}
      />,
    );
    const gold = [...container.querySelectorAll("[data-gold]")].map((m) => m.textContent);
    expect(gold).toEqual(["Monazite46%", "Painite5%"]);
  });

  it("shows the demand bars for what sells, in the card", () => {
    const { container } = render(
      <MiningTargets
        systemName="Sol"
        rings={[]}
        sellable={[sells("Periclase Dunite", { demand: 2400 })]}
        bodies={[body("Sol 1", { carries: [{ material: "Periclase Dunite", percent: 12 }] })]}
      />,
    );
    fireEvent.mouseEnter(container.querySelector("li > div")!, { clientX: 10, clientY: 10 });
    const row = [...card()!.querySelectorAll("li")].find((r) => r.textContent?.includes("Periclase Dunite"))!;
    expect(row.querySelectorAll("[data-on]")).toHaveLength(5); // the five bars
    expect(row.querySelectorAll('[data-on="true"]').length).toBeGreaterThan(0);
    expect(row.textContent).toContain("2,400 t");
  });

  it("shows nothing for a body whose kind is not known", () => {
    const { container } = render(<MiningTargets systemName="Sol" rings={[]} bodies={[body("Sol 1", { bodyClass: null })]} />);
    fireEvent.mouseEnter(container.querySelector("li > div")!, { clientX: 10, clientY: 10 });
    expect(card()).toBeNull();
  });
});
