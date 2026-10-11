import http from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { resumableDownload } from "./download";

const BODY = Buffer.from("0123456789".repeat(5000)); // 50,000 bytes
let server: http.Server | undefined;

afterEach(() => new Promise<void>((r) => (server ? server.close(() => r()) : r())));

// Serves BODY with Range/If-Range support. `dropAfter` cuts the first connection off after that many bytes.
function serve(opts: { dropAfter?: number; etag?: () => string } = {}): Promise<string> {
  let first = true;
  server = http.createServer((req, res) => {
    const etag = opts.etag ? opts.etag() : '"v1"';
    const range = /bytes=(\d+)-/.exec(req.headers.range ?? "");
    const ifRange = req.headers["if-range"];
    let start = range ? Number(range[1]) : 0;
    if (range && ifRange && ifRange !== etag) start = 0; // validator mismatch: send the whole (new) file with 200
    const partial = range && start > 0;
    if (partial && start >= BODY.length) {
      res.writeHead(416).end();
      return;
    }
    res.writeHead(partial ? 206 : 200, { ETag: etag, "Content-Length": BODY.length - start });
    const data = BODY.subarray(start);
    if (first && opts.dropAfter != null) {
      first = false;
      res.write(data.subarray(0, opts.dropAfter));
      setTimeout(() => res.destroy(), 20); // abrupt close mid-body
      return;
    }
    res.end(data);
  });
  return new Promise((resolve) => server!.listen(0, "127.0.0.1", () => resolve(`http://127.0.0.1:${(server!.address() as AddressInfo).port}/dump`)));
}

async function readAll(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(c as Buffer);
  return Buffer.concat(chunks);
}

const quiet = { retryDelayMs: 1, log: () => {} };

describe("resumableDownload", () => {

  it("resumes with a Range request after the connection drops mid-body, with no gap or duplicate", async () => {
    const url = await serve({ dropAfter: 12345 });
    expect((await readAll(resumableDownload(url, quiet))).equals(BODY)).toBe(true);
  });

  it("fails clearly instead of splicing files when the dump changes mid-download", async () => {
    let n = 0;
    const url = await serve({ dropAfter: 1000, etag: () => `"v${++n}"` }); // new validator on every request
    await expect(readAll(resumableDownload(url, quiet))).rejects.toThrow(/changed on the server/);
  });

  it("gives up after the retry limit", async () => {
    const url = "http://127.0.0.1:1/unreachable";
    await expect(readAll(resumableDownload(url, { retries: 1, ...quiet }))).rejects.toThrow();
  });
});
