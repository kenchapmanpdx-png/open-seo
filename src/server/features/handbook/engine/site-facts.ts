import type {
  CollectedData,
  JsonLdNode,
  PageSnapshot,
} from "@/server/features/handbook/contracts/collectors";
import type {
  SiteProfileAnswer,
  SpCode,
  SpValue,
} from "@/server/features/handbook/contracts/status";

/**
 * Live-site facts and SP1–SP12 inference rules for P0 intake (handbook §0).
 * Each rule returns Y/N/? with the evidence it used and a confidence.
 */
export type Facts = {
  pages: readonly PageSnapshot[];
  nodes: readonly JsonLdNode[];
  sitemapCount: number;
  crawlCapped: boolean;
  headers: ReadonlyArray<readonly [string, string]>;
  hrefs: string[];
  /** Same-site links only; path heuristics must not match third-party URLs. */
  internal: string[];
};

export function facts(
  collected: Partial<CollectedData>,
  maxPages: number,
): Facts {
  const pages =
    collected.pages?.status === "ok" ? collected.pages.snapshots : [];
  const nodes =
    collected.jsonld?.status === "ok"
      ? collected.jsonld.pages.flatMap((p) => p.nodes)
      : [];
  return {
    pages,
    nodes,
    sitemapCount:
      collected.sitemap?.status === "ok" ? collected.sitemap.urls.length : 0,
    crawlCapped: pages.length >= maxPages,
    headers:
      collected.headers?.status === "ok"
        ? collected.headers.responses.flatMap((r) => r.headers)
        : [],
    hrefs: pages.flatMap((p) => p.links.map((l) => l.href)),
    internal: pages.flatMap((p) =>
      p.links.map((l) => l.href).filter((h) => sameSite(h, p.finalUrl)),
    ),
  };
}

const bareHost = (url: string) => new URL(url).hostname.replace(/^www\./, "");

function sameSite(href: string, base: string) {
  try {
    return bareHost(href) === bareHost(base);
  } catch {
    return false;
  }
}

export const internalMatches = (f: Facts, re: RegExp) =>
  f.internal.filter((h) => re.test(h));

export const hasType = (f: Facts, re: RegExp) =>
  f.nodes
    .filter((n) => n.types.some((t) => re.test(t)))
    .map((n) => n.types.join("/"));

export const hrefMatches = (f: Facts, re: RegExp) =>
  f.hrefs.filter((h) => re.test(h));

export type Answer = {
  value: SpValue;
  evidence: string;
  confidence: SiteProfileAnswer["confidence"];
};

export const yes = (
  evidence: string,
  confidence: Answer["confidence"] = "medium",
): Answer => ({
  value: "Y",
  evidence,
  confidence,
});
export const no = (
  evidence: string,
  confidence: Answer["confidence"] = "low",
): Answer => ({
  value: "N",
  evidence,
  confidence,
});
export const sample = (items: string[]) =>
  [...new Set(items)].slice(0, 3).join(", ");

const MAPS_LINK = /google\.[a-z.]+\/maps|maps\.app\.goo\.gl|maps\.apple\.com/i;
const STREET_ADDRESS =
  /\b\d{1,6}\s+(?:[NSEW]\.?\s+)?[A-Z0-9][\w.'-]*(?:\s+[A-Z0-9][\w.'-]*){0,3}\s+(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Dr|Drive|Ln|Lane|Way|Ct|Court|Pl|Place|Pkwy|Parkway|Hwy|Highway)\b|\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/;

export const INFER: Record<
  SpCode,
  (f: Facts, sp: Partial<Record<SpCode, Answer>>) => Answer
