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
 * profiles + site fact map, evidence kind `factMap`. No K3 change;
 * 1.6.0, B10: closed B9 escalations — `SafeFetchResult.ttfbMs`, SafeFetch
 * request `headers` (media Range fallback), bot-fetch body `excerpt` on
 * blocked fetches, `RenderData.noJs.opacityZeroWords`,
 * `PageMarkup.firstAnswerNosnippet`, `EVIDENCE_RETAIN_RUNS` 5 → 2. No K3
 * change;
 * 1.7.0, B11: scaled content + copy quality (ADR-022…024) — PageSnapshot
 * `sentenceHashes` / `aiAddressed`, RenderData `js.aiAddressedRemoved`,
 * PageMarkup `prose`, run options, report
 * `scaledContent` / `copyQuality`, SERP originality record, SUPP-17…19,
 * MCP `handbook_copy_rules_get` + findings `copyRules` hint. No K3 change;
 * 1.8.0, B14: novice layout (ADR-029) — report `categoryScores`
 * (SEO / GEO / AEO) and finding `categories`. No K3 change;
 * 1.9.0, B15: accuracy (ADR-031) — collectors `linkTargets` (P3-08
 * un-crawled internal targets) and `resources` (SUPP-20), `LinkProbe`,
 * coverage `unread` ("Pages not read", ACCURACY #0). No K3 change;
 * 1.10.0, B17: accuracy part 2 (ADR-032) — PageSnapshot `redirectChain`
 * (SUPP-25 temporary redirects) and `doctype` (SUPP-26). No K3 change.
 */
export const CONTRACTS_VERSION = "1.10.0";
