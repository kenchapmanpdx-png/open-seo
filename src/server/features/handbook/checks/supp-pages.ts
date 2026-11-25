import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import { createResult, sitemapKey, pathOf } from "./support";

/**
 * SUPP-05 / SUPP-06 (ADR-020, FULL-READ §6, handbook §2/§10/§17):
 * test / dev / numbered-copy slugs that are indexable and listed in the
 * sitemap (noindex and out-of-sitemap pages are left alone), and social meta
 * tags (`og:*`, `twitter:*`) present with an empty `content`. Not scored
 * (Additional findings).
 */
const ITEMS = ["SUPP-05", "SUPP-06"];

/**
 * Last path segment: a dev / test / staging / copy word, or a CMS duplicate
 * suffix `-2`…`-9` ("about-2"). Longer numbers ("top-10", "2024") are real slugs.
 */
const DEV_SLUG = /(^|[-_])(dev|test|testing|staging|copy)([-_]|$)|-[2-9]$/i;

/** Evidence rows kept per finding (one per page). */
const MAX_EVIDENCE = 20;

const noindex = (s: PageSnapshot) =>
  /noindex/i.test(`${s.head.robotsMeta ?? ""} ${s.xRobotsTag ?? ""}`);

function slugOf(url: string): string {
  const path = pathOf(url).replace(/\/+$/, "");
  return (path.split("/").pop() ?? "").replace(/\.[a-z0-9]+$/i, "");
}

const emptySocial = (s: PageSnapshot) => [
  ...Object.entries(s.head.og)
    .filter(([, v]) => v.trim() === "")
    .map(([k]) => `og:${k}`),
  ...Object.entries(s.head.twitter)
    .filter(([, v]) => v.trim() === "")
    .map(([k]) => `twitter:${k}`),
];

export const suppPagesCheck: HandbookCheck = {
  id: "crawl.supp-pages",
  itemIds: ITEMS,
  class: "CRAWL",
  requires: ["pages"],
  run(ctx) {
    const out = createResult(ITEMS);
    const { pages, sitemap } = ctx.collected;
    if (pages.status !== "ok") return out.build();

    // SUPP-05 — test / dev / numbered slugs, indexable and in the sitemap.
    const listed = new Set(
      sitemap.status === "ok" ? sitemap.urls.map((u) => sitemapKey(u.loc)) : [],
    );
    const devPages = pages.snapshots.filter(
      (s) =>
        s.status === 200 &&
        !noindex(s) &&
        listed.has(sitemapKey(s.url)) &&
        DEV_SLUG.test(slugOf(s.url)),
    );
    if (devPages.length > 0) {
      out.finding({
        itemIds: ["SUPP-05"],
        severity: "S3",
        title: "Test / dev / numbered-copy pages indexable and in the sitemap",
        detail: devPages
          .map((s) => `${s.url} — slug "${slugOf(s.url)}"`)
          .join("\n"),
        fix: "Retire each test or duplicate page (404/410, or 301 to the real page) and drop it from the sitemap; if it is a real page, give it a descriptive slug and 301 the old one.",
        fixability: "FIXABLE",
        effort: "S",
        urls: devPages.map((s) => s.url),
        evidenceRefs: devPages
          .slice(0, MAX_EVIDENCE)
          .map((s) =>
            out.evidence(
              "sitemap",
              s.url,
              `<loc>${s.url}</loc> · HTTP ${s.status} · robots ${s.head.robotsMeta ?? "none"} · slug "${slugOf(s.url)}"`,
            ),
          ),
      });
    }

    // SUPP-06 — empty social meta.
    const empty = pages.snapshots.flatMap((s) => {
      const keys = emptySocial(s);
      return keys.length > 0 ? [{ s, keys }] : [];
    });
    if (empty.length > 0) {
      out.finding({
        itemIds: ["SUPP-06"],
        severity: "S4",
        title: 'Empty social meta tags (content="")',
        detail: empty
          .map(({ s, keys }) => `${s.url} — ${keys.join(", ")}`)
          .join("\n"),
        fix: "Fill each empty og:/twitter: tag with the page's real value, or remove the tag so platforms fall back to the other tags.",
        fixability: "FIXABLE",
        effort: "S",
        urls: empty.map(({ s }) => s.url),
        evidenceRefs: empty
          .slice(0, MAX_EVIDENCE)
          .map(({ s, keys }) =>
            out.evidence(
              "rawHtml",
              s.url,
              keys
                .map(
                  (k) =>
                    `<meta ${k.startsWith("og:") ? "property" : "name"}="${k}" content="">`,
                )
                .join("\n"),
              s.rawKey,
            ),
          ),
      });
    }
    return out.build();
  },
};
