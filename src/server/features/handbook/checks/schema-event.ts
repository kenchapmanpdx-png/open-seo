import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import type {
  JsonLdNode,
  PageSnapshot,
} from "@/server/features/handbook/contracts/collectors";
import { createResult, normalizeUrl } from "./support";

/**
 * SCHEMA (handbook §24): Event nodes carry venue name + street address, a
 * timed startDate with offset when the page shows a time, and a price when
 * the page shows one (P2-06); plus geo, image, organizer, eventStatus, full
 * offers, presale-only validFrom and no filler performer (P6-05). One
 * finding per item per template key (ADR-006).
 */
const ITEMS = ["P2-06", "P6-05"];

const TIME = /\b\d{1,2}(:\d{2})?\s?(am|pm)\b|\b([01]?\d|2[0-3]):[0-5]\d\b/i;
const PRICE = /[$€£]\s?\d|\b\d+(\.\d{2})?\s?(usd|eur|gbp)\b|\bfree\b/i;
const PRESALE = /presale|pre-sale|early[- ]?bird|early registration/i;
const FILLER = /^(tba|tbd|various|various artists|to be announced)$/i;
const TIMED = /T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const str = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;
const first = (value: unknown): unknown =>
  Array.isArray(value) ? (value[0] as unknown) : value;
const has = (value: unknown) =>
  value !== undefined &&
  value !== null &&
  !(typeof value === "string" && !value.trim()) &&
  !(Array.isArray(value) && value.length === 0);

const isEvent = (n: JsonLdNode) => n.types.some((t) => t.endsWith("Event"));

/** Problems per item for one Event node given its page's visible text. */
function inspect(node: JsonLdNode, text: string): Record<string, string[]> {
  const p = node.properties;
  const location = first(p.location);
  const place = isRecord(location) ? location : {};
  const address = isRecord(place.address) ? place.address : {};
  const offers = first(p.offers);
  const offer = isRecord(offers) ? offers : null;
  const start = str(p.startDate) ?? "";
  const p206: string[] = [];
  const p605: string[] = [];

  if (!str(place.name)) p206.push("location.name");
  if (!str(address.streetAddress)) p206.push("location.address.streetAddress");
  const timeShown = TIME.test(text);
  if (!start) p206.push("startDate");
  else if (timeShown && !TIMED.test(start))
    p206.push("startDate time + offset (page shows a time)");
  if (PRICE.test(text) && !has(offer?.price)) p206.push("offers.price");

  for (const k of ["addressLocality", "postalCode", "addressCountry"])
    if (!str(address[k])) p605.push(`location.address.${k}`);
  if (!isRecord(place.geo)) p605.push("location.geo");
  for (const k of ["image", "organizer", "eventStatus"])
    if (!has(p[k])) p605.push(k);
  if (start && start.includes("T") && !TIMED.test(start))
    p605.push("startDate offset");
  if (!offer) p605.push("offers");
  else {
    for (const k of ["price", "priceCurrency", "availability", "url"])
      if (!has(offer[k])) p605.push(`offers.${k}`);
    if (has(offer.validFrom) && !PRESALE.test(text))
      p605.push("offers.validFrom without a presale");
  }
  const organizer = first(p.organizer);
  const organizerName = isRecord(organizer) ? str(organizer.name) : null;
  const performers = (Array.isArray(p.performer) ? p.performer : [p.performer])
    .map((x) => (isRecord(x) ? str(x.name) : str(x)))
    .filter((x): x is string => !!x);
  if (
    performers.some(
      (name) =>
        FILLER.test(name) ||
        (organizerName && name.toLowerCase() === organizerName.toLowerCase()),
    )
  )
    p605.push("filler performer");
  return { "P2-06": p206, "P6-05": [...p206, ...p605] };
}

const live = (s: PageSnapshot) =>
  s.status === 200 && normalizeUrl(s.finalUrl) === normalizeUrl(s.url);

export const schemaEventCheck: HandbookCheck = {
  id: "schema.event",
  itemIds: ITEMS,
  class: "SCHEMA",
  requires: ["jsonld", "pages"],
  run(ctx) {
    const out = createResult(ITEMS);
    const { jsonld, pages, templates } = ctx.collected;
    if (jsonld.status !== "ok") return out.build();
    const textOf = new Map<string, string>();
    if (pages.status === "ok")
      for (const s of pages.snapshots.filter(live))
        textOf.set(normalizeUrl(s.url), s.markup.text);
    const templateOf = new Map<string, string>();
    if (templates.status === "ok")
      for (const t of templates.templates)
        for (const url of t.urls) templateOf.set(normalizeUrl(url), t.key);

    const events = jsonld.pages.flatMap((page) =>
      page.nodes.filter(isEvent).map((node) => ({
        page,
        problems: inspect(node, textOf.get(normalizeUrl(page.url)) ?? ""),
        node,
      })),
    );
    if (events.length === 0) {
      for (const id of ITEMS) out.na(id, "no Event JSON-LD on crawled pages");
      return out.build();
    }

    for (const itemId of ITEMS) {
      const byTemplate = new Map<string, typeof events>();
      for (const e of events) {
        if ((e.problems[itemId] ?? []).length === 0) continue;
        const key = templateOf.get(normalizeUrl(e.page.url)) ?? e.page.url;
        byTemplate.set(key, [...(byTemplate.get(key) ?? []), e]);
      }
      for (const [key, hits] of byTemplate) {
        const counts = new Map<string, number>();
        for (const h of hits)
          for (const prop of h.problems[itemId] ?? [])
            counts.set(prop, (counts.get(prop) ?? 0) + 1);
        out.finding({
          itemIds: [itemId],
          severity: "S2",
          title:
            itemId === "P2-06"
              ? `Event JSON-LD lacks venue/time/price facts (${key})`
              : `Event JSON-LD is incomplete (${key})`,
          detail: [...counts]
            .map(([prop, n]) => `${prop} — ${n}/${hits.length} event(s)`)
            .join("\n"),
          fix: "Emit each Event with location Place (name, full PostalAddress, geo), startDate with time and UTC offset, image, organizer, eventStatus and offers (price, priceCurrency, availability, url); drop placeholder performers.",
          fixability: "FIXABLE",
          effort: "S",
          urls: [...new Set(hits.map((h) => h.page.url))],
          evidenceRefs: hits
            .slice(0, 10)
            .map((h) =>
              out.evidence(
                "jsonld",
                h.page.url,
                JSON.stringify(h.node.properties, null, 1),
              ),
            ),
        });
      }
      const sample = events[0];
      out.pass(itemId, `${events.length} Event node(s) complete`, [
        out.evidence(
          "jsonld",
          sample.page.url,
          JSON.stringify(sample.node.properties, null, 1),
        ),
      ]);
    }
    return out.build();
  },
};
