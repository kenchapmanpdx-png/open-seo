import type { CitationCategory, CitationPageType } from "./domainCategories";
import { extractDomain } from "./domainCategories";
import { classifyPage, resolvePageClass } from "./pageClassification";

// Citation category + page type for one cited source (ADR-015 §4).
// Order: brand (own domains) → competitor → Elmo list lookup / page-type
// fallback → `other`. Bump CATEGORIES_VERSION whenever the lists or rules
// change; the categorize job recomputes rows stored under an older version.

export const CATEGORIES_VERSION = "elmo-2b477bd6+fork.1";

const domainSet = (domains: string[]) =>
  new Set(domains.map((domain) => extractDomain(domain)).filter(Boolean));

export function categorizeSource(input: {
  url: string;
  domain: string;
  title?: string | null;
  ownDomains: string[];
  competitorDomains: string[];
}): { category: CitationCategory; pageType: CitationPageType } {
  const domain = extractDomain(input.domain || input.url);
  const stored = classifyPage(input.url, domain, input.title ?? null);
  const resolved = resolvePageClass(
    {
      domain,
      static_category: stored.staticCategory,
      page_type: stored.pageType,
    },
    domainSet(input.ownDomains),
    domainSet(input.competitorDomains),
  );
  // Google search/shopping surfaces have no publisher category.
  return resolved ?? { category: "other", pageType: stored.pageType };
}
