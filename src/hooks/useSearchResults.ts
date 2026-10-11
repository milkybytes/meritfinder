import { useCallback, useEffect, useState } from "react";

import type { SearchResult } from "@/lib/search/search";

export const SEARCH_TIMEOUT_MS = 45_000;

export type SearchState = { status: "loading" } | { status: "done"; res: SearchResult } | { status: "failed"; message: string };

// Asks /api/search for a query's results, ending in a state the page can show: loading, done, or failed (`retry` clears it), including after
// SEARCH_TIMEOUT_MS. A new query or unmounting cancels the request.
export function useSearchResults(query: string): { state: SearchState; retry: () => void } {
  const [state, setState] = useState<SearchState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // The request starts a moment later, not now: in development React runs this effect, undoes it and runs it again at once,
    // and without the wait the first request would be sent and cancelled, which looks like a failed search.
    const start = setTimeout(() => {
      timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, SEARCH_TIMEOUT_MS);
      fetch(`/api/search?${query}`, { signal: controller.signal })
        .then(async (r) => {
          if (r.status === 429) throw new Error("Too many searches. Wait a moment and try again.");
          if (!r.ok) throw new Error("The search failed. Try again.");
          return (await r.json()) as SearchResult;
        })
        .then((res) => setState({ status: "done", res }))
        .catch((e: unknown) => {
          if (controller.signal.aborted && !timedOut) return; // a newer search replaced this one
          setState({ status: "failed", message: e instanceof Error && e.name !== "AbortError" ? e.message : "The search took too long. Narrow it down and try again." });
        })
        .finally(() => clearTimeout(timer));
    }, 0);
    return () => {
      clearTimeout(start);
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, attempt]);

  return { state, retry };
}
