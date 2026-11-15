import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import { createResult, normalizeUrl } from "./support";

/**
 * CRAWL (handbook §2): Open Graph + Twitter tags on every indexable page with
 * a per-page 1200×630 share image that is not the logo (P4-09; declared
 * og:image:width/height only — the image itself is not fetched); article
 * pages carry `og:type=article` + published/modified times (P4-10);
 * `max-image-preview:large` on indexable pages (P4-11).
 */
const ITEMS = ["P4-09", "P4-10", "P4-11"];

const REQUIRED_OG = ["title", "description", "image", "url"] as const;
const ARTICLE = /^(Article|BlogPosting|NewsArticle)$/;

const indexable = (s: PageSnapshot) =>
  s.status === 200 &&
  normalizeUrl(s.finalUrl) === normalizeUrl(s.url) &&
  !/noindex/i.test(`${s.head.robotsMeta ?? ""} ${s.xRobotsTag ?? ""}`) &&
  /html/i.test(s.contentType ?? "html");

const socialExcerpt = (s: PageSnapshot) =>
  [
    ...Object.entries(s.head.og).map(
      ([k, v]) => `<meta property="og:${k}" content="${v}">`,
    ),
    ...Object.entries(s.head.twitter).map(
      ([k, v]) => `<meta name="twitter:${k}" content="${v}">`,
    ),
    ...Object.entries(s.head.meta)
      .filter(([k]) => k.startsWith("article:"))
      .map(([k, v]) => `<meta property="${k}" content="${v}">`),
    `<meta name="robots" content="${s.head.robotsMeta ?? ""}">`,
    s.xRobotsTag ? `X-Robots-Tag: ${s.xRobotsTag}` : "",
  ]
    .filter(Boolean)
    .join("\n") || "no OG / Twitter / robots meta";

const near = (value: string | undefined, want: number) => {
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n - want) <= want * 0.1;
};

export const socialMetaCheck: HandbookCheck = {
  id: "crawl.social-meta",
  itemIds: ITEMS,
  class: "CRAWL",
  requires: ["pages"],
  run(ctx) {
    const out = createResult(ITEMS);
    const { pages, jsonld } = ctx.collected;
    if (pages.status !== "ok") return out.build();
    const live = pages.snapshots.filter(indexable);
    if (live.length === 0) {
      for (const id of ITEMS) out.na(id, "no indexable 200 page crawled");
      return out.build();
    }
    const ref = (s: PageSnapshot) =>
      out.evidence("rawHtml", s.url, socialExcerpt(s), s.rawKey);
    const report = (
      itemId: string,
      title: string,
      fix: string,
      hits: { page: PageSnapshot; why: string }[],
    ) => {
      if (hits.length === 0) return;
      out.finding({
        itemIds: [itemId],
        severity: "S3",
        title,
        detail: hits.map((h) => `${h.page.url} — ${h.why}`).join("\n"),
        fix,
        fixability: "FIXABLE",
        effort: "S",
        urls: hits.map((h) => h.page.url),
        evidenceRefs: hits.slice(0, 20).map((h) => ref(h.page)),
      });
    };

    // P4-09
    report(
      "P4-09",
      "Pages missing Open Graph / Twitter tags",
      "Emit og:title, og:description, og:image, og:url and twitter:card on every indexable page.",
      live.flatMap((page) => {
        const missing = [
          ...REQUIRED_OG.filter((k) => !page.head.og[k]?.trim()).map(
            (k) => `og:${k}`,
          ),
          ...(page.head.twitter.card?.trim() ? [] : ["twitter:card"]),
        ];
        return missing.length > 0
          ? [{ page, why: `missing ${missing.join(", ")}` }]
          : [];
      }),
    );
    const images = new Map<string, number>();
    for (const s of live) {
      const img = s.head.og.image;
      if (img) images.set(img, (images.get(img) ?? 0) + 1);
    }
    const shared = [...images].find(
      ([img, n]) =>
        n >= live.length * 0.8 &&
        live.length > 1 &&
        /logo/i.test(new URL(img, ctx.origin).pathname.split("/").at(-1) ?? ""),
    );
    if (shared) {
      report(
        "P4-09",
        "Site logo used as the share image",
        "Give each page its own 1200×630 share image (not the logo).",
        live
          .filter((s) => s.head.og.image === shared[0])
          .map((page) => ({ page, why: `og:image ${shared[0]}` })),
      );
    }
    report(
      "P4-09",
      "Share image dimensions are not 1200×630",
      "Use a 1200×630 og:image and declare og:image:width / og:image:height to match the file.",
      live.flatMap((page) => {
        const w = page.head.og["image:width"];
        const h = page.head.og["image:height"];
        if (!page.head.og.image || (!w && !h)) return [];
        return near(w, 1200) && near(h, 630)
          ? []
          : [{ page, why: `declared ${w ?? "?"}×${h ?? "?"}` }];
      }),
    );

    // P4-10
    const articleUrls = new Set(
      jsonld.status === "ok"
        ? jsonld.pages
            .filter((p) =>
              p.nodes.some((n) => n.types.some((t) => ARTICLE.test(t))),
            )
            .map((p) => normalizeUrl(p.url))
        : [],
    );
    const articles = live.filter((s) => articleUrls.has(normalizeUrl(s.url)));
    if (articles.length === 0) {
      out.na("P4-10", "no Article/BlogPosting/NewsArticle pages");
    } else {
      report(
        "P4-10",
        "Article pages lack og:type=article or published/modified times",
        "On article pages emit og:type=article plus article:published_time and article:modified_time.",
        articles.flatMap((page) => {
          const missing = [
            ...(page.head.og.type === "article" ? [] : ["og:type=article"]),
            ...["article:published_time", "article:modified_time"].filter(
              (k) => !page.head.meta[k],
            ),
          ];
          return missing.length > 0
            ? [{ page, why: `missing ${missing.join(", ")}` }]
            : [];
        }),
      );
      out.pass(
        "P4-10",
        `${articles.length} article page(s) with og:type=article + times`,
        articles.slice(0, 5).map(ref),
      );
    }

    // P4-11
    report(
      "P4-11",
      "Indexable pages without max-image-preview:large",
      'Add `<meta name="robots" content="max-image-preview:large">` (or the X-Robots-Tag equivalent) to indexable pages.',
      live
        .filter(
          (s) =>
            !/max-image-preview:large/i.test(
              `${s.head.robotsMeta ?? ""} ${s.xRobotsTag ?? ""}`,
            ),
        )
        .map((page) => ({ page, why: "no max-image-preview:large" })),
    );

    const sample = live.slice(0, 5).map(ref);
    out.pass(
      "P4-09",
      `${live.length} pages with OG + Twitter tags and per-page share images (declared dimensions only; files not fetched)`,
      sample,
    );
    out.pass(
      "P4-11",
      `${live.length} pages allow max-image-preview:large`,
      sample,
    );
    return out.build();
  },
};
