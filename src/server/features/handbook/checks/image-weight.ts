import { sort } from "remeda";
import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import { imageUrl } from "@/server/features/handbook/engine/page-images";
import { createResult, normalizeUrl } from "./support";

/**
 * Image weight from render requests (P2-05, FULL-READ §3.7). Each image the
 * rendered page loads is sized by its transfer bytes (else the engine's media
 * size probe). Oversized: > 500 KB, or > 2× the byte budget of its markup
 * `width`×`height` at 2× density (≈ 0.5 byte per pixel) when both are known
 * and it is over 100 KB. Pages whose images add up to > 3 MB are named too.
 * K3 has no rendered display size per request, so images without size
 * attributes are judged by bytes alone. Total page weight (all resource types,
 * > 5 MB) stays in `perf.page-weight`.
 */
const ITEMS = ["P2-05"];

const IMAGE_BYTES = 500_000;
const PAGE_IMAGE_BYTES = 3_000_000;
/** Below this an image is never called oversized by the attribute budget. */
const BUDGET_FLOOR = 100_000;
const MAX_LIST = 10;

const kb = (bytes: number) => `${Math.round(bytes / 1000)} KB`;

/** Byte budget from markup width/height: 2× density at ~0.5 byte per pixel. */
function budget(snap: PageSnapshot | undefined, url: string): number | null {
  const img = snap?.images.find((i) => {
    const src = imageUrl(i);
    return src !== null && normalizeUrl(src) === normalizeUrl(url);
  });
  const w = Number.parseInt(img?.width ?? "", 10);
  const h = Number.parseInt(img?.height ?? "", 10);
  if (!(w > 0 && h > 0)) return null;
  return 2 * w * 2 * h * 0.5;
}

export const imageWeightCheck: HandbookCheck = {
  id: "perf.image-weight",
  itemIds: ITEMS,
  class: "PERF",
  requires: ["pages"],
  run(ctx) {
    const out = createResult(ITEMS);
    const { pages, render } = ctx.collected;
    if (render.status !== "ok") return out.build();
    const snaps = new Map(
      (pages.status === "ok" ? pages.snapshots : []).map((s) => [
        normalizeUrl(s.url),
        s,
      ]),
    );
    const mediaBytes = new Map(
      (render.mediaSizes ?? []).map((m) => [m.url, m.bytes]),
    );

    type Image = {
      page: string;
      key: string;
      url: string;
      bytes: number;
      why: string;
    };
    const oversized: Image[] = [];
    const heavyPages: Array<{
      page: string;
      key: string;
      bytes: number;
      count: number;
    }> = [];
    for (const page of render.pages) {
      const snap = snaps.get(normalizeUrl(page.url));
      let total = 0;
      let count = 0;
      for (const q of page.js.requests) {
        if (q.resourceType !== "image") continue;
        const bytes = q.transferBytes ?? mediaBytes.get(q.url) ?? null;
        if (bytes === null) continue;
        total += bytes;
        count += 1;
        const limit = budget(snap, q.url);
        if (bytes > IMAGE_BYTES)
          oversized.push({
            page: page.url,
            key: page.js.renderedKey,
            url: q.url,
            bytes,
            why: "> 500 KB",
          });
        else if (limit !== null && bytes > BUDGET_FLOOR && bytes > 2 * limit)
          oversized.push({
            page: page.url,
            key: page.js.renderedKey,
            url: q.url,
            bytes,
            why: `> 2× its ${kb(limit)} width×height budget`,
          });
      }
      if (total > PAGE_IMAGE_BYTES)
        heavyPages.push({
          page: page.url,
          key: page.js.renderedKey,
          bytes: total,
          count,
        });
    }

    if (render.pages.length === 0) {
      out.na("P2-05", "no rendered page");
      return out.build();
    }
    if (oversized.length === 0 && heavyPages.length === 0) {
      out.pass(
        "P2-05",
        `${render.pages.length} rendered page(s): no image over 500 KB or its size-attribute budget, no page with > 3 MB of images`,
        render.pages
          .slice(0, 5)
          .map((page) =>
            out.evidence(
              "renderedDom",
              page.url,
              "no image over 500 KB or its size-attribute budget; under 3 MB of images",
              page.js.renderedKey,
            ),
          ),
      );
      return out.build();
    }
    const top = sort(oversized, (a, b) => b.bytes - a.bytes).slice(0, MAX_LIST);
    const pageLines = heavyPages.map(
      (p) => `${p.page} — ${kb(p.bytes)} of images over ${p.count} requests`,
    );
    out.finding({
      itemIds: ["P2-05"],
      severity: "S3",
      title: "Oversized images",
      detail: [
        ...top.map((i) => `${i.url} — ${kb(i.bytes)} (${i.why}) on ${i.page}`),
        ...pageLines,
      ].join("\n"),
      fix: "Export photos at about 2× their largest display width, serve WebP/AVIF through srcset with width/height attributes, and lazy-load images below the first screen.",
      fixability: "FIXABLE",
      effort: "M",
      urls: [...new Set([...oversized, ...heavyPages].map((i) => i.page))],
      evidenceRefs: [
        ...top.map((i) =>
          out.evidence(
            "renderedDom",
            i.page,
            `${kb(i.bytes)} image ${i.url} (${i.why})`,
            i.key,
          ),
        ),
        ...heavyPages
          .slice(0, MAX_LIST)
          .map((p) =>
            out.evidence(
              "renderedDom",
              p.page,
              `${kb(p.bytes)} of images over ${p.count} requests`,
              p.key,
            ),
          ),
      ],
    });
    return out.build();
  },
};
