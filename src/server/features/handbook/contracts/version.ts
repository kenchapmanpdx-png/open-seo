/**
 * Version of the handbook engine contracts K1–K8 (BLUEPRINT §3.5).
 * Frozen at the end of B1. Work orders pin this value; a breaking change to
 * any contract file in this directory bumps the major version; an additive,
 * optional field bumps the minor (1.1.0, B3: rendered requests `beforeLoad`;
 * 1.2.0, B3: `CheckContext.judge` for LLM-class checks, llms file `text`;
 * 1.3.0, B5: `CheckContext.fetchOffsite`, rendered form count, axe sample
 * texts, Lighthouse render-blocking items, loose MCP output objects;
 * 1.4.0, B5: integration contracts K9–K13 beside their features — ai-traffic,
 * bing, ai-visibility/providers/byok, backlinks/providers/commoncrawl,
 * agency — ADR-013…017;
 * 1.5.0, B8: full-read additions (ADR-018…021) — K2 page headers / TTFB /
 * discoveredBy / video + embed facts / coverage / boilerplate split, K3
 * sidecar 1.2.0 (transferBytes, aborted, protocol, blockBeacons, media
 * elements), K14 `PageProfile`, K15 `SiteFactMap`, SUPP registry types,
 * report depth / coverage / escalations / additional findings / answer-engine
 * readiness);
 * 1.5.1, B8: R2 follow-ups for B9 — pages coverage, `paginated-home` variant,
 * bot-fetch round + AI-bot policy map, render numeric mismatches + media
 * sizes, PageSnapshot main words / minhash / duplicate blocks, PageMarkup
 * nosnippet words / fake list runs, CrUX field slot, CheckContext page
 * profiles + site fact map, evidence kind `factMap`. No K3 change.
 */
export const CONTRACTS_VERSION = "1.5.1";
