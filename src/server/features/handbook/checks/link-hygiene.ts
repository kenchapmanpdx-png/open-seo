import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import { createResult, normalizeUrl, originUrl, parseUrl } from "./support";

/**
 * Semrush GAP checks (B17 §9 #10, T13), raw HTML of read pages, not scored
 * (Additional findings):
 * - SUPP-21 mixed content: `http://` `<img>`, `<script>` or stylesheet on an
 *   HTTPS page.
 * - SUPP-22 internal links to `http://` URLs of the site's own host on an
 *   HTTPS site.
 * - SUPP-23 `<meta http-equiv="refresh">` redirects.
 * - SUPP-24 malformed link URLs: unparseable, a scheme typo (`htp:`), a
 *   missing `//` (`http//…` resolved as a path), a bare `www.` path segment,
 *   `mailto:` without `@`, `tel:` without digits.
 * - SUPP-25 internal links to crawled URLs whose redirect chain has a
 *   302 / 303 / 307 hop (crawl fetch `redirectChain`, 1.10.0).
 * - SUPP-26 HTML pages without `<!doctype>` (1.10.0).
 * One finding per rule, page rows.
 */
const ITEMS = [
  "SUPP-21",
  "SUPP-22",
  "SUPP-23",
  "SUPP-24",
  "SUPP-25",
  "SUPP-26",
];
const TEMPORARY = new Set([302, 303, 307]);
const MAX_EVIDENCE = 20;

const live = (s: PageSnapshot) =>
  s.status === 200 && normalizeUrl(s.finalUrl) === normalizeUrl(s.url);
const isHttp = (url: string | null | undefined): url is string =>
  !!url && /^http:\/\//i.test(url);
const line = ({ s, bad }: { s: PageSnapshot; bad: string[] }) =>
  `${s.url} — ${[...new Set(bad)].slice(0, 10).join(", ")}`;

