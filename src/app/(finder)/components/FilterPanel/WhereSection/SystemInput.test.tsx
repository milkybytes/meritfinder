// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SystemInput } from "./SystemInput";

const HYADES = [
  { name: "Hyades Sector AA-P b6-2", power: null },
  { name: "Hyades Sector BB-O b7-1", power: "Edmund Mahon" },
  { name: "Hyades Sector CC-N b8-0", power: "Yuri Grom" },
];

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.useFakeTimers();
  fetchMock = vi.fn(async (url: string) => ({ ok: true, json: async () => (decodeURIComponent(url).includes("hya") ? HYADES : []) }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const input = () => screen.getByRole("combobox") as HTMLInputElement;
const type = (text: string) => fireEvent.change(input(), { target: { value: text } });
const wait = (ms = 250) => act(async () => void vi.advanceTimersByTime(ms));
const options = () => screen.queryAllByRole("option").map((o) => o.textContent);

function setup(defaultValue = "") {
  const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
  const utils = render(
    <form onSubmit={onSubmit}>
      <SystemInput name="ref" label="Reference system" defaultValue={defaultValue} placeholder="e.g. Sol" />
      <button type="submit">go</button>
    </form>,
  );
  const form = utils.container.querySelector("form")!;
  return { onSubmit, value: () => new FormData(form).get("ref") };
}
function focusAndType(text: string) {
  fireEvent.focus(input());
  type(text);
}

describe("SystemInput", () => {
  it("offers matching systems after a short pause, with the controlling power", async () => {
    setup();
    focusAndType("hya");
    expect(fetchMock).not.toHaveBeenCalled(); // not on every key
    await wait();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/systems?q=hya");
    expect(options()).toEqual(["Hyades Sector AA-P b6-2", "Hyades Sector BB-O b7-1Edmund Mahon", "Hyades Sector CC-N b8-0Yuri Grom"]);
  });

  it("asks once for a burst of typing, using the latest text", async () => {
    setup();
    fireEvent.focus(input());
    for (const t of ["hy", "hya", "hyad"]) {
      type(t);
      await wait(100);
    }
    await wait(250);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/systems?q=hyad");
  });

  it("is a plain text box when the suggestions fail", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const { value } = setup();
    focusAndType("hya");
    await wait();
    expect(screen.queryByRole("listbox")).toBeNull();
    type("Sol");
    expect(value()).toBe("Sol");
    fetchMock.mockResolvedValue({ ok: false, json: async () => [] }); // a 429 or 503
    type("hyades");
    await wait();
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  describe("choosing", () => {
    it("fills the box with the system clicked, and closes the list", async () => {
      const { value } = setup();
      focusAndType("hya");
      await wait();
      fireEvent.mouseDown(screen.getByText("Hyades Sector BB-O b7-1"));
      expect(value()).toBe("Hyades Sector BB-O b7-1");
      expect(screen.queryByRole("listbox")).toBeNull();
    });

  });

});
