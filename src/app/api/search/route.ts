import { cachedSearch } from "@/lib/search/cached";
import { parseParams, type RawParams } from "@/lib/search/params";

// The search itself: GET /api/search?<the same query as the page> returns the SearchResult as JSON. The page asks for it with
// fetch, so the results never depend on the page's own streaming, and a slow or failed search is an answer the page can show.
export function GET(request: Request) {
  try {
    const raw: RawParams = {};
    for (const key of new Set(new URL(request.url).searchParams.keys())) raw[key] = new URL(request.url).searchParams.getAll(key);
    return Response.json(cachedSearch(parseParams(raw)));
  } catch {
    return Response.json({ error: "search failed" }, { status: 503, headers: { "Cache-Control": "no-store" } }); // say nothing about why
  }
}
