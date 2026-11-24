import type {
  CollectorContext,
  LinkProbe,
  SafeFetch,
} from "@/server/features/handbook/contracts/collectors";

/**
 * Shared URL probe (ADR-031) for outbound links, un-crawled internal link
 * targets and page resources: HEAD, GET when HEAD fails or answers ≥ 400, one retry after 2 s on a transient status. A 403 for a non-browser
 * user-agent is retried once as a browser (`browserRetest`). `null` = no
 * HTTP answer (DNS, connect or timeout failure).
 */
export const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const TRANSIENT = new Set([429, 502, 503, 504]);
const RETRY_DELAY_MS = 2000;

const sleep = (ms: number) =>
  new Promise<void>((done) => setTimeout(done, Math.max(0, ms)));

type Pace = (url: string) => Promise<void>;

/**
 * Per-host pacer: each request on a host waits for its own slot. 300 ms =
 * the page crawl's own per-host spacing (safeFetch); was 1 s, which made the
 * probes of a site's own assets the longest crawl unit (WO-B20-005 / 012).
 */
export function hostPacer(intervalMs = 300): Pace {
  const next = new Map<string, number>();
  return async (url: string) => {
    const host = new URL(url).host;
    const now = Date.now();
    const slot = Math.max(now, next.get(host) ?? 0);
    next.set(host, slot + intervalMs);
    await sleep(slot - now);
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
  await pace(url);
  try {
    const res = await fetcher(url, { userAgent, method });
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
  const first = await once();
  if (first && !TRANSIENT.has(first.status)) return first;
  await sleep(RETRY_DELAY_MS);
  return (await once()) ?? first;
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