function malformed(href: string): string | null {
  if (/^(mailto):/i.test(href))
    return href.includes("@") ? null : "mailto without @";
  if (/^tel:/i.test(href)) return /\d/.test(href) ? null : "tel without digits";
  if (/^(javascript|data|sms|whatsapp|skype|ftp|callto|fb|viber):/i.test(href))
    return null;
  if (/^h?t{1,3}ps?:/i.test(href) && !/^https?:/i.test(href))
    return "scheme typo";
  const url = parseUrl(href);
  if (!url) return "not a valid URL";
  if (/\/https?\/\//i.test(url.pathname)) return "missing ':' after http";
  if (/\/www\.[a-z0-9-]+\.[a-z]/i.test(url.pathname))
    return "domain written as a relative path (missing https://)";
  return null;
}

/** Pages linking to a crawled URL whose redirect chain has a temporary hop. */
function temporaryTargets(snapshots: readonly PageSnapshot[]) {
  const temporary = new Map(
    snapshots.flatMap((s) => {
      const hops = (s.redirectChain ?? []).filter((h) =>
        TEMPORARY.has(h.status),
      );
      return hops.length > 0
        ? [
            [
              normalizeUrl(s.url),
              `${s.url} → ${hops.map((h) => h.status).join(" → ")} → ${s.finalUrl}`,
            ] as const,
          ]
        : [];
    }),
  );
  return snapshots.flatMap((s) => {
    const bad = [...new Set(s.links.map((l) => normalizeUrl(l.href)))].flatMap(
      (href) => temporary.get(href) ?? [],
    );
    return bad.length > 0 ? [{ s, bad }] : [];
  });
}

export const linkHygieneCheck: HandbookCheck = {
  id: "crawl.link-hygiene",
  itemIds: ITEMS,
  class: "CRAWL",
  requires: ["pages"],
  run(ctx) {
    const out = createResult(ITEMS);
    const { pages } = ctx.collected;
    if (pages.status !== "ok") return out.build();
    const host = originUrl(ctx.origin).host.replace(/^www\./, "");
    const secure = pages.snapshots.filter(
      (s) => live(s) && s.url.startsWith("https://"),
    );
    const ownHost = (url: string) => {
      return (parseUrl(url)?.host ?? "").replace(/^www\./, "") === host;
    };

    const rules = [
      {
        itemId: "SUPP-21",
        severity: "S2" as const,
        title: "Mixed content: http:// resources on HTTPS pages",
        fix: "Load every image, script and stylesheet over https:// (update the theme setting, page builder field or hard-coded URL); browsers block or flag http:// resources on HTTPS pages.",
        rows: secure.flatMap((s) => {
          const bad = [
            ...s.images.map((i) => i.src).filter(isHttp),
            ...s.markup.scripts.map((x) => x.src).filter(isHttp),
            ...s.markup.headLinks
              .filter((l) => l.rel.includes("stylesheet"))
              .map((l) => l.href)
              .filter(isHttp),
          ];
          return bad.length > 0 ? [{ s, bad }] : [];
        }),
      },
      {
        itemId: "SUPP-22",
        severity: "S3" as const,
        title: "Internal links point at http:// URLs",
        fix: "Change each internal link to its https:// URL (usually a menu item or a hard-coded link in the content); every click otherwise goes through a redirect.",
        rows: ctx.origin.startsWith("https://")
          ? secure.flatMap((s) => {
              const bad = s.links
                .map((l) => l.href)
                .filter((h) => isHttp(h) && ownHost(h));
              return bad.length > 0 ? [{ s, bad }] : [];
            })
          : [],
      },
      {
        itemId: "SUPP-23",
        severity: "S3" as const,
        title: "Pages redirect with a meta refresh",
        fix: "Replace each meta refresh with a server-side 301 to the target URL (or remove it if the page should stay).",
        rows: pages.snapshots.flatMap((s) => {
          const refresh = s.head.meta["http-equiv:refresh"];
          return refresh !== undefined && /url\s*=/i.test(refresh)
            ? [{ s, bad: [`<meta http-equiv="refresh" content="${refresh}">`] }]
            : [];
        }),
      },
      {
        itemId: "SUPP-24",
        severity: "S3" as const,
        title: "Malformed link URLs",
        fix: "Fix each href (full https:// URL, no typos, mailto: with an address); these links lead nowhere or to a 404 under your own domain.",
        rows: pages.snapshots.flatMap((s) => {
          const bad = s.links.flatMap((l) => {
            const why = malformed(l.href);
            return why ? [`${l.href} (${why})`] : [];
          });
          return bad.length > 0 ? [{ s, bad }] : [];
        }),
      },
      {
        itemId: "SUPP-25",
        severity: "S3" as const,
        title: "Internal links go through temporary redirects",
        fix: "Point each link at the final URL; if the move is permanent, make the redirect a 301 / 308.",
        rows: temporaryTargets(pages.snapshots),
      },
      {
        itemId: "SUPP-26",
        severity: "S4" as const,
        title: "HTML pages without a doctype",
        fix: "Start every page with <!DOCTYPE html> (usually one theme header file) so browsers render in standards mode.",
        rows: pages.snapshots.flatMap((s) =>
          live(s) && s.doctype === null ? [{ s, bad: ["no <!doctype>"] }] : [],
        ),
      },
    ];
    for (const rule of rules) {
      if (rule.rows.length === 0) continue;
      out.finding({
        itemIds: [rule.itemId],
        severity: rule.severity,
        title: `${rule.title} (${rule.rows.length} page${rule.rows.length === 1 ? "" : "s"})`,
        detail: rule.rows.map(line).join("\n"),
        fix: rule.fix,
        fixability: "FIXABLE",
        effort: "S",
        urls: rule.rows.map(({ s }) => s.url),
        evidenceRefs: rule.rows
          .slice(0, MAX_EVIDENCE)
          .map((row) =>
            out.evidence("rawHtml", row.s.url, line(row), row.s.rawKey),
          ),
      });
    }
    return out.build();
  },
};
