/**
 * Tiny promise pool: at most `max` tasks in flight; the rest wait in FIFO
 * order. A finishing task hands its slot straight to the next waiter, so a
 * new caller can never slip in between and exceed `max`. Shared by the
 * render and axe sidecar calls (ADR-018: client never exceeds the sidecar's
 * `HANDBOOK_SIDECAR_MAX_RENDERS`).
 */
export function createLimiter(max: number) {
  let active = 0;
  const waiting: Array<() => void> = [];
  return async function limit<T>(task: () => Promise<T>): Promise<T> {
    if (active < max) active += 1;
    else await new Promise<void>((resolve) => waiting.push(resolve));
    try {
      return await task();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else active -= 1;
    }
  };
}
