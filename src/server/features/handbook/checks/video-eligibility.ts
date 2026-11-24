import type { CheckContext } from "@/server/features/handbook/contracts/check";
import type { JsonLdData } from "@/server/features/handbook/contracts/collectors";
import { decide } from "@/server/features/handbook/engine/robots";
import type { createResult } from "./support";
import { normalizeUrl, parseUrl } from "./support";
import { embedTag, videoTag, type PageVideos } from "./video-pages";

/**
 * SUPP-12 (FULL-READ §3.12, handbook §15/§24): content video eligible for
 * Google video results. Required VideoObject fields per Google's video
 * structured-data doc (re-read 2026-11-18): `name`, `thumbnailUrl`,
 * `uploadDate`. Thumbnails: HEAD must answer 200 with an image type (≤ 5
 * probed, off-site fetch cap 10 per check); thumbnail and video URL must not
 * be blocked for Googlebot by a robots.txt the crawl read (other hosts are
 * not judged). > 10 content videos site-wide: the urlset sitemaps (≤ 3
 * fetched) must carry `<video:video>` entries.
 */
const REQUIRED = ["name", "thumbnailUrl", "uploadDate"] as const;
const MAX_THUMBS = 5;
const MAX_SITEMAPS = 3;
const SITEMAP_VIDEO_THRESHOLD = 10;
const MAX_EVIDENCE = 10;

type Out = ReturnType<typeof createResult>;
type JsonLdPage = JsonLdData["pages"][number];
type Issue = { page: string; line: string; ref: string };

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : [v]);

function videoObjects(page: JsonLdPage | undefined) {
  const out: Record<string, unknown>[] = [];
  const walk = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!isRecord(v)) return;
    if (list(v["@type"]).includes("VideoObject")) out.push(v);
    Object.values(v).forEach(walk);
  };
  for (const n of page?.nodes ?? [])
    walk({ "@type": n.types, ...n.properties });
  return out;
}

function absolute(url: string, base: string): string | null {
  return parseUrl(url, base)?.href ?? null;
}

const pageTags = (p: PageVideos) =>
  [
    ...p.videos.map((x) => videoTag(x.v)),
    ...p.embeds.map((x) => embedTag(x.e)),
  ].join("\n");

const urlsOf = (v: unknown): string[] =>
  list(v).flatMap((x) =>
    typeof x === "string"
      ? [x]
      : isRecord(x) && typeof x.url === "string"
        ? [x.url]
        : [],
  );

function robotsBlocked(ctx: CheckContext, url: string): boolean {
  const { robots } = ctx.collected;
  if (robots.status !== "ok") return false;
  const u = parseUrl(url);
  if (!u) return false;
  const host = robots.hosts.find(
    (h) => h.host.toLowerCase() === u.hostname.toLowerCase() && h.status < 400,
  );
  if (!host) return false;
  return !decide(host.host, host.groups, "Googlebot", u.pathname + u.search)
    .allowed;
}

