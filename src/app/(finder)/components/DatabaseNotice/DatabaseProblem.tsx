import type { DatabaseState } from "@/lib/db/db";

// Shown instead of the app when there is no usable database.
export function DatabaseProblem({ state }: { state: Exclude<DatabaseState, "ok"> }) {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="font-display text-3xl font-semibold">meritfinder</h1>
      <p className="mt-4">
        {state === "missing" ? (
          <>
            No database yet. Run <code>npm run ingest</code> first.
          </>
        ) : state === "unreadable" ? (
          <>
            The database cannot be read right now. This usually means the live-update listener was stopped in the middle of a write. Start it again
            (<code>npm run eddn-listener</code>): it repairs the file as it starts. If it is already restarting, reload in a minute.
          </>
        ) : (
          <>
            The database does not match this version of the app. Run <code>npm run db:migrate</code> to update it, or <code>npm run ingest -- --force</code> to rebuild it.
          </>
        )}
      </p>
    </main>
  );
}
