import type { CollectorContext } from "@/server/features/handbook/contracts/collectors";
import { createLimiter } from "./limiter";

export type Outcome<T> = { ok: true; value: T } | { ok: false; reason: string };

/** Runs `each` per URL; unavailable only when every URL failed. */
export async function perUrl<T>(
  ctx: CollectorContext,
  key: string,
  urls: readonly string[] | null,
  each: (url: string) => Promise<Outcome<T>>,
): Promise<
  { status: "ok"; pages: T[] } | { status: "unavailable"; reason: string }
> {
  if (!urls) return { status: "unavailable", reason: "templates unavailable" };
  if (urls.length === 0)
    return { status: "unavailable", reason: "no template samples" };
  const pages: T[] = [];
  let firstError: string | null = null;
  // All URLs start at once; the shared limiter caps sidecar calls in flight.
  const outcomes = await Promise.all(urls.map((url) => each(url)));
  for (const [i, outcome] of outcomes.entries()) {
    const url = urls[i];
    if (outcome.ok) pages.push(outcome.value);
    else {
      firstError ??= outcome.reason;
      ctx.log("handbook.sidecar.skip", { key, url, reason: outcome.reason });
    }
  }
  return pages.length > 0
    ? { status: "ok", pages }
    : { status: "unavailable", reason: firstError ?? "no pages rendered" };
}

/** Shared pause before each retry of a page the site answered with 429. */
const BACKOFF_MS = [5_000, 20_000];
/** Pages still throttled after back-off, in a row, before retries stop. */
const GIVE_UP = 3;

const sleep = (ms: number) =>
  new Promise<void>((done) => setTimeout(done, Math.max(0, ms)));

/**
 * One per render pass (WO-B9-103). A site that throttles the renders
 * (HTTP 429) pauses every render for the back-off, then the page is retried;
 * after GIVE_UP pages in a row stay throttled, retries stop. From the first
 * 429 on, pages render one at a time: parallel renders (each loading the
 * page's assets) kept re-tripping bluetree's limit after every pause (B10
 * run 54: every render 429).
 */
export function createRenderThrottle(
  onRetry: (retryInMs: number) => void = () => {},
) {
  let pauseUntil = 0;
  let throttledInARow = 0;
  let serial = false;
  const onePage = createLimiter(1);
  return async <T>(
    attempt: () => Promise<T>,
    throttled: (result: T) => boolean,
  ): Promise<T> => {
    const once = async () => {
      await sleep(pauseUntil - Date.now());
      return attempt();
    };
    let result = await (serial ? onePage(once) : once());
    for (const delay of BACKOFF_MS) {
      if (!throttled(result) || throttledInARow >= GIVE_UP) break;
      serial = true;
      pauseUntil = Math.max(pauseUntil, Date.now() + delay);
      onRetry(delay);
      result = await onePage(once);
    }
    throttledInARow = throttled(result) ? throttledInARow + 1 : 0;
    return result;
  };
}

/**
 * Client timeouts = the sidecar's hard deadline + 30 s (WO-B12-003): render
 * 30 s page timeout + 60 s, axe 60 s + 60 s, Lighthouse 240 s.
 */
export const CLIENT_TIMEOUT_MS = {
  "/render": 120_000,
  "/axe": 150_000,
  "/lighthouse": 270_000,
} as const;
export const SIDECAR_TIMEOUT = "sidecar timeout";
export const SIDECAR_UNAVAILABLE = "sidecar unavailable";
/** Timeouts in a row before the sidecar is treated as down (WO-B12-003). */
const TIMEOUTS_BEFORE_DOWN = 3;
const HEALTH_WAIT_MS = 60_000;

/**
 * One per run (WO-B12-003). After 3 sidecar timeouts in a row every call
 * waits 60 s, `/health` is probed once: healthy → calls resume; otherwise
 * every later call fails `sidecar unavailable` without reaching the sidecar
 * (render / axe / Lighthouse items BLOCKED, FULL-READ §8). The single probe
 * is spent: a second run of 3 timeouts marks the sidecar unavailable.
 */
export function createSidecarGate(
  sidecarUrl: string,
  probe = async () =>
    (
      await fetch(`${sidecarUrl.replace(/\/$/, "")}/health`, {
        signal: AbortSignal.timeout(10_000),
      })
    ).ok,
) {
  let inARow = 0;
  let probed = false;
  let unavailable = false;
  let waiting: Promise<void> | null = null;
  return async <T>(attempt: () => Promise<Outcome<T>>): Promise<Outcome<T>> => {
    if (waiting) await waiting;
    if (unavailable) return { ok: false, reason: SIDECAR_UNAVAILABLE };
    const result = await attempt();
    inARow = !result.ok && result.reason === SIDECAR_TIMEOUT ? inARow + 1 : 0;
    if (inARow >= TIMEOUTS_BEFORE_DOWN && !waiting && !unavailable) {
      if (probed) unavailable = true;
      else {
        probed = true;
        waiting = sleep(HEALTH_WAIT_MS)
          .then(probe)
          .catch(() => false)
          .then((healthy) => {
            console.warn(
              `handbook sidecar: ${TIMEOUTS_BEFORE_DOWN} timeouts in a row; /health ${healthy ? "ok, resuming" : "failed, unavailable for this run"}`,
            );
            unavailable = !healthy;
            inARow = 0;
            waiting = null;
          });
      }
    }
    return result;
  };
}
