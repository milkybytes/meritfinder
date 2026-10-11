// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Dropdown, type DropdownOption } from "./Dropdown";

const OPTIONS: DropdownOption[] = [
  { value: "undermine", label: "Undermine" },
  { value: "reinforce", label: "Reinforce" },
  { value: "acquire", label: "Acquire" },
  { value: "any", label: "Any system", dot: "#ff0000" },
];

function setup(props: Partial<Parameters<typeof Dropdown>[0]> = {}) {
  const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
  const utils = render(
    <form onSubmit={onSubmit}>
      <Dropdown label="Goal" name="goal" options={OPTIONS} {...props} />
      <button type="submit">go</button>
    </form>,
  );
  const form = utils.container.querySelector("form")!;
  const box = () => screen.getByRole("combobox");
  const listed = () => screen.queryAllByRole("option").map((o) => o.textContent);
  return { onSubmit, box, listed, value: () => new FormData(form).get("goal") };
}

describe("Dropdown", () => {
  it("shows the starting choice, and submits it with the form", () => {
    const { box, value } = setup({ defaultValue: "reinforce" });
    expect(box().textContent).toBe("Reinforce");
    expect(value()).toBe("reinforce");
  });

  it("opens on a click, lists every option, and picks one with a click", () => {
    const { box, listed, value } = setup();
    expect(listed()).toEqual([]);
    fireEvent.click(box());
    expect(listed()).toEqual(["Undermine", "Reinforce", "Acquire", "Any system"]);
    fireEvent.mouseDown(screen.getByText("Acquire"));
    expect(listed()).toEqual([]); // closed again
    expect(box().textContent).toBe("Acquire");
    expect(value()).toBe("acquire");
  });

  it("tells the page what was chosen", () => {
    const onChange = vi.fn();
    const { box } = setup({ onChange });
    fireEvent.click(box());
    fireEvent.mouseDown(screen.getByText("Reinforce"));
    expect(onChange).toHaveBeenCalledWith("reinforce");
  });

  describe("keyboard", () => {
    it("arrow keys open it, move through the options without going past the ends, and Enter picks", () => {
      const { box, value } = setup();
      fireEvent.keyDown(box(), { key: "ArrowDown" }); // opens, on the current choice
      fireEvent.keyDown(box(), { key: "ArrowDown" });
      fireEvent.keyDown(box(), { key: "ArrowDown" });
      for (let i = 0; i < 5; i++) fireEvent.keyDown(box(), { key: "ArrowDown" });
      expect(screen.getAllByRole("option").at(-1)!.getAttribute("aria-selected")).toBe("false"); // active is not the same as chosen
      expect(box().getAttribute("aria-activedescendant")).toBe(screen.getAllByRole("option").at(-1)!.id);
      fireEvent.keyDown(box(), { key: "Enter" });
      expect(value()).toBe("any");
    });

    it("Escape closes without changing the choice", () => {
      const { box, listed, value } = setup();
      fireEvent.keyDown(box(), { key: "ArrowDown" });
      fireEvent.keyDown(box(), { key: "ArrowDown" });
      fireEvent.keyDown(box(), { key: "Escape" });
      expect(listed()).toEqual([]);
      expect(value()).toBe("undermine");
    });

  });

});

describe("Dropdown options", () => {
  const open = () => fireEvent.click(screen.getByRole("combobox"));
  const listed = () => screen.queryAllByRole("option").map((o) => o.textContent);

  it("takes plain strings and numbers, using each as its own label and value", () => {
    render(<form><Dropdown label="Limit" name="limit" options={["Large", 25, 50]} defaultValue={50} /></form>);
    expect(new FormData(document.querySelector("form")!).get("limit")).toBe("50"); // numbers are submitted as text, as a form always does
    open();
    expect(listed()).toEqual(["Large", "25", "50"]);
  });

  it("takes { value, label } where they differ, including an empty value", () => {
    render(<form><Dropdown label="Goal" name="goal" options={[{ value: "", label: "-" }, { value: "undermine", label: "Undermine" }]} defaultValue="" /></form>);
    expect(new FormData(document.querySelector("form")!).get("goal")).toBe("");
    open();
    expect(listed()).toEqual(["-", "Undermine"]);
    fireEvent.mouseDown(screen.getByText("Undermine"));
    expect(new FormData(document.querySelector("form")!).get("goal")).toBe("undermine");
  });

});
