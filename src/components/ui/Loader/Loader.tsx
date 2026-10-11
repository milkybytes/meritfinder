import { EDLoader } from "./EDLoader";

// The loading state shown while a search runs (the Suspense fallback in app/page.tsx).
export function Loader({ label = "Scanning" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-4 px-4 py-14" role="status" aria-live="polite">
      <EDLoader size={96} style={{ filter: "drop-shadow(0 0 10px color-mix(in srgb, var(--accent) 55%, transparent))" }} />
      <p className="font-display text-[0.8rem] font-semibold uppercase tracking-[0.3em] text-accent" aria-hidden="true">
        {label}
      </p>
      <span className="sr-only">Loading results</span>
    </div>
  );
}
