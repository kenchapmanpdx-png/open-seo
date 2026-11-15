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
 * agency — ADR-013…017).
 */
export const CONTRACTS_VERSION = "1.4.0";
