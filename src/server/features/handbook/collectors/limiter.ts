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

/**
 * Read-ahead over an ordered list (WO-B20-005): `take(i)` starts `items[i]`
 * and the next `ahead() - 1` items if not started yet, then awaits item `i`.
 * The caller still handles results one by one in list order.
 */
export function readAhead<T, R>(
  items: readonly T[],
  ahead: () => number,
  start: (item: T) => Promise<R>,
): (index: number) => Promise<R> {
  const started = new Map<number, Promise<R>>();
  return (index) => {
    const end = Math.min(items.length, index + Math.max(1, ahead()));
    for (let i = index; i < end; i++)
      if (!started.has(i)) started.set(i, start(items[i]));
    return started.get(index) ?? start(items[index]);
  };
}
