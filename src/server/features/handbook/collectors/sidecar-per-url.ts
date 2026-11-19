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