async function thumbnailProblem(
  ctx: CheckContext,
  url: string,
): Promise<string | null> {
  if (!ctx.fetchOffsite) return null;
  try {
    const res = await ctx.fetchOffsite(url, { method: "HEAD" });
    const type = res.headers.find(([k]) => k === "content-type")?.[1] ?? "";
    if (res.status === 200 && /^image\//i.test(type)) return null;
    return `HEAD ${res.status}, content-type ${type || "none"}`;
  } catch (error) {
    return `HEAD failed: ${error instanceof Error ? error.message.slice(0, 80) : "error"}`;
  }
}

async function sitemapHasVideo(ctx: CheckContext): Promise<boolean | null> {
  const { sitemap } = ctx.collected;
  if (sitemap.status !== "ok" || !ctx.fetchOffsite) return null;
  const sources = sitemap.sources
    .filter((s) => s.kind === "urlset" && s.status === 200)
    .slice(0, MAX_SITEMAPS);
  if (sources.length === 0) return false;
  for (const s of sources) {
    try {
      const res = await ctx.fetchOffsite(s.url);
      if (/<video:video[\s>]/i.test(res.body)) return true;
    } catch {
      // Unreadable sitemap: treated as no video entries.
    }
  }
  return false;
}

function pageIssues(
  ctx: CheckContext,
  p: PageVideos,
  ld: JsonLdPage | undefined,
  out: Out,
): { issues: Issue[]; thumbs: Array<{ page: string; url: string }> } {
  const issues: Issue[] = [];
  const thumbs: Array<{ page: string; url: string }> = [];
  const page = p.snap.url;
  const tags = pageTags(p);
  const objects = videoObjects(ld);
  if (objects.length === 0)
    issues.push({
      page,
      line: "no VideoObject",
      ref: out.evidence(
        "rawHtml",
        page,
        `${tags}\n(no VideoObject in JSON-LD)`,
        p.snap.rawKey,
      ),
    });
  for (const o of objects) {
    const missing = REQUIRED.filter((k) => urlsOf(o[k]).length === 0 && !o[k]);
    if (missing.length > 0)
      issues.push({
        page,
        line: `VideoObject "${typeof o.name === "string" ? o.name : ""}" missing ${missing.join(", ")}`,
        ref: out.evidence("jsonld", page, JSON.stringify(o).slice(0, 600)),
      });
    for (const t of urlsOf(o.thumbnailUrl)) {
      const abs = absolute(t, page);
      if (!abs) continue;
      if (robotsBlocked(ctx, abs))
        issues.push({
          page,
          line: `thumbnail ${abs} blocked by robots.txt for Googlebot`,
          ref: out.evidence("robotsTxt", abs, `Googlebot disallowed: ${abs}`),
        });
      else thumbs.push({ page, url: abs });
    }
    for (const c of urlsOf(o.contentUrl)) {
      const abs = absolute(c, page);
      if (abs && robotsBlocked(ctx, abs))
        issues.push({
          page,
          line: `video ${abs} blocked by robots.txt for Googlebot`,
          ref: out.evidence("robotsTxt", abs, `Googlebot disallowed: ${abs}`),
        });
    }
  }
  for (const { url } of p.videos) {
    const abs = url ? absolute(url, page) : null;
    if (abs && robotsBlocked(ctx, abs))
      issues.push({
        page,
        line: `video ${abs} blocked by robots.txt for Googlebot`,
        ref: out.evidence("robotsTxt", abs, `Googlebot disallowed: ${abs}`),
      });
  }
  return { issues, thumbs };
}

export async function videoEligibility(
  ctx: CheckContext,
  content: readonly PageVideos[],
  out: Out,
): Promise<void> {
  if (content.length === 0) return;
  const { jsonld } = ctx.collected;
  const ldByUrl = new Map(
    (jsonld.status === "ok" ? jsonld.pages : []).map((p) => [
      normalizeUrl(p.url),
      p,
    ]),
  );
  const issues: Issue[] = [];
  const thumbs = new Map<string, string>();
  for (const p of content) {
    const r = pageIssues(ctx, p, ldByUrl.get(normalizeUrl(p.snap.url)), out);
    issues.push(...r.issues);
    for (const t of r.thumbs) if (!thumbs.has(t.url)) thumbs.set(t.url, t.page);
  }
  for (const [url, page] of [...thumbs].slice(0, MAX_THUMBS)) {
    const problem = await thumbnailProblem(ctx, url);
    if (problem)
      issues.push({
        page,
        line: `thumbnail ${url} not fetchable as an image (${problem})`,
        ref: out.evidence("header", url, `HEAD ${url}\n${problem}`),
      });
  }
  const videoCount = content.reduce(
    (n, p) => n + p.embeds.length + p.videos.length,
    0,
  );
  if (
    videoCount > SITEMAP_VIDEO_THRESHOLD &&
    (await sitemapHasVideo(ctx)) === false
  )
    issues.push({
      page: content[0].snap.url,
      line: `${videoCount} content videos and no <video:video> entries in the sitemap`,
      ref: out.evidence(
        "sitemap",
        content[0].snap.url,
        `${videoCount} content videos; urlset sitemaps carry no <video:video>`,
      ),
    });
  if (issues.length === 0) {
    out.pass(
      "SUPP-12",
      `${content.length} page(s) with content video: VideoObject with name, thumbnailUrl, uploadDate; thumbnails fetch as images; not blocked by robots.txt`,
      [
        out.evidence(
          "rawHtml",
          content[0].snap.url,
          pageTags(content[0]),
          content[0].snap.rawKey,
        ),
      ],
    );
    return;
  }
  out.finding({
    itemIds: ["SUPP-12"],
    severity: "S3",
    title: "Content video not eligible for Google video results",
    detail: issues.map((i) => `${i.page} — ${i.line}`).join("\n"),
    fix: "Add VideoObject JSON-LD (name, thumbnailUrl, uploadDate; contentUrl or embedUrl) for each content video, keep thumbnails and video files crawlable, and list videos in a video sitemap when the site has many.",
    fixability: "FIXABLE",
    effort: "S",
    urls: [...new Set(issues.map((i) => i.page))],
    evidenceRefs: issues.slice(0, MAX_EVIDENCE).map((i) => i.ref),
  });
}
