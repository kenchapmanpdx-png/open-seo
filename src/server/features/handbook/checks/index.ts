import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import { a11yMarkupCheck } from "./a11y-markup";
import { aboutPeopleCheck } from "./about-people";
import { auditProcessCheck } from "./audit-process";
import { axeRulesCheck } from "./axe-rules";
import { botParityCheck } from "./bot-parity";
import { cachePolicyCheck } from "./cache-policy";
import { canonicalFormCheck } from "./canonical-form";
import { crawlCoverageCheck } from "./crawl-coverage";
import { duplicatesCheck } from "./duplicates";
import { headTagsCheck } from "./head-tags";
import { interstitialCheck } from "./interstitial";
import { aiBotPolicyCheck } from "./ai-bot-policy";
import { consentLcpCheck, firstScreenActionCheck } from "./first-screen";
import { hiddenPagesCheck } from "./hidden-pages";
import { imageMarkupCheck } from "./image-markup";
import { imageWeightCheck } from "./image-weight";
import { hreflangCheck } from "./hreflang";
import { jsonLdIntegrityCheck } from "./jsonld-integrity";
import { labMetricsCheck, pageWeightCheck } from "./lab-performance";
import { resourceHintsCheck } from "./resource-hints";
import { listNavigationCheck } from "./list-navigation";
import { LLM_CONTENT_CHECKS } from "./llm-content";
import { LLM_CHECKS } from "./llm-copy";
import { sourceCheck } from "./llm-sources";
import { LLM_TEMPLATE_CHECKS } from "./llm-templates";
import { llmsMirrorsCheck } from "./llms-mirrors";
import { notFoundCheck } from "./not-found";
import { numericParityCheck } from "./numeric-parity";
import { outboundLinksCheck } from "./outbound-links";
import { pageStructureCheck } from "./page-structure";
import { platformCheck } from "./platform";
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
import { suppLinksCheck } from "./supp-links";
import { suppPagesCheck } from "./supp-pages";
import { thirdPartyCheck } from "./third-party";
import { urlInventoryCheck } from "./url-inventory";
import { urlVariantsCheck } from "./url-variants";
import { videoCheck } from "./video";

/**
 * Every K1 check the runner executes. B1 R5 exemplars (one per class); the
 * rest via B2 work orders (fork/queue.md). Items without a check report
 * DEFERRED.
 */
export const HANDBOOK_CHECKS: readonly HandbookCheck[] = [
  robotsGroupsCheck,
  urlInventoryCheck,
  duplicatesCheck,
  securityHeadersCheck,
  jsonLdIntegrityCheck,
  botParityCheck,
  interstitialCheck,
  aiBotPolicyCheck,
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
  suppLinksCheck,
  suppPagesCheck,
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
  numericParityCheck,
  firstScreenActionCheck,
  consentLcpCheck,
  renderResourcesCheck,
  labMetricsCheck,
  pageWeightCheck,
  imageWeightCheck,
  resourceHintsCheck,
  thirdPartyCheck,
  videoCheck,
  axeRulesCheck,
  auditProcessCheck,
  platformCheck,
  // LLM class last: they run only with a judge and stop at the budget cap.
  ...LLM_CHECKS,
  ...LLM_CONTENT_CHECKS,
  ...LLM_TEMPLATE_CHECKS,
  sourceCheck,
];
