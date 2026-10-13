import fs from "node:fs";
import zlib from "node:zlib";

import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fssBodySignals, jumpToUnoccupiedSystem, marketMessage , SYMBOLS } from "../../test/eddn-messages";
import { buildFixtureDb } from "../../test/galaxy";

import { runListener } from "./listener";
let built: { file: string; dir: string };
beforeEach(() => {
  built = buildFixtureDb();
});
afterEach(() => fs.rmSync(built.dir, { recursive: true, force: true }));

const pack = (m: unknown) => zlib.deflateSync(JSON.stringify(m));
async function* feed(...items: (object | Uint8Array)[]) {
  for (const i of items) yield i instanceof Uint8Array ? i : pack(i);
}
const open = () => new Database(built.file);
const stationRow = (id: number) => {
  const db = open();
  try {
    return db.prepare("SELECT market_updated, best_price FROM stations WHERE id = ?").get(id) as { market_updated: string; best_price: number };
  } finally {
    db.close();
  }
};
const FRESH = (offsetMs = 0) => new Date(Date.now() - 60_000 + offsetMs).toISOString();
const market = (marketId: number, timestamp: string, price: number) => marketMessage({ marketId, timestamp, commodities: [{ name: "monazite", sellPrice: price, demand: 5 }] });

describe("runListener", () => {
  it("writes valid updates to the database, and says what happened to everything else", async () => {
    const stats = await runListener({
      symbols: SYMBOLS,
      source: feed(market(20, FRESH(), 700_000), jumpToUnoccupiedSystem({ SystemAddress: 2, timestamp: FRESH() }), fssBodySignals({ SystemAddress: 2, BodyID: 3 }), { $schemaRef: "https://eddn.edcd.io/schemas/outfitting/2", message: {} }),
      openDb: open,
    });
    expect(stats.received).toBe(4);
    expect(stats.accepted).toMatchObject({ market: 1, system: 1, signals: 1 });
    expect(stats.skipped).toEqual({ schema: 1 });
    expect(stats.applied).toMatchObject({ markets: 1, systems: 1, signals: 1 });
    expect(stationRow(20).best_price).toBe(700_000);
  });

  it("says which symbols it had no name for, so their names can be looked for", async () => {
    const unknown: string[][] = [];
    const msg = marketMessage({ marketId: 3225348096, timestamp: FRESH(), commodities: [{ name: "newthing", sellPrice: 100, demand: 5 }] });
    await runListener({ source: feed(msg), symbols: SYMBOLS, onUnknown: (s) => unknown.push(s), flushMs: 1_000_000 });
    expect(unknown).toEqual([["newthing"]]);
  });

  it("does not let a system message without Powerplay information replace one that has it", async () => {
    const jump = (over: object) => jumpToUnoccupiedSystem({ SystemAddress: 4999999999, timestamp: FRESH(), ...over });
    await runListener({
      source: feed(jump({}), jump({ timestamp: FRESH(5_000), Powers: undefined, PowerplayState: undefined, PowerplayConflictProgress: undefined })),
      symbols: SYMBOLS,
      openDb: open,
    }).then((s) => expect(s.accepted.system).toBe(2));
    const db = open();
    try {
      expect(db.prepare("SELECT power_state FROM systems WHERE id64 = 4999999999").get()).toMatchObject({ power_state: "Unoccupied" });
    } finally {
      db.close();
    }
  });

  it("drops an update the database refuses and writes the rest of its batch", async () => {
    const db = open();
    db.exec("CREATE TRIGGER poison BEFORE INSERT ON market WHEN NEW.sell_price = 666 BEGIN SELECT RAISE(ABORT, 'poison'); END");
    db.close();
    const log = vi.fn();
    const stats = await runListener({ symbols: SYMBOLS, source: feed(market(20, FRESH(-1000), 666), market(30, FRESH(-500), 4_321)), openDb: open, log });
    expect(stats.rejected).toBe(1);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("dropped a market update"));
    expect(stationRow(30).best_price).toBe(4_321); // written, though it was in the same batch
    expect(stationRow(20).best_price).not.toBe(666);
  });

  it("copes with garbage: bytes that are not compressed, text that is not JSON, and a compression bomb", async () => {
    // a perfectly valid market update, padded to 6 MB once opened: only the size limit can refuse it
    const bomb = zlib.deflateSync(JSON.stringify({ ...market(40, FRESH(), 456_789), padding: "x".repeat(6_000_000) }));
    const stats = await runListener({
      symbols: SYMBOLS,
      source: feed(Buffer.from("not compressed at all"), zlib.deflateSync("{not json"), zlib.deflateSync("[1,2"), bomb, market(20, FRESH(), 1_000)),
      openDb: open,
    });
    expect(stats.skipped.malformed).toBe(4);
    expect(stats.applied.markets).toBe(1); // and carried on to the good message
    expect(stationRow(40).best_price).not.toBe(456_789); // the oversize one was not used
  });

  it("keeps the newest observation of a market, whichever arrives last", async () => {
    await runListener({ symbols: SYMBOLS, source: feed(market(20, FRESH(-1000), 111_111), market(20, FRESH(-60_000), 222_222)), openDb: open }); // the older one arrives second
    expect(stationRow(20).best_price).toBe(111_111);
  });

  it("writes in batches, as soon as enough distinct updates are waiting, and once more at the end", async () => {
    const stats = await runListener({
      symbols: SYMBOLS,
      source: feed(market(20, FRESH(), 1_000), market(30, FRESH(), 2_000), market(40, FRESH(), 3_000)),
      openDb: open,
      maxBatch: 2,
    });
    expect(stats.flushes).toBe(2); // two distinct markets fill a batch; the third goes at the end
    expect(stats.applied.markets).toBe(3);
  });

  it("keeps what it could not write and tries again, rather than losing it", async () => {
    let attempts = 0;
    const log = vi.fn();
    const stats = await runListener({
      symbols: SYMBOLS,
      source: feed(market(20, FRESH(), 5_000), market(30, FRESH(), 6_000)),
      openDb: () => {
        if (++attempts <= 2) throw new Error("database is locked"); // the first is the heartbeat on the first message, the second the first write
        return open();
      },
      maxBatch: 1, // the first message fails to write; the second flush retries both
      log,
    });
    expect(stats.flushErrors).toBe(1);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("database is locked"));
    expect(stats.applied.markets).toBe(2);
    expect(stationRow(20).best_price).toBe(5_000);
  });

  it("a dry run reads and counts but writes nothing", async () => {
    const before = stationRow(20);
    const stats = await runListener({ symbols: SYMBOLS, source: feed(market(20, FRESH(), 9_999_999)) });
    expect(stats.accepted.market).toBe(1);
    expect(stats.flushes).toBe(0);
    expect(stationRow(20)).toEqual(before);
  });

  it("stops reading when told to, after writing what it has", async () => {
    const controller = new AbortController();
    async function* endless() {
      yield pack(market(20, FRESH(), 8_000));
      controller.abort();
      for (;;) yield pack(market(30, FRESH(), 1)); // would never end
    }
    const stats = await runListener({ symbols: SYMBOLS, source: endless(), openDb: open, signal: controller.signal });
    expect(stats.received).toBeLessThan(5);
    expect(stationRow(20).best_price).toBe(8_000);
  });

});

