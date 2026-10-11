import { useEffect, useRef } from "react";

export interface Suggestion {
  name: string;
  power: string | null;
}

export const MIN_CHARS = 2;
const DEBOUNCE_MS = 200;

// Looks up systems starting with the typed text (/api/systems) once typing pauses, and hands the list to `onList` (empty for text that is too short).
// Answers are remembered; typing again, `cancel` or unmounting drops a lookup in flight.
export function useSystemSuggestions(onList: (list: Suggestion[], typed: string) => void): { lookup: (typed: string) => void; cancel: () => void } {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const request = useRef<AbortController | undefined>(undefined);
  const seen = useRef(new Map<string, Suggestion[]>());

  const cancel = () => {
    clearTimeout(timer.current);
    request.current?.abort();
  };
  useEffect(() => cancel, []);

  function lookup(typed: string) {
    cancel();
    const text = typed.trim();
    if (text.length < MIN_CHARS) return onList([], typed);
    const known = seen.current.get(text.toLowerCase());
    if (known) return onList(known, text);

    timer.current = setTimeout(async () => {
      const controller = new AbortController();
      request.current = controller;
      try {
        const res = await fetch(`/api/systems?q=${encodeURIComponent(text)}`, { signal: controller.signal });
        if (!res.ok) return;
        const list = (await res.json()) as Suggestion[];
        seen.current.set(text.toLowerCase(), list);
        onList(list, text);
      } catch {
        // aborted by newer typing, or offline: no suggestions, the box still works as a plain field
      }
    }, DEBOUNCE_MS);
  }

  return { lookup, cancel };
}
