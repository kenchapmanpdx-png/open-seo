import { type Browser, type Page, type Request } from "@playwright/test";
import type { z } from "zod";
import type {
  renderRequestSchema,
  RenderResponse,
} from "../../src/server/features/handbook/contracts/sidecar";

/**
 * Playwright render engine for the sidecar: a fresh context per
 * request. Render captures status, HTML, console errors, every request,
 * words inside opacity:0 elements (after load, before scroll) and the
 * actions intersecting the first viewport.
 */
type RenderRequest = z.output<typeof renderRequestSchema>;

export const VIEWPORTS = {
  mobile: {
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
  },
  desktop: {
    viewport: { width: 1350, height: 940 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
} as const;

/** Scroll in viewport steps so lazy content and observers fire. */
export async function scrollToEnd(page: Page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight && y < 50_000; ) {
      y += window.innerHeight;
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 150));
    }
  });
}

/** Runs in the page: words under opacity:0 + first-viewport actions. */
function inspectPage() {
  let opacityZeroWords = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    for (let el = node.parentElement; el; el = el.parentElement) {
      if (getComputedStyle(el).opacity === "0") {
        opacityZeroWords += (node.textContent ?? "")
          .split(/\s+/)
          .filter(Boolean).length;
        break;
      }
    }
  }
  const firstScreenActions = [
    ...document.querySelectorAll("a, button, [role=button]"),
  ]
    .filter((el) => {
      const r = el.getBoundingClientRect();
      return (
        r.width > 0 &&
        r.height > 0 &&
        r.bottom > 0 &&
        r.right > 0 &&
        r.top < window.innerHeight &&
        r.left < window.innerWidth
      );
    })
    .map((el) => ({
      tag: el.tagName.toLowerCase(),
      text: (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 200),
      href: el.getAttribute("href"),
    }));
  return { opacityZeroWords, firstScreenActions };
}

export async function render(
  browser: Browser,
  req: RenderRequest,
): Promise<RenderResponse> {
  const started = Date.now();
  const context = await browser.newContext({
    ...VIEWPORTS[req.viewport],
    javaScriptEnabled: req.javascript,
  });
  try {
    const page = await context.newPage();
    const consoleErrors: string[] = [];
    const log: Request[] = [];
    const statusOf = new Map<Request, number>();
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text().slice(0, 500));
    });
    page.on("response", (r) => statusOf.set(r.request(), r.status()));
    page.on("request", (r) => log.push(r));
    // Playwright's TimeoutError (name "TimeoutError") maps to 504 in server.ts.
    const response = await page.goto(req.url, {
      waitUntil: "load",
      timeout: req.timeoutMs,
    });
    // Resource Timing, read right after load: what started before the load
    // event (P7-04 wants tags scheduled after load/interaction). Entries still
    // in flight are absent, so they count as not-before-load (no false OPEN).
    const beforeLoad = new Set(
      await page.evaluate(() => {
        const nav = performance.getEntriesByType("navigation")[0];
        const cut =
          nav instanceof PerformanceNavigationTiming && nav.loadEventStart > 0
            ? nav.loadEventStart
            : Number.POSITIVE_INFINITY;
        return performance
          .getEntriesByType("resource")
          .filter((e) => e.startTime < cut)
          .map((e) => e.name);
      }),
    );
    const inspected = await page.evaluate(inspectPage);
    if (req.scrollToEnd) await scrollToEnd(page);
    const screenshot =
      req.screenshot === "none"
        ? null
        : (
            await page.screenshot({ fullPage: req.screenshot === "fullPage" })
          ).toString("base64");
    const html = await page.content();
    return {
      finalUrl: page.url(),
      status: response?.status() ?? null,
      html,
      screenshotPng: screenshot,
      consoleErrors,
      requests: log.map((r) => ({
        url: r.url(),
        resourceType: r.resourceType(),
        status: statusOf.get(r) ?? null,
        beforeLoad: beforeLoad.has(r.url()),
      })),
      ...inspected,
      timingMs: Date.now() - started,
    };
  } finally {
    await context.close();
  }
}
