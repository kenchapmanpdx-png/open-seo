import type {
  FindingDraft,
  HandbookCheck,
} from "@/server/features/handbook/contracts/check";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import { createResult, normalizeUrl } from "./support";

/**
 * CRAWL (handbook §2, §14): unique title / meta description / single H1 with
 * a consistent brand suffix (P4-01), a non-empty meta description (P4-03), a
 * zoomable `width=device-width, initial-scale=1` viewport (P4-04), and no
 * hard-coded year in listing/evergreen headings (P4-06; event pages exempt,
 * "evergreen" judgment beyond templates is LLM work in B3).
 */
const ITEMS = ["P4-01", "P4-03", "P4-04", "P4-06"];

const SUFFIX = /\s[|·•–—-]\s([^|·•–—-]+)$/;
const YEAR = /\b20\d{2}\b/;
/** Handbook §2: 150–160 [HEURISTIC]; flag only clear overshoots. */
const DESCRIPTION_MAX = 170;
/** Handbook §2: ~50–65 characters / < 600 px [HEURISTIC]; clear overshoots only (B18 WO-004). */
const TITLE_MAX = 70;

const indexable = (s: PageSnapshot) =>
  s.status === 200 &&
  normalizeUrl(s.finalUrl) === normalizeUrl(s.url) &&
  !/noindex/i.test(`${s.head.robotsMeta ?? ""} ${s.xRobotsTag ?? ""}`) &&
  /html/i.test(s.contentType ?? "html");

const headExcerpt = (s: PageSnapshot) =>
  [
    `<title>${s.head.title ?? ""}</title>`,
    `<meta name="description" content="${s.head.metaDescription ?? ""}">`,
    `<meta name="viewport" content="${s.head.viewport ?? ""}">`,
    ...s.h1.map((h) => `<h1>${h}</h1>`),
  ].join("\n");

type Hit = { page: PageSnapshot; why: string };

