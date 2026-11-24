/**
 * WO-B20-008 / WO-B20-015 (c), ADR-035: one retry policy primitive for the
 * outbound calls a run depends on. Every retry loop in the Handbook goes
 * through `withRetry`; a call site only states its policy (which results are
 * transient, how many tries, how long to wait before the next try). After the
 * last try the last result is returned (or the last error thrown), so callers
 * keep their own "failed" handling. `retry-policy.test.ts` fails when a
 * Handbook file waits with `setTimeout` outside the allow-list.
 */
export type RetryPolicy<T> = {
  /** Total tries, first one included. */
  tries: number;
  /** True = transient: try again. */
  retryable: (result: T) => boolean;
  /** Thrown errors are transient too (else rethrown at once). */
  retryThrown?: boolean;
  /**
   * Wait before try `next` (2…tries), given the last result (undefined after
   * a throw). Resolve `false` to stop and keep the last result.
   */
  wait: (next: number, last: T | undefined) => Promise<boolean | void>;
};

export const sleep = (ms: number) =>
  new Promise<void>((done) => setTimeout(done, Math.max(0, ms)));

export async function withRetry<T>(
  attempt: () => Promise<T>,
  policy: RetryPolicy<T>,
): Promise<T> {
  for (let i = 1; ; i++) {
    let last: { value: T } | { error: unknown };
    try {
      const value = await attempt();
      if (!policy.retryable(value) || i >= policy.tries) return value;
      last = { value };
    } catch (error) {
      if (!policy.retryThrown || i >= policy.tries) throw error;
      last = { error };
    }
    const lastValue = "value" in last ? last.value : undefined;
    if ((await policy.wait(i + 1, lastValue)) === false) {
      if ("error" in last) throw last.error;
      return last.value;
    }
  }
}

export const TRANSIENT_TRIES = 3;
const BASE_MS = 400;

export const isTransientStatus = (status: number) =>
  status === 429 || status >= 500;

/** Infrastructure we own or pay for (evidence store): 429 / 5xx / network, 3 tries, 400 ms doubling. */
export function fetchWithRetry(
  attempt: () => Promise<Response>,
  tries = TRANSIENT_TRIES,
): Promise<Response> {
  return withRetry(attempt, {
    tries,
    retryable: (res) => isTransientStatus(res.status),
    retryThrown: true,
    wait: (next) => sleep(BASE_MS * 2 ** (next - 2)),
  });
}

const RETRY_AFTER_DEFAULT_MS = 10_000;
const RETRY_AFTER_MAX_MS = 15_000;

/** A site's 429: its `Retry-After` in seconds (capped 15 s), else 10 s (a common Crawl-delay). */
export function retryAfterMs(res: {
  headers: readonly (readonly [string, string])[];
}): number {
  const value = res.headers.find(([k]) => k === "retry-after")?.[1];
  const seconds = Number(value);
  return value && Number.isFinite(seconds) && seconds > 0
    ? Math.min(seconds * 1000, RETRY_AFTER_MAX_MS)
    : RETRY_AFTER_DEFAULT_MS;
}
