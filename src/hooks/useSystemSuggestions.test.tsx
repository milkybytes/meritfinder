// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSystemSuggestions } from "./useSystemSuggestions";

const SOL = [{ name: "Sol", power: "Jerome Archer" }];

let fetchMock: ReturnType<typeof vi.fn>;
let onList: ReturnType<typeof vi.fn<(list: unknown[], typed: string) => void>>;
beforeEach(() => {
  vi.useFakeTimers();
  fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => SOL });
  vi.stubGlobal("fetch", fetchMock);
  onList = vi.fn<(list: unknown[], typed: string) => void>();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const setup = () => renderHook(() => useSystemSuggestions(onList)).result;
const settle = () => act(() => vi.advanceTimersByTimeAsync(250));

describe("useSystemSuggestions", () => {
  it("waits for the typing to stop, then asks for what was typed", async () => {
    const hook = setup();
    act(() => hook.current.lookup("So"));
    act(() => hook.current.lookup("Sol"));
    expect(fetchMock).not.toHaveBeenCalled();
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/systems?q=Sol");
    expect(onList).toHaveBeenCalledWith(SOL, "Sol");
  });

  it("does not ask for text that is too short, and gives an empty list", () => {
    const hook = setup();
    act(() => hook.current.lookup(" S "));
    expect(onList).toHaveBeenCalledWith([], " S ");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers text it has seen from memory, in any case", async () => {
    const hook = setup();
    act(() => hook.current.lookup("Sol"));
    await settle();
    onList.mockClear();
    act(() => hook.current.lookup("SOL"));
    expect(onList).toHaveBeenCalledWith(SOL, "SOL");
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

});
