import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import type { OutboundData } from "@/server/features/handbook/contracts/collectors";
import { createResult, normalizeUrl, parseUrl } from "./support";

/**
 * BOTFETCH/CRAWL (handbook §12): outbound and third-party conversion links
 * are not dead (P5-13; ADR-031: 404, 410, 5xx other than 503 = finding; no
 * HTTP answer after the late re-probe = "not confirmed dead", info only,
 * WO-B26-006; redirects = one S4 "(info)" finding; bot or platform blocks
 * (incl. 503) and other statuses = info only); `target="_blank"` links carry noopener (noreferrer
 * implies it; noreferrer alone on internal links is by intent) (P4-12).
 */
const ITEMS = ["P5-13", "P4-12"];

type Link = OutboundData["links"][number];

const BLOCKED = new Set([401, 403, 429, 503]);
const DEAD = new Set([404, 410]);

const isRedirect = (status: number) => status >= 300 && status < 400;

/** A redirect answer (offsite fetches stop at the 3xx) or a 200 at another URL. */
const moved = (link: Link) =>
  link.browser !== null &&
  (isRedirect(link.browser.status) ||
    (link.browser.status === 200 &&
      normalizeUrl(link.browser.finalUrl) !== normalizeUrl(link.url)));

/** A server error that survived the probe's retry; 503 is usually a bot wall. */
const serverError = (status: number) => status >= 500 && !BLOCKED.has(status);

/** A host with no dot (and not IPv6) is not a public domain name: provably unresolvable. */
const noDomain = (url: string) => {
  const host = parseUrl(url)?.hostname ?? ".";
  return !host.includes(".") && !host.startsWith("[");
};

/**
 * Dead = an HTTP answer that says so: 404, 410 or 5xx (ADR-031). No answer
 * at all (DNS, connect or timeout, twice, ≥ 30 s apart) is not proof from one
 * machine (WO-B26-006): the probe cannot tell a name that does not exist
 * from a timeout, so every no-answer is "not confirmed dead", except a host
 * with no domain (B26 exit).
 */
function deadReason(link: Link): string | null {
  if (!link.browser)
    return noDomain(link.url)
      ? "no answer; the host name has no domain, so it cannot resolve"
      : null;
  const s = link.browser.status;
  if (DEAD.has(s) || serverError(s)) return `browser gets ${s}`;
  return null;
}

/** Info only, never a finding: bot / platform blocks, other statuses. */
function infoReason(link: Link): string | null {
  if (!link.browser || deadReason(link) || moved(link)) return null;
  if (link.browser.status !== 200) return `browser gets ${link.browser.status}`;
  if (link.bot && BLOCKED.has(link.bot.status))
    return `${link.bot.name} gets ${link.bot.status}`;
  return null;
}

const status = (l: Link) =>
  `${l.url} — browser ${l.browser ? `${l.browser.status} → ${l.browser.finalUrl}` : "failed"}; ${l.bot?.name ?? "bot"} ${l.bot ? l.bot.status : "failed"}`;

