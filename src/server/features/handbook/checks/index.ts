import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import { botParityCheck } from "./bot-parity";
import { canonicalFormCheck } from "./canonical-form";
import { crawlCoverageCheck } from "./crawl-coverage";
import { headTagsCheck } from "./head-tags";
import { hiddenPagesCheck } from "./hidden-pages";
import { hreflangCheck } from "./hreflang";
import { jsonLdIntegrityCheck } from "./jsonld-integrity";
import { listNavigationCheck } from "./list-navigation";
import { notFoundCheck } from "./not-found";
import { outboundLinksCheck } from "./outbound-links";
import { pageStructureCheck } from "./page-structure";
import { redirectedLinksCheck } from "./redirected-links";
import { robotsGroupsCheck } from "./robots-groups";
import { securityHeadersCheck } from "./security-headers";
import { sitemapLastmodCheck } from "./sitemap-lastmod";
import { socialMetaCheck } from "./social-meta";
import { urlInventoryCheck } from "./url-inventory";
import { urlVariantsCheck } from "./url-variants";

/**
 * Every K1 check the runner executes. B1 R5 exemplars (one per class); the
 * rest via B2 work orders (fork/queue.md). Items without a check report
 * DEFERRED.
 */
export const HANDBOOK_CHECKS: readonly HandbookCheck[] = [
  robotsGroupsCheck,
  urlInventoryCheck,
  securityHeadersCheck,
  jsonLdIntegrityCheck,
  botParityCheck,
  urlVariantsCheck,
  canonicalFormCheck,
  notFoundCheck,
  redirectedLinksCheck,
  crawlCoverageCheck,
  hiddenPagesCheck,
  listNavigationCheck,
  hreflangCheck,
  sitemapLastmodCheck,
  headTagsCheck,
  socialMetaCheck,
  pageStructureCheck,
  outboundLinksCheck,
];
