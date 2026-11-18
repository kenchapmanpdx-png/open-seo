/**
 * Sidecar throughput probe (B8 R1): render N sitemap URLs of a live site at
 * client concurrency 1, 2 and 3 against the running K3 sidecar and print
 * renders/min plus per-render timing. Token comes from HANDBOOK_SIDECAR_TOKEN
 * or .env.local (loaded into this process, never printed).
 *
 *   pnpm exec tsx fork/scripts/sidecar-throughput.ts https://whyracingevents.com [--urls 12] [--sidecar http://127.0.0.1:4777]
 */
import { parseArgs } from "node:util";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    urls: { type: "string", default: "12" },
    sidecar: { type: "string", default: "http://127.0.0.1:4777" },
    concurrency: { type: "string", default: "1,2,3" },
  },
});
const origin = positionals[0];
if (!origin) throw new Error("usage: sidecar-throughput.ts <origin>");
if (!process.env.HANDBOOK_SIDECAR_TOKEN) {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // handled below
  }
}
const token = process.env.HANDBOOK_SIDECAR_TOKEN;
if (!token) throw new Error("HANDBOOK_SIDECAR_TOKEN missing");

async function sitemapUrls(): Promise<string[]> {
  const seen = new Set<string>();
  const queue = [`${origin}/sitemap.xml`];
  while (queue.length > 0 && seen.size < 500) {
    const res = await fetch(queue.shift()!);
    if (!res.ok) continue;
    const xml = await res.text();
    for (const [, loc] of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
      if (/sitemap[^/]*\.xml/.test(loc)) queue.push(loc);
      else seen.add(loc);
    }
  }
  return [...seen];
}

async function render(url: string) {
  const started = Date.now();
  const res = await fetch(`${values.sidecar}/render`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      url,
      javascript: true,
      viewport: "mobile",
      screenshot: "none",
      scrollToEnd: true,
    }),
  });
  const body = (await res.json()) as { html?: string; requests?: unknown[] };
  return {
    ok: res.ok,
    ms: Date.now() - started,
    htmlKb: Math.round((body.html?.length ?? 0) / 1024),
    requests: body.requests?.length ?? 0,
  };
}

const urls = (await sitemapUrls()).slice(0, Number(values.urls));
console.error(`urls ${urls.length}`);
const results = [];
for (const c of values.concurrency.split(",").map(Number)) {
  const pending = [...urls];
  const runs: Awaited<ReturnType<typeof render>>[] = [];
  const started = Date.now();
  await Promise.all(
    Array.from({ length: c }, async () => {
      for (let url = pending.shift(); url; url = pending.shift())
        runs.push(await render(url));
    }),
  );
  const wallMs = Date.now() - started;
  const ms = runs.map((r) => r.ms).sort((a, b) => a - b);
  results.push({
    concurrency: c,
    renders: runs.length,
    failed: runs.filter((r) => !r.ok).length,
    wallMs,
    rendersPerMin: Math.round((runs.length / wallMs) * 60_000 * 10) / 10,
    medianMs: ms[Math.floor(ms.length / 2)],
    maxMs: ms.at(-1),
  });
}
console.log(JSON.stringify(results, null, 2));
