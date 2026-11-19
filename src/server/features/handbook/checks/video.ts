import type {
  CheckContext,
  HandbookCheck,
} from "@/server/features/handbook/contracts/check";
import type { MarkupVideo } from "@/server/features/handbook/contracts/collectors";
import { createResult, normalizeUrl } from "./support";
import { videoEligibility } from "./video-eligibility";
import {
  embedTag,
  isDecorative,
  pagesWithVideo,
  videoTag,
  type PageVideos,
} from "./video-pages";

/**
 * Video & embeds (FULL-READ §3.12, handbook §14/§15). Decorative video =
 * autoplay + muted + loop + no controls (speed rules only); every other
 * `<video>` and every player embed is a content video.
 * P7-01: the hero (first-screen, else first) video loads with the page and
 *   is > HANDBOOK_VIDEO_MAX_MB (file, or the page's loading-video total).
 * SUPP-08: a non-hero video loads with the page (`autoplay` /
 *   `preload="auto"`, or a media request the render saw) and is over the cap.
 * SUPP-09: video / embed with no reserved size (rendered layout, else markup).
 * SUPP-10: embed loads its player with the page (no facade, and either
 *   first screen or no `loading="lazy"`).
 * SUPP-11: content video and `PageProfile.videoText` = none (map stage).
 * SUPP-12: Google video eligibility (`video-eligibility.ts`).
 * Sizes come from the engine's HEAD probe (`render.mediaSizes`); media
 * bodies are never downloaded. P7-01 poster / pause stay in `third-party.ts`.
 * SUPP items are not scored (ADR-020).
 */
const ITEMS = ["P7-01", "SUPP-08", "SUPP-09", "SUPP-10", "SUPP-11", "SUPP-12"];
const DEFAULT_MAX_MB = 5;
const MAX_EVIDENCE = 10;

type Out = ReturnType<typeof createResult>;

const loadsWithPage = (v: MarkupVideo) =>
  v.autoplay || v.preload?.toLowerCase() === "auto";
const mb = (bytes: number) => `${(bytes / 1_000_000).toFixed(1)} MB`;

function maxBytes(): number {
  const env =
    typeof process === "undefined"
      ? undefined
      : process.env.HANDBOOK_VIDEO_MAX_MB;
  const n = Number(env);
  return (Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_MB) * 1_000_000;
}

