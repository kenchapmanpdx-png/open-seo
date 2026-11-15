import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import { createResult, normalizeUrl } from "./support";

/**
 * CRAWL (handbook §10): internal links point at final 200 URLs, not at
 * redirects or retired 404/410 URLs (P3-08); a moved URL redirects to the
 * closest relevant page, never the homepage (P3-05); retired items still
 * linked are listed with their 404/410 status (P3-07 — the "closest
 * equivalent" judgment is LLM work in B3). Only links between crawled pages
 * are judged; un-crawled targets are skipped.
 */
const ITEMS = ["P3-08", "P3-05", "P3-07"];

const pathOf = (url: string) => new URL(url).pathname;
const redirected = (s: PageSnapshot) =>
  normalizeUrl(s.finalUrl) !== normalizeUrl(s.url);
const retired = (s: PageSnapshot) => s.status === 404 || s.status === 410;

export const redirectedLinksCheck: HandbookCheck = {
  id: "crawl.redirected-links",
  itemIds: ITEMS,
  class: "CRAWL",
  requires: ["pages"],
  run(ctx) {
    const out = createResult(ITEMS);
    const { pages } = ctx.collected;
    if (pages.status !== "ok") return out.build();
    const byUrl = new Map(pages.snapshots.map((s) => [normalizeUrl(s.url), s]));

    // target URL → source pages linking to it
    const linkedFrom = new Map<string, Set<string>>();
    for (const source of pages.snapshots) {
      for (const link of source.links) {
        const target = normalizeUrl(link.href);
        if (target === normalizeUrl(source.url)) continue;
        const set = linkedFrom.get(target) ?? new Set<string>();
        set.add(source.url);
        linkedFrom.set(target, set);
      }
    }
    const describe = (t: PageSnapshot) =>
      redirected(t)
        ? `${t.url} → ${t.finalUrl} (${t.status})`
        : `${t.url} → ${t.status}`;
    const evidenceFor = (t: PageSnapshot) => {
      const sources = [...(linkedFrom.get(normalizeUrl(t.url)) ?? [])];
      return out.evidence(
        "status",
        t.url,
        `${describe(t)}\nlinked from:\n${sources.slice(0, 20).join("\n")}`,
      );
    };

    const badTargets = [...linkedFrom.keys()].flatMap((url) => {
      const t = byUrl.get(url);
      return t && (redirected(t) || retired(t)) ? [t] : [];
    });
    if (badTargets.length > 0) {
      out.finding({
        itemIds: ["P3-08"],
        severity: "S3",
        title: "Internal links point at redirected or retired URLs",
        detail: badTargets
          .map(
            (t) =>
              `${describe(t)} — linked from ${[...(linkedFrom.get(normalizeUrl(t.url)) ?? [])].slice(0, 5).join(", ")}`,
          )
          .join("\n"),
        fix: "Update each internal link to the final 200 URL (or remove links to retired pages).",
        fixability: "FIXABLE",
        effort: "S",
        urls: badTargets.map((t) => t.url),
        evidenceRefs: badTargets.slice(0, 20).map(evidenceFor),
      });
    } else {
      out.pass(
        "P3-08",
        `${linkedFrom.size} internal link targets among crawled pages; none redirect or 404`,
        [
          out.evidence(
            "url",
            ctx.origin,
            [...linkedFrom.keys()].slice(0, 50).join("\n"),
          ),
        ],
      );
    }

    // P3-05 — any crawled non-root URL that redirects to the homepage.
    const moved = pages.snapshots.filter((s) => redirected(s));
    const toHome = moved.filter(
      (s) => pathOf(s.finalUrl) === "/" && pathOf(s.url) !== "/",
    );
    if (toHome.length > 0) {
      out.finding({
        itemIds: ["P3-05"],
        severity: "S1",
        title: "Moved URLs redirect to the homepage",
        detail: toHome.map(describe).join("\n"),
        fix: "Redirect each moved URL to its closest relevant page (same topic/item); if none exists, return 410 instead of sending visitors to the homepage.",
        fixability: "FIXABLE",
        effort: "S",
        urls: toHome.map((s) => s.url),
        evidenceRefs: toHome.slice(0, 20).map(evidenceFor),
      });
    } else if (moved.length > 0) {
      out.pass(
        "P3-05",
        `${moved.length} redirected URL(s), none to the homepage (closest-relevant judgment pending, LLM B3)`,
        moved.slice(0, 20).map(evidenceFor),
      );
    } else {
      out.na("P3-05", "no redirected URL among crawled pages");
    }

    // P3-07 — retired (404/410) URLs still linked internally.
    const gone = badTargets.filter(retired);
    if (gone.length > 0) {
      out.finding({
        itemIds: ["P3-07"],
        severity: "S3",
        title: "Retired URLs are still linked internally",
        detail: `${gone.map(describe).join("\n")}\nclosest-equivalent judgment pending (LLM, B3)`,
        fix: "Point retired items at a no-longer-offered page or the closest equivalent; return 410 when there is no demand, and drop internal links to them.",
        fixability: "FIXABLE",
        effort: "S",
        urls: gone.map((t) => t.url),
        evidenceRefs: gone.slice(0, 20).map(evidenceFor),
      });
    }
    return out.build();
  },
};
