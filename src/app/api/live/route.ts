import { getLiveStatus } from "@/lib/eddn/status";

export const dynamic = "force-dynamic";

// Whether live updates are arriving (see lib/eddn/status.ts), for the indicator in the page header to refresh itself.
// Kept for ten seconds at most by anything in between: it is meant to be current.
export function GET() {
  return Response.json(getLiveStatus(), { headers: { "Cache-Control": "public, max-age=10, s-maxage=10" } });
}
