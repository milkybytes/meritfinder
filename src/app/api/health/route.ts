import { databaseState } from "@/lib/db/db";

export const dynamic = "force-dynamic";

// For load balancers and uptime checks. Says only whether the app can serve searches; nothing about the machine or the data.
export function GET() {
  let ok = false;
  try {
    ok = databaseState() === "ok";
  } catch {
    // an unreadable database is the same as no database
  }
  return Response.json({ status: ok ? "ok" : "unavailable" }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
