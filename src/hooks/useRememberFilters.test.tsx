// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FILTERS_STORAGE_KEY, useRememberFilters } from "./useRememberFilters";

// Next's hooks, standing in for the address bar: `url` is the query string the page was opened with.
let url = "";
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(url),
  useRouter: () => ({ replace }),
}));

// A component that does nothing but use the hook.
function Probe() {
  useRememberFilters();
  return null;
}

const stored = () => localStorage.getItem(FILTERS_STORAGE_KEY);
const visit = (query: string) => {
  url = query;
  return render(<Probe />);
};

beforeEach(() => {
  localStorage.clear();
  replace.mockClear();
  url = "";
});
afterEach(() => vi.restoreAllMocks());

describe("useRememberFilters", () => {
  describe("saving", () => {
    it("remembers a search: everything in the address, not just the reference system", () => {
      visit("ref=Sol&range=120&goal=reinforce&power=Yuri+Grom&commodity=Gold&commodity=Silver&method=laser&limit=50");
      expect(new URLSearchParams(stored()!).getAll("commodity")).toEqual(["Gold", "Silver"]);
      expect(new URLSearchParams(stored()!).get("power")).toBe("Yuri Grom");
      expect(new URLSearchParams(stored()!).get("range")).toBe("120");
      expect(replace).not.toHaveBeenCalled();
    });

    it("does not save an address that is not a search", () => {
      visit("range=50&goal=acquire"); // no reference system
      expect(stored()).toBeNull();
      visit("ref=&range=50"); // an empty one
      expect(stored()).toBeNull();
    });
  });

  describe("restoring", () => {
    it("loads the saved search when the page is opened with no search", () => {
      localStorage.setItem(FILTERS_STORAGE_KEY, "ref=Sol&range=120&commodity=Gold");
      visit("");
      expect(replace).toHaveBeenCalledWith("/?ref=Sol&range=120&commodity=Gold");
    });

    it("never overrides an address that already says what to show", () => {
      localStorage.setItem(FILTERS_STORAGE_KEY, "ref=Sol&range=120");
      visit("ref=Sirius&range=5");
      expect(replace).not.toHaveBeenCalled();
      expect(stored()).toBe("ref=Sirius&range=5"); // and it becomes the one remembered
    });

  });

});