> = {
  SP1: (f) => {
    const langs = new Set(
      f.pages.flatMap((p) => p.head.hreflang.map((h) => h.lang)),
    );
    const htmlLangs = new Set(f.pages.map((p) => p.head.lang).filter(Boolean));
    if (langs.size >= 2)
      return yes(`hreflang: ${[...langs].join(", ")}`, "high");
    if (htmlLangs.size >= 2)
      return yes(`<html lang>: ${[...htmlLangs].join(", ")}`);
    return no(
      `one language (${[...htmlLangs].join(", ") || "no lang attr"}), no hreflang`,
      "medium",
    );
  },
  SP2: (f) => {
    const products = hasType(f, /^(Product|Offer|AggregateOffer)$/);
    const cart = internalMatches(f, /\/(cart|checkout|basket)(\/|$|\?)/i);
    if (products.length) return yes(`JSON-LD ${sample(products)}`, "high");
    if (cart.length) return yes(`cart links: ${sample(cart)}`);
    return no("no Product/Offer JSON-LD, no cart/checkout links", "medium");
  },
  SP3: (f) => {
    // Y only with ≥5 distinct internal URLs carrying facet parameters.
    const facets = [
      ...new Set(
        internalMatches(
          f,
          /[?&](color|size|sort|filter|price|brand|orderby)=/i,
        ),
      ),
    ];
    if (facets.length >= 5)
      return yes(`${facets.length} facet URLs: ${sample(facets)}`);
    return no(
      facets.length
        ? `${facets.length} facet-parameter links (< 5): ${sample(facets)}`
        : "no facet-parameter links",
    );
  },
  SP4: (f) => {
    const videos = hasType(f, /^VideoObject$/);
    const embeds = hrefMatches(
      f,
      /youtube\.com\/watch|youtu\.be\/|vimeo\.com\/\d/i,
    );
    return videos.length + embeds.length > 10
      ? yes(`${videos.length} VideoObject, ${embeds.length} video links`)
      : no(`${videos.length} VideoObject, ${embeds.length} video links (≤10)`);
  },
  SP5: (f) => {
    const ugc = hasType(f, /^(Review|Comment|QAPage|DiscussionForumPosting)$/);
    const paths = internalMatches(
      f,
      /\/(forum|community|comments?|reviews?)(\/|$)/i,
    );
    if (ugc.length) return yes(`JSON-LD ${sample(ugc)}`);
    if (paths.length) return yes(`UGC paths: ${sample(paths)}`, "low");
    return no("no review/comment/forum markup or paths");
  },
  SP6: (f) => {
    const re =
      /\b(health|medical|clinic|doctor|therapy|finance|loan|mortgage|invest|legal|attorney|lawyer|insurance|supplement|pharmacy)\b/i;
    const hits = f.pages
      .map((p) => p.head.title ?? "")
      .filter((t) => re.test(t));
    return hits.length
      ? yes(`YMYL terms in titles: ${sample(hits)}`)
      : no("no YMYL terms in page titles");
  },
  SP7: (f) => {
    // Y only with ≥2 signals; one signal (e.g. a bare Maps link) = "?".
    const live = f.pages.filter((p) => p.status === 200);
    const local = hasType(
      f,
      /LocalBusiness|Store|Restaurant|Dentist|Physician|AutoRepair|HomeAndConstructionBusiness|ProfessionalService/,
    );
    const tel = f.hrefs.filter((h) => /^tel:/i.test(h));
    const withAddress = live.filter((p) => STREET_ADDRESS.test(p.markup.text));
    const mapsEmbed = live.filter(
      (p) =>
        p.markup.counts.iframes > 0 &&
        p.links.some((l) => MAPS_LINK.test(l.href)),
    );
    const mapsLinks = hrefMatches(f, MAPS_LINK);
    const signals = [
      local.length ? `JSON-LD ${sample(local)}` : null,
      tel.length ? `tel: link ${sample(tel)}` : null,
      // NAP in a footer = street address on most pages, not one venue page.
      live.length && withAddress.length * 2 >= live.length
        ? `street address on ${withAddress.length}/${live.length} pages`
        : null,
      mapsEmbed.length
        ? `Maps embed on ${sample(mapsEmbed.map((p) => p.url))}`
        : null,
    ].filter((x): x is string => x !== null);
    if (signals.length >= 2) return yes(signals.join("; "), "high");
    if (signals.length === 1 || mapsLinks.length)
      return {
        value: "?",
        evidence: `one local signal: ${signals[0] ?? `${mapsLinks.length} Maps links`}`,
        confidence: "low",
      };
    return no("no LocalBusiness, tel:, street address or Maps embed");
  },
  SP8: (f) => {
    if (f.sitemapCount > 500)
      return yes(`sitemap lists ${f.sitemapCount} URLs`, "high");
    if (f.crawlCapped) {
      return {
        value: "?",
        evidence: `crawl hit its page cap at ${f.pages.length}`,
        confidence: "low",
      };
    }
    return no(
      `sitemap ${f.sitemapCount} URLs, crawl ${f.pages.length} pages`,
      "medium",
    );
  },
  SP9: (f) => {
    // Y only when a search results URL is linked (form input names are not
    // in the page facts); SearchAction markup alone = "?".
    const links = internalMatches(
      f,
      /\/search(\/|\?|$)|[?&](s|q|query|search)=/i,
    );
    if (links.length) return yes(`search links: ${sample(links)}`);
    const action = f.nodes.filter(
      (n) =>
        n.types.includes("SearchAction") ||
        ("potentialAction" in n.properties && n.types.includes("WebSite")),
    );
    if (action.length)
      return {
        value: "?",
        evidence: "WebSite SearchAction in JSON-LD, no search URL linked",
        confidence: "low",
      };
    return no("no search results URL linked");
  },
  SP10: (_f, sp) =>
    sp.SP2?.value === "N"
      ? no("SP2=N (no catalog to feed)", "medium")
      : {
          value: "?",
          evidence:
            "Merchant Center / agentic checkout needs owner confirmation",
          confidence: "low",
        },
  SP11: () => ({
    value: "?",
    evidence:
      "EU audience and AI-generated content provenance need owner confirmation",
    confidence: "low",
  }),
  SP12: (f) => {
    const get = (name: string) =>
      f.headers.filter(([k]) => k === name).map(([, v]) => v);
    const server = [...new Set(get("server"))].join(" ");
    if (/cloudflare/i.test(server) || get("cf-ray").length)
      return yes(`server: ${server || "cf-ray present"}`, "high");
    if (get("x-vercel-id").length)
      return yes("x-vercel-id header (Vercel)", "high");
    if (
      /fastly|akamai/i.test(
        `${server} ${get("x-served-by").join(" ")} ${get("via").join(" ")}`,
      )
    ) {
      return yes(`CDN headers: ${server}`, "medium");
    }
    return no(
      `server: ${server || "(none)"}; no bot-managed CDN headers`,
      "medium",
    );
  },
};
