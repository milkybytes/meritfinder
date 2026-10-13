// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LiveStatus as Status } from "@/lib/eddn/status";

import { LiveStatus } from "./LiveStatus";

const OFF: Status = { state: "off", heartbeatAt: null, updatedAt: null, startedAt: null, totals: null };
const LIVE: Status = { state: "live", heartbeatAt: "2026-10-12T08:00:00Z", updatedAt: "2026-10-12T08:00:00Z", startedAt: "2026-10-12T07:59:00Z", totals: { markets: 1, systems: 1, signals: 1 } };

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.useFakeTimers();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const state = () => screen.getByText(/EDDN|Live updates/).closest("[data-state]")!.getAttribute("data-state");

describe("LiveStatus", () => {
  it("starts from what the server saw and changes by itself when the listener comes up, with no refresh", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => LIVE });
    render(<LiveStatus initial={OFF} />);
    expect(state()).toBe("off");
    await act(() => vi.advanceTimersByTimeAsync(15_500));
    expect(fetchMock).toHaveBeenCalledWith("/api/live");
    expect(state()).toBe("live");
  });

  it("keeps the last answer while the check fails, and recovers on the next one", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ ok: true, json: async () => LIVE });
    render(<LiveStatus initial={OFF} />);
    await act(() => vi.advanceTimersByTimeAsync(15_500));
    expect(state()).toBe("off");
    await act(() => vi.advanceTimersByTimeAsync(15_000));
    expect(state()).toBe("live");
  });
});
