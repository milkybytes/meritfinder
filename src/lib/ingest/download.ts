import { once } from "node:events";
import { PassThrough, Readable } from "node:stream";

class DumpChangedError extends Error {}

// Says who is asking, so the dump's host can tell this from a scraper.
export const USER_AGENT = "meritfinder/0.1 (personal Elite Dangerous Powerplay tool; downloads the dump by hand, rarely)";

// Streams `url` as one byte stream, resuming with Range requests if the connection drops. If the file changes on the server mid-download (Spansh
// regenerates dumps hourly) the resume fails with an error instead of splicing two files.
export function resumableDownload(url: string, opts: { retries?: number; retryDelayMs?: number; log?: (m: string) => void } = {}): Readable {
  const { retries = 8, retryDelayMs = 2000, log = console.warn } = opts;
  const out = new PassThrough();

  (async () => {
    let received = 0;
    let etag: string | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const headers: Record<string, string> = { "User-Agent": USER_AGENT };
        if (received > 0) {
          headers.Range = `bytes=${received}-`;
          if (etag) headers["If-Range"] = etag;
        }
        const res = await fetch(url, { headers });
        // Asked to resume past the end: the previous attempt had in fact received everything.
        if (res.status === 416 && received > 0) return void out.end();
        if (received > 0 && res.status !== 206) throw new DumpChangedError("the dump changed on the server during download; run the ingest again");
        if (!res.ok || !res.body) throw new Error(`download failed: HTTP ${res.status}`);
        etag ??= res.headers.get("etag");

        for await (const chunk of Readable.fromWeb(res.body as never)) {
          received += (chunk as Buffer).length;
          if (!out.write(chunk)) await once(out, "drain");
        }
        return void out.end();
      } catch (e) {
        if (e instanceof DumpChangedError || attempt === retries) return void out.destroy(e as Error);
        log(`download interrupted after ${received} bytes (${(e as Error).message}); resuming, attempt ${attempt + 1}/${retries}`);
        await new Promise((r) => setTimeout(r, retryDelayMs * (attempt + 1)));
      }
    }
  })();

  return out;
}
