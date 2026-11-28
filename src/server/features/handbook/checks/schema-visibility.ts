import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import type {
  JsonLdData,
  JsonLdNode,
  PageSnapshot,
} from "@/server/features/handbook/contracts/collectors";
import { isOrganizationType } from "./schema-localbusiness";
import { foldText } from "../engine/text-fold";
import { createResult, normalizeUrl } from "./support";

/**
 * SCHEMA (handbook §24, §25, §36), deterministic parts: FAQ Q&A visible in
 * server text and not duplicated across pages (P6-07); Review/VideoObject
 * visible, videos embedded (P6-14); Product offers + return policy, price
 * shown in text (P6-13; feed parity is DATA work); brand disambiguation via
 * alternateName + ≥2 sameAs (P6-09; "generic-word brand" is LLM work).
 * "Real / page-specific" judgments stay with the B3 LLM checks.
 */
const ITEMS = ["P6-07", "P6-14", "P6-13", "P6-09"];

type Page = JsonLdData["pages"][number];
type Hit = { page: Page; why: string };
type Scan = { hits: Hit[]; seen: Page[] };
type TextOf = (page: Page) => string;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const str = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;
const list = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : value === undefined ? [] : [value];
const first = (value: unknown): unknown => list(value)[0];

const norm = foldText;
const visible = (needle: string, text: string) =>
  text.includes(norm(needle).slice(0, 80));

const live = (s: PageSnapshot) =>
  s.status === 200 && normalizeUrl(s.finalUrl) === normalizeUrl(s.url);

const ofType = (nodes: readonly JsonLdNode[], type: string) =>
  nodes.filter((n) => n.types.includes(type));

/** Every object with `@type` `type` anywhere under the page's nodes. */
function deep(page: Page, type: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const walk = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!isRecord(v)) return;
    if (list(v["@type"]).includes(type)) out.push(v);
    Object.values(v).forEach(walk);
  };
  for (const n of page.nodes) walk({ "@type": n.types, ...n.properties });
  return out;
}

function scanFaq(pages: readonly Page[], textOf: TextOf): Scan {
  const seen = pages.filter((p) => ofType(p.nodes, "FAQPage").length > 0);
  const hits: Hit[] = [];
  const sets = new Map<string, Page[]>();
  for (const page of seen) {
    const text = textOf(page);
    const questions = deep(page, "Question");
    for (const q of questions) {
      const name = str(q.name) ?? "";
      const a = first(q.acceptedAnswer);
      const answer = isRecord(a) ? str(a.text) : null;
      if (!name || !visible(name, text))
        hits.push({ page, why: `question not visible: "${name}"` });
      else if (!answer || !visible(answer.replace(/<[^>]+>/g, " "), text))
        hits.push({ page, why: `answer not visible for "${name}"` });
    }
    const names = questions.map((q) => norm(str(q.name) ?? ""));
    names.sort((a, b) => a.localeCompare(b));
    const key = names.join("|");
    if (key) sets.set(key, [...(sets.get(key) ?? []), page]);
  }
  for (const group of sets.values())
    if (group.length >= 2)
      for (const page of group)
        hits.push({ page, why: `same FAQ set on ${group.length} pages` });
  return { hits, seen };
}

function scanReviews(
  pages: readonly Page[],
  textOf: TextOf,
  embeds: (page: Page) => number,
): Scan {
  const seen: Page[] = [];
  const hits: Hit[] = [];
  for (const page of pages) {
    const reviews = deep(page, "Review");
    const videos = deep(page, "VideoObject");
    if (reviews.length + videos.length === 0) continue;
    seen.push(page);
    const text = textOf(page);
    for (const r of reviews) {
      const body = str(r.reviewBody);
      if (!body || !visible(body, text))
        hits.push({ page, why: "review body not visible" });
    }
    for (const v of videos) {
      const name = str(v.name);
      if (!name || !visible(name, text))
        hits.push({ page, why: `video title not visible: "${name}"` });
      if (!(str(v.contentUrl) || str(v.embedUrl)) || embeds(page) === 0)
        hits.push({
          page,
          why: "VideoObject without contentUrl/embedUrl + an <iframe>/<video> on the page",
        });
    }
  }
  return { hits, seen };
}

function offerProblems(
  product: Record<string, unknown>,
  orgPolicy: boolean,
  text: string,
) {
  const o = first(product.offers);
  const offer = isRecord(o) ? o : null;
  const why: string[] = [];
  if (!list(product["@type"]).includes("ProductGroup")) {
    const missing = offer
      ? ["price", "priceCurrency", "availability"].filter(
          (k) =>
            offer[k] === undefined &&
            !(k === "price" && offer.lowPrice !== undefined),
        )
      : ["offers"];
    if (missing.length > 0) why.push(`offers lacks ${missing.join(", ")}`);
  }
  const policy =
    product.hasMerchantReturnPolicy ?? offer?.hasMerchantReturnPolicy;
  if (policy === undefined && !orgPolicy)
    why.push("no hasMerchantReturnPolicy");
  const raw = offer?.price ?? offer?.lowPrice;
  const price =
    typeof raw === "number" || typeof raw === "string" ? String(raw) : "";
  if (price && !text.includes(price.replace(/\.0+$/, "")))
    why.push(`price ${price} not in page text`);
  return why;
}

