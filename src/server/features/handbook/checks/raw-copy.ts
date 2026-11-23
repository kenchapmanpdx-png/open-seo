import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import type {
  JsonLdNode,
  PageSnapshot,
} from "@/server/features/handbook/contracts/collectors";
import { createResult, normalizeUrl } from "./support";

/**
 * CRAWL (handbook §14, §7, §25): server HTML carries no loading/empty/error
 * strings as page copy (P2-04); one `tel:` display format, the JSON-LD street
 * address and opening hours present in server text (P5-08, deterministic
 * part); a contact route or block exposes ≥1 channel (mailto/tel/form) in
 * server HTML (P5-16; "verified/approved" is owner evidence).
 */
const ITEMS = ["P2-04", "P5-08", "P5-16"];

const STATE_COPY =
  /[^.!?\n]{0,80}\b(loading|please wait|no (results|events|items) found|something went wrong|failed to load|error loading)\b[^.!?\n]{0,80}/i;
const WEEKDAY = /\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\b/i;

const live = (s: PageSnapshot) =>
  s.status === 200 &&
  normalizeUrl(s.finalUrl) === normalizeUrl(s.url) &&
  /html/i.test(s.contentType ?? "html");

const norm = (t: string) => t.toLowerCase().replace(/\s+/g, " ");
const digits = (tel: string) => tel.replace(/^tel:/i, "").replace(/\D/g, "");

function addressOf(nodes: readonly JsonLdNode[]): string | null {
  for (const n of nodes) {
    const address = n.properties.address;
    if (address && typeof address === "object" && "streetAddress" in address) {
      const street = address.streetAddress;
      if (typeof street === "string" && street.trim()) return street.trim();
    }
    if (n.types.includes("PostalAddress")) {
      const street = n.properties.streetAddress;
      if (typeof street === "string" && street.trim()) return street.trim();
    }
  }
  return null;
}

const hasHours = (nodes: readonly JsonLdNode[]) =>
  nodes.some(
    (n) =>
      "openingHours" in n.properties ||
      "openingHoursSpecification" in n.properties,
  );

