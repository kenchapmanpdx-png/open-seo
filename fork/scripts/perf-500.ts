/**
 * Performance probe (B7 R1 WP43; WO-B9-026): serve a synthetic N-page site
 * and run the CLI engine on it with --max-pages N. Prints wall time,
 * per-collector timing, peak RSS and peak heap. No LLM; sidecar optional.
 *
 * Site: home → 20 section pages (/events/, /venues/ …) → detail pages (N - 21 split evenly). Each
 * category uses its own template (20 DOM skeletons + schema types), so the
 * template sampler and stratified fill see 20 templates. Every page ~25 KB
 * of HTML with nav, JSON-LD, images and body copy that varies per page, plus
 * sitemap.xml and robots.txt.
 *
 *   pnpm exec tsx fork/scripts/perf-500.ts [--pages 1000] [--depth full|quick] [--sidecar http://127.0.0.1:4777]
 */
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { runCliAudit } from "./handbook-audit";

const SECTIONS =
  "events venues catering tickets teams drivers tracks results news guides hospitality parking travel merch photos faq partners careers press offers".split(
    " ",
  );
const TEMPLATES = SECTIONS.length;
const SCHEMA_TYPES = [
  "WebPage",
  "Article",
  "Product",
  "Service",
  "Event",
  "FAQPage",
  "AboutPage",
  "ContactPage",
  "CollectionPage",
  "BlogPosting",
];
const WORDS =
  "event planning race-day logistics venue hire catering groups dates prices track paddock hospitality transport parking tickets weather schedule safety briefing timing results awards photography".split(
    " ",
  );

function sitePaths(total: number): string[] {
  const perCategory = Math.ceil((total - 1 - TEMPLATES) / TEMPLATES);
  return [
    "/",
    ...SECTIONS.map((s) => `/${s}/`),
    ...SECTIONS.map((s) =>
      Array.from({ length: perCategory }, (_, i) => `/${s}/${s}-${i}`),
    ).flat(),
  ].slice(0, total);
}

/** Deterministic per-page word mix so pages are not near-duplicates. */
function filler(seed: string): string {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const word = () => {
    h = (h * 1103515245 + 12345) >>> 0;
    return WORDS[h % WORDS.length];
  };
  return Array.from(
    { length: 40 },
    (_, i) =>
      `<p>${seed} section ${i}: ${Array.from({ length: 18 }, word).join(" ")}.</p>`,
  ).join("");
}

function page(origin: string, path: string, paths: string[]): string {
  const c = SECTIONS.indexOf(path.split("/")[1] ?? "");
  const children =
    path === "/"
      ? SECTIONS.map((s) => `/${s}/`)
      : /^\/[a-z]+\/$/.test(path)
        ? paths.filter((p) => p.startsWith(path) && p !== path)
        : [];
  const nav = SECTIONS.map((s) => `<a href="/${s}/">${s}</a>`).join(" ");
  const title = path === "/" ? "Perf site home" : `Perf ${path} page`;
  const type = c < 0 ? "WebPage" : SCHEMA_TYPES[c % SCHEMA_TYPES.length];
  // Template c: a distinct wrapper depth + class set per category.
  const open = Array.from(
    { length: (c % 5) + 1 },
    (_, d) => `<div class="t${c}-l${d} layout-${c % 4}">`,
  ).join("");
  const close = "</div>".repeat((c % 5) + 1);
  const aside =
    c % 3 === 0
      ? `<aside class="t${c}-aside"><h2>Related</h2><a href="/${SECTIONS[(c + 1) % TEMPLATES]}/">Next section</a></aside>`
      : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${title} — Perf Site</title>
<meta name="description" content="Synthetic page ${path} for the handbook performance probe, template ${c}.">
<link rel="canonical" href="${origin}${path}">
<meta name="viewport" content="width=device-width,initial-scale=1">
<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": type,
    name: title,
    url: `${origin}${path}`,
  })}</script></head><body class="tpl-${c}"><header><nav>${nav}</nav></header>
<main>${open}<h1>${title}</h1>
<img src="/img/${path.replace(/\W/g, "_")}.jpg" alt="Photo for ${title}" width="800" height="600">
${filler(title)}
<ul>${children.map((p) => `<li><a href="${p}">${p}</a></li>`).join("")}</ul>
${close}${aside}</main><footer><a href="/">Home</a> <a href="/faq/">FAQ</a></footer></body></html>`;
}

/** Serve the synthetic site; `host` "0.0.0.0" for the sidecar / in-app probe; port 0 = any. */
export async function startSyntheticSite(
  total: number,
  host = "127.0.0.1",
  port = 0,
): Promise<{ server: Server; port: number }> {
  const paths = sitePaths(total);
  const known = new Set(paths);
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
    if (!known.has(path)) {
      res.writeHead(404, { "content-type": "text/html" });
      res.end("<!doctype html><title>Not found</title><h1>Not found</h1>");
      return;
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(page(origin, path, paths));
  });
  await new Promise<void>((done) => server.listen(port, host, done));
  return { server, port: (server.address() as AddressInfo).port };
}

async function main() {
  const { values } = parseArgs({
    options: {
      pages: { type: "string", default: "500" },
      depth: { type: "string", default: "full" },
      sidecar: { type: "string" },
    },
  });
  const total = Number(values.pages);
  // --sidecar: bind 0.0.0.0 so the Docker sidecar reaches it (compose.badgeo.yaml maps 127.0.0.1.nip.io to the host gateway).
  const { server, port } = await startSyntheticSite(
    total,
    values.sidecar ? "0.0.0.0" : "127.0.0.1",
  );
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
      "--depth",
      values.depth,
      "--max-pages",
      String(total),
      ...(values.sidecar ? ["--sidecar", values.sidecar] : []),
      "--out",
      join(
        "fork/runs/perf",
        `${total}-${values.depth}-${new Date().toISOString().slice(0, 10)}`,
      ),
    ]);
    sample();
    const mb = (n: number) => `${Math.round(n / 1_048_576)} MB`;
    console.log(
      JSON.stringify(
        {
          pages: total,
          depth: values.depth,
          sidecar: Boolean(values.sidecar),
          coverage: report.run.coverage ?? null,
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
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