function scanProducts(pages: readonly Page[], textOf: TextOf): Scan {
  const orgPolicy = pages.some((p) =>
    p.nodes.some(
      (n) =>
        n.types.some(isOrganizationType) &&
        n.properties.hasMerchantReturnPolicy !== undefined,
    ),
  );
  const seen: Page[] = [];
  const hits: Hit[] = [];
  for (const page of pages) {
    const products = [...deep(page, "Product"), ...deep(page, "ProductGroup")];
    if (products.length === 0) continue;
    seen.push(page);
    for (const product of products)
      for (const why of offerProblems(product, orgPolicy, textOf(page)))
        hits.push({ page, why });
  }
  return { hits, seen };
}

function scanBrand(pages: readonly Page[]): Scan & { sameAs: number } {
  const brands = pages.flatMap((page) =>
    page.nodes
      .filter((n) =>
        n.types.some((t) => t === "WebSite" || isOrganizationType(t)),
      )
      .map((node) => ({ page, node })),
  );
  const alt = brands.some((b) => str(b.node.properties.alternateName));
  const sameAs = Math.max(
    0,
    ...brands
      .filter((b) => b.node.types.some(isOrganizationType))
      .map((b) => list(b.node.properties.sameAs).filter(str).length),
  );
  const why = [
    !alt && "no alternateName on Organization/WebSite",
    sameAs < 2 && `Organization sameAs has ${sameAs} profile(s)`,
  ].filter((w): w is string => !!w);
  const hits =
    brands.length > 0 && why.length > 0
      ? [{ page: brands[0].page, why: why.join("; ") }]
      : [];
  return { hits, seen: brands.map((b) => b.page), sameAs };
}

export const schemaVisibilityCheck: HandbookCheck = {
  id: "schema.visibility",
  itemIds: ITEMS,
  class: "SCHEMA",
  requires: ["jsonld", "pages"],
  run(ctx) {
    const out = createResult(ITEMS);
    const { jsonld, pages } = ctx.collected;
    if (jsonld.status !== "ok") return out.build();
    const snapOf = new Map<string, PageSnapshot>();
    if (pages.status === "ok")
      for (const s of pages.snapshots.filter(live))
        snapOf.set(normalizeUrl(s.url), s);
    const textOf = (page: Page) =>
      norm(snapOf.get(normalizeUrl(page.url))?.markup.text ?? "");
    const embeds = (page: Page) => {
      const counts = snapOf.get(normalizeUrl(page.url))?.markup.counts;
      return (counts?.iframes ?? 0) + (counts?.videos ?? 0);
    };
    const ref = (page: Page) =>
      out.evidence(
        "jsonld",
        page.url,
        page.blocks.map((b) => b.raw).join("\n") || "no JSON-LD block",
      );
    const report = (
      itemId: string,
      { hits, seen }: Scan,
      copy: { title: string; fix: string; pass: string; none: string },
      severity: "S2" | "S3" = "S2",
    ) => {
      if (seen.length === 0) return out.na(itemId, copy.none);
      if (hits.length === 0) return out.pass(itemId, copy.pass, [ref(seen[0])]);
      out.finding({
        itemIds: [itemId],
        severity,
        title: copy.title,
        detail: hits.map((h) => `${h.page.url} — ${h.why}`).join("\n"),
        fix: copy.fix,
        fixability: "FIXABLE",
        effort: "S",
        urls: [...new Set(hits.map((h) => h.page.url))],
        evidenceRefs: [...new Set(hits.map((h) => h.page))]
          .slice(0, 10)
          .map(ref),
      });
    };

    const faq = scanFaq(jsonld.pages, textOf);
    report("P6-07", faq, {
      title: "FAQPage markup is not visible or is duplicated",
      fix: "Mark up only the Q&A printed on that page, and keep each FAQ set on one page.",
      pass: `${faq.seen.length} FAQPage page(s): Q&A visible, no duplicate sets (page-specific judgment pending, LLM B3)`,
      none: "no FAQPage JSON-LD",
    });
    const reviews = scanReviews(jsonld.pages, textOf, embeds);
    report("P6-14", reviews, {
      title: "Review / VideoObject markup has no visible counterpart",
      fix: "Mark up only reviews and videos shown on the page; give VideoObject a contentUrl/embedUrl for the embedded player.",
      pass: `${reviews.seen.length} page(s): reviews/videos visible (authenticity judgment pending)`,
      none: "no Review / VideoObject JSON-LD",
    });
    const products = scanProducts(jsonld.pages, textOf);
    report("P6-13", products, {
      title: "Product markup lacks offers/return policy or price parity",
      fix: "Give each Product offers (price, priceCurrency, availability) and a hasMerchantReturnPolicy, and print the same price on the page.",
      pass: `${products.seen.length} product page(s): offers, return policy, price in text (feed parity pending, DATA B6)`,
      none: "no Product JSON-LD",
    });
    const brand = scanBrand(jsonld.pages);
    report(
      "P6-09",
      brand,
      {
        title: "Brand is not disambiguated in schema",
        fix: "Add alternateName to the Organization/WebSite nodes and ≥2 sameAs links to official profiles.",
        pass: `alternateName present; Organization sameAs ${brand.sameAs} (generic-word judgment pending, LLM B3)`,
        none: "no Organization / WebSite JSON-LD",
      },
      "S3",
    );
    return out.build();
  },
};
