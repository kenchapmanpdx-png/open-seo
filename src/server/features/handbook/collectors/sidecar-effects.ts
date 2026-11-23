import type { CollectedData } from "@/server/features/handbook/contracts/collectors";
import type { RenderData } from "@/server/features/handbook/contracts/render-data";
import type { RenderResponse } from "@/server/features/handbook/contracts/sidecar";
import { extractHtmlFacts } from "@/server/features/handbook/engine/html-facts";
import {
  compareRenderedText,
  containsText,
  robotsBlockedRequests,
} from "@/server/features/handbook/engine/robots-blocked";
import { z } from "zod";
import type { Outcome } from "./sidecar-per-url";

type RobotsBlocked = RenderData["pages"][number]["js"]["robotsBlocked"];

/**
 * P3-20 by effect (WO-B19-004, ADR-033): when the normal render made
 * robots-blocked same-host requests, render again with exactly those URLs
 * aborted and compare the visible text. Undefined when nothing is blocked
 * or the second render fails (the check then keeps the by-type rule).
 * A difference must hold twice (B19 run 91): a control render with nothing
 * aborted keeps only sentences present in both normal renders (a review
 * carousel, a typing animation vary on their own), and a second render with
 * the requests aborted keeps only sentences missing both times (a slow
 * third-party widget can fail to load once under load).
 */
export async function robotsBlockedEffect(
  renderWithout: (abortUrls: string[]) => Promise<Outcome<RenderResponse>>,
  normal: RenderResponse,
  normalText: string,
  robots: CollectedData["robots"] | undefined,
  onFail: (reason: string) => void = () => {},
): Promise<RobotsBlocked> {
  if (robots?.status !== "ok") return undefined;
  const urls = [
    ...new Set(
      robotsBlockedRequests(normal.requests, robots).blocked.map((b) => b.url),
    ),
  ];
  if (urls.length === 0) return undefined;
  const textOf = async (abortUrls: string[]) => {
    const r = await renderWithout(abortUrls);
    if (!r.ok) return onFail(r.reason);
    const status = r.value.status;
    if (status !== null && (status < 200 || status >= 300))
      return onFail(`HTTP ${status}`);
    return extractHtmlFacts(r.value.html, r.value.finalUrl).markup.text;
  };
  const blockedText = await textOf(urls.slice(0, 200));
  if (blockedText === undefined) return undefined;
  const first = compareRenderedText(normalText, blockedText);
  const result = (sameContent: boolean, missing: string[]) => ({
    urls,
    ...first,
    sameContent,
    missing: missing.slice(0, 5).map((s) => s.slice(0, 200)),
  });
  if (first.sameContent) return result(true, first.missing);
  const controlText = await textOf([]);
  if (controlText === undefined) return result(false, first.missing);
  const stable = first.missing.filter((s) => containsText(controlText, s));
  if (stable.length === 0) return result(true, stable);
  const againText = await textOf(urls.slice(0, 200));
  if (againText === undefined) return result(false, stable);
  const repeated = stable.filter((s) => !containsText(againText, s));
  return result(repeated.length === 0, repeated);
}

/** Polls the sidecar `/health` every 5 s until it answers ok or `ms` passes. */
async function waitHealthy(url: string, ms: number): Promise<boolean> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    await new Promise((r) => setTimeout(r, 5_000));
    try {
      const res = await fetch(`${url.replace(/\/$/, "")}/health`, {
        signal: AbortSignal.timeout(5_000),
      });
      if (res.ok) return true;
    } catch {
      // still restarting
    }
  }
  return false;
}

/**
 * WO-B19-016: a dropped connection (the sidecar process restarted, e.g. its
 * stall guard after axe deadline misses) gets one retry once `/health`
 * answers again (≤ 90 s).
 */
export async function withRestartRetry<T>(
  attempt: () => Promise<Outcome<T>>,
  sidecarUrl: string,
  onRetry: () => void,
): Promise<Outcome<T>> {
  const first = await attempt();
  if (first.ok || !first.reason.includes("unreachable")) return first;
  onRetry();
  return (await waitHealthy(sidecarUrl, 90_000)) ? attempt() : first;
}

/** Σ transferBytes, unknown sizes (aborted, opaque) skipped. */
export function pageWeight(
  requests: ReadonlyArray<{ transferBytes?: number | null }>,
): number {
  return requests.reduce((sum, r) => sum + (r.transferBytes ?? 0), 0);
}

export const encode = (text: string) => new TextEncoder().encode(text);

/** Visible text of an axe node's outer HTML, ≤120 chars (P8-02, contracts 1.3.0). */
export const nodeText = (html: string) =>
  extractHtmlFacts(html, "https://axe.invalid/").markup.text.slice(0, 120);

// Lighthouse `render-blocking-resources` audit details (P7-05, contracts 1.3.0).
const renderBlockingSchema = z.object({
  audits: z.object({
    "render-blocking-resources": z.object({
      details: z.object({
        items: z.array(
          z.object({ url: z.string(), wastedMs: z.number().nonnegative() }),
        ),
      }),
    }),
  }),
});

/** Undefined when the report lacks the audit (older Lighthouse or no items). */
export function renderBlocking(report: unknown) {
  const parsed = renderBlockingSchema.safeParse(report);
  return parsed.success
    ? parsed.data.audits["render-blocking-resources"].details.items.map(
        (item) => ({ url: item.url, wastedMs: Math.round(item.wastedMs) }),
      )
    : undefined;
}
