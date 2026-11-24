import type {
  CollectorContext,
  LinkProbe,
  SafeFetch,
} from "@/server/features/handbook/contracts/collectors";
import {
  type RetryPolicy,
  sleep,
  withRetry,
} from "@/server/features/handbook/engine/transient-retry";

/**
 * Shared URL probe (ADR-031) for outbound links, un-crawled internal link
 * targets and page resources: HEAD, GET when HEAD fails or answers ≥ 400, one retry after 2 s on a transient status. A 403 for a non-browser
 * user-agent is retried once as a browser (`browserRetest`). `null` = no
 * HTTP answer (DNS, connect or timeout failure).
 */
export const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
/**
 * Probe retry policy (ADR-035 (c)): a site's own server, so one retry after
 * 2 s on 429 / 502 / 503 / 504 or no answer, never a burst.
 */
const TRANSIENT = new Set([429, 502, 503, 504]);
const PROBE_RETRY: RetryPolicy<Answer | null> = {
  tries: 2,
  retryable: (a) => !a || TRANSIENT.has(a.status),
  wait: () => sleep(2000),
};

/** Per-host request spacing, adjusted by each answer's status. */
type Pace = {
  wait: (url: string) => Promise<void>;
  answered: (url: string, status: number) => void;
};

/** Slowest spacing 429s can push a host to. */
const MAX_INTERVAL_MS = 4000;
/** Answers without a 429 before a slowed host's spacing halves. */
const CLEAN_ANSWERS_TO_SPEED_UP = 10;

/**
 * Per-host pacer: each request on a host waits for its own slot. 300 ms =
 * the page crawl's own per-host spacing (safeFetch); was 1 s, which made the
 * probes of a site's own assets the longest crawl unit (WO-B20-005 / 012).
 * A 429 slows that host: 1 s, then doubling up to 4 s; every 10 answers
 * without one halve it again, down to the base (run 97: salonvata.com
 * answered 78 link and 91 resource probes with 429 at a fixed 300 ms; a
 * fixed 4 s after the first 429 tripled its probe time).
 */
export function hostPacer(intervalMs = 300): Pace {
  const next = new Map<string, number>();
  const hosts = new Map<string, { interval: number; clean: number }>();
  const state = (url: string) => {
    const host = new URL(url).host;
    const found = hosts.get(host);
    if (found) return { host, s: found };
    const fresh = { interval: intervalMs, clean: 0 };
    hosts.set(host, fresh);
    return { host, s: fresh };
  };
  return {
    async wait(url) {
      const { host, s } = state(url);
      const now = Date.now();
      const slot = Math.max(now, next.get(host) ?? 0);
      next.set(host, slot + s.interval);
      await sleep(slot - now);
    },
    answered(url, status) {
      const { host, s } = state(url);
      if (status === 429) {
        s.interval = Math.min(MAX_INTERVAL_MS, Math.max(1000, 2 * s.interval));
        s.clean = 0;
        next.set(host, Math.max(next.get(host) ?? 0, Date.now() + s.interval));
      } else if (
        s.interval > intervalMs &&
        ++s.clean >= CLEAN_ANSWERS_TO_SPEED_UP
      ) {
        s.interval = Math.max(intervalMs, s.interval / 2);
        s.clean = 0;
      }
    },
  };
}

type Answer = { status: number; finalUrl: string; method: "HEAD" | "GET" };

/** Where and how one probe goes. */
type Target = { fetcher: SafeFetch; pace: Pace; url: string };

export async function fetchOnce(
  ctx: CollectorContext,
  { fetcher, pace, url }: Target,
  userAgent: string | undefined,
  method: "GET" | "HEAD",
): Promise<Answer | null> {
  await pace.wait(url);
  try {
    const res = await fetcher(url, { userAgent, method });
    pace.answered(url, res.status);
    return { status: res.status, finalUrl: res.finalUrl, method };
  } catch (error) {
    ctx.log("handbook.probe.fetch_failed", {
      url,
      method,
      error: String(error),
    });
    return null;
  }
}

async function attempt(
  ctx: CollectorContext,
  target: Target,
  userAgent: string | undefined,
): Promise<Answer | null> {
  const once = async () => {
    const head = await fetchOnce(ctx, target, userAgent, "HEAD");
    // HEAD is trusted only for success / redirect; some servers answer
    // HEAD with 404 or 405 for a URL GET serves (Google Maps JS).
    if (head && head.status < 400) return head;
    return fetchOnce(ctx, target, userAgent, "GET");
  };
  let first: Answer | null | undefined;
  const last = await withRetry(async () => {
    const answer = await once();
    first ??= answer;
    return answer;
  }, PROBE_RETRY);
  return last ?? first ?? null;
}

/** Probe `url`; `userAgent` undefined = the fetcher's default (Handbook) UA. */
export async function probeUrl(
  ctx: CollectorContext,
  fetcher: SafeFetch,
  pace: Pace,
  url: string,
  userAgent?: string,
): Promise<LinkProbe> {
  const target = { fetcher, pace, url };
  const answer = await attempt(ctx, target, userAgent);
  if (!answer || answer.status !== 403 || userAgent === BROWSER_UA)
    return answer;
  const retest = await attempt(ctx, target, BROWSER_UA);
  return {
    ...answer,
    browserRetest: retest
      ? { status: retest.status, finalUrl: retest.finalUrl }
      : null,
  };
}

/** Status a browser ends up with: the browser retest when there was one. */
export function effectiveStatus(p: LinkProbe): number | null {
  if (!p) return null;
  return p.browserRetest ? p.browserRetest.status : p.status;
}

/** Run `task` over `items` with `workers` in parallel, results in order. */
export async function pool<T, R>(
  items: readonly T[],
  workers: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = Array.from({ length: items.length });
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await task(items[i]);
    }
  };
  await Promise.all(Array.from({ length: workers }, worker));
  return out;
}
