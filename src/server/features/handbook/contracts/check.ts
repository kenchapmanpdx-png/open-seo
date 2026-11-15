import type {
  EvidenceKind,
  RegistryClass,
  RegistryEntry,
  Severity,
} from "./registry-types";
import type { CollectorKey, CollectedData } from "./collectors";
import type {
  Effort,
  Fixability,
  HandbookMode,
  ItemStatus,
  SiteProfileAnswer,
  SiteTier,
} from "./status";
import type { Judge } from "./llm";

/**
 * K1 — HandbookCheck (ADR-005).
 *
 * Runner-enforced invariants (checks do not re-implement them):
 * - every FindingDraft cites ≥1 evidence ref and ≥1 item id from `itemIds`;
 * - a PASS verdict cites ≥1 evidence ref;
 * - a check that throws yields BLOCKED for its items ("check error: <code>");
 * - a check whose `requires` collector is unavailable is not run; its items
 *   become BLOCKED or LIMITED with the collector's reason;
 * - an LLM-class check runs only with a judge; `LlmBudgetError` → its items
 *   and every later LLM check's items BLOCKED `llm budget`.
 */
export type HandbookCheck = {
  /** Stable id, e.g. "robots.group-evaluation". */
  id: string;
  /** Registry item ids this check decides (e.g. ["P3-04", "P9-02"]). */
  itemIds: readonly string[];
  class: RegistryClass;
  requires: readonly CollectorKey[];
  /** Extra applicability beyond tier/gate/mode filtering done at intake. */
  appliesTo?: (ctx: CheckContext) => boolean;
  run: (ctx: CheckContext) => Promise<CheckResult> | CheckResult;
};

export type CheckContext = {
  runId: string;
  origin: string;
  mode: HandbookMode;
  tier: SiteTier;
  siteProfile: readonly SiteProfileAnswer[];
  /** Registry entries applicable to this run (after intake filtering). */
  applicableItems: ReadonlyMap<string, RegistryEntry>;
  collected: CollectedData;
  /**
   * K5 judge for LLM-class checks (contracts 1.2.0). The runner never runs an
   * LLM check without one: its items are BLOCKED `no llm key` instead.
   */
  judge?: Judge;
};

/** Local reference from a finding/verdict to an evidence draft in the same result. */
export type EvidenceRef = string;

export type EvidenceDraft = {
  ref: EvidenceRef;
  kind: EvidenceKind;
  url: string;
  /** ≤2 KB snippet the finding cites; stored inline in DB. */
  excerpt: string;
  /** Full body to persist in the evidence store, when larger than the excerpt. */
  body?: { bytes: Uint8Array; contentType: string };
  /** Present when the body was already stored by a collector. */
  storageKey?: string;
};

export type ItemVerdict = {
  itemId: string;
  status: ItemStatus;
  /** Reason for NA/BLOCKED/DEFERRED/LIMITED, or a short pass note. */
  note?: string;
  evidenceRefs: readonly EvidenceRef[];
};

export type FindingDraft = {
  itemIds: readonly string[];
  severity: Severity;
  /** Required when severity differs from the registry default. */
  severityReason?: string;
  title: string;
  detail: string;
  fix: string;
  fixability: Fixability;
  /** Platform + documentation/setting evidence; required when LIMITED. */
  limitedReason?: string;
  effort: Effort;
  urls: readonly string[];
  /** Template key when the finding was found on samples (ADR-006). */
  templateKey?: string;
  source: "deterministic" | "llm";
  evidenceRefs: readonly EvidenceRef[];
};

export type CheckResult = {
  statuses: readonly ItemVerdict[];
  findings: readonly FindingDraft[];
  evidence: readonly EvidenceDraft[];
};
