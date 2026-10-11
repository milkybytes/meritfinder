// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FilterFormState, useMethod, useRebuildForm } from "./FilterFormState";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(), useRouter: () => ({ replace: () => {} }) }));

// Two fields that share the method, as the method tabs and the Mining section do, a box that keeps what is typed, and Reset.
function MethodTabs() {
  const [, setMethod] = useMethod();
  return <button onClick={() => setMethod("core")}>choose core</button>;
}
function Reader() {
  const [method] = useMethod();
  return <p>method: {method}</p>;
}
function Reset() {
  return <button onClick={useRebuildForm()}>reset</button>;
}
const page = () => (
  <FilterFormState method="laser">
    <MethodTabs />
    <Reader />
    <input aria-label="ref" defaultValue="" />
    <Reset />
  </FilterFormState>
);

describe("FilterFormState", () => {
  it("starts with the method it was given, and shares a change with every field that reads it", () => {
    render(page());
    expect(screen.getByText("method: laser")).toBeTruthy();
    fireEvent.click(screen.getByText("choose core"));
    expect(screen.getByText("method: core")).toBeTruthy();
  });

  it("rebuild puts the method back and makes the fields new, so what was typed is gone", () => {
    render(page());
    fireEvent.click(screen.getByText("choose core"));
    fireEvent.change(screen.getByLabelText("ref"), { target: { value: "Sol" } });
    fireEvent.click(screen.getByText("reset"));
    expect(screen.getByText("method: laser")).toBeTruthy();
    expect((screen.getByLabelText("ref") as HTMLInputElement).value).toBe("");
  });
});
