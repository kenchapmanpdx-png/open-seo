import type {
  Collector,
  CollectorKey,
} from "@/server/features/handbook/contracts/collectors";
import { createCrawlCollectors, type CrawlOptions } from "./site-crawl";
import {
  botFetchCollector,
  headersCollector,
  llmsCollector,
  robotsCollector,
  sitemapCollector,
  variantsCollector,
} from "./fetch-collectors";

/**
 * Raw-fetch collectors in dependency order. `render`, `axe` and `lighthouse`
 * need the sidecar (K3, B2) and stay "collector not configured" until then.
 */
export function createDefaultCollectors(
  crawl: CrawlOptions,
): Collector<CollectorKey>[] {
  const { pages, jsonld, templates } = createCrawlCollectors(crawl);
  return [
    robotsCollector,
    sitemapCollector,
    pages,
    jsonld,
    templates,
    headersCollector,
    llmsCollector,
    variantsCollector,
    botFetchCollector,
  ];
}
