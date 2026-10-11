"use client";

import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";

// Copies `text` to the clipboard; the icon turns into a tick for a moment.
export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const { copy, done } = useCopyToClipboard();

  return (
    <button type="button" className="inline-flex size-6 flex-none items-center justify-center text-muted hover:text-accent" onClick={() => copy(text)} title={done ? "Copied" : `${label} "${text}"`} aria-label={`${label} ${text}`}>
      {done ? (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--good)" }}>
          <path d="M3 8.5l3.2 3L13 4.5" />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="5.5" y="5.5" width="8" height="8" />
          <path d="M10.5 5.5v-3h-8v8h3" />
        </svg>
      )}
    </button>
  );
}
