import { useEffect, useState } from "react";

import type { LiveStatus } from "@/lib/eddn/status";

const REFRESH_MS = 15_000;

// Whether live updates are arriving: starts from what the server saw, then asks /api/live every 15 s.
export function useLiveStatus(initial: LiveStatus): LiveStatus {
  const [status, setStatus] = useState(initial);

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const res = await fetch("/api/live");
        if (res.ok) setStatus((await res.json()) as LiveStatus);
      } catch {
        // offline: keep showing the last answer
      }
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  return status;
}