function sizeSpeed(ctx: CheckContext, pages: PageVideos[], out: Out) {
  const { render } = ctx.collected;
  const loading = pages.filter((p) => p.videos.some((x) => loadsWithPage(x.v)));
  if (render.status !== "ok" || !render.mediaSizes) {
    if (loading.length > 0)
      out.blocked(
        "SUPP-08",
        "render sidecar / media size probe unavailable: sizes of video that loads with the page unknown",
      );
    return;
  }
  const cap = maxBytes();
  const bytesOf = new Map(render.mediaSizes.map((m) => [m.url, m.bytes]));
  const sized = (urls: Array<string | null | undefined>) => {
    for (const u of urls) {
      if (!u) continue;
      const b = bytesOf.get(u);
      if (typeof b === "number") return { url: u, bytes: b };
    }
    return null;
  };
  type Hit = { page: PageVideos; url: string; bytes: number; why: string };
  const hero: Hit[] = [];
  const other: Hit[] = [];
  for (const page of pages) {
    const files = page.videos
      .filter((x) => loadsWithPage(x.v))
      .map((x) => ({
        x,
        size: sized([x.v.src, ...(x.v.sources ?? []).map((s) => s.src)]),
      }));
    // Media the render requested that no markup video names (JS players).
    const known = new Set(files.flatMap((f) => (f.size ? [f.size.url] : [])));
    const jsMedia = (page.render?.js.requests ?? [])
      .filter((q) => q.aborted === "media" && !known.has(q.url))
      .map((q) => sized([q.url]))
      .filter((s) => s !== null);
    const total =
      files.reduce((sum, f) => sum + (f.size?.bytes ?? 0), 0) +
      jsMedia.reduce((sum, s) => sum + s.bytes, 0);
    for (const { x, size } of files) {
      if (!size) continue;
      const over = size.bytes > cap;
      const pageOver = total > cap;
      if (!over && !pageOver) continue;
      const why = over
        ? `${mb(size.bytes)} file > ${mb(cap)}`
        : `page loads ${mb(total)} of video > ${mb(cap)}`;
      (x.hero ? hero : other).push({ page, ...size, why });
    }
    for (const s of jsMedia)
      if (s.bytes > cap || total > cap)
        other.push({
          page,
          ...s,
          why: `${mb(s.bytes)} media request (script-inserted), page total ${mb(total)}`,
        });
  }
  const emit = (itemId: "P7-01" | "SUPP-08", hits: Hit[]) => {
    if (hits.length === 0) return;
    out.finding({
      itemIds: [itemId],
      severity: "S2",
      ...(itemId === "P7-01"
        ? {
            severityReason:
              "over the size cap: the download competes with LCP on every visit",
          }
        : {}),
      title:
        itemId === "P7-01"
          ? "Hero video that loads with the page is over the size cap"
          : "Non-hero video loads with the page and is over the size cap",
      detail: hits
        .map((h) => `${h.url} — ${h.why} on ${h.page.snap.url}`)
        .join("\n"),
      fix: 'Serve one short clip per device at ≤ the size cap (mobile ≈ 1–2 MB), use preload="none" or "metadata" with a poster, and drop autoplay on videos below the first screen.',
      fixability: "FIXABLE",
      effort: "M",
      urls: [...new Set(hits.map((h) => h.page.snap.url))],
      evidenceRefs: hits.slice(0, MAX_EVIDENCE).flatMap((h) => [
        out.evidence(
          "header",
          h.url,
          `HEAD ${h.url}\ncontent-length: ${h.bytes} (${h.why})`,
        ),
        out.evidence(
          "rawHtml",
          h.page.snap.url,
          h.page.videos
            .filter((x) => x.url === h.url)
            .map((x) => videoTag(x.v))
            .join("\n") || `media request ${h.url}`,
          h.page.snap.rawKey,
        ),
      ]),
    });
  };
  emit("P7-01", hero);
  emit("SUPP-08", other);
  if (other.length === 0 && loading.length > 0)
    out.pass(
      "SUPP-08",
      `${loading.length} page(s) load video with the page; every file and page total ≤ ${mb(cap)}`,
      [
        out.evidence(
          "rawHtml",
          loading[0].snap.url,
          loading[0].videos
            .filter((x) => loadsWithPage(x.v))
            .map((x) => videoTag(x.v))
            .join("\n"),
          loading[0].snap.rawKey,
        ),
      ],
    );
}

