import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import { createResult, normalizeUrl, parseUrl } from "./support";
import { imageUrl } from "@/server/features/handbook/engine/page-images";

/**
 * A11Y (raw HTML, handbook §14, §15): a skip link among the first three
 * links; icon-only links and buttons carry an accessible name; no filename
 * alts and the hero (first) image not marked decorative (P8-04).
 */
const ITEMS = ["P8-04"];

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif|svg)$/i;
const CAMERA_NAME = /^(img|image|photo|dsc|pxl)[_-]?\d*$/i;

const live = (s: PageSnapshot) =>
  s.status === 200 &&
  normalizeUrl(s.finalUrl) === normalizeUrl(s.url) &&
  /html/i.test(s.contentType ?? "html");

function isSkipLink(page: PageSnapshot, link: PageSnapshot["links"][number]) {
  const href = parseUrl(link.href);
  const here = parseUrl(page.url);
  return (
    !!href &&
    !!here &&
    href.hash.length > 1 &&
    href.pathname === here.pathname &&
    /skip/i.test(`${link.text} ${link.ariaLabel ?? ""}`)
  );
}

function fileAlt(image: PageSnapshot["images"][number]): boolean {
  const alt = image.alt?.trim();
  if (!alt) return false;
  const file = (imageUrl(image) ?? "").split(/[?#]/)[0].split("/").pop();
  const base = file?.replace(/\.[a-z0-9]+$/i, "");
  return (
    IMAGE_EXT.test(alt) ||
    CAMERA_NAME.test(alt) ||
    (!!file && (alt === file || alt === base))
  );
}

function pageProblems(page: PageSnapshot, axeNoAlt: number): string[] {
  const why: string[] = [];
  // Field test 7: axe's image-alt is rendered truth (visible images only,
  // so hidden tracking pixels do not count); P8-04 owns image alts.
  if (axeNoAlt > 0)
    why.push(`${axeNoAlt} image(s) without alt text (axe image-alt)`);
  for (const l of page.links)
    if (!l.text.trim() && !l.ariaLabel?.trim())
      why.push(`icon-only link without a name → ${l.href}`);
  for (const b of page.markup.buttons)
    if (!b.text.trim() && !b.ariaLabel?.trim())
      why.push("icon-only button without a name");
  for (const img of page.images)
    if (fileAlt(img)) why.push(`filename alt "${img.alt}" on ${img.src}`);
  if (page.images[0]?.alt === "")
    why.push(`hero image marked decorative (alt="") ${page.images[0].src}`);
  return why;
}

export const a11yMarkupCheck: HandbookCheck = {
  id: "a11y.markup",
  itemIds: ITEMS,
  class: "A11Y",
  requires: ["pages"],
  run(ctx) {
    const out = createResult(ITEMS);
    const { pages } = ctx.collected;
    if (pages.status !== "ok") return out.build();
    const pagesLive = pages.snapshots.filter(live);
    if (pagesLive.length === 0) {
      out.na("P8-04", "no 200 HTML page crawled");
      return out.build();
    }
    const ref = (s: PageSnapshot, excerpt: string) =>
      out.evidence("rawHtml", s.url, excerpt, s.rawKey);

    const noSkip = pagesLive.filter(
      (s) => !s.links.slice(0, 3).some((l) => isSkipLink(s, l)),
    );
    const axe = ctx.collected.axe;
    const noAlt = new Map(
      (axe.status === "ok" ? axe.pages : []).flatMap((p) => {
        const v = p.violations.find((x) => x.id === "image-alt");
        return v ? [[normalizeUrl(p.url), v.nodes] as const] : [];
      }),
    );
    const hits = pagesLive.flatMap((s) => {
      const why = pageProblems(s, noAlt.get(normalizeUrl(s.url)) ?? 0);
      if (noSkip.includes(s)) why.unshift("no skip link in the first 3 links");
      return why.length > 0 ? [{ s, why }] : [];
    });
    // Sitewide rule: no page has a skip link → one site-level line, not N.
    const sitewideNoSkip = noSkip.length === pagesLive.length;
    const rows = hits
      .map(({ s, why }) => ({
        s,
        why: sitewideNoSkip ? why.filter((w) => !w.startsWith("no skip")) : why,
      }))
      .filter((h) => h.why.length > 0);
    if (rows.length > 0 || sitewideNoSkip) {
      out.finding({
        itemIds: ["P8-04"],
        severity: "S2",
        title: "Skip link / accessible names / image alts need work",
        detail: [
          ...(sitewideNoSkip ? ["no page has a skip link"] : []),
          ...rows.map(
            ({ s, why }) => `${s.url} — ${why.slice(0, 5).join("; ")}`,
          ),
        ].join("\n"),
        fix: 'Add <a href="#main">Skip to content</a> as the first link, give icon-only links/buttons an aria-label, describe images in alt (alt="" only for decoration, never on the hero).',
        fixability: "FIXABLE",
        effort: "S",
        urls: sitewideNoSkip
          ? pagesLive.map((s) => s.url)
          : rows.map(({ s }) => s.url),
        evidenceRefs: (rows.length > 0 ? rows : [{ s: pagesLive[0], why: [] }])
          .slice(0, 10)
          .map(({ s, why }) =>
            ref(
              s,
              [
                ...why,
                ...s.links
                  .slice(0, 3)
                  .map((l) => `link ${l.text || "(empty)"} → ${l.href}`),
              ].join("\n"),
            ),
          ),
      });
    } else {
      out.pass(
        "P8-04",
        `${pagesLive.length} pages: skip link, named links/buttons, no filename alts`,
        pagesLive.slice(0, 3).map((s) => ref(s, s.links[0]?.href ?? "")),
      );
    }
    return out.build();
  },
};
