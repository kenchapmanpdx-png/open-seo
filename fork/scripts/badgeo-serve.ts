/**
 * BadGEO static server (B1 R4): serves fork/fixtures/badgeo on 127.0.0.1,
 * applies per-path headers from `_headers.json`, answers 403 to the user-agent
 * tokens `_bots.json` lists for a path (bot-parity fixtures; `{ challenge200 }`
 * entries get a 200 openresty-style bot-check page instead; with `every: N`
 * only the 1st, N+1th, … matching request is challenged), answers the
 * redirects `_redirects.json` lists (path → [status, location]), substitutes
 * `{{ORIGIN}}` in text files, 404 for anything missing. `{{OFFSITE}}` names
 * a second stub host (WO-B9-012): `/gone/*` → 404, anything else → 200.
 *
 *   pnpm exec tsx fork/scripts/badgeo-serve.ts [--port 4455]
 */
import { createServer } from "node:http";
import { crc32, deflateSync } from "node:zlib";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import type { AddressInfo } from "node:net";
import { parseArgs } from "node:util";
import { z } from "zod";

export const BADGEO_ROOT = resolve("fork/fixtures/badgeo");

const headersSchema = z.record(z.string(), z.record(z.string(), z.string()));
/** Path → UA tokens answered 403, or `{ challenge200 }` tokens answered with a 200 bot-check page (WO-B9-008). */
const botsSchema = z.record(
  z.string(),
  z.union([
    z.array(z.string()),
    z.object({
      challenge200: z.array(z.string()),
      /** Challenge only every Nth matching request (1st, N+1th, …): intermittent (WO-B9-009). */
      every: z.number().int().min(1).optional(),
    }),
  ]),
);

/** openresty-style interstitial (bluetreefunding F01): 200, ~9 words, reload after 5 s, no canonical. */
const CHALLENGE_PAGE =
  "<!doctype html><html><head><title>One moment, please...</title></head><body><h1>One moment, please...</h1><p>Please wait while your request is being verified...</p><script>setTimeout(function(){location.reload()},5000)</script></body></html>";
const redirectsSchema = z.record(
  z.string(),
  z.tuple([z.number().int(), z.string()]),
);

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".json": "application/json",
  ".md": "text/markdown; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

function resolveFile(pathname: string): string | null {
  const safe = normalize(decodeURIComponent(pathname)).replace(
    /^(\.\.[/\\])+/,
    "",
  );
  // Underscore files are harness config, not site content.
  if (safe.split("/").some((part) => part.startsWith("_"))) return null;
  const candidate = join(BADGEO_ROOT, safe);
  if (!candidate.startsWith(BADGEO_ROOT)) return null;
  if (existsSync(candidate) && statSync(candidate).isDirectory()) {
    const index = join(candidate, "index.html");
    return existsSync(index) ? index : null;
  }
  return existsSync(candidate) ? candidate : null;
}

