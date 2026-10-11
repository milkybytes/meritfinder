// @vitest-environment jsdom
import fs from "node:fs";

import { act, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/search/route";
import { SEARCH_TIMEOUT_MS } from "@/hooks/useSearchResults";
import { parseParams } from "@/lib/search/params";
import { buildFixtureDb } from "@/test/galaxy";

import { Results } from "./Results";

const { file, dir } = buildFixtureDb();
process.env.MERITFINDER_DB = file;
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const query = (raw: Record<string, string>) => new URLSearchParams({ goal: "undermine", power: "Edmund Mahon", pad: "S", maxAge: "", ...raw }).toString();
const show = (raw: Record<string, string>) => {
  const q = query(raw);
  return render(<Results p={parseParams(Object.fromEntries(new URLSearchParams(q)))} query={q} />);
};

// The browser's fetch, answered by the real API route (and so the real database).
const viaRoute = (url: string) => Promise.resolve(GET(new Request(`http://localhost${url}`)));

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn(viaRoute);
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Results", () => {
  it("shows the loader, then the systems found, from the real database", async () => {
    show({ ref: "Origin", range: "200" });
    expect(screen.getByRole("status")).toBeTruthy();
    expect(await screen.findByText(/systems within/)).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByText("Alpha")).toBeTruthy();
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/search?${query({ ref: "Origin", range: "200" })}`);
  });

  it("says the reference system was not found, and shows what was typed as plain text", async () => {
    const { container } = show({ ref: '<script>alert("x")</script>' });
    expect(await screen.findByText(/not found/)).toBeTruthy();
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain('<script>alert("x")</script>');
  });

  it("says so, with a way to try again, when the search fails; and shows the results when it then works", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 503 }));
    show({ ref: "Origin", range: "200" });
    expect((await screen.findByRole("alert")).textContent).toContain("The search failed");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByRole("status")).toBeTruthy(); // the loader again, while it runs
    expect(await screen.findByText(/systems within/)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up when the search never answers, instead of showing the loader for ever", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation((_url: string, init: RequestInit) => new Promise((_, reject) => init.signal!.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))));
    show({ ref: "Origin" });
    expect(screen.getByRole("status")).toBeTruthy();
    await act(() => vi.advanceTimersByTimeAsync(SEARCH_TIMEOUT_MS + 10));
    expect(screen.getByRole("alert").textContent).toContain("took too long");
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("asks for the results only once, even where React runs effects twice (development)", async () => {
    const q = query({ ref: "Origin", range: "200" });
    render(
      <StrictMode>
        <Results p={parseParams(Object.fromEntries(new URLSearchParams(q)))} query={q} />
      </StrictMode>,
    );
    await screen.findByText(/systems within/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

});
