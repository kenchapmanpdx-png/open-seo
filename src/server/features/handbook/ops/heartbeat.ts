// Handbook heartbeat (B13 WO-B13-010, ADR-027): a live Handbook step writes
// `fork:hb:beat:<runId>` on entry and every 30 s until it ends. The
// reconciler treats a run whose beat is older than 10 min as interrupted.
// A failed beat write is ignored: KV trouble must never fail the run.
import { HandbookKv } from "./kv";

const HEARTBEAT_INTERVAL_S = 30;

export async function withHeartbeat<T>(
  beat: { runId: string; stage: string; batch: number },
  fn: () => Promise<T>,
): Promise<T> {
  const write = async () => {
    try {
      await HandbookKv.putBeat(beat.runId, {
        ts: Date.now(),
        stage: beat.stage,
        batch: beat.batch,
      });
    } catch {
      // KV down: the reconciler's self-test sees it and stands down.
    }
  };
  await write();
  const timer = setInterval(() => void write(), HEARTBEAT_INTERVAL_S * 1000);
  try {
    return await fn();
  } finally {
    clearInterval(timer);
  }
}
