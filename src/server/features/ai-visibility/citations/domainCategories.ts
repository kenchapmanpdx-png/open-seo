// Ported from elmohq/elmo@2b477bd6 packages/lib/src/citations/domain-categories.ts — MIT, © 2026 Blue Whale Software, LLC
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software, subject to the MIT License (https://opensource.org/license/mit).
// Fork changes: category/page-type unions come from K11 (byok/contracts.ts);
// domain validation/dedupe helpers, product attribution, percentages and chart
// colors/config dropped (ADR-015 §4).
import type {
  CITATION_CATEGORIES,
  CITATION_PAGE_TYPES,
} from "@/server/features/ai-visibility/providers/byok/contracts";

export type CitationCategory = (typeof CITATION_CATEGORIES)[number];
export type CitationPageType = (typeof CITATION_PAGE_TYPES)[number];

export function extractDomain(urlOrDomain: string): string {
  try {
    const cleaned = urlOrDomain.replace(/^https?:\/\//, "");
    const withoutWww = cleaned.replace(/^www\./, "");
    return withoutWww.split("/")[0].toLowerCase();
  } catch {
    return urlOrDomain.toLowerCase();
  }
}

export function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    if (urlObj.searchParams.get("utm_source") === "openai") {
      urlObj.searchParams.delete("utm_source");
    }
    urlObj.search = urlObj.searchParams.toString();
    urlObj.hash = urlObj.hash.replace(/:~:text=[^&]*/, "");
    if (urlObj.hash === "#") urlObj.hash = "";
    urlObj.protocol = "https:";
    urlObj.hostname = urlObj.hostname.replace(/^www\./, "").toLowerCase();
    if (urlObj.pathname.length > 1 && urlObj.pathname.endsWith("/")) {
      urlObj.pathname = urlObj.pathname.slice(0, -1);
    }
    return urlObj.toString();
  } catch {
    return url;
  }
}

const GOOGLE_HOST_RE = /(^|\.)google\.[a-z.]+$/;

function googleHost(url: string): string | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return GOOGLE_HOST_RE.test(host) ? host : null;
  } catch {
    return null;
  }
}

/**
 * Google Shopping product card, e.g.
 * `google.com/search?q=product&prds=pvt:hg,productid:123...`. The product name
 * lives in the citation title; `q=product` is a constant in this deep-link format.
 */
export function isGoogleShoppingUrl(url: string): boolean {
  if (!googleHost(url)) return false;
  try {
    const u = new URL(url);
    if (!u.pathname.startsWith("/search")) return false;
    const q = u.search;
    return (
      q.includes("prds=") ||
      /productid(%3a|:)/i.test(q) ||
      q.includes("tbm=shop") ||
      u.searchParams.get("udm") === "28"
    );
  } catch {
    return false;
  }
}

/** Google web-search link, e.g. `google.com/search?q=best+vitamin+c+serum`. */
export function isGoogleSearchUrl(url: string): boolean {
  if (!googleHost(url)) return false;
  if (isGoogleShoppingUrl(url)) return false;
  try {
    const u = new URL(url);
    return u.pathname.startsWith("/search") && u.searchParams.has("q");
  } catch {
    return false;
  }
}

/**
 * Google link wrappers: AI Mode's `/goto?url=`, ad clicks (`/aclk`), and the
 * `/url` and `/imgres` redirectors. The destination is an encoded Google payload
 * rather than the publisher's address, so the citation names no resolvable
 * source and can't be attributed to a domain.
 */
