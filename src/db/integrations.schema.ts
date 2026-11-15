// ============================================================================
// Fork integrations (B5 R4a; ADR-013 ai-traffic, ADR-014 Bing, ADR-015 BYOK AI
// visibility, ADR-016 Common Crawl, ADR-017 agency). Mirrored in
// pg/integrations.schema.ts; ./integrations-schema-parity.test.ts guards drift.
// Conventions = ADR-002: text ids + ISO text timestamps, organization_id on
// project-level rows, children reach the tenant through their FK.
// ============================================================================

export * from "./ai-traffic.schema";
export * from "./bing.schema";
export * from "./byok-ai.schema";
export * from "./commoncrawl.schema";
export * from "./agency.schema";