describe("runListener: the heartbeat", () => {
  const metaRow = (key: string) => {
    const db = open();
    try {
      return (db.prepare("SELECT value FROM meta WHERE key = ?").get(key) as { value: string } | undefined)?.value;
    } finally {
      db.close();
    }
  };

  async function* oneThenQuiet(gate: Promise<void>) {
    yield pack(market(20, FRESH(), 7_000));
    await gate;
  }

  it("is recorded while messages are arriving, with what has been applied, and removed when the listener stops", async () => {
    vi.useFakeTimers();
    try {
      let release: () => void = () => {};
      const gate = new Promise<void>((r) => (release = r));
      const done = runListener({ symbols: SYMBOLS, source: oneThenQuiet(gate), openDb: open, flushMs: 1000, heartbeatMs: 2000 });
      await vi.advanceTimersByTimeAsync(2500);
      expect(metaRow("eddn_heartbeat")).toBeDefined();
      expect(JSON.parse(metaRow("eddn_totals")!)).toEqual({ markets: 1, systems: 0, signals: 0 });
      expect(metaRow("eddn_started")).toBeDefined();
      release();
      await done;
      expect(metaRow("eddn_heartbeat")).toBeUndefined(); // stopped: the page says so at once
    } finally {
      vi.useRealTimers();
    }
  });

});

describe("runListener: the report", () => {
  it("hands over the running totals on its interval, and stops when the listener does", async () => {
    vi.useFakeTimers();
    try {
      const seen: number[] = [];
      let release: () => void = () => {};
      const gate = new Promise<void>((r) => (release = r));
      async function* oneThenQuiet() {
        yield pack(market(20, FRESH(), 7_000));
        await gate;
      }
      const done = runListener({ symbols: SYMBOLS, source: oneThenQuiet(), openDb: open, flushMs: 1000, reportMs: 5000, report: (s) => seen.push(s.received) });
      await vi.advanceTimersByTimeAsync(11_000);
      expect(seen).toEqual([1, 1]);
      release();
      await done;
      await vi.advanceTimersByTimeAsync(20_000);
      expect(seen).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
