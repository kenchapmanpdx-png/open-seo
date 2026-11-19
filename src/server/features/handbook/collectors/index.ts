import type {
  Collector,
  CollectorKey,
} from "@/server/features/handbook/contracts/collectors";
import { createCrawlCollectors, type CrawlOptions } from "./site-crawl";
import { botFetchCollector } from "./bot-fetch";
import {
  llmsCollector,
  robotsCollector,
  sitemapCollector,
  variantsCollector,
} from "./fetch-collectors";
import { headersCollector } from "./headers-collector";
import { outboundCollector } from "./outbound";
import {
  createSidecarCollectors,
  type SidecarConfig,
} from "./sidecar-collectors";

/**
 * Raw-fetch collectors in dependency order. `render`, `axe` and `lighthouse`
 * are appended only when a render sidecar (K3) is configured; otherwise they
 * stay "collector not configured".
 */
export function createDefaultCollectors(
  crawl: CrawlOptions,
  sidecar?: SidecarConfig | null,
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
    outboundCollector,
    ...(sidecar ? createSidecarCollectors(sidecar) : []),
  ];
}
