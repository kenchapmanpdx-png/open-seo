import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import { MAX_TARGETS } from "@/server/features/handbook/collectors/link-targets";
import { effectiveStatus } from "@/server/features/handbook/collectors/probe";
import { createResult, normalizeUrl } from "./support";

/**
 * CRAWL (handbook §10): internal links point at final 200 URLs, not at
 * redirects or retired 404/410 URLs (P3-08); a moved URL redirects to the
 * closest relevant page, never the homepage (P3-05); retired items still
 * linked are listed with their 404/410 status (P3-07 — the "closest
 * equivalent" judgment is LLM work in B3). Only links between crawled pages
 * are judged by their crawl fetch; un-crawled internal targets by the
 * `linkTargets` probe (ADR-031, cap 200); targets with no answer are counted,
 * not flagged.
 */
const ITEMS = ["P3-08", "P3-05", "P3-07"];

type Target = Pick<PageSnapshot, "url" | "finalUrl" | "status"> & {
  sources: string[];
};

const pathOf = (url: string) => new URL(url).pathname;
const redirected = (s: Pick<PageSnapshot, "url" | "finalUrl">) =>
  normalizeUrl(s.finalUrl) !== normalizeUrl(s.url);
const retired = (s: Pick<PageSnapshot, "status">) =>
  s.status === 404 || s.status === 410;

/**
 * One row per bad target; redirects sharing a final URL collapse into one
 * row (a site-wide relative link resolves to a new URL per page).
 */
function groupRows(targets: Target[], describe: (t: Target) => string) {
  const groups = new Map<string, Target[]>();
  for (const t of targets) {
    const key = redirected(t)
      ? normalizeUrl(t.finalUrl)
      : `${normalizeUrl(t.url)} ${t.status}`;
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  return [...groups.values()].map((g) => {
    const sources = [...new Set(g.flatMap((t) => t.sources))];
    const from = `linked from ${sources.length} page(s), e.g. ${sources.slice(0, 3).join(", ")}`;
    if (g.length === 1) return `${describe(g[0])} — ${from}`;
    const [first] = g;
    return `${g.length} URLs → ${first.finalUrl}, e.g. ${g
      .slice(0, 3)
      .map((t) => t.url)
      .join(", ")} — ${from}`;
  });
}

export const redirectedLinksCheck: HandbookCheck = {
  id: "crawl.redirected-links",
  itemIds: ITEMS,
  class: "CRAWL",
  requires: ["pages"],
  run(ctx) {
    const out = createResult(ITEMS);
    const { pages, linkTargets } = ctx.collected;
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
    const describe = (t: Target) =>
      redirected(t)
        ? `${t.url} → ${t.finalUrl}${t.status === 200 ? "" : ` (final answer ${t.status})`}`
        : `${t.url} → ${t.status}`;
    const evidenceFor = (t: Target) =>
      out.evidence(
        "status",
        t.url,
        `${describe(t)}\nlinked from:\n${t.sources.slice(0, 20).join("\n")}`,
      );

    const crawledTargets: Target[] = [...linkedFrom].flatMap(([url, from]) => {
      const t = byUrl.get(url);
      return t ? [{ ...t, sources: [...from] }] : [];
    });
    // Un-crawled internal targets probed by the linkTargets collector (ADR-031).
    const probed = linkTargets.status === "ok" ? linkTargets.targets : [];
    const probedTargets: Target[] = probed.flatMap((p) =>
      p.probe
        ? [
            {
              url: p.url,
              finalUrl: p.probe.browserRetest?.finalUrl ?? p.probe.finalUrl,
              status: effectiveStatus(p.probe) ?? p.probe.status,
              sources: [...p.sourceUrls],
            },
          ]
        : [],
    );
    const unanswered = probed.length - probedTargets.length;
    const probeNote =
      linkTargets.status === "ok"
        ? `; ${probed.length} un-crawled internal target(s) probed (found ${linkTargets.found}, cap ${MAX_TARGETS}), ${unanswered} without an answer`
        : "";

    const badTargets = [...crawledTargets, ...probedTargets].filter(
      (t) => redirected(t) || retired(t),
    );
    if (badTargets.length > 0) {
      out.finding({
        itemIds: ["P3-08"],
        severity: "S3",
        title: "Internal links point at redirected or retired URLs",
        detail: `${groupRows(badTargets, describe).join("\n")}${probeNote}`,
        fix: "Update each internal link to the final 200 URL (or remove links to retired pages). A row covering many URLs is usually one link in a shared template (header, footer, menu).",
        fixability: "FIXABLE",
        effort: "S",
        urls: badTargets.map((t) => t.url),
        evidenceRefs: badTargets.slice(0, 20).map(evidenceFor),
      });
    } else {
      out.pass(
        "P3-08",
        `${linkedFrom.size} internal link targets among crawled pages; none redirect or 404${probeNote}`,
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
    const moved: Target[] = pages.snapshots
      .filter((s) => redirected(s))
      .map((s) => ({
        ...s,
        sources: [...(linkedFrom.get(normalizeUrl(s.url)) ?? [])],
      }));
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
