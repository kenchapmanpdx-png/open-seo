import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import { createResult, originUrl, parseUrl } from "./support";

/**
 * SUPP-01 / SUPP-02 (ADR-020, FULL-READ §6, handbook §12): links whose
 * anchor text says nothing about the target ("Read more", "Click here",
 * "Learn more", "Find out more"; an `aria-label` is the name tested when
 * present) —
 * internal and, since B17 §9 #6, external ones; links with no name at all
 * (no text, no image alt, no `aria-label`; in-page `#` and `javascript:`
 * controls excluded); internal links that open a new tab. Raw HTML links of
 * crawled pages; not scored (Additional findings).
 */
const ITEMS = ["SUPP-01", "SUPP-02"];

const GENERIC = new Set([
  "read more",
  "click here",
  "learn more",
  "find out more",
  "more",
  "here",
  "click",
  "link",
  "this link",
  "more info",
  "details",
  "website",
  "visit website",
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

/** An http(s) link to another host. */
function isExternal(href: string, host: string): boolean {
  const url = parseUrl(href);
  return !!url && /^https?:$/.test(url.protocol) && url.host !== host;
}

/** No accessible name; in-page `#` targets and `javascript:` are UI controls. */
const unnamed = (l: Link, page: string) =>
  !l.ariaLabel?.trim() &&
  anchorText(l.text) === "" &&
  !/^javascript:/i.test(l.href) &&
  l.href.split("#")[0] !== page.split("#")[0];

function isInternal(href: string, host: string): boolean {
  const url = parseUrl(href);
  return !!url && /^https?:$/.test(url.protocol) && url.host === host;
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
    const host = originUrl(ctx.origin).host;
    const hits = (match: (l: Link, page: string) => boolean) =>
      pages.snapshots.flatMap((s) => {
        const bad = s.links.filter((l) => match(l, s.url));
        return bad.length > 0 ? [{ s, bad }] : [];
      });
    // The accessible name is the aria-label when there is one (field test 7:
    // aria-label="Learn More" names the link "Learn More").
    const generic = (l: Link) =>
      GENERIC.has(anchorText(l.ariaLabel?.trim() || l.text));

    const rules = [
      {
        itemId: "SUPP-01",
        hits: hits((l) => isInternal(l.href, host) && generic(l)),
        title:
          'Generic anchor text ("Read more", "Click here") on internal links',
        fix: 'Rewrite each anchor to name its target ("Read the pricing guide"), or give the link an aria-label that does.',
      },
      {
        itemId: "SUPP-01",
        hits: hits((l) => isExternal(l.href, host) && generic(l)),
        title:
          'Generic anchor text ("Website", "Click here") on external links',
        fix: 'Name the site or page the link opens ("Aveda\'s ingredient list"), or give the link an aria-label that does.',
      },
      {
        itemId: "SUPP-01",
        hits: hits(unnamed),
        title: "Links with no anchor text (no text, image alt or aria-label)",
        fix: "Give each link visible text, an alt on its only image, or an aria-label naming the target (icon links in the header, footer or social bar are the usual cause).",
      },
      {
        itemId: "SUPP-02",
        hits: hits(
          (l) =>
            isInternal(l.href, host) && l.target?.toLowerCase() === "_blank",
        ),
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
