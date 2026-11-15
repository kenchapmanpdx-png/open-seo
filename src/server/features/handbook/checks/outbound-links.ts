import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import type { OutboundData } from "@/server/features/handbook/contracts/collectors";
import { createResult, normalizeUrl } from "./support";

/**
 * BOTFETCH/CRAWL (handbook §12): outbound and third-party conversion links
 * answer 200 for browsers, point at their final URL, and bot-only blocks are
 * recorded (P5-13); `target="_blank"` links carry noopener (noreferrer
 * implies it; noreferrer alone on internal links is by intent) (P4-12).
 */
const ITEMS = ["P5-13", "P4-12"];

type Link = OutboundData["links"][number];

const BLOCKED = new Set([401, 403, 429, 503]);

function linkProblem(link: Link): string | null {
  if (!link.browser) return "unreachable for browsers";
  if (link.browser.status !== 200) return `browser gets ${link.browser.status}`;
  if (normalizeUrl(link.browser.finalUrl) !== normalizeUrl(link.url))
    return `redirects to ${link.browser.finalUrl}`;
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
    const broken = outbound.links.flatMap((l) => {
      const why = linkProblem(l);
      return why ? [{ l, why }] : [];
    });
    const botOnly = outbound.links.filter(
      (l) => l.browser?.status === 200 && l.bot && BLOCKED.has(l.bot.status),
    );
    const ref = (l: Link) => out.evidence("botFetch", l.url, status(l));
    if (broken.length > 0) {
      out.finding({
        itemIds: ["P5-13"],
        severity: "S4",
        title: "Outbound links are broken or point at redirects",
        detail: broken
          .map(
            ({ l, why }) =>
              `${l.url} — ${why} (on ${l.sourceUrls.slice(0, 3).join(", ")})`,
          )
          .join("\n"),
        fix: "Fix or remove broken outbound links and update redirected ones to their final URL.",
        fixability: "FIXABLE",
        effort: "S",
        urls: [...new Set(broken.flatMap(({ l }) => l.sourceUrls))],
        evidenceRefs: broken.slice(0, 20).map(({ l }) => ref(l)),
      });
    } else {
      out.pass(
        "P5-13",
        `${outbound.links.length} outbound link(s) 200 at their final URL for browsers; bot-only blocks: ${botOnly.length ? botOnly.map((l) => `${l.url} (${l.bot?.status})`).join(", ") : "none"}`,
        outbound.links.slice(0, 10).map(ref),
      );
    }
    return out.build();
  },
};
