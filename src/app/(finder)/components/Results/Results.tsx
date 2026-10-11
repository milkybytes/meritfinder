"use client";

import { Button } from "@/components/ui/Button";
import { Loader } from "@/components/ui/Loader/Loader";
import { useSearchResults } from "@/hooks/useSearchResults";
import type { SearchParams } from "@/lib/search/search";

import { ResultsSummary } from "./ResultsSummary";
import { ResultsTable } from "./ResultsTable/ResultsTable";

// The results of this query: a loader while they load, then the table, or a message with a retry (see useSearchResults).
// page.tsx gives it a new key for each search.
export function Results({ p, query }: { p: SearchParams; query: string }) {
  const { state, retry } = useSearchResults(query);

  if (state.status === "loading") return <Loader label="Scanning" />;

  if (state.status === "failed") {
    return (
      <div className="mt-6 text-sm text-warn" role="alert">
        <p>{state.message}</p>
        <Button type="button" className="mt-3" onClick={retry}>
          Try again
        </Button>
      </div>
    );
  }

  const { res } = state;
  if (!res.ref) {
    return (
      <p className="mt-6 text-sm text-warn">
        Reference system &ldquo;{p.ref}&rdquo; not found. Only systems with a station market are in the data.
      </p>
    );
  }

  return (
    <section className="mt-8">
      <ResultsSummary count={res.rows.length} truncated={res.truncated} partial={res.partial} refName={res.ref.name} params={p} />
      <ResultsTable rows={res.rows} />
    </section>
  );
}
