import { useEffect, useState } from "react";

import type { LiveStatus } from "@/lib/eddn/status";

const REFRESH_MS = 30_000;

// Whether live updates are arriving: starts from what the server saw, then asks /api/live every 30 s. `now` is the browser clock (null until mounted).
export function useLiveStatus(initial: LiveStatus): { status: LiveStatus; now: number | null } {
  const [status, setStatus] = useState(initial);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now()); // eslint-disable-line react-hooks/set-state-in-effect -- the browser's clock, known only after mount
    const timer = setInterval(async () => {
      setNow(Date.now());
      try {
        const res = await fetch("/api/live");
        if (res.ok) setStatus((await res.json()) as LiveStatus);
      } catch {
        // offline: keep showing the last answer, whose age keeps growing
      }
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  return { status, now };
}
