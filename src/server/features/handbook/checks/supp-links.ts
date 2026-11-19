import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import { createResult } from "./support";

/**
 * SUPP-01 / SUPP-02 (ADR-020, FULL-READ §6, handbook §12): internal links
 * whose anchor text says nothing about the target ("Read more", "Click here",
 * "Learn more", "Find out more"; an `aria-label` names the link instead), and
 * internal links that open a new tab. Raw HTML links of crawled pages; not
 * scored (Additional findings).
 */
const ITEMS = ["SUPP-01", "SUPP-02"];

const GENERIC = new Set([
  "read more",
  "click here",
  "learn more",
  "find out more",
]);

/** Evidence rows kept per finding (one per page). */
const MAX_EVIDENCE = 20;

type Link = PageSnapshot["links"][number];

const anchorText = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

function isInternal(href: string, host: string): boolean {
  try {
    const url = new URL(href);
    return /^https?:$/.test(url.protocol) && url.host === host;
  } catch {
    return false;
  }
}

const tag = (l: Link) =>
  `<a href="${l.href}"${l.target ? ` target="${l.target}"` : ""}>${l.text}</a>`;

export const suppLinksCheck: HandbookCheck = {
  id: "crawl.supp-links",
  itemIds: ITEMS,
  class: "CRAWL",
  requires: ["pages"],
  run(ctx) {
    const out = createResult(ITEMS);
    const { pages } = ctx.collected;
    if (pages.status !== "ok") return out.build();
    const host = new URL(ctx.origin).host;
    const hits = (match: (l: Link) => boolean) =>
      pages.snapshots.flatMap((s) => {
        const bad = s.links.filter((l) => isInternal(l.href, host) && match(l));
        return bad.length > 0 ? [{ s, bad }] : [];
      });

    const rules = [
      {
        itemId: "SUPP-01",
        hits: hits(
          (l) => !l.ariaLabel?.trim() && GENERIC.has(anchorText(l.text)),
        ),
        title:
          'Generic anchor text ("Read more", "Click here") on internal links',
        fix: 'Rewrite each anchor to name its target ("Read the pricing guide"), or give the link an aria-label that does.',
      },
      {
        itemId: "SUPP-02",
        hits: hits((l) => l.target?.toLowerCase() === "_blank"),
        title: 'Internal links open a new tab (target="_blank")',
        fix: 'Drop target="_blank" from internal links so they open in the same tab.',
      },
    ];
    for (const rule of rules) {
      if (rule.hits.length === 0) continue;
      out.finding({
        itemIds: [rule.itemId],
        severity: "S4",
        title: rule.title,
        detail: rule.hits
          .map(({ s, bad }) => `${s.url} — ${bad.map(tag).join(", ")}`)
          .join("\n"),
        fix: rule.fix,
        fixability: "FIXABLE",
        effort: "S",
        urls: rule.hits.map(({ s }) => s.url),
        evidenceRefs: rule.hits
          .slice(0, MAX_EVIDENCE)
          .map(({ s, bad }) =>
            out.evidence("rawHtml", s.url, bad.map(tag).join("\n"), s.rawKey),
          ),
      });
    }
    return out.build();
  },
};