const HEAVY_IMAGE = "/img/heavy-photo.png";
// WO-B9-032: media answered by headers only (sizes come from HEAD; bodies are never read).
const FAKE_VIDEO = "/media/big-loop.mp4";
const FAKE_VIDEO_BYTES = 12_000_000;
const VIDEO_THUMB = "/img/video-thumb.png";
const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/** Valid 1250×1250 RGBA PNG, stored uncompressed (~6.3 MB), so Chrome reads every byte. */
function heavyPng(): Buffer {
  const side = 1250;
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), body.length + 4);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(side, 0);
  header.writeUInt32BE(side, 4);
  header.set([8, 6, 0, 0, 0], 8);
  const stride = side * 4 + 1;
  const rows = Buffer.alloc(side * stride, 0x80);
  for (let y = 0; y < side; y += 1) rows[y * stride] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows, { level: 0 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** `/calendar/page/N/` (WO-B9-001 infinite-space guard): one clean page per N. */
const CALENDAR_PAGE = /^\/calendar\/page\/(\d+)\/$/;

function calendarHtml(origin: string, n: number): string {
  const title = `Race calendar page ${n} · BadGEO`;
  const description = `Race calendar page ${n} — BadGEO rule fixture page.`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, follow" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${origin}/calendar/page/${n}/" />
<meta property="og:image" content="${origin}/img/calendar-share.jpg" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<title>${title}</title><meta name="description" content="${description}" />
<link rel="canonical" href="/calendar/page/${n}/" />
<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${origin}/` },
      {
        "@type": "ListItem",
        position: 2,
        name: "Race calendar",
        item: `${origin}/calendar/`,
      },
      { "@type": "ListItem", position: 3, name: `Page ${n}` },
    ],
  })}</script></head>
<body><a href="#main">Skip to content</a>
<header><nav><a href="/">Home</a> <a href="/about/">About</a>
<a href="/events/">Events</a> <a href="/broken-jsonld.html">Broken</a>
<a href="/placeholder.html">Placeholder</a>
<a href="/no-headers.html">Headers</a>
<a href="/contact.html">Contact us</a></nav></header>
<main id="main"><h1>Race calendar page ${n}</h1>
<p>Races listed for calendar page ${n}.</p>
<p><a href="/calendar/">Back to the race calendar</a></p></main>
<footer><p>BadGEO fixture site.</p></footer></body></html>`;
}

/**
 * `originHost` names the origin the site advertises (robots/sitemap URLs).
 * The default `127.0.0.1.nip.io` resolves to 127.0.0.1 via public wildcard
 * DNS: the engine's safeFetch rejects IP-literal loopback targets
 * (`isCrawlableUrl`), so the harness crawls through this name instead.
 * `host: "0.0.0.0"` lets the Docker render sidecar reach the server
 * (fork/sidecar/compose.badgeo.yaml maps the name to the host gateway).
 */
export async function startBadgeo(
  options: { port?: number; originHost?: string; host?: string } = {},
): Promise<{ origin: string; close: () => Promise<void> }> {
  const headerMap = headersSchema.parse(
    JSON.parse(readFileSync(join(BADGEO_ROOT, "_headers.json"), "utf8")),
  );
  const botMap = botsSchema.parse(
    JSON.parse(readFileSync(join(BADGEO_ROOT, "_bots.json"), "utf8")),
  );
  const redirectMap = redirectsSchema.parse(
    JSON.parse(readFileSync(join(BADGEO_ROOT, "_redirects.json"), "utf8")),
  );
  let origin = "";
  // Off-site stub (P5-13 outbound links): another host name on its own port.
  const offsite = createServer((req, res) => {
    const gone = (req.url ?? "/").startsWith("/gone/");
    res.writeHead(gone ? 404 : 200, { "content-type": "text/plain" });
    res.end(req.method === "HEAD" ? undefined : gone ? "gone" : "ok");
  });
  await new Promise<void>((done) => offsite.listen(0, "127.0.0.1", done));
  const offsiteAddress = offsite.address();
  if (!offsiteAddress || typeof offsiteAddress === "string")
    throw new Error("no offsite address");
  const offsiteOrigin = `http://offsite.127.0.0.1.nip.io:${offsiteAddress.port}`;
  let heavy: Buffer | null = null;
  const challengeCount = new Map<string, number>();
  const server = createServer((req, res) => {
    const pathname = new URL(req.url ?? "/", origin).pathname;
    const ua = req.headers["user-agent"] ?? "";
    const botRule = botMap[pathname] ?? [];
    const challenge = !Array.isArray(botRule);
    const tokens = Array.isArray(botRule) ? botRule : botRule.challenge200;
    const matched = tokens.some((token) => ua.includes(token));
    const seen = matched ? (challengeCount.get(pathname) ?? 0) : 0;
    if (matched) challengeCount.set(pathname, seen + 1);
    const every = Array.isArray(botRule) ? 1 : (botRule.every ?? 1);
    if (matched && seen % every === 0) {
      res.writeHead(challenge ? 200 : 403, {
        "content-type": "text/html; charset=utf-8",
        ...(challenge ? { server: "openresty" } : {}),
      });
      res.end(
        challenge
          ? CHALLENGE_PAGE
          : "<!doctype html><title>Forbidden</title><h1>Forbidden</h1>",
      );
      return;
    }
    const redirect = redirectMap[pathname];
    if (redirect) {
      res.writeHead(redirect[0], {
        location: redirect[1].replaceAll("{{ORIGIN}}", origin),
      });
      res.end();
      return;
    }
    // WO-B9-004: 6.3 MB uncompressed PNG (P2-05 page weight); nothing committed.
    if (pathname === HEAVY_IMAGE) {
      heavy ??= heavyPng();
      res.writeHead(200, {
        "content-type": "image/png",
        "content-length": String(heavy.length),
      });
      res.end(req.method === "HEAD" ? undefined : heavy);
      return;
    }
    if (pathname === FAKE_VIDEO) {
      // HEAD declares 12 MB; GET sends no body (the sidecar aborts media).
      res.writeHead(200, {
        "content-type": "video/mp4",
        ...(req.method === "HEAD"
          ? { "content-length": String(FAKE_VIDEO_BYTES) }
          : {}),
      });
      res.end();
      return;
    }
    if (pathname === VIDEO_THUMB) {
      res.writeHead(200, {
        "content-type": "image/png",
        "content-length": String(ONE_PIXEL_PNG.length),
      });
      res.end(req.method === "HEAD" ? undefined : ONE_PIXEL_PNG);
      return;
    }
    const calendarPage = CALENDAR_PAGE.exec(pathname)?.[1];
    if (calendarPage) {
      res.writeHead(200, {
        "content-type": TYPES[".html"],
        ...headerMap["*"],
      });
      res.end(calendarHtml(origin, Number(calendarPage)));
      return;
    }
    const file = resolveFile(pathname);
    if (!file) {
      res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
      res.end("<!doctype html><title>Not found</title><h1>Not found</h1>");
      return;
    }
    const ext = extname(file);
    const extra = headerMap[pathname] ?? headerMap["*"] ?? {};
    const raw = readFileSync(file);
    const body =
      ext in TYPES
        ? raw
            .toString("utf8")
            .replaceAll("{{ORIGIN}}", origin)
            .replaceAll("{{OFFSITE}}", offsiteOrigin)
        : raw;
    res.writeHead(200, {
      "content-type": TYPES[ext] ?? "application/octet-stream",
      ...extra,
    });
    res.end(req.method === "HEAD" ? undefined : body);
  });
  await new Promise<void>((done) =>
    server.listen(options.port ?? 0, options.host ?? "127.0.0.1", done),
  );
  const address: AddressInfo | string | null = server.address();
  if (!address || typeof address === "string") throw new Error("no address");
  origin = `http://${options.originHost ?? "127.0.0.1.nip.io"}:${address.port}`;
  return {
    origin,
    close: () =>
      Promise.all(
        [server, offsite].map(
          (s) => new Promise<void>((done) => s.close(() => done())),
        ),
      ).then(() => {}),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values } = parseArgs({
    options: { port: { type: "string", default: "4455" } },
  });
  startBadgeo({ port: Number(values.port) })
    .then(({ origin }) => console.log(`BadGEO on ${origin}`))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
