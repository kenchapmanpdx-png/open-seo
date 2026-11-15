import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import { a11yMarkupCheck } from "./a11y-markup";
import { aboutPeopleCheck } from "./about-people";
import { botParityCheck } from "./bot-parity";
import { cachePolicyCheck } from "./cache-policy";
import { canonicalFormCheck } from "./canonical-form";
import { crawlCoverageCheck } from "./crawl-coverage";
import { headTagsCheck } from "./head-tags";
import { consentLcpCheck, firstScreenActionCheck } from "./first-screen";
import { hiddenPagesCheck } from "./hidden-pages";
import { imageMarkupCheck } from "./image-markup";
import { hreflangCheck } from "./hreflang";
import { jsonLdIntegrityCheck } from "./jsonld-integrity";
import {
  labMetricsCheck,
  pageWeightCheck,
  resourceHintsCheck,
} from "./lab-performance";
import { listNavigationCheck } from "./list-navigation";
import { llmsMirrorsCheck } from "./llms-mirrors";
import { notFoundCheck } from "./not-found";
import { outboundLinksCheck } from "./outbound-links";
import { pageStructureCheck } from "./page-structure";
import { rawCopyCheck } from "./raw-copy";
import { redirectedLinksCheck } from "./redirected-links";
import { renderParityCheck } from "./render-parity";
import { renderResourcesCheck } from "./render-resources";
import { robotsGroupsCheck } from "./robots-groups";
import { schemaBasicsCheck } from "./schema-basics";
import { schemaEventCheck } from "./schema-event";
import { schemaListsArticlesCheck } from "./schema-lists-articles";
import { schemaLocalBusinessCheck } from "./schema-localbusiness";
import { schemaVisibilityCheck } from "./schema-visibility";
import { securityHeadersCheck } from "./security-headers";
import { sitemapLastmodCheck } from "./sitemap-lastmod";
import { socialMetaCheck } from "./social-meta";
import { thirdPartyCheck } from "./third-party";
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
  rawCopyCheck,
  imageMarkupCheck,
  cachePolicyCheck,
  llmsMirrorsCheck,
  schemaBasicsCheck,
  aboutPeopleCheck,
  schemaEventCheck,
  schemaLocalBusinessCheck,
  schemaListsArticlesCheck,
  schemaVisibilityCheck,
  a11yMarkupCheck,
  renderParityCheck,
  firstScreenActionCheck,
  consentLcpCheck,
  renderResourcesCheck,
  labMetricsCheck,
  pageWeightCheck,
  resourceHintsCheck,
  thirdPartyCheck,
];
