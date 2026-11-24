/**
 * WO-B20-008 / ADR-035: one retry policy for the outbound calls a run
 * depends on. A transient answer (HTTP 429 or 5xx, or a network error
 * thrown by fetch) is retried with doubling backoff; anything else returns
 * at once. After the last try the last response is returned (or the last
 * error thrown), so callers keep their own "failed" handling.
 */
export const TRANSIENT_TRIES = 3;
const BASE_MS = 400;

export const isTransientStatus = (status: number) =>
  status === 429 || status >= 500;

export async function fetchWithRetry(
  attempt: () => Promise<Response>,
  tries = TRANSIENT_TRIES,
): Promise<Response> {
  for (let i = 1; ; i++) {
    try {
      const res = await attempt();
      if (!isTransientStatus(res.status) || i >= tries) return res;
    } catch (error) {
      if (i >= tries) throw error;
    }
    await new Promise((r) => setTimeout(r, BASE_MS * 2 ** (i - 1)));
  }
}