export const outboundLinksCheck: HandbookCheck = {
  id: "botfetch.outbound-links",
  itemIds: ITEMS,
  class: "BOTFETCH",
  requires: ["pages"],
  run(ctx) {
    const out = createResult(ITEMS);
    const { pages, outbound } = ctx.collected;
    if (pages.status !== "ok") return out.build();

    // P4-12 — target=_blank without noopener/noreferrer.
    const blank = pages.snapshots.flatMap((s) => {
      const bad = s.links.filter(
        (l) =>
          l.target?.toLowerCase() === "_blank" &&
          !/\bnoopener\b|\bnoreferrer\b/i.test(l.rel ?? ""),
      );
      return bad.length > 0 ? [{ s, bad }] : [];
    });
    if (blank.length > 0) {
      out.finding({
        itemIds: ["P4-12"],
        severity: "S4",
        title: 'target="_blank" links without rel="noopener"',
        detail: blank
          .map(
            ({ s, bad }) => `${s.url} — ${bad.map((l) => l.href).join(", ")}`,
          )
          .join("\n"),
        fix: 'Add rel="noopener" to every target="_blank" link (noreferrer only where hiding the referrer is intended).',
        fixability: "FIXABLE",
        effort: "S",
        urls: blank.map(({ s }) => s.url),
        evidenceRefs: blank
          .slice(0, 20)
          .map(({ s, bad }) =>
            out.evidence(
              "rawHtml",
              s.url,
              bad
                .map(
                  (l) =>
                    `<a href="${l.href}" target="${l.target}"${l.rel ? ` rel="${l.rel}"` : ""}>`,
                )
                .join("\n"),
              s.rawKey,
            ),
          ),
      });
    } else {
      out.pass(
        "P4-12",
        'every target="_blank" link carries noopener/noreferrer',
        [
          out.evidence(
            "rawHtml",
            pages.snapshots[0]?.url ?? ctx.origin,
            `${pages.snapshots.length} pages scanned for target="_blank"`,
            pages.snapshots[0]?.rawKey,
          ),
        ],
      );
    }

    // P5-13 — outbound link health (needs the outbound collector).
    if (outbound.status !== "ok") return out.build();
    if (outbound.links.length === 0) {
      out.na("P5-13", "no outbound links on crawled pages");
      return out.build();
    }
    const dead = outbound.links.flatMap((l) => {
      const why = deadReason(l);
      return why ? [{ l, why }] : [];
    });
    const info = outbound.links.flatMap((l) => {
      const why = infoReason(l);
      return why ? [`${l.url} — ${why}`] : [];
    });
    const unreached = outbound.links
      .filter((l) => !l.browser && !noDomain(l.url))
      .map((l) => l.url);
    const infoNote = [
      `info, not findings (bot or platform blocks, other statuses): ${info.length ? info.slice(0, 20).join("; ") : "none"}`,
      ...(unreached.length
        ? [
            `could not be reached from this machine (not confirmed dead): ${unreached.slice(0, 20).join("; ")}`,
          ]
        : []),
    ].join("\n");
    const ref = (l: Link) => out.evidence("botFetch", l.url, status(l));
    // Redirecting links: a low-priority S4 "(info)" finding of their own, so
    // the golden audits' "points at redirects" entries stay caught (ADR-031).
    const redirects = outbound.links.filter(moved);
    if (redirects.length > 0) {
      out.finding({
        itemIds: ["P5-13"],
        severity: "S4",
        title: "Outbound links point at redirected URLs (info)",
        detail: redirects
          .slice(0, 50)
          .map(
            (l) =>
              `${l.url} → ${l.browser && isRedirect(l.browser.status) ? l.browser.status : l.browser?.finalUrl} (on ${l.sourceUrls.slice(0, 3).join(", ")})`,
          )
          .join("\n")
          // No dead finding to carry the info lines: keep them visible here.
          .concat(dead.length === 0 ? `\n${infoNote}` : ""),
        fix: "Low priority: update each link to its final URL.",
        fixability: "FIXABLE",
        effort: "S",
        urls: [...new Set(redirects.flatMap((l) => l.sourceUrls))],
        evidenceRefs: redirects.slice(0, 20).map(ref),
      });
    }
    if (dead.length > 0) {
      out.finding({
        itemIds: ["P5-13"],
        severity: "S4",
        title: "Outbound links are dead",
        detail: `${dead
          .map(
            ({ l, why }) =>
              `${l.url} — ${why} (on ${l.sourceUrls.slice(0, 3).join(", ")})`,
          )
          .join("\n")}\n${infoNote}`,
        fix: "Fix or remove dead outbound links (the target answers 404 / 410 or a server error, or its host name has no domain).",
        fixability: "FIXABLE",
        effort: "S",
        urls: [...new Set(dead.flatMap(({ l }) => l.sourceUrls))],
        evidenceRefs: dead.slice(0, 20).map(({ l }) => ref(l)),
      });
    } else if (redirects.length === 0) {
      out.pass(
        "P5-13",
        `${outbound.links.length} outbound link(s), none dead; ${infoNote}`,
        outbound.links.slice(0, 10).map(ref),
      );
    }
    return out.build();
  },
};
