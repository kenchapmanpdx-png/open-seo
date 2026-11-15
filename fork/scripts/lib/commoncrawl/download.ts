// Ported from Canonry/canonry@4b91e077 packages/integration-commoncrawl/src/downloader.ts — MIT, © 2026 Arber X and contributors
// Licensed under the MIT License (https://opensource.org/licenses/MIT).
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import type { ReadableStream } from "node:stream/web";
import { pipeline } from "node:stream/promises";
import { parseContentLength } from "./release-discovery";

export interface DownloadResult {
  bytes: number;
  sha256: string;
  cached: boolean;
  elapsedMs: number;
}

/**
 * Download `url` to `destPath` via `<dest>.partial` + rename, with a
 * `<dest>.sha256` sidecar. An existing complete file is reused (idempotent per
 * release); an interrupted download restarts from zero.
 */
export async function downloadFile(opts: {
  url: string;
  destPath: string;
  onProgress?: (bytesSoFar: number, totalBytes: number | null) => void;
  fetchImpl?: typeof fetch;
}): Promise<DownloadResult> {
  const start = Date.now();
  const fetchImpl = opts.fetchImpl ?? fetch;
  const sidecarPath = `${opts.destPath}.sha256`;

  const existing = await fs.stat(opts.destPath).catch(() => null);
  if (existing) {
    const sidecar = await readSidecar(sidecarPath);
    const sha256 = sidecar ?? (await hashFile(opts.destPath));
    if (!sidecar) await fs.writeFile(sidecarPath, `${sha256}\n`);
    return {
      bytes: existing.size,
      sha256,
      cached: true,
      elapsedMs: Date.now() - start,
    };
  }

  const partialPath = `${opts.destPath}.partial`;
  await fs.mkdir(path.dirname(opts.destPath), { recursive: true });
  await fs.rm(partialPath, { force: true });

  const res = await fetchImpl(opts.url);
  if (!res.ok || !res.body) {
    throw new Error(`HTTP ${res.status} ${res.statusText} for ${opts.url}`);
  }

  const total = parseContentLength(res.headers.get("content-length"));
  const hasher = createHash("sha256");
  let bytes = 0;
  const hashAndCount = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      hasher.update(chunk);
      bytes += chunk.length;
      opts.onProgress?.(bytes, total);
      cb(null, chunk);
    },
  });

  await pipeline(
    // eslint-disable-next-line typescript/no-unsafe-type-assertion -- DOM vs node:stream/web ReadableStream types
    Readable.fromWeb(res.body as ReadableStream<Uint8Array>),
    hashAndCount,
    createWriteStream(partialPath),
  );

  const sha256 = hasher.digest("hex");
  await fs.rename(partialPath, opts.destPath);
  await fs.writeFile(sidecarPath, `${sha256}\n`);
  return { bytes, sha256, cached: false, elapsedMs: Date.now() - start };
}

async function hashFile(filePath: string): Promise<string> {
  const hasher = createHash("sha256");
  const handle = await fs.open(filePath, "r");
  try {
    for await (const chunk of handle.createReadStream()) hasher.update(chunk);
  } finally {
    await handle.close();
  }
  return hasher.digest("hex");
}

async function readSidecar(sidecarPath: string): Promise<string | null> {
  const raw = await fs.readFile(sidecarPath, "utf8").catch(() => null);
  const trimmed = raw?.trim() ?? "";
  return /^[0-9a-f]{64}$/i.test(trimmed) ? trimmed.toLowerCase() : null;
}
