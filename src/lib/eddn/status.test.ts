import { describe, expect, it } from "vitest";

import { liveStatusFrom, OFF } from "./status";
const NOW = Date.parse("2026-10-08T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const meta = (over: Record<string, string> = {}) => ({
  eddn_heartbeat: ago(10_000), eddn_updated: ago(5_000), eddn_started: ago(3_600_000), eddn_totals: JSON.stringify({ markets: 5, systems: 6, signals: 7 }), ...over,
});

describe("liveStatusFrom", () => {
  it("is live while the heartbeat is recent, with what has been applied since the listener started", () => {
    expect(liveStatusFrom(meta(), NOW)).toEqual({
      state: "live", heartbeatAt: ago(10_000), updatedAt: ago(5_000), startedAt: ago(3_600_000), totals: { markets: 5, systems: 6, signals: 7 },
    });
  });

  it("is live up to two minutes after the last heartbeat, delayed up to half an hour, then off", () => {
    expect(liveStatusFrom(meta({ eddn_heartbeat: ago(119_000) }), NOW).state).toBe("live");
    expect(liveStatusFrom(meta({ eddn_heartbeat: ago(121_000) }), NOW).state).toBe("delayed");
    expect(liveStatusFrom(meta({ eddn_heartbeat: ago(29 * 60_000) }), NOW).state).toBe("delayed");
    expect(liveStatusFrom(meta({ eddn_heartbeat: ago(31 * 60_000) }), NOW).state).toBe("off");
  });

  it("is off when the listener has never run, or said it stopped, but still knows when data last changed", () => {
    expect(liveStatusFrom({}, NOW)).toEqual(OFF);
    const stopped = liveStatusFrom({ eddn_updated: ago(60_000), eddn_started: ago(9e6), eddn_totals: JSON.stringify({ markets: 1, systems: 1, signals: 1 }) }, NOW);
    expect(stopped).toEqual({ state: "off", heartbeatAt: null, updatedAt: ago(60_000), startedAt: null, totals: null });
  });

});
