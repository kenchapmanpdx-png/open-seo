/**
 * Version of the handbook engine contracts K1–K8 (BLUEPRINT §3.5).
 * Frozen at the end of B1. Work orders pin this value; a breaking change to
 * any contract file in this directory bumps the major version; an additive,
 * optional field bumps the minor (1.1.0, B3: rendered requests `beforeLoad`;
 * 1.2.0, B3: `CheckContext.judge` for LLM-class checks, llms file `text`).
 */
export const CONTRACTS_VERSION = "1.2.0";
