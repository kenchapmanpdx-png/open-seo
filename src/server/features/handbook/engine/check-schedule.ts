import type {
  CheckResult,
  HandbookCheck,
} from "@/server/features/handbook/contracts/check";
import type { CollectedData } from "@/server/features/handbook/contracts/collectors";
import type { ItemStatus } from "@/server/features/handbook/contracts/status";

/** LLM checks in flight at once (WO-B20-005). */
const LLM_CHECK_CONCURRENCY = 4;

export type CheckOutcome =
  | { kind: "verdict"; status: ItemStatus; note: string }
  | { kind: "result"; result: CheckResult }
  | { kind: "error"; code: string };

/**
 * Runs every check that has an applicable item and returns the outcomes by
 * check index (undefined = skipped). Other checks run one at a time; LLM
 * checks after them, LLM_CHECK_CONCURRENCY in flight (the judge reserves each
 * call's estimate, so parallel calls still stop at the budget). The caller
 * applies outcomes in check order, so verdict precedence ties and findings
 * order do not depend on which call returned first.
 */
export async function scheduleChecks(
  checks: readonly HandbookCheck[],
  applies: (itemId: string) => boolean,
  evaluate: (check: HandbookCheck) => Promise<CheckOutcome>,
  onCheck: (done: number, total: number) => void,
): Promise<(CheckOutcome | undefined)[]> {
  let done = 0;
  const tick = () => onCheck(++done, checks.length);
  onCheck(0, checks.length);
  const outcomes: (CheckOutcome | undefined)[] = [];
  const llmQueue: number[] = [];
  for (const [index, check] of checks.entries()) {
    if (!check.itemIds.some(applies)) tick();
    else if (check.class === "LLM") llmQueue.push(index);
    else {
      outcomes[index] = await evaluate(check);
      tick();
    }
  }
  const llmWorker = async () => {
    for (let i = llmQueue.shift(); i !== undefined; i = llmQueue.shift()) {
      const check = checks[i];
      if (check) outcomes[i] = await evaluate(check);
      tick();
    }
  };
  await Promise.all(
    Array.from({ length: LLM_CHECK_CONCURRENCY }, () => llmWorker()),
  );
  return outcomes;
}

/** BLOCKED when an input the check requires was not collected. */
export function missingInput(
  check: HandbookCheck,
  collected: Partial<CollectedData>,
): CheckOutcome | undefined {
  const missing = check.requires.find((key) => collected[key]?.status !== "ok");
  if (!missing) return undefined;
  const value = collected[missing];
  const reason =
    value && value.status === "unavailable" ? value.reason : "not collected";
  return {
    kind: "verdict",
    status: "BLOCKED",
    note: `${missing} unavailable: ${reason}`,
  };
}