export const rawCopyCheck: HandbookCheck = {
  id: "crawl.raw-copy",
  itemIds: ITEMS,
  class: "CRAWL",
  requires: ["pages"],
  run(ctx) {
    const out = createResult(ITEMS);
    const { pages, jsonld } = ctx.collected;
    if (pages.status !== "ok") return out.build();
    const pagesLive = pages.snapshots.filter(live);
    const first = pagesLive[0];
    if (!first) {
      for (const id of ITEMS) out.na(id, "no 200 HTML page crawled");
      return out.build();
    }
    const textRef = (s: PageSnapshot, excerpt: string) =>
      out.evidence("rawHtml", s.url, excerpt, s.rawKey);

    // P2-04
    const states = pagesLive.flatMap((s) => {
      const hit = STATE_COPY.exec(
        s.markup.visibleText ?? s.markup.text,
      )?.[0]?.trim();
      return hit ? [{ s, hit: hit.slice(0, 200) }] : [];
    });
    if (states.length > 0) {
      out.finding({
        itemIds: ["P2-04"],
        severity: "S3",
        title: "Loading / empty / error strings in server HTML",
        detail: states.map(({ s, hit }) => `${s.url} — "${hit}"`).join("\n"),
        fix: "Render the real content on the server; inject loading/empty/error states with JS only, never as page copy in the HTML.",
        fixability: "FIXABLE",
        effort: "M",
        urls: states.map(({ s }) => s.url),
        evidenceRefs: states.slice(0, 20).map(({ s, hit }) => textRef(s, hit)),
      });
    } else {
      out.pass(
        "P2-04",
        `${pagesLive.length} pages: no loading/empty/error copy in server text`,
        [textRef(first, "no state copy matched")],
      );
    }

    // P5-08
    const tels = pagesLive.flatMap((s) =>
      s.links
        .filter((l) => /^tel:/i.test(l.href))
        .map((l) => ({ s, href: l.href, text: l.text.trim() })),
    );
    // Key on the national number (last 10 digits) so `tel:+14805550100`
    // and `tel:4805550100` count as one number in two formats.
    const formats = new Map<string, Set<string>>();
    for (const t of tels) {
      const key = digits(t.href).slice(-10);
      const set = formats.get(key) ?? new Set<string>();
      set.add(`href "${t.href.replace(/^tel:/i, "")}"`);
      // Link text counts only when it shows the number ("Call now" does not).
      if (t.text.replace(/\D/g, "").length >= 7) set.add(`text "${t.text}"`);
      formats.set(key, set);
    }
    const p508: { s: PageSnapshot; why: string }[] = [];
    for (const [num, shown] of formats) {
      const hrefs = [...shown].filter((x) => x.startsWith("href"));
      const texts = [...shown].filter((x) => x.startsWith("text"));
      if (hrefs.length > 1 || texts.length > 1) {
        const sample = tels.find((t) => digits(t.href).slice(-10) === num);
        if (sample)
          p508.push({
            s: sample.s,
            why: `${num} written as ${[...shown].join(", ")}`,
          });
      }
    }
    const home = pagesLive.find((s) => new URL(s.url).pathname === "/");
    const contact = pagesLive.find((s) =>
      /contact/i.test(new URL(s.url).pathname),
    );
    const factPages = [home, contact].filter((s): s is PageSnapshot => !!s);
    // NAP facts come from the home/contact JSON-LD only (other pages may
    // describe venues or partners).
    const factUrls = new Set(factPages.map((s) => normalizeUrl(s.url)));
    const allNodes = (jsonld.status === "ok" ? jsonld.pages : [])
      .filter((p) => factUrls.has(normalizeUrl(p.url)))
      .flatMap((p) => p.nodes);
    const street = addressOf(allNodes);
    if (street && factPages.length > 0) {
      if (!factPages.some((s) => norm(s.markup.text).includes(norm(street))))
        p508.push({
          s: factPages[0],
          why: `JSON-LD streetAddress "${street}" not in home/contact server text`,
        });
    }
    if (hasHours(allNodes) && factPages.length > 0) {
      if (!factPages.some((s) => WEEKDAY.test(s.markup.text)))
        p508.push({
          s: factPages[0],
          why: "JSON-LD opening hours but no weekday in home/contact server text",
        });
    }
    if (p508.length > 0) {
      out.finding({
        itemIds: ["P5-08"],
        severity: "S3",
        title: "NAP facts inconsistent or missing from server HTML",
        detail: p508.map(({ s, why }) => `${s.url} — ${why}`).join("\n"),
        fix: "Show the address as one postal-format text block, one tel: display format sitewide, and the opening hours in server HTML.",
        fixability: "FIXABLE",
        effort: "S",
        urls: [...new Set(p508.map(({ s }) => s.url))],
        evidenceRefs: p508.map(({ s, why }) => textRef(s, why)),
      });
    } else if (tels.length > 0 || street) {
      out.pass(
        "P5-08",
        `tel formats ${formats.size} number(s), one display each; address/hours in server text where declared (postal-format judgment pending, LLM B3)`,
        factPages
          .slice(0, 1)
          .map((s) => textRef(s, s.markup.text.slice(0, 600))),
      );
    } else {
      out.na("P5-08", "no tel: links or JSON-LD address");
    }

    // P5-16
    const channelPages = pagesLive.filter(
      (s) =>
        s.links.some((l) => /^(mailto|tel):/i.test(l.href)) ||
        (/contact/i.test(new URL(s.url).pathname) && s.markup.counts.forms > 0),
    );
    if (channelPages.length === 0) {
      const target = contact ?? home ?? first;
      out.finding({
        itemIds: ["P5-16"],
        severity: "S3",
        title: "No contact channel in server HTML",
        detail: `${pagesLive.length} pages crawled: no mailto:/tel: link and no contact-page form`,
        fix: "Expose the owner-approved contact channels (email, phone or a contact form) in server HTML on a contact route or a site-wide footer block.",
        fixability: "FIXABLE",
        effort: "S",
        urls: [target.url],
        evidenceRefs: [textRef(target, "no mailto:/tel: link or contact form")],
      });
    } else {
      out.pass(
        "P5-16",
        `channels in server HTML on ${channelPages.length} page(s), e.g. ${channelPages[0]?.url} (verified/approved: owner)`,
        channelPages.slice(0, 3).map((s) =>
          textRef(
            s,
            s.links
              .filter((l) => /^(mailto|tel):/i.test(l.href))
              .map((l) => `<a href="${l.href}">${l.text}</a>`)
              .join("\n") || `${s.markup.counts.forms} form(s)`,
          ),
        ),
      );
    }
    return out.build();
  },
};
