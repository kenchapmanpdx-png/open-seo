import type { StageName, StageTracker } from "./stages";

/**
 * WO-B20-006: "items done of total" for a running unit, at most every 2 s
 * (each update is a DB round trip); the final count always goes through.
 */
export function throttledProgress(
  tracker: StageTracker,
  stage: StageName,
  batch: number,
): (done: number, total: number) => void {
  let shown = 0;
  return (done, total) => {
    if (done < total && Date.now() - shown < 2000) return;
    shown = Date.now();
    tracker.progress?.(stage, batch, done, total).catch(() => {});
  };
}
