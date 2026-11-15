import {
  GRADE_THRESHOLDS,
  ITEM_SCORE,
  S1_CAP,
  SCORED_PHASE_WEIGHTS,
  type Grade,
  type PhaseScore,
  type ScoredPhase,
  type ScoreInput,
  type ScoreOutput,
} from "@/server/features/handbook/contracts/scoring";

/**
 * K6 — EP-7 score (ADR-008). Phase score = Σ item scores ÷ applicable × 100
 * (PASS 1, PARTIAL/LIMITED 0.5, OPEN 0; BLOCKED/NA/DEFERRED excluded).
 * Total = Σ weight × phase score ÷ 100, with the weight of a phase that has
 * no applicable item spread proportionally over the scored phases. Any open
 * S1 caps the total at 39. Totals keep one decimal; the grade reads `final`.
 */
export function scoreItems(input: ScoreInput): ScoreOutput {
  const phases = (Object.keys(SCORED_PHASE_WEIGHTS) as ScoredPhase[]).map(
    (phase) => {
      let applicable = 0;
      let points = 0;
      for (const item of input.items) {
        if (item.phase !== phase) continue;
        const value = ITEM_SCORE[item.status];
        if (value === null) continue;
        applicable += 1;
        points += value;
      }
      return {
        phase,
        weight: SCORED_PHASE_WEIGHTS[phase],
        applicable,
        points,
        score: applicable ? (points / applicable) * 100 : null,
      };
    },
  );
  const scoredWeight = phases.reduce(
    (sum, p) => sum + (p.score === null ? 0 : p.weight),
    0,
  );
  const withWeights: PhaseScore[] = phases.map((p) => ({
    ...p,
    effectiveWeight:
      p.score === null || scoredWeight === 0
        ? 0
        : (p.weight * 100) / scoredWeight,
  }));
  const uncapped = round1(
    withWeights.reduce(
      (sum, p) => sum + (p.effectiveWeight * (p.score ?? 0)) / 100,
      0,
    ),
  );
  const s1Codes = [
    ...new Set(
      input.items.flatMap((item) =>
        item.status === "OPEN" || item.status === "PARTIAL"
          ? item.openFindingCodes.filter(
              (_, i) => item.openSeverities[i] === "S1",
            )
          : [],
      ),
    ),
  ].sort();
  const final = s1Codes.length ? Math.min(uncapped, S1_CAP) : uncapped;
  return {
    handbookVersion: input.handbookVersion,
    phases: withWeights.map((p) => ({
      ...p,
      score: p.score === null ? null : round1(p.score),
    })),
    uncapped,
    final,
    capReason: s1Codes.length ? `open S1: ${s1Codes.join(", ")}` : null,
    grade: gradeOf(final),
  };
}

function gradeOf(total: number): Grade {
  return (GRADE_THRESHOLDS.find((t) => total >= t.min) ?? { grade: "F" }).grade;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
