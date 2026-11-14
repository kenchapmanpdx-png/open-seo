import type { Severity } from "./registry-types";
import type { HandbookMode, ItemStatus } from "./status";

/**
 * K6 — EP-7 scoring (ADR-008). Pure function; never receives ranking,
 * traffic or backlink data.
 */

export const SCORED_PHASE_WEIGHTS = {
  P2: 15,
  P3: 15,
  P4: 15,
  P5: 15,
  P6: 15,
  P7: 10,
  P8: 10,
  P9: 5,
} as const;
export type ScoredPhase = keyof typeof SCORED_PHASE_WEIGHTS;

export const ITEM_SCORE: Record<ItemStatus, number | null> = {
  PASS: 1,
  PARTIAL: 0.5,
  LIMITED: 0.5,
  OPEN: 0,
  BLOCKED: null,
  NA: null,
  DEFERRED: null,
};

export const S1_CAP = 39;

export const GRADE_THRESHOLDS = [
  { grade: "A", min: 85 },
  { grade: "B", min: 70 },
  { grade: "C", min: 55 },
  { grade: "D", min: 40 },
  { grade: "F", min: 0 },
] as const;
export type Grade = (typeof GRADE_THRESHOLDS)[number]["grade"];

export type ScoreInput = {
  handbookVersion: string;
  mode: HandbookMode;
  items: ReadonlyArray<{
    itemId: string;
    phase: string;
    status: ItemStatus;
    /** Severities of OPEN/PARTIAL findings linked to this item. */
    openSeverities: readonly Severity[];
    /** Finding codes behind `openSeverities`, for the cap reason. */
    openFindingCodes: readonly string[];
  }>;
};

export type PhaseScore = {
  phase: ScoredPhase;
  weight: number;
  /** Weight after redistributing phases with no applicable items. */
  effectiveWeight: number;
  applicable: number;
  points: number;
  score: number | null;
};

export type ScoreOutput = {
  handbookVersion: string;
  phases: readonly PhaseScore[];
  uncapped: number;
  final: number;
  capReason: string | null;
  grade: Grade;
};

export type Scorer = (input: ScoreInput) => ScoreOutput;
