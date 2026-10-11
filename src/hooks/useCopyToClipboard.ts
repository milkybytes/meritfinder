import { useState } from "react";

const SHOWN_MS = 1200;

// Copies text to the clipboard, and says for a moment afterwards that it did (`done`), for a tick to replace the copy icon.
export function useCopyToClipboard(): { copy: (text: string) => Promise<void>; done: boolean } {
  const [done, setDone] = useState(false);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // clipboard API unavailable (insecure context): fall back to a hidden textarea
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setDone(true);
    setTimeout(() => setDone(false), SHOWN_MS);
  };

  return { copy, done };
}
