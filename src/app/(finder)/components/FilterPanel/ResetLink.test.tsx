// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FILTERS_STORAGE_KEY } from "@/hooks/useRememberFilters";

import { FilterFormState } from "./FilterFormState";
import { ResetLink } from "./ResetLink";

// The address bar: the query string the page was opened with. Link is a plain anchor so a click's default can be inspected.
let query = "";
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(query), useRouter: () => ({ replace: () => {} }) }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: { children: ReactNode }) => <a {...props}>{children}</a> }));

beforeEach(() => {
  localStorage.clear();
  query = "";
});

// A field that remembers what is typed into it, as ours do: only a new one goes back to its default.
const Page = () => (
  <FilterFormState method="any">
    <input aria-label="ref" defaultValue="" />
    <ResetLink />
  </FilterFormState>
);
const ref = () => screen.getByLabelText("ref") as HTMLInputElement;

describe("ResetLink", () => {
  it("goes to the plain address, and forgets the remembered search before it does, so the old one is not brought back", () => {
    query = "ref=Sol&range=70";
    localStorage.setItem(FILTERS_STORAGE_KEY, query);
    render(<Page />);
    const notCancelled = fireEvent.click(screen.getByText("Reset"));
    expect(notCancelled).toBe(true); // the link is followed
    expect(screen.getByText("Reset").getAttribute("href")).toBe("/");
    expect(localStorage.getItem(FILTERS_STORAGE_KEY)).toBeNull();
  });

  it("on the plain address, clears what was typed without leaving the page", () => {
    render(<Page />);
    fireEvent.change(ref(), { target: { value: "half-typed" } });
    const notCancelled = fireEvent.click(screen.getByText("Reset"));
    expect(notCancelled).toBe(false); // nowhere to go: the click is handled here
    expect(ref().value).toBe("");
  });

});
