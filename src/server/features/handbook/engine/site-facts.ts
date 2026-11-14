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
    const facets = internalMatches(
      f,
      /[?&](color|size|sort|filter|price|brand|orderby)=/i,
    );
    return facets.length
      ? yes(`facet links: ${sample(facets)}`)
      : no("no facet-parameter links");
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
    const local = hasType(
      f,
      /LocalBusiness|Store|Restaurant|Dentist|Physician|AutoRepair|HomeAndConstructionBusiness|ProfessionalService/,
    );
    const addresses = f.nodes.filter(
      (n) => "address" in n.properties || "geo" in n.properties,
    );
    const maps = hrefMatches(
      f,
      /google\.[a-z.]+\/maps|maps\.app\.goo\.gl|maps\.apple\.com/i,
    );
    if (local.length) return yes(`JSON-LD ${sample(local)}`, "high");
    if (addresses.length || maps.length) {
      return yes(
        `${addresses.length} nodes with address/geo, ${maps.length} map links`,
      );
    }
    return no("no LocalBusiness, address or map links");
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
    const search = hasType(f, /^SearchAction$/);
    const action = f.nodes.filter(
      (n) => "potentialAction" in n.properties && n.types.includes("WebSite"),
    );
    const links = internalMatches(f, /\/search(\/|\?|$)|[?&](s|q|query)=/i);
    if (search.length || action.length)
      return yes("WebSite SearchAction in JSON-LD", "high");
    if (links.length) return yes(`search links: ${sample(links)}`, "low");
    return no("no SearchAction, no search links");
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
    const server = get("server").join(" ");
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
