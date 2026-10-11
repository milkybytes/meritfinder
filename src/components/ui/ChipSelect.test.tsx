// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChipSelect } from "./ChipSelect";

const OPTIONS = ["Alexandrite", "Benitoite", "Monazite", "Painite", "Platinum"];

function setup(props: Partial<Parameters<typeof ChipSelect>[0]> = {}) {
  const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
  const utils = render(
    <form onSubmit={onSubmit}>
      <ChipSelect name="material" label="Material" options={OPTIONS} {...props} />
      <button type="submit">go</button>
    </form>,
  );
  const user = userEvent.setup();
  const input = screen.getByRole("textbox");
  const form = utils.container.querySelector("form")!;
  const values = () => new FormData(form).getAll("material");
  const listbox = () => utils.container.querySelector("ul");
  const options = () => (listbox() ? within(listbox()!).getAllByRole("listitem").map((li) => li.textContent) : []);
  return { user, input, onSubmit, values, options, listbox, ...utils };
}

describe("ChipSelect: what it shows", () => {

  it("shows the initial selection as chips and submits each as a repeated field", () => {
    const { values } = setup({ initial: ["Monazite", "Painite"] });
    expect(screen.queryByText("Any")).toBeNull();
    expect(screen.getByText("Monazite")).toBeTruthy();
    expect(screen.getByText("Painite")).toBeTruthy();
    expect(values()).toEqual(["Monazite", "Painite"]);
  });

});

describe("ChipSelect: choosing", () => {

  it("filters as you type, ignoring case and matching anywhere in the name", async () => {
    const { user, input, options } = setup();
    await user.type(input, "PLA");
    expect(options()).toEqual(["Platinum"]);
    await user.clear(input);
    await user.type(input, "ite");
    expect(options()).toEqual(["Alexandrite", "Benitoite", "Monazite", "Painite"]);
  });

  it("clicking an option adds a chip, submits it, clears the query and keeps focus in the box", async () => {
    const { user, input, options, values } = setup();
    await user.type(input, "mon");
    await user.click(screen.getByText("Monazite", { selector: "li" }));
    expect(screen.getByRole("button", { name: "Remove Monazite" })).toBeTruthy(); // the chip, with its remove button
    expect(values()).toEqual(["Monazite"]);
    expect((input as HTMLInputElement).value).toBe("");
    expect(document.activeElement).toBe(input);
    expect(options()).not.toContain("Monazite");
  });

});

describe("ChipSelect: keyboard", () => {
  it("Enter picks the highlighted option and does not submit the form", async () => {
    const { user, input, values, onSubmit } = setup();
    await user.type(input, "pla{Enter}");
    expect(values()).toEqual(["Platinum"]);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("Backspace in an empty box removes the last chip, but never while you are typing", async () => {
    const { user, input, values } = setup({ initial: ["Alexandrite", "Monazite"] });
    await user.click(input);
    await user.type(input, "p{Backspace}"); // deletes the typed letter only
    expect(values()).toEqual(["Alexandrite", "Monazite"]);
    await user.keyboard("{Backspace}"); // box is empty now
    expect(values()).toEqual(["Alexandrite"]);
  });

});

describe("ChipSelect: removing", () => {
  it("the x on a chip removes it, and the Any chip returns when none are left", async () => {
    const { user, values } = setup({ initial: ["Monazite"] });
    await user.click(screen.getByRole("button", { name: "Remove Monazite" }));
    expect(values()).toEqual([]);
    expect(screen.getByText("Any")).toBeTruthy();
  });

  it("Clear empties the whole field at once, and is not there when nothing is selected", async () => {
    const { user, values, input } = setup({ initial: ["Monazite", "Painite", "Platinum"] });
    await user.click(screen.getByRole("button", { name: "Clear Material" }));
    expect(values()).toEqual([]);
    expect(screen.getByText("Any")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Clear Material" })).toBeNull();
    expect(document.activeElement).toBe(input);
  });

});
