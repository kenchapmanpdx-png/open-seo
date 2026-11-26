import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import type {
  CollectedData,
  UrlVariantKind,
  VariantsData,
} from "@/server/features/handbook/contracts/collectors";
import { createResult, originUrl, parseUrl, pathOf } from "./support";

/**
 * CRAWL (handbook §2, §10): one URL per page. Host/protocol variants reach
 * the canonical origin in one 301/308 hop (P3-01); the other trailing-slash
 * form 301/308s or 404s (P3-02); `/index.html` is not a live duplicate and no
 * page links to it (P3-03); `/page/2/` is not a 200 copy of the homepage
 * (P3-12). An upper-case path that answers 200 is noted under P3-03: the
 * probe carries no canonical (contracts 1.5.1), so it is not judged a
 * duplicate. A plain-HTTP URL that answers a bot UA with an interstitial
 * instead of redirecting also opens P3-01 (bot-fetch escalation probes).
 * Input: the variants collector's probes + bot fetches.
 */
const ITEMS = ["P3-01", "P3-02", "P3-03", "P3-12"];

type Probe = VariantsData["probes"][number];

const HOST_KINDS: readonly UrlVariantKind[] = [
  "http-apex",
  "http-www",
  "https-apex",
  "https-www",
];
const PERMANENT = new Set([301, 308]);

const describe = (p: Probe) =>
  [
    ...p.redirectChain.map((hop) => `${hop.status} ${hop.url}`),
    `${p.status} ${p.finalUrl}`,
  ].join("\n→ ");

/** Why a redirect probe breaks "one permanent hop to `target`", or null. */
function hopProblem(p: Probe, target: (url: string) => boolean) {
  const temporary = p.redirectChain.find((h) => !PERMANENT.has(h.status));
  if (temporary) return `${temporary.status} (temporary) hop`;
  if (!target(p.finalUrl)) return `ends at ${p.finalUrl}`;
  if (p.redirectChain.length > 1)
    return `${p.redirectChain.length} hops (want 1)`;
  return null;
}

/** Plain-HTTP URLs that answered a bot with an interstitial, not a redirect. */
function plainHttpChallenges(botFetch: CollectedData["botFetch"]) {
  if (botFetch.status !== "ok") return [];
  const hits = botFetch.fetches.filter(
    (f) =>
      f.bot !== "browser" &&
      f.url.startsWith("http:") &&
      f.finalUrl.startsWith("http:") &&
      f.status === 200 &&
      (f.blockedReason?.startsWith("interstitial:") ?? false),
  );
  return [...new Set(hits.map((f) => f.url))].map((url) => {
    const rows = hits.filter((f) => f.url === url);
    const bots = [...new Set(rows.map((f) => f.bot))];
    return {
      url,
      why: `serves ${rows[0]?.blockedReason} to ${bots.join(", ")} over plain HTTP instead of redirecting`,
      evidence: rows
        .map(
          (f) =>
            `${f.bot} round ${f.round ?? 1}: HTTP ${f.status}, ${f.blockedReason}, ${f.words} words, sha256 ${f.bodySha256.slice(0, 12)}`,
        )
        .join("\n"),
    };
  });
}

/** The home page's canonical origin; a missing or malformed canonical falls back to the run origin. */
function canonicalOriginOf(
  canonical: string | null | undefined,
  origin: string,
) {
  return parseUrl(canonical ?? "")?.origin ?? originUrl(origin).origin;
}

/** A same-origin link to `…/index.html` (P3-03). */
function indexHtmlLink(href: string, pageUrl: string) {
  const u = parseUrl(href);
  return (
    !!u &&
    u.origin === parseUrl(pageUrl)?.origin &&
    /\/index\.html?$/i.test(u.pathname)
  );
}

