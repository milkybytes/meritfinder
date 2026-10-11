"use client";

import { Button } from "@/components/ui/Button";

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="font-display text-3xl font-semibold">Something went wrong</h1>
      <p className="mt-4 text-muted">The search could not be completed. Try again, or change the search.</p>
      {error.digest && <p className="font-mono tabular-nums mt-2 text-xs text-muted">Reference: {error.digest}</p>}
      <Button type="button" className="mt-6" onClick={() => retry()}>
        Try again
      </Button>
    </main>
  );
}
