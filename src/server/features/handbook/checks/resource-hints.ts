import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import { createResult, normalizeUrl, parseUrl } from "./support";

/**
 * P7-06 (raw HTML + render): preconnect only to origins the rendered page
 * uses; image preload only for the hero; ≤3 preloads. Split from
 * `lab-performance.ts`.
 */
const MAX_PRELOADS = 3;

const live = (s: PageSnapshot) =>
  s.status === 200 &&
  normalizeUrl(s.finalUrl) === normalizeUrl(s.url) &&
  /html/i.test(s.contentType ?? "html");

function absolute(url: string, base: string): string {
  const u = parseUrl(url, base);
  return u ? normalizeUrl(u.href) : url;
}

const host = (url: string) => {
  return parseUrl(url)?.host ?? url;
};

export const resourceHintsCheck: HandbookCheck = {
  id: "perf.resource-hints",
  itemIds: ["P7-06"],
  class: "PERF",
  requires: ["pages", "render"],
  run(ctx) {
    const out = createResult(["P7-06"]);
    const { pages, render } = ctx.collected;
    if (pages.status !== "ok" || render.status !== "ok") return out.build();
    const snapOf = new Map(
      pages.snapshots.map((s) => [normalizeUrl(s.url), s]),
    );
    const pairs = render.pages.flatMap((r) => {
      const s = snapOf.get(normalizeUrl(r.url));
      return s && live(s) ? [{ r, s }] : [];
    });
    if (pairs.length === 0) {
      out.na("P7-06", "no rendered 200 page");
      return out.build();
    }
    const rows = pairs.flatMap(({ r, s }) => {
      const used = new Set(r.js.requests.map((q) => host(q.url)));
      const hints = s.markup.headLinks;
      const why: string[] = [];
      for (const h of hints)
        if (/\bpreconnect\b/i.test(h.rel) && !used.has(host(h.href)))
          why.push(`preconnect to ${h.href} — no request to that origin`);
      const preloads = hints.filter((h) => /\bpreload\b/i.test(h.rel));
      if (preloads.length > MAX_PRELOADS)
        why.push(`${preloads.length} preloads (max ${MAX_PRELOADS})`);
      const hero = s.images[0];
      const heroUrls = hero
        ? [hero.src, hero.dataSrc, ...(hero.srcset ?? "").split(/,\s*/)]
            .filter((v): v is string => !!v)
            .map((v) => v.trim().split(/\s+/)[0])
        : [];
      for (const h of preloads)
        if (
          h.as === "image" &&
          !heroUrls.some((u) => absolute(u, s.url) === normalizeUrl(h.href))
        )
          why.push(`preload of non-hero image ${h.href}`);
      return why.length > 0 ? [{ r, s, why }] : [];
    });
    if (rows.length > 0)
      out.finding({
        itemIds: ["P7-06"],
        severity: "S3",
        title: "Resource hints point at unused origins or non-LCP assets",
        detail: rows
          .map(({ s, why }) => `${s.url} — ${why.join("; ")}`)
          .join("\n"),
        fix: "Keep preconnect for origins the first render uses, preload only the LCP image and blocking fonts, and re-test lab LCP after changing hints.",
        fixability: "FIXABLE",
        effort: "S",
        urls: rows.map(({ s }) => s.url),
        evidenceRefs: rows
          .slice(0, 5)
          .flatMap(({ r, s, why }) => [
            out.evidence(
              "rawHtml",
              s.url,
              [
                ...why,
                ...s.markup.headLinks.map(
                  (h) =>
                    `<link rel="${h.rel}" href="${h.href}"${h.as ? ` as="${h.as}"` : ""}>`,
                ),
              ].join("\n"),
              s.rawKey,
            ),
            out.evidence(
              "renderedDom",
              r.url,
              `request origins: ${[...new Set(r.js.requests.map((q) => host(q.url)))].join(", ")}`,
              r.js.renderedKey,
            ),
          ]),
      });
    else
      out.pass(
        "P7-06",
        `${pairs.length} rendered samples: preconnects used, image preload only for the hero, ≤ ${MAX_PRELOADS} preloads (LCP regression after hint changes not tracked)`,
        pairs
          .slice(0, 2)
          .map(({ s }) =>
            out.evidence(
              "rawHtml",
              s.url,
              s.markup.headLinks
                .map((h) => `<link rel="${h.rel}" href="${h.href}">`)
                .join("\n") || "no resource hints",
              s.rawKey,
            ),
          ),
      );
    return out.build();
  },
};
