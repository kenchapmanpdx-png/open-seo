import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import type {
  UrlVariantKind,
  VariantsData,
} from "@/server/features/handbook/contracts/collectors";
import { createResult } from "./support";

/**
 * CRAWL (handbook §2, §10): one URL per page. Host/protocol variants reach
 * the canonical origin in one 301/308 hop (P3-01); the other trailing-slash
 * form 301/308s or 404s (P3-02); `/index.html` is not a live duplicate and no
 * page links to it (P3-03). Input: the variants collector's probes.
 */
const ITEMS = ["P3-01", "P3-02", "P3-03"];

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
  if (p.redirectChain.length > 1)
    return `${p.redirectChain.length} hops (want 1)`;
  if (!target(p.finalUrl)) return `ends at ${p.finalUrl}`;
  return null;
}

const pathOf = (url: string) => new URL(url).pathname;

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
    const canonicalOrigin = new URL(home?.head.canonical ?? ctx.origin).origin;
    const probe = (p: Probe) =>
      out.evidence("redirectChain", p.url, describe(p));

    // P3-01 — host / protocol variants.
    const hostProbes = variants.probes.filter(
      (p) =>
        HOST_KINDS.includes(p.kind) &&
        new URL(p.url).origin !== canonicalOrigin,
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
        (url) => new URL(url).origin === canonicalOrigin,
      );
      return why ? [{ p, why }] : [];
    });
    if (hostIssues.length > 0) {
      out.finding({
        itemIds: ["P3-01"],
        severity: "S1",
        title: "Host/protocol variants do not 301/308 to the canonical origin",
        detail: hostIssues.map(({ p, why }) => `${p.url} — ${why}`).join("\n"),
        fix: `Redirect every http:// and apex/www variant to ${canonicalOrigin}/ in one 301 or 308 hop (no 302/307, no chains).`,
        fixability: "FIXABLE",
        effort: "S",
        urls: hostIssues.map(({ p }) => p.url),
        evidenceRefs: hostIssues.map(({ p }) => probe(p)),
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
    if (!slash) {
      out.na("P3-02", "no inner route to toggle the trailing slash on");
    } else {
      const toggled = new URL(slash.url);
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
      const why =
        index.redirectChain.length === 0
          ? index.status === 200
            ? "/index.html answers 200 (duplicate of /)"
            : null
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
        .filter((href) => {
          const u = new URL(href);
          return (
            u.origin === new URL(s.finalUrl).origin &&
            /\/index\.html?$/i.test(u.pathname)
          );
        });
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
    if (passRefs.length > 0) {
      out.pass(
        "P3-03",
        `/index.html → ${index?.status}; no internal links to index.html; query variants not probed`,
        passRefs,
      );
    } else if (!index) {
      out.na("P3-03", "index.html probe not fetched");
    }
    return out.build();
  },
};