function layout(pages: PageVideos[], out: Out) {
  const unsized: Array<{ page: PageVideos; line: string; rendered: boolean }> =
    [];
  const eager: Array<{ page: PageVideos; line: string }> = [];
  for (const page of pages) {
    const elements = page.render?.js.mediaElements;
    if (elements)
      for (const m of elements.filter((el) => !el.reservedSize))
        unsized.push({
          page,
          rendered: true,
          line: `${m.kind} ${m.src ?? "(no src)"} — no width/height or aspect-ratio after render`,
        });
    else {
      for (const { v } of page.videos)
        if (!(v.width && v.height) && !v.aspectRatio)
          unsized.push({ page, rendered: false, line: videoTag(v) });
      for (const { e } of page.embeds)
        if (!(e.width && e.height) && !e.aspectRatio)
          unsized.push({ page, rendered: false, line: embedTag(e) });
    }
    for (const { e, firstScreen } of page.embeds) {
      if (e.facade) continue;
      if (firstScreen === true)
        eager.push({
          page,
          line: `${embedTag(e)} — first screen, player loads at page load (no click-to-load thumbnail)`,
        });
      else if (e.loading?.toLowerCase() !== "lazy")
        eager.push({
          page,
          line: `${embedTag(e)} — ${firstScreen === false ? "below the first screen" : "position unknown"}, no loading="lazy"`,
        });
    }
  }
  const ref = (h: { page: PageVideos; line: string; rendered?: boolean }) =>
    h.rendered
      ? out.evidence(
          "renderedDom",
          h.page.snap.url,
          h.line,
          h.page.render?.js.renderedKey,
        )
      : out.evidence("rawHtml", h.page.snap.url, h.line, h.page.snap.rawKey);
  if (unsized.length > 0)
    out.finding({
      itemIds: ["SUPP-09"],
      severity: "S3",
      title: "Video or video embed with no reserved size",
      detail: unsized.map((h) => `${h.page.snap.url} — ${h.line}`).join("\n"),
      fix: "Give every <video> and player <iframe> width/height attributes or a CSS aspect-ratio box so the page does not shift when it loads.",
      fixability: "FIXABLE",
      effort: "S",
      urls: [...new Set(unsized.map((h) => h.page.snap.url))],
      evidenceRefs: unsized.slice(0, MAX_EVIDENCE).map(ref),
    });
  if (eager.length > 0)
    out.finding({
      itemIds: ["SUPP-10"],
      severity: "S3",
      title: "Video embed loads its player with the page",
      detail: eager.map((h) => `${h.page.snap.url} — ${h.line}`).join("\n"),
      fix: 'Add loading="lazy" to player iframes below the first screen; in the first screen show a thumbnail that loads the player on click (lite-youtube style facade).',
      fixability: "FIXABLE",
      effort: "S",
      urls: [...new Set(eager.map((h) => h.page.snap.url))],
      evidenceRefs: eager.slice(0, MAX_EVIDENCE).map(ref),
    });
}

const captionsOnly = (p: PageVideos) =>
  p.videos.some((x) =>
    (x.v.tracks ?? []).some((t) => /captions|subtitles/i.test(t.kind ?? "")),
  );

function videoText(ctx: CheckContext, content: PageVideos[], out: Out) {
  if (content.length === 0) return;
  if (!ctx.pageProfiles) {
    out.blocked(
      "SUPP-11",
      "needs PageProfile.videoText from the LLM map stage (not run)",
    );
    return;
  }
  const byUrl = new Map(ctx.pageProfiles.map((p) => [normalizeUrl(p.url), p]));
  const none = content.filter(
    (p) => byUrl.get(normalizeUrl(p.snap.url))?.videoText === "none",
  );
  if (none.length === 0) return;
  out.finding({
    itemIds: ["SUPP-11"],
    severity: "S3",
    title: "Content video with no transcript or text summary as page text",
    detail: none
      .map(
        (p) =>
          `${p.snap.url}${captionsOnly(p) ? " — partial: captions file only" : ""}`,
      )
      .join("\n"),
    fix: "Put a transcript or a short text summary of each content video on the page as plain text (a captions file or schema transcript alone is not read as page text).",
    fixability: "FIXABLE",
    effort: "M",
    urls: none.map((p) => p.snap.url),
    evidenceRefs: none
      .slice(0, MAX_EVIDENCE)
      .map((p) =>
        out.evidence(
          "rawHtml",
          p.snap.url,
          [
            ...p.videos.map((x) => videoTag(x.v)),
            ...p.embeds.map((x) => embedTag(x.e)),
          ].join("\n"),
          p.snap.rawKey,
        ),
      ),
  });
}

export const videoCheck: HandbookCheck = {
  id: "perf.video",
  itemIds: ITEMS,
  class: "PERF",
  requires: ["pages"],
  async run(ctx) {
    const out = createResult(ITEMS);
    const pages = pagesWithVideo(ctx);
    if (pages.length === 0) return out.build();
    const content = pages.filter(
      (p) => p.embeds.length > 0 || p.videos.some((x) => !isDecorative(x.v)),
    );
    sizeSpeed(ctx, pages, out);
    layout(pages, out);
    videoText(ctx, content, out);
    await videoEligibility(ctx, content, out);
    return out.build();
  },
};
