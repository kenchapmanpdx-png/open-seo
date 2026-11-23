import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import { createResult } from "./support";

/**
 * CRAWL (handbook §19): sitemap `lastmod` is the last significant update,
 * never a build/deploy/migration date (P3-17). Deterministic smells per
 * sitemap file: ≥80% of ≥5 dated `<loc>` share one day, a date in the future,
 * or a value that is not a W3C datetime. Omitted lastmod is fine; provenance
 * per route type is owner evidence.
 */
const ITEMS = ["P3-17"];

const W3C =
  /^\d{4}(-\d{2}(-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?)?)?$/;
const DAY_MS = 86_400_000;

export const sitemapLastmodCheck: HandbookCheck = {
  id: "crawl.sitemap-lastmod",
  itemIds: ITEMS,
  class: "CRAWL",
  requires: ["sitemap"],
  run(ctx) {
    const out = createResult(ITEMS);
    const { sitemap } = ctx.collected;
    if (sitemap.status !== "ok") return out.build();
    const sources = sitemap.sources.filter((s) => s.kind === "urlset");
    if (sources.length === 0 || sitemap.urls.length === 0) {
      out.na("P3-17", 'no sitemap (see finding "No XML sitemap")');
      return out.build();
    }
    const now = Date.now();
    let dated = 0;
    for (const source of sources) {
      const urls = sitemap.urls.filter(
        (u) => u.source === source.url && u.lastmod,
      );
      dated += urls.length;
      const why: string[] = [];
      const byDay = new Map<string, number>();
      for (const u of urls) {
        const day = (u.lastmod ?? "").slice(0, 10);
        byDay.set(day, (byDay.get(day) ?? 0) + 1);
      }
      let [topDay, topCount] = ["", 0];
      for (const [day, n] of byDay)
        if (n > topCount) [topDay, topCount] = [day, n];
      if (urls.length >= 5 && topCount >= urls.length * 0.8)
        why.push(
          `${topCount}/${urls.length} <lastmod> = ${topDay} (build/deploy date)`,
        );
      const invalid = urls.filter((u) => !W3C.test(u.lastmod ?? ""));
      if (invalid.length > 0)
        why.push(
          `not W3C datetime: ${invalid
            .slice(0, 5)
            .map((u) => `${u.loc} "${u.lastmod}"`)
            .join(", ")}`,
        );
      const future = urls.filter(
        (u) =>
          W3C.test(u.lastmod ?? "") &&
          Date.parse(u.lastmod ?? "") > now + DAY_MS,
      );
      if (future.length > 0)
        why.push(
          `future: ${future
            .slice(0, 5)
            .map((u) => `${u.loc} ${u.lastmod}`)
            .join(", ")}`,
        );
      if (why.length === 0) continue;
      out.finding({
        itemIds: ["P3-17"],
        severity: "S3",
        title: "Sitemap lastmod is not a real last-update date",
        detail: `${source.url}\n${why.join("\n")}`,
        fix: "Emit lastmod from each route's content-update source (CMS field / git history of the content); omit it when unknown; never the build or deploy time.",
        fixability: "FIXABLE",
        effort: "M",
        urls: [source.url],
        evidenceRefs: [
          out.evidence(
            "sitemap",
            source.url,
            urls
              .slice(0, 40)
              .map((u) => `${u.loc} ${u.lastmod}`)
              .join("\n"),
            source.storageKey,
          ),
        ],
      });
    }
    out.pass(
      "P3-17",
      `${dated} dated <loc> across ${sources.length} sitemap(s): no shared build date, future or malformed values; provenance per route type is owner-recorded (status file)`,
      [
        out.evidence(
          "sitemap",
          sources[0]?.url ?? ctx.origin,
          sitemap.urls
            .slice(0, 40)
            .map((u) => `${u.loc} ${u.lastmod ?? "(no lastmod)"}`)
            .join("\n"),
          sources[0]?.storageKey,
        ),
      ],
    );
    return out.build();
  },
};
