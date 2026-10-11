import { databaseState } from "@/lib/db/db";
import { getLiveStatus } from "@/lib/eddn/status";
import { parseParams, type RawParams } from "@/lib/search/params";
import { meta } from "@/lib/search/search";

import { Header } from "../../components/common/Header/Header";

import { DatabaseProblem } from "./components/DatabaseNotice/DatabaseProblem";
import { PartialDatabaseBanner } from "./components/DatabaseNotice/PartialDatabaseBanner";
import { FilterPanel } from "./components/FilterPanel/FilterPanel";
import { Results } from "./components/Results/Results";

export const dynamic = "force-dynamic";

// The page, top to bottom: header, the search form, then the results (which the browser fetches from /api/search, behind a loader).
export default async function Home({ searchParams }: { searchParams: Promise<RawParams> }) {
  const state = databaseState();
  if (state !== "ok") return <DatabaseProblem state={state} />;

  const raw = await searchParams;
  const params = parseParams(raw);
  const info = meta();

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-[88rem] px-5 py-8 sm:px-10">
        <Header builtAt={info.builtAt} systemCount={info.systemCount} live={getLiveStatus()} />
        <PartialDatabaseBanner systemCount={info.systemCount} />
        {/* Keys are per search, and different for the form and the results: siblings may not share one (React then duplicates elements).
            The fields keep what was typed into them, so they only follow the address if the form is rebuilt: a new search in the
            address (Reset, Back, a restored search, a shared link) is a new key. Without it the form shows old values over new results. */}
        <FilterPanel key={`form:${JSON.stringify(raw)}`} params={params} info={info} />
        {params.ref && (
          // key = the whole query, so each new search starts from the loader instead of holding the old results
          <Results key={`results:${JSON.stringify(raw)}`} p={params} query={queryString(raw)} />
        )}
      </main>
    </div>
  );
}

// The address's own query, handed to the results so they ask /api/search the same question.
function queryString(raw: RawParams): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) for (const v of Array.isArray(value) ? value : value === undefined ? [] : [value]) q.append(key, v);
  return q.toString();
}
