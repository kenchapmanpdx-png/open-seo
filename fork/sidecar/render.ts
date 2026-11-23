import { type Browser, type Page, type Request } from "@playwright/test";
import type { z } from "zod";
import type {
  renderRequestSchema,
  RenderResponse,
} from "../../src/server/features/handbook/contracts/sidecar";
import { classifyRequest, VIDEO_EMBED, type AbortReason } from "./classify";

/**
 * Playwright render engine for the sidecar: a fresh context per
 * request. Render captures status, HTML, console errors, every request
 * (bytes, protocol, aborted beacons / media — K3 1.2.0), words inside
 * opacity:0 elements (after load, before scroll), the actions intersecting
 * the first viewport and video / video-iframe layout facts.
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

/**
 * Runs in the page: words under opacity:0, first-viewport actions, media elements.
 * WO-B19-006: one walker for numerator and denominator. It reads the main
 * content root (`main`, `[role=main]`, else body), skips script / style /
 * noscript / template text and anything under `display:none` or
 * `visibility:hidden`; `mainWords` counts every remaining word and
 * `opacityZeroWords` those under an `opacity:0` ancestor, so the hidden
 * count can never exceed the total.
 */
function inspectPage(embedPattern: string) {
  const root = document.querySelector("main, [role=main]") ?? document.body;
  const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"]);
  const state = new Map<Element, "skip" | "faded" | "shown">();
  const stateOf = (el: Element | null): "skip" | "faded" | "shown" => {
    if (!el) return "shown";
    const known = state.get(el);
    if (known) return known;
    const style = getComputedStyle(el);
    const parent = el === root ? "shown" : stateOf(el.parentElement);
    const own: "skip" | "faded" | "shown" =
      parent === "skip" ||
      SKIP.has(el.tagName) ||
      style.display === "none" ||
      style.visibility === "hidden"
        ? "skip"
        : parent === "faded" || style.opacity === "0"
          ? "faded"
          : "shown";
    state.set(el, own);
    return own;
  };
  let mainWords = 0;
  let opacityZeroWords = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const where = stateOf(node.parentElement);
    if (where === "skip") continue;
    const words = (node.textContent ?? "").split(/\s+/).filter(Boolean).length;
    mainWords += words;
    if (where === "faded") opacityZeroWords += words;
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
  const embed = new RegExp(embedPattern, "i");
  const mediaElements = [...document.querySelectorAll("video, iframe")]
    .map((el) => {
      const src =
        el.getAttribute("src") ??
        el.querySelector("source")?.getAttribute("src") ??
        el.getAttribute("data-src");
      const kind: "video" | "iframe" =
        el.tagName === "VIDEO" ? "video" : "iframe";
      const r = el.getBoundingClientRect();
      const ratio = getComputedStyle(el).aspectRatio;
      return {
        kind,
        src,
        firstScreen:
          r.width > 0 &&
          r.height > 0 &&
          r.top < window.innerHeight &&
          r.bottom > 0,
        reservedSize:
          (el.hasAttribute("width") && el.hasAttribute("height")) ||
          (!!ratio && ratio !== "auto"),
      };
    })
    .filter((m) => m.kind === "video" || (!!m.src && embed.test(m.src)));
  return { opacityZeroWords, mainWords, firstScreenActions, mediaElements };
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
    const abortedOf = new Map<Request, AbortReason>();
    // WO-B19-004: robots-blocked same-host requests, aborted to measure their effect.
    const abortUrls = new Set(req.abortUrls ?? []);
    // Record every request; abort beacons (when asked) and media bodies.
    await page.route("**/*", (route) => {
      const request = route.request();
      const reason = abortUrls.has(request.url())
        ? "robots"
        : classifyRequest(
            request.url(),
            request.resourceType(),
            req.blockBeacons,
          );
      if (!reason) return route.continue();
      abortedOf.set(request, reason);
      return route.abort("blockedbyclient");
    });
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
    const inspected = await page.evaluate(inspectPage, VIDEO_EMBED.source);
    if (req.scrollToEnd) await scrollToEnd(page);
    // Resource Timing after scroll: bytes over the wire (0 when cross-origin
    // without Timing-Allow-Origin → fall back to Playwright sizes) + protocol.
    const timing = new Map(
      await page.evaluate(() =>
        [
          ...performance.getEntriesByType("navigation"),
          ...performance.getEntriesByType("resource"),
        ]
          .filter((e) => e instanceof PerformanceResourceTiming)
          .map(
            (t) =>
              [
                t.name,
                { bytes: t.transferSize, protocol: t.nextHopProtocol || null },
              ] as const,
          ),
      ),
    );
    const sizes = await Promise.all(
      log.map(async (r) => {
        if (abortedOf.has(r)) return null;
        const t = timing.get(r.url());
        if (t && t.bytes > 0) return t.bytes;
        try {
          const s = await r.sizes();
          return s.responseBodySize + s.responseHeadersSize;
        } catch {
          return null;
        }
      }),
    );
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
      requests: log.map((r, i) => ({
        url: r.url(),
        resourceType: r.resourceType(),
        status: statusOf.get(r) ?? null,
        beforeLoad: beforeLoad.has(r.url()),
        transferBytes: sizes[i],
        aborted: abortedOf.get(r) ?? null,
        protocol: timing.get(r.url())?.protocol ?? null,
      })),
      ...inspected,
      timingMs: Date.now() - started,
    };
  } finally {
    await context.close();
  }
}