export const headTagsCheck: HandbookCheck = {
  id: "crawl.head-tags",
  itemIds: ITEMS,
  class: "CRAWL",
  requires: ["pages"],
  run(ctx) {
    const out = createResult(ITEMS);
    const { pages, jsonld, templates } = ctx.collected;
    if (pages.status !== "ok") return out.build();
    const live = pages.snapshots.filter(indexable);
    if (live.length === 0) {
      for (const id of ITEMS) out.na(id, "no indexable 200 page crawled");
      return out.build();
    }
    const ref = (s: PageSnapshot) =>
      out.evidence("rawHtml", s.url, headExcerpt(s), s.rawKey);
    const report = (
      itemId: string,
      title: string,
      fix: string,
      hits: Hit[],
      severity: Pick<FindingDraft, "severity" | "severityReason">,
    ) => {
      if (hits.length === 0) return;
      out.finding({
        itemIds: [itemId],
        ...severity,
        title,
        detail: hits.map((h) => `${h.page.url} — ${h.why}`).join("\n"),
        fix,
        fixability: "FIXABLE",
        effort: "S",
        urls: [...new Set(hits.map((h) => h.page.url))],
        evidenceRefs: hits.slice(0, 20).map((h) => ref(h.page)),
      });
    };
    const S2 = { severity: "S2" } as const;

    // P4-01 — duplicates.
    const dupes = (
      label: string,
      value: (s: PageSnapshot) => string | null,
    ) => {
      const groups = new Map<string, PageSnapshot[]>();
      for (const s of live) {
        const v = value(s)?.trim().toLowerCase();
        if (v) groups.set(v, [...(groups.get(v) ?? []), s]);
      }
      return [...groups]
        .filter(([, list]) => list.length > 1)
        .flatMap(([v, list]) =>
          list.map((page) => ({
            page,
            why: `${label} "${v}" shared by ${list.length} pages`,
          })),
        );
    };
    report(
      "P4-01",
      "Duplicate titles, descriptions or H1s",
      "Write a unique title, meta description and H1 for every indexable page.",
      [
        ...dupes("title", (s) => s.head.title),
        ...dupes("description", (s) => s.head.metaDescription),
        ...dupes("H1", (s) => s.h1[0] ?? null),
      ],
      S2,
    );
    report(
      "P4-01",
      "Pages with a missing title or not exactly one H1",
      "Give every indexable page a <title> and exactly one <h1>.",
      live.flatMap((page) => {
        const why = [
          ...(page.head.title?.trim() ? [] : ["no title"]),
          ...(page.h1.length === 1 ? [] : [`${page.h1.length} H1s`]),
        ];
        return why.length > 0 ? [{ page, why: why.join(", ") }] : [];
      }),
      S2,
    );
    const suffixes = new Map<string, number>();
    for (const s of live) {
      const suffix = SUFFIX.exec(s.head.title ?? "")?.[1]?.trim();
      if (suffix) suffixes.set(suffix, (suffixes.get(suffix) ?? 0) + 1);
    }
    const [brand, brandCount] = [...suffixes].reduce(
      (best, cur) => (cur[1] > best[1] ? cur : best),
      ["", 0],
    );
    // A simple majority sets the brand; a title that names the brand elsewhere
    // (the home page's "Brand | tagline") is consistent enough.
    if (brand && brandCount >= 3 && brandCount > live.length / 2) {
      report(
        "P4-01",
        `Titles missing the brand suffix "${brand}"`,
        `End every title with the same brand suffix ("… · ${brand}").`,
        live
          .filter(
            (s) =>
              !(s.head.title ?? "").toLowerCase().includes(brand.toLowerCase()),
          )
          .map((page) => ({ page, why: `title "${page.head.title ?? ""}"` })),
        { severity: "S3", severityReason: "brand-suffix consistency only" },
      );
    }
    report(
      "P4-01",
      `Titles over ${TITLE_MAX} characters`,
      "Shorten each title to about 50–65 characters, main topic first, so results do not cut it off.",
      live.flatMap((page) => {
        const length = page.head.title?.trim().length ?? 0;
        return length > TITLE_MAX
          ? [{ page, why: `title is ${length} characters` }]
          : [];
      }),
      {
        severity: "S4",
        severityReason:
          "handbook length range is [HEURISTIC]; Google indexes the full title",
      },
    );
    report(
      "P4-01",
      `Meta descriptions over ${DESCRIPTION_MAX} characters`,
      "Trim each meta description to about 150–160 characters so it is not cut off in results.",
      live.flatMap((page) => {
        const length = page.head.metaDescription?.trim().length ?? 0;
        return length > DESCRIPTION_MAX
          ? [{ page, why: `description is ${length} characters` }]
          : [];
      }),
      {
        severity: "S4",
        severityReason: "handbook length range is [HEURISTIC]",
      },
    );

    // P4-03 — description present.
    report(
      "P4-03",
      "Indexable pages without a meta description",
      "Write a specific meta description for every indexable page.",
      live
        .filter((s) => !s.head.metaDescription?.trim())
        .map((page) => ({ page, why: "missing/empty meta description" })),
      S2,
    );

    // P4-04 — viewport.
    report(
      "P4-04",
      "Viewport meta missing or blocks zoom",
      'Use `<meta name="viewport" content="width=device-width, initial-scale=1">` without maximum-scale/user-scalable limits.',
      live.flatMap((page) => {
        const v = (page.head.viewport ?? "").toLowerCase().replace(/\s/g, "");
        const why = [
          ...(v.includes("width=device-width")
            ? []
            : ["no width=device-width"]),
          ...(/initial-scale=1(\.0)?(,|$)/.test(v)
            ? []
            : ["no initial-scale=1"]),
          ...(/user-scalable=(no|0)|maximum-scale=1(\.0)?(,|$)/.test(v)
            ? ["zoom disabled"]
            : []),
        ];
        return why.length > 0
          ? [{ page, why: `"${page.head.viewport ?? ""}" — ${why.join(", ")}` }]
          : [];
      }),
      S2,
    );

    // P4-06 — years in listing/evergreen headings.
    const eventUrls = new Set(
      jsonld.status === "ok"
        ? jsonld.pages
            .filter((p) =>
              p.nodes.some((n) => n.types.some((t) => t.endsWith("Event"))),
            )
            .map((p) => normalizeUrl(p.url))
        : [],
    );
    const listingUrls = new Set(
      templates.status === "ok"
        ? templates.templates
            .filter((t) => t.urls.length >= 3)
            .flatMap((t) => t.urls.map(normalizeUrl))
        : [],
    );
    report(
      "P4-06",
      "Hard-coded years in listing/evergreen headings",
      "Drop the year from evergreen titles/H1s (or render it from the content date) so the page does not look stale next year.",
      live
        .filter(
          (s) =>
            (new URL(s.url).pathname === "/" ||
              listingUrls.has(normalizeUrl(s.url))) &&
            !eventUrls.has(normalizeUrl(s.url)),
        )
        .flatMap((page) => {
          const hit = [page.head.title ?? "", ...page.h1].find((t) =>
            YEAR.test(t),
          );
          return hit ? [{ page, why: `"${hit}"` }] : [];
        }),
      { severity: "S3" },
    );

    const sample = live.slice(0, 5).map(ref);
    out.pass(
      "P4-01",
      `${live.length} pages: unique title/description/H1, one H1 each`,
      sample,
    );
    out.pass("P4-03", `${live.length} pages carry a meta description`, sample);
    out.pass(
      "P4-04",
      `${live.length} pages: zoomable device-width viewport`,
      sample,
    );
    out.pass(
      "P4-06",
      "no year in home/listing-template headings (evergreen judgment pending, LLM B3)",
      sample,
    );
    return out.build();
  },
};
