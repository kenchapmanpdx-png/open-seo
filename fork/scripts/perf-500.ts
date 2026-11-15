/**
 * Performance probe (B7 R1, WP43): serve a synthetic N-page site on
 * 127.0.0.1 and run the CLI engine on it with --max-pages N. Prints wall
 * time, per-collector timing, peak RSS and peak heap. No sidecar, no LLM.
 *
 * Site: home → 10 category pages → 49 detail pages each (N = 500), every
 * page ~25 KB of HTML with nav, JSON-LD, images and body copy, plus a
 * sitemap.xml and robots.txt.
 *
 *   pnpm exec tsx fork/scripts/perf-500.ts [--pages 500]
 */
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { runCliAudit } from "./handbook-audit";

const { values } = parseArgs({
  options: { pages: { type: "string", default: "500" } },
});
const total = Number(values.pages);
const CATEGORIES = 10;
const perCategory = Math.ceil((total - 1 - CATEGORIES) / CATEGORIES);

const paths = [
  "/",
  ...Array.from({ length: CATEGORIES }, (_, c) => `/c${c}/`),
  ...Array.from({ length: CATEGORIES }, (_, c) =>
    Array.from({ length: perCategory }, (_, i) => `/c${c}/item-${i}`),
  ).flat(),
].slice(0, total);

const filler = (seed: string) =>
  Array.from(
    { length: 40 },
    (_, i) =>
      `<p>${seed} paragraph ${i}: event planning, race-day logistics, venue hire and catering details for groups of every size, with dates and prices.</p>`,
  ).join("");

function page(origin: string, path: string): string {
  const c = path.match(/^\/c(\d+)\//)?.[1];
  const children =
    path === "/"
      ? Array.from({ length: CATEGORIES }, (_, i) => `/c${i}/`)
      : /^\/c\d+\/$/.test(path)
        ? paths.filter((p) => p.startsWith(path) && p !== path)
        : [];
  const nav = Array.from(
    { length: CATEGORIES },
    (_, i) => `<a href="/c${i}/">Category ${i}</a>`,
  ).join(" ");
  const title = path === "/" ? "Perf site home" : `Perf ${path} page`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${title} — Perf Site</title>
<meta name="description" content="Synthetic page ${path} for the handbook performance probe, category ${c ?? "none"}.">
<link rel="canonical" href="${origin}${path}">
<meta name="viewport" content="width=device-width,initial-scale=1">
<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    url: `${origin}${path}`,
  })}</script></head><body><header><nav>${nav}</nav></header>
<main><h1>${title}</h1>
<img src="/img/${path.replace(/\W/g, "_")}.jpg" alt="Photo for ${title}" width="800" height="600">
${filler(title)}
<ul>${children.map((p) => `<li><a href="${p}">${p}</a></li>`).join("")}</ul>
</main><footer><a href="/">Home</a> <a href="/c0/">Contact</a></footer></body></html>`;
}

const server = createServer((req, res) => {
  const origin = `http://${req.headers.host}`;
  const path = (req.url ?? "/").split("?")[0];
  if (path === "/robots.txt") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end(`User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
    return;
  }
  if (path === "/sitemap.xml") {
    res.writeHead(200, { "content-type": "application/xml" });
    res.end(
      `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths
        .map((p) => `<url><loc>${origin}${p}</loc></url>`)
        .join("")}</urlset>`,
    );
    return;
  }
  if (path.startsWith("/img/")) {
    res.writeHead(200, { "content-type": "image/jpeg" });
    res.end(Buffer.alloc(2048));
    return;
  }
  if (!paths.includes(path)) {
    res.writeHead(404, { "content-type": "text/html" });
    res.end("<!doctype html><title>Not found</title><h1>Not found</h1>");
    return;
  }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(page(origin, path));
});

await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
const { port } = server.address() as AddressInfo;
const origin = `http://127.0.0.1.nip.io:${port}`;

let peakRss = 0;
let peakHeap = 0;
const sample = () => {
  const m = process.memoryUsage();
  peakRss = Math.max(peakRss, m.rss);
  peakHeap = Math.max(peakHeap, m.heapUsed);
};
const poll = setInterval(sample, 100);
const started = Date.now();
try {
  const { report, timing } = await runCliAudit([
    origin,
    "--allow-private",
    "--mode",
    "AUDIT",
    "--max-pages",
    String(total),
    "--out",
    join("fork/runs/perf", `${total}-${new Date().toISOString().slice(0, 10)}`),
  ]);
  sample();
  const mb = (n: number) => `${Math.round(n / 1_048_576)} MB`;
  console.log(
    JSON.stringify(
      {
        pages: total,
        crawled: report.items.length > 0 ? "ok" : "none",
        findings: report.findings.length,
        wallMs: Date.now() - started,
        collectorMs: timing,
        peakRss: mb(peakRss),
        peakHeap: mb(peakHeap),
      },
      null,
      2,
    ),
  );
} finally {
  clearInterval(poll);
  server.close();
}
