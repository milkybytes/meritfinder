import { suggestSystems } from "@/lib/search/suggest";

// Reference-system suggestions: GET /api/systems?q=hya returns up to ten { name, power }. The answer depends only on the
// text and on which build of the database is live, so a CDN or the browser may keep it for a while.
export function GET(request: Request) {
  try {
    const items = suggestSystems(new URL(request.url).searchParams.get("q"));
    return Response.json(items, { headers: { "Cache-Control": "public, max-age=60, s-maxage=3600" } });
  } catch {
    return Response.json([], { status: 503, headers: { "Cache-Control": "no-store" } }); // say nothing about why
  }
}