export const urlVariantsCheck: HandbookCheck = {
  id: "crawl.url-variants",
  itemIds: ITEMS,
  class: "CRAWL",
  requires: ["variants", "pages"],
  run(ctx) {
    const out = createResult(ITEMS);
    const { variants, pages } = ctx.collected;
    if (variants.status !== "ok" || pages.status !== "ok") return out.build();
    const home = pages.snapshots.find(
      (s) => pathOf(s.url) === "/" && s.status === 200,
    );
    const canonicalOrigin = canonicalOriginOf(home?.head.canonical, ctx.origin);
    const probe = (p: Probe) =>
      out.evidence("redirectChain", p.url, describe(p));

    // P3-01 — host / protocol variants.
    const hostProbes = variants.probes.filter(
      (p) =>
        HOST_KINDS.includes(p.kind) &&
        parseUrl(p.url)?.origin !== canonicalOrigin,
    );
    const hostIssues = hostProbes.flatMap((p) => {
      if (p.redirectChain.length === 0) {
        const why =
          p.status === 200
            ? "answers 200 (duplicate host)"
            : `answers ${p.status} without redirecting`;
        return [{ p, why }];
      }
      const why = hopProblem(
        p,
        (url) => parseUrl(url)?.origin === canonicalOrigin,
      );
      return why ? [{ p, why }] : [];
    });
    // A plain-HTTP URL that serves a bot an interstitial (200) instead of
    // redirecting is a host-variant failure even when the browser gets the
    // HTTPS redirect (bot-parity escalation, WO-B9-009).
    const httpChallenges = canonicalOrigin.startsWith("https:")
      ? plainHttpChallenges(ctx.collected.botFetch)
      : [];
    if (hostIssues.length > 0 || httpChallenges.length > 0) {
      // Permanent chains that still land on the canonical origin only waste a
      // hop; duplicates, temporary or wrong-target redirects stay S1.
      const chainsOnly =
        httpChallenges.length === 0 &&
        hostIssues.every(({ why }) => why.endsWith(" hops (want 1)"));
      out.finding({
        itemIds: ["P3-01"],
        ...(chainsOnly
          ? {
              severity: "S4" as const,
              severityReason:
                "permanent chain reaches the canonical origin; extra hop only",
            }
          : { severity: "S1" as const }),
        title: chainsOnly
          ? "Host/protocol variants reach the canonical origin in more than one hop"
          : "Host/protocol variants do not 301/308 to the canonical origin",
        detail: [
          ...hostIssues.map(({ p, why }) => `${p.url} — ${why}`),
          ...httpChallenges.map((c) => `${c.url} — ${c.why}`),
        ].join("\n"),
        fix: `Redirect every http:// and apex/www variant to ${canonicalOrigin}/ in one 301 or 308 hop (no 302/307, no chains), for every user agent: the bot check must not answer plain HTTP before the redirect.`,
        fixability: "FIXABLE",
        effort: "S",
        urls: [
          ...hostIssues.map(({ p }) => p.url),
          ...httpChallenges.map((c) => c.url),
        ],
        evidenceRefs: [
          ...hostIssues.map(({ p }) => probe(p)),
          ...httpChallenges.map((c) =>
            out.evidence("botFetch", c.url, c.evidence),
          ),
        ],
      });
    } else if (hostProbes.length > 0) {
      out.pass(
        "P3-01",
        `${hostProbes.length} variant(s) reach ${canonicalOrigin} in one permanent hop; variants that failed to fetch (no DNS/TLS) not judged`,
        hostProbes.map(probe),
      );
    } else {
      out.na("P3-01", "no fetchable non-canonical host/protocol variant");
    }

    // P3-02 — toggled trailing slash on one inner route.
    const slash = variants.probes.find(
      (p) => p.kind === "trailing-slash" || p.kind === "no-trailing-slash",
    );
    const toggled = slash && parseUrl(slash.url);
    if (!slash || !toggled) {
      out.na("P3-02", "no inner route to toggle the trailing slash on");
    } else {
      const crawledPath =
        slash.kind === "trailing-slash"
          ? toggled.pathname.slice(0, -1)
          : `${toggled.pathname}/`;
      const why =
        slash.redirectChain.length === 0
          ? slash.status === 200
            ? `both ${crawledPath} and ${toggled.pathname} answer 200 (duplicate)`
            : null // 404/410/other error = one policy
          : hopProblem(slash, (url) => pathOf(url) === crawledPath);
      if (why) {
        out.finding({
          itemIds: ["P3-02"],
          severity: "S3",
          title: "Trailing-slash variant is a live duplicate or bad redirect",
          detail: `${slash.url} — ${why}`,
          fix: `Pick one trailing-slash form site-wide and 301/308 the other to it in one hop (here ${toggled.pathname} → ${crawledPath}).`,
          fixability: "FIXABLE",
          effort: "S",
          urls: [slash.url],
          evidenceRefs: [probe(slash)],
        });
      } else {
        out.pass(
          "P3-02",
          `${slash.url} → ${slash.status} (one policy; one route probed, nested routes not probed)`,
          [probe(slash)],
        );
      }
    }

    // P3-03 — /index.html probe + links to index.html.
    const index = variants.probes.find((p) => p.kind === "index-html");
    const passRefs: string[] = [];
    if (index) {
      // WO-B25-004: a chain that ends in 404 / 410 serves no duplicate.
      const why =
        index.redirectChain.length === 0
          ? index.status === 200
            ? "/index.html answers 200 (duplicate of /)"
            : null
          : index.status === 404 || index.status === 410
            ? null
            : hopProblem(index, (url) => pathOf(url) === "/");
      if (why) {
        out.finding({
          itemIds: ["P3-03"],
          severity: "S3",
          title: "/index.html is a live duplicate of the homepage",
          detail: `${index.url} — ${why}`,
          fix: "301/308 /index.html to / in one hop (or return 404).",
          fixability: "FIXABLE",
          effort: "S",
          urls: [index.url],
          evidenceRefs: [probe(index)],
        });
      } else {
        passRefs.push(probe(index));
      }
    }
    const linkers = pages.snapshots.flatMap((s) => {
      const hrefs = s.links
        .map((l) => l.href)
        .filter((href) => indexHtmlLink(href, s.finalUrl));
      return hrefs.length > 0 ? [{ s, hrefs }] : [];
    });
    if (linkers.length > 0) {
      out.finding({
        itemIds: ["P3-03"],
        severity: "S3",
        title: "Internal links point at index.html instead of the clean URL",
        detail: linkers
          .map(({ s, hrefs }) => `${s.url} → ${hrefs.join(", ")}`)
          .join("\n"),
        fix: "Link the logo/nav to `/` (and directory URLs to their clean form), not `…/index.html`.",
        fixability: "FIXABLE",
        effort: "S",
        urls: linkers.map(({ s }) => s.url),
        evidenceRefs: linkers.map(({ s, hrefs }) =>
          out.evidence(
            "rawHtml",
            s.url,
            hrefs.map((h) => `<a href="${h}">`).join("\n"),
            s.rawKey,
          ),
        ),
      });
    }
    const upper = variants.probes.find((p) => p.kind === "uppercase-path");
    const upperNote =
      upper && upper.status === 200 && upper.redirectChain.length === 0
        ? `; ${pathOf(upper.url)} answers 200 without redirecting (case variant; canonical not recorded)`
        : "";
    if (upper && upperNote) passRefs.push(probe(upper));
    if (passRefs.length > 0) {
      out.pass(
        "P3-03",
        `/index.html → ${index?.status ?? "not fetched"}${index && index.redirectChain.length > 0 && (index.status === 404 || index.status === 410) ? ` (ends in ${index.status})` : ""}; no internal links to index.html; query variants not probed${upperNote}`,
        passRefs,
      );
    } else if (!index) {
      out.na("P3-03", "index.html probe not fetched");
    }

    // P3-12 — `/page/2/` serving the homepage again (same title, ±10 % words).
    const paged = variants.probes.find((p) => p.kind === "paginated-home");
    if (
      paged &&
      home &&
      paged.status === 200 &&
      pathOf(paged.finalUrl) !== "/" &&
      paged.title !== null &&
      paged.title === home.head.title &&
      Math.abs(paged.words - home.wordsRaw) <= home.wordsRaw * 0.1
    ) {
      out.finding({
        itemIds: ["P3-12"],
        severity: "S4",
        severityReason: "one duplicate URL; reachable only if linked",
        title: "Paginated home copy: /page/2/ serves the homepage",
        detail: `${paged.url} → 200 "${paged.title}" (${paged.words} words; home ${home.wordsRaw})`,
        fix: "Return 404 for /page/N/ beyond the last page of the home listing, or 301 it to /.",
        fixability: "FIXABLE",
        effort: "S",
        urls: [paged.url, home.url],
        evidenceRefs: [probe(paged)],
      });
    }
    return out.build();
  },
};
