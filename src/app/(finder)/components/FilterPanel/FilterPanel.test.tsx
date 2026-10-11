// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { parseParams } from "@/lib/search/params";
import type { SearchInfo } from "@/lib/search/search";

import { FilterPanel } from "./FilterPanel";

// next/form and the navigation hooks need Next's router; a plain form and an empty address stand in for them.
vi.mock("next/form", () => ({ default: ({ children, ...props }: { children: ReactNode }) => <form {...props}>{children}</form> }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(""), useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: { children: ReactNode }) => <a {...props}>{children}</a> }));

const info = {
  powers: ["Edmund Mahon"], states: ["Boom"], commodities: ["Gold"], ringMaterials: ["Monazite"], allRings: true, reserves: ["Pristine"],
} as unknown as SearchInfo;

describe("FilterPanel", () => {

  it("remounting it (what a new search in the address does, see app/page.tsx) makes every field show the new search", () => {
    const { rerender } = render(<FilterPanel key="form" params={parseParams({ ref: "Sol", range: "300", limit: "100" })} info={info} />);
    const ref = () => screen.getByLabelText("Reference system") as HTMLInputElement;
    fireEvent.change(ref(), { target: { value: "Sirius" } }); // the visitor edits the box
    expect(ref().value).toBe("Sirius");
    rerender(<FilterPanel key="form" params={parseParams({})} info={info} />);
    expect(ref().value).toBe("Sirius"); // same key: React keeps what was typed (the bug)
    rerender(<FilterPanel key="reset" params={parseParams({})} info={info} />);
    expect(ref().value).toBe("");
    expect(screen.getByLabelText("Max results").textContent).toBe("25");
  });

  it("asks for a power when acquiring without one, as for reinforcing", () => {
    render(<FilterPanel params={parseParams({ goal: "acquire" })} info={info} />);
    expect(screen.getByText(/Pick your power to acquire with/)).toBeTruthy();
  });

});
