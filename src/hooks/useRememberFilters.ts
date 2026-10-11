"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export const FILTERS_STORAGE_KEY = "meritfinder.filters";
const MAX_LENGTH = 2000; // well inside what the server accepts

// Remembers the last search in this browser (localStorage; it never leaves the device) and restores it when the page is opened with no search in the
// address. Reset forgets it (see ResetLink).
export function useRememberFilters() {
  const params = useSearchParams();
  const router = useRouter();
  const query = params.toString();

  useEffect(() => {
    try {
      if (params.get("ref")) {
        if (query.length <= MAX_LENGTH) localStorage.setItem(FILTERS_STORAGE_KEY, query);
      } else if (query === "") {
        const saved = localStorage.getItem(FILTERS_STORAGE_KEY);
        if (saved && saved.length <= MAX_LENGTH && new URLSearchParams(saved).get("ref")) router.replace(`/?${saved}`);
      }
    } catch {
      // storage is unavailable (private mode, blocked): the form simply starts empty
    }
  }, [params, query, router]);
}