export function isGoogleRedirectUrl(url: string): boolean {
  if (!googleHost(url)) return false;
  try {
    return /^\/(goto|aclk|url|imgres)\/?$/.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

/** Any Google search/shopping surface pulled out of the source-mix donut. */
export function isGoogleSurfaceUrl(url: string): boolean {
  return (
    isGoogleShoppingUrl(url) ||
    isGoogleSearchUrl(url) ||
    isGoogleRedirectUrl(url)
  );
}

export const FORUM_DOMAINS = new Set([
  // general / large (incl. major non-US: zhihu = Chinese Q&A, nairaland = Nigerian)
  "4chan.org",
  "somethingawful.com",
  "city-data.com",
  "gaiaonline.com",
  "resetera.com",
  "neogaf.com",
  "thestudentroom.co.uk",
  "mumsnet.com",
  "nairaland.com",
  "skyscrapercity.com",
  "whirlpool.net.au",
  "zhihu.com",
  "news.ycombinator.com",
  // academic / professional
  "collegeconfidential.com",
  "studentdoctor.net",
  "boredofstudies.org",
  "pprune.org",
  "eng-tips.com",
  // hobby / enthusiast
  "bogleheads.org",
  "physicsforums.com",
  "avsforum.com",
  "head-fi.org",
  "audiosciencereview.com",
  "linustechtips.com",
  "androidforums.com",
  "talkbass.com",
  "ultimate-guitar.com",
  "reef2reef.com",
  "fishlore.com",
  "stripersonline.com",
  "ar15.com",
  "rollitup.org",
  "grasscity.com",
  "twoplustwo.com",
  "healthboards.com",
  "airliners.net",
  "gearspace.com",
  "teamliquid.net",
  "atariage.com",
  "websleuths.com",
  // deals / travel / parenting / wedding (slickdeals lives in ecommerce, not here)
  "redflagdeals.com",
  "flyertalk.com",
  "weddingbee.com",
  "thenest.com",
  "cafemom.com",
]);

/** Walks parent suffixes so lookups stay O(labels) however large the set. */
export function inDomainSet(domain: string, set: Set<string>): boolean {
  let d = domain;
  while (true) {
    if (set.has(d)) return true;
    const dot = d.indexOf(".");
    if (dot === -1) return false;
    d = d.slice(dot + 1);
  }
}

export function isForumDomain(host: string): boolean {
  let d = host.replace(/^www\./, "").toLowerCase();
  if (/^(forums?|community|discuss|boards?)\./.test(d)) return true;
  while (d) {
    if (FORUM_DOMAINS.has(d)) return true;
    const dot = d.indexOf(".");
    if (dot === -1) return false;
    d = d.slice(dot + 1);
  }
  return false;
}

/**
 * Path segments that mark technical documentation whoever publishes it — the
 * signal that makes an otherwise-unclassified host a developer source. Kept
 * narrower than the "doc" page type, which also covers consumer help centres.
 */
const DEVELOPER_PATH_RE =
  /\/(docs?|documentation|developers?|api|apis|sdks?|reference|api-reference|changelog|release-notes|openapi|swagger|graphql)(\/|$)/;

export function hasDeveloperPath(url: string): boolean {
  try {
    return DEVELOPER_PATH_RE.test(new URL(url).pathname.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Ordered page-type rules. Order is load-bearing: an earlier rule wins, which
 * is how "/products/return-pillow" reads as a product rather than a returns
 * page, and how a whole-segment policy path stays "info" even under /shop.
 * Each rule sees the lowercased path, the lowercased title, and both joined.
 */
interface PageTypeRule {
  type: CitationPageType;
  matches: (page: {
    host: string;
    path: string;
    title: string;
    haystack: string;
  }) => boolean;
}

const PAGE_TYPE_RULES: PageTypeRule[] = [
  {
    type: "video",
    matches: ({ host, path }) =>
      /(^|\.)(youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com|tiktok\.com)$/.test(
        host,
      ) || /\/(watch|shorts|embed|videos?)(\/|$|\?)/.test(path),
  },
  {
    type: "forum",
    matches: ({ host, path }) =>
      isForumDomain(host) ||
      /(^|\.)reddit\.com$/.test(host) ||
      /\/(comments|forums?|threads?|viewtopic|discussion)(\/|$)/.test(path) ||
      /\/r\//.test(path),
  },
  { type: "doc", matches: ({ path }) => DEVELOPER_PATH_RE.test(path) },
  {
    type: "review",
    matches: ({ haystack }) => /\breview(s|ed)?\b/.test(haystack),
  },
  {
    type: "comparison",
    matches: ({ path, haystack }) =>
      /\b(vs\.?|versus|alternatives?|comparison)\b/.test(haystack) ||
      /\/(compare|comparison|vs|alternatives)(\/|$|-)/.test(path),
  },
  {
    type: "listicle",
    matches: ({ path, title }) =>
      /\b(\d+\s+best|best\s+\d+|top\s+\d+|\d+\s+top|best\s+[a-z])\b/.test(
        title,
      ) ||
      /^\s*(best|top)\b/.test(title) ||
      // "best-"/"top-" in the URL slug (catches review domains whose title doesn't
      // lead with "Best"), excluding store "best-seller" pages and commerce paths.
      // "best-" also counts mid-slug ("/the-best-running-shoes"); "top-" does not,
      // because apparel slugs like "/tank-top-black" would collide.
      (/(^|\/)(best|top)-[a-z]|-best-[a-z]/.test(path) &&
        !/best-?sellers?|\/(products?|collections|shop|store|dp|gp|pdp|item|cart|buy)(\/|$|-)/.test(
          path,
        )),
  },
  {
    type: "howto",
    matches: ({ path, haystack }) =>
      /\b(how to|how-to|guide|tutorial|step[- ]by[- ]step|getting started|routine)\b/.test(
        haystack,
      ) || /\/(how-to|guides?|tutorials?|routines?)(\/|$)/.test(path),
  },
  {
    // Unambiguous policy / legal / contact pages stay "info" even when nested
    // under a commerce path segment (e.g. /shop/shipping-policy,
    // /store/locations). Matched as whole segments so product slugs
    // (/products/location-tracker) aren't caught.
    type: "info",
    matches: ({ path }) =>
      /\/(shipping-policy|returns?-policy|refund-policy|privacy-policy|privacy|terms|store-locator|locations?|about|about-us|contact|contact-us|faqs?)(\/|$)/.test(
        path,
      ),
  },
  {
    // Otherwise commerce paths win over the broader "info" list below:
    // /products/return-pillow is a product, not a returns page.
    type: "product",
    matches: ({ path }) =>
      /\/(dp|gp\/product|gp\/aw\/d|ip|itm|pdp|products?|item|shop|store|collections?|catalog(ue)?|buy|cart|pricing|plans?)(\/|$)/.test(
        path,
      ) ||
      // "/p/<slug>" is a widespread product path, but also Substack's post path.
      // A catalogue id tells them apart: prose slugs carry counts and years
      // ("/p/5-lessons-from-2024"), not a SKU-length run of digits.
      hasCatalogueId(path),
  },
  {
    type: "info",
    matches: ({ path }) =>
      /\/(about|about-us|faq|faqs|contact|contact-us|shipping|shipping-policy|returns?|return-policy|refunds?|privacy|terms|policy|policies|legal|account|login|sign-?in|register|careers?|press|wholesale|store-locator|locations?|subscribe|subscription|rewards|loyalty|gift-?cards?)(\/|$|-)/.test(
        path,
      ),
  },
  {
    type: "doc",
    matches: ({ path }) =>
      /\/(support|help|kb|knowledge-?base|glossary)(\/|$)/.test(path),
  },
  {
    type: "article",
    matches: ({ path }) =>
      /\/(blogs?|news|newsroom|articles?|story|stories|posts?|magazine|tips|advice|journal|features?|insights?|resources?|reports?|case-stud(y|ies)|white-?papers?|opinions?|editorials?)(\/|$|-)/.test(
        path,
      ) ||
      /\/\d{4}\/\d{2}\//.test(path) ||
      /\/\d{4}\/[a-z]/.test(path),
  },
];

/**
 * True when a "/p/" path carries a catalogue id — a run of four or more digits
 * that isn't a year, anywhere after the prefix (retailers put it in the slug or
 * in a trailing segment). Four digits is the floor because shorter runs are
 * prose: counts, model years, "gpt-4".
 */
function hasCatalogueId(path: string): boolean {
  const rest = /\/p\/(.+)/.exec(path)?.[1];
  if (!rest) return false;
  return (rest.match(/\d{4,}/g) ?? []).some((run) => !isYear(run));
}

function isYear(token: string): boolean {
  const n = Number(token);
  return n >= 1900 && n <= 2099;
}

/** Heuristic: the long tail falls through to "other". */
export function inferPageType(
  url: string,
  title?: string | null,
): CitationPageType {
  if (isGoogleShoppingUrl(url)) return "shopping";
  if (isGoogleSearchUrl(url)) return "search";

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "other";
  }

  // Underscore-separated slugs ("/gear_guides/best_running_shoes") are the same
  // shape as hyphen-separated ones; normalize so one set of rules covers both.
  const path = parsed.pathname.toLowerCase().replace(/_/g, "-");
  if (path === "/" || path === "") return "homepage";

  const lowerTitle = (title ?? "").toLowerCase();
  const page = {
    host: parsed.hostname.replace(/^www\./, "").toLowerCase(),
    path,
    title: lowerTitle,
    haystack: `${path} ${lowerTitle}`,
  };

  return PAGE_TYPE_RULES.find((rule) => rule.matches(page))?.type ?? "other";
}

/** Source categories whose cited pages are essentially always editorial content. */
export const CONTENT_PUBLISHER_CATEGORIES: ReadonlySet<CitationCategory> =
  new Set<CitationCategory>(["editorial", "institutional", "reference"]);

/** A content publisher's otherwise-unmatched page is an article, without per-industry paths. */
export function resolvePageType(
  url: string,
  title: string | null | undefined,
  category: CitationCategory,
): CitationPageType {
  const pt = inferPageType(url, title);
  if (pt === "other" && CONTENT_PUBLISHER_CATEGORIES.has(category))
    return "article";
  return pt;
}
