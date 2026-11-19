import { z } from "zod";
import type {
  CollectedData,
  Collector,
  CollectorContext,
} from "@/server/features/handbook/contracts/collectors";
import type {
  AxeData,
  LighthouseData,
  RenderData,
} from "@/server/features/handbook/contracts/render-data";
import {
  axeResponseSchema,
  lighthouseResponseSchema,
  renderResponseSchema,
  type AxeRequest,
  type LighthouseRequest,
  type RenderRequest,
} from "@/server/features/handbook/contracts/sidecar";
import type { HandbookDepth } from "@/server/features/handbook/contracts/exports";
import type { LighthouseScope } from "@/server/features/handbook/engine/depth";
import { extractHtmlFacts } from "@/server/features/handbook/engine/html-facts";
import { numericMismatches } from "@/server/features/handbook/engine/numeric-parity";
import { renderRemovedAiTexts } from "@/server/features/handbook/engine/ai-addressed";
import { normalizeUrl } from "@/server/features/handbook/checks/support";
import {
  lighthouseEscalations,
  lighthouseMobileBase,
} from "@/server/features/handbook/engine/escalations";
import { createLimiter } from "./limiter";
import {
  LIGHTHOUSE_BATCH_SIZE,
  livePageUrls,
  sampleUrls,
  screenshotTargets,
} from "./sidecar-targets";
import {
  CLIENT_TIMEOUT_MS,
  createRenderThrottle,
  createSidecarGate,
  perUrl,
  SIDECAR_TIMEOUT,
  type Outcome,
} from "./sidecar-per-url";
import { renderOnlyLinks } from "./site-crawl";

/**
 * K3 client collectors (ADR-004): `render`, `axe` and `lighthouse` call the
 * local render sidecar. `quick`: one sample URL per template (rank 1, max
 * 16). `full` (FULL-READ §2/§3.3): `render` covers every 200 HTML page,
 * scrolled to the end, first-screen screenshots only for template rank-1,
 * home, contact and hub pages. Axe: samples (`full`: every live page).
 * Lighthouse, one at a time: `quick` home + first 2 samples, mobile; `full`
 * rank-1 per template (cap 15) + 3 heaviest pages mobile, home desktop, plus
 * the LCP / page-weight escalations (`engine/escalations.ts`). Every sidecar call goes through one limiter
 * (`concurrency`, default 3 = the sidecar's default MAX_RENDERS, ADR-018);
 * beacons are always recorded then aborted (ADR-021). The sidecar is
 * operator config (never a site URL), so it is called with plain fetch, not
 * the site-scoped SSRF fetch. Per-URL failures are logged and skipped; when
 * every URL fails the collector is unavailable with the first reason.
 */
export type SidecarConfig = {
  url: string;
  token: string;
  /** Default `quick` (pre-B9 sampling). */
  depth?: HandbookDepth;
  /** `HANDBOOK_RENDER_CONCURRENCY`; clamped to 1…8, default 3. */
  concurrency?: number;
  /** `HANDBOOK_LIGHTHOUSE` at `full`; default `templates`. */
  lighthouse?: LighthouseScope;
};

const DEFAULT_CONCURRENCY = 3;
/** A known non-2xx status (null = sidecar saw no main response). */
const non2xx = (status: number | null) =>
  status !== null && (status < 200 || status >= 300);

type LighthousePage = LighthouseData["pages"][number];

async function call<T extends z.ZodTypeAny>(
  config: SidecarConfig,
  path: keyof typeof CLIENT_TIMEOUT_MS,
  body: RenderRequest | AxeRequest | LighthouseRequest,
  schema: T,
): Promise<Outcome<z.output<T>>> {
  try {
    const res = await fetch(`${config.url.replace(/\/$/, "")}${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS[path]),
    });
    if (res.status === 504) return { ok: false, reason: SIDECAR_TIMEOUT };
    if (!res.ok)
      return {
        ok: false,
        reason: `sidecar ${path} ${res.status}: ${(await res.text()).slice(0, 200)}`,
      };
    const parsed = schema.safeParse(await res.json());
    if (!parsed.success)
      return { ok: false, reason: `sidecar ${path} response failed K3 schema` };
    return { ok: true, value: parsed.data as z.output<T> };
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError")
      return { ok: false, reason: SIDECAR_TIMEOUT };
    return {
      ok: false,
      reason: `sidecar ${path} unreachable: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/** Σ transferBytes, unknown sizes (aborted, opaque) skipped. */
function pageWeight(
  requests: ReadonlyArray<{ transferBytes?: number | null }>,
): number {
  return requests.reduce((sum, r) => sum + (r.transferBytes ?? 0), 0);
}

const encode = (text: string) => new TextEncoder().encode(text);

/** Visible text of an axe node's outer HTML, ≤120 chars (P8-02, contracts 1.3.0). */
const nodeText = (html: string) =>
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
function renderBlocking(report: unknown) {
  const parsed = renderBlockingSchema.safeParse(report);
  return parsed.success
    ? parsed.data.audits["render-blocking-resources"].details.items.map(
        (item) => ({ url: item.url, wastedMs: Math.round(item.wastedMs) }),
      )
    : undefined;
}

export function createSidecarCollectors(config: SidecarConfig) {
  const full = config.depth === "full";
  const want = config.concurrency ?? DEFAULT_CONCURRENCY;
  const limit = createLimiter(
    Number.isInteger(want) && want >= 1
      ? Math.min(want, 8)
      : DEFAULT_CONCURRENCY,
  );
  const gate = createSidecarGate(config.url);
  const sidecar = <T extends z.ZodTypeAny>(
    path: keyof typeof CLIENT_TIMEOUT_MS,
    body: RenderRequest | AxeRequest | LighthouseRequest,
    schema: T,
  ) => gate(() => limit(() => call(config, path, body, schema)));
  // Lighthouse cannot run two audits at once in one sidecar process.
  const oneAtATime = createLimiter(1);
  // `all`: URLs already tried by an earlier batch of this process, so a
  // failing page is not retried by every later batch.
  const lighthouseTried = new Set<string>();

  const render: Collector<"render"> = {
    key: "render",
    dependsOn: full ? ["templates", "pages"] : ["templates"],
    collect: (ctx, collected) => {
      const samples = sampleUrls(collected);
      const urls = full && samples ? livePageUrls(collected) : samples;
      const shots = full
        ? screenshotTargets(urls ?? [], samples ?? [])
        : new Set((samples ?? []).map(normalizeUrl));
      // Non-2xx renders are skipped: they hold no page to read.
      const retryThrottled = createRenderThrottle((retryInMs) =>
        ctx.log("handbook.sidecar.throttled", { retryInMs }),
      );
      return perUrl(ctx, "render", urls, async (url) => {
        const base = {
          url,
          viewport: "mobile",
          scrollToEnd: full,
          blockBeacons: true,
        } as const;
        const [js, noJs] = await retryThrottled(
          () =>
            Promise.all([
              sidecar(
                "/render",
                {
                  ...base,
                  javascript: true,
                  screenshot: shots.has(normalizeUrl(url))
                    ? "firstScreen"
                    : "none",
                },
                renderResponseSchema,
              ),
              sidecar(
                "/render",
                {
                  ...base,
                  scrollToEnd: false,
                  javascript: false,
                  screenshot: "none",
                },
                renderResponseSchema,
              ),
            ]),
          (results) => results.some((r) => r.ok && r.value.status === 429),
        );
        if (!js.ok) return js;
        if (!noJs.ok) return noJs;
        if (non2xx(js.value.status) || non2xx(noJs.value.status))
          return {
            ok: false,
            reason: `render HTTP ${js.value.status} (no-JS ${noJs.value.status})`,
          };
        const [renderedKey, nojsKey, firstScreenKey] = await Promise.all([
          ctx.storeBody("rendered", url, encode(js.value.html), "text/html"),
          ctx.storeBody("nojs", url, encode(noJs.value.html), "text/html"),
          js.value.screenshotPng
            ? ctx.storeBody(
                "screenshot",
                url,
                Uint8Array.from(Buffer.from(js.value.screenshotPng, "base64")),
                "image/png",
              )
            : null,
        ]);
        const jsFacts = extractHtmlFacts(js.value.html, js.value.finalUrl);
        const raw =
          collected.pages?.status === "ok"
            ? collected.pages.snapshots.find((s) => s.url === url)
            : undefined;
        const page: RenderData["pages"][number] = {
          url,
          js: {
            finalUrl: js.value.finalUrl,
            status: js.value.status,
            renderedKey,
            words: jsFacts.words,
            requests: js.value.requests,
            pageWeightBytes: pageWeight(js.value.requests),
            mediaElements: js.value.mediaElements,
            opacityZeroWords: js.value.opacityZeroWords,
            firstScreenActions: js.value.firstScreenActions,
            forms: jsFacts.markup.counts.forms,
            // Without the raw snapshot every rendered link would look JS-only.
            ...(raw
              ? {
                  renderOnlyLinks: renderOnlyLinks(
                    url,
                    jsFacts.links,
                    raw.links,
                  ),
                  numericMismatches: numericMismatches(
                    raw.markup.text,
                    jsFacts.markup.text,
                  ),
                  aiAddressedRemoved: renderRemovedAiTexts(
                    raw.aiAddressed,
                    jsFacts.markup.text,
                  ),
                }
              : {}),
          },
          noJs: {
            status: noJs.value.status,
            nojsKey,
            words: extractHtmlFacts(noJs.value.html, noJs.value.finalUrl).words,
            opacityZeroWords: noJs.value.opacityZeroWords,
          },
          firstScreenKey,
          consoleErrors: js.value.consoleErrors,
        };
        return { ok: true, value: page };
      });
    },
  };

  const axe: Collector<"axe"> = {
    key: "axe",
    dependsOn: full ? ["templates", "pages"] : ["templates"],
    collect: (ctx, collected) => {
      // `full`: every live page (same set the render collector reads).
      const samples = sampleUrls(collected);
      const urls = full && samples ? livePageUrls(collected) : samples;
      return perUrl(ctx, "axe", urls, async (url) => {
        const res = await sidecar(
          "/axe",
          { url, viewport: "mobile", scrollToEnd: true },
          axeResponseSchema,
        );
        if (!res.ok) return res;
        const page: AxeData["pages"][number] = {
          url,
          violations: res.value.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            help: v.help,
            nodes: v.nodes.length,
            sampleTargets: v.nodes.slice(0, 5).map((n) => n.target.join(" ")),
            sampleTexts: v.nodes.slice(0, 3).map((n) => nodeText(n.html)),
          })),
        };
        return { ok: true, value: page };
      });
    },
  };

  /** One Lighthouse run (sequential across the whole collector). */
  const lighthouseRun =
    (ctx: CollectorContext, formFactor: "mobile" | "desktop") =>
    async (url: string): Promise<Outcome<LighthousePage>> => {
      const res = await oneAtATime(() =>
        sidecar("/lighthouse", { url, formFactor }, lighthouseResponseSchema),
      );
      if (!res.ok) return res;
      const storageKey = await ctx.storeBody(
        "lighthouse",
        url,
        encode(JSON.stringify(res.value.report)),
        "application/json",
      );
      return {
        ok: true,
        value: {
          url,
          formFactor,
          environment: res.value.environment,
          performance: res.value.categories.performance,
          lcpMs: res.value.metrics.lcpMs,
          cls: res.value.metrics.cls,
          tbtMs: res.value.metrics.tbtMs,
          lcpElement: res.value.lcpElement,
          storageKey,
          renderBlocking: renderBlocking(res.value.report),
        },
      };
    };

  const lighthouse: Collector<"lighthouse"> = {
    key: "lighthouse",
    dependsOn: full ? ["templates", "render"] : ["templates"],
    async collect(ctx, collected) {
      const home = new URL("/", ctx.origin).href;
      const mobile = lighthouseRun(ctx, "mobile");
      if (!full) {
        const samples = sampleUrls(collected);
        const urls = samples
          ? [home, ...samples.filter((u) => u !== home)].slice(0, 3)
          : null;
        return perUrl(ctx, "lighthouse", urls, mobile);
      }
      if (config.lighthouse === "all")
        return lighthouseAllBatch(ctx, collected);
      // `full` (HANDBOOK_LIGHTHOUSE=templates): rank-1 of every template
      // (cap 15) + 3 heaviest pages on mobile, home on desktop, then the
      // LCP > 4 s and > 5 MB escalations (FULL-READ §4) on mobile.
      const baseUrls =
        collected.templates?.status === "ok"
          ? lighthouseMobileBase(collected)
          : null;
      const base = await perUrl(ctx, "lighthouse", baseUrls, mobile);
      const desktop = await perUrl(
        ctx,
        "lighthouse",
        [home],
        lighthouseRun(ctx, "desktop"),
      );
      const baseRuns = base.status === "ok" ? base.pages : [];
      const { slow, heavy } = lighthouseEscalations(collected, baseRuns);
      const tried = new Set((baseUrls ?? []).map(normalizeUrl));
      const more = [...slow, ...heavy]
        .flatMap((f) => f.urls)
        .filter((u) => {
          if (tried.has(normalizeUrl(u))) return false;
          tried.add(normalizeUrl(u));
          return true;
        });
      const escalated =
        more.length > 0
          ? await perUrl(ctx, "lighthouse", more, mobile)
          : ({ status: "unavailable", reason: "none" } as const);
      const pages = [base, desktop, escalated].flatMap((r) =>
        r.status === "ok" ? r.pages : [],
      );
      if (pages.length > 0) return { status: "ok", pages };
      return base.status === "ok" ? base : desktop;
    },
  };

  /**
   * `all` (FULL-READ §2): one batch = the next 25 live pages not yet
   * measured, mobile only; the first batch also runs home on desktop. The
   * batch re-emits the earlier batches' pages, so the last batch holds them
   * all (stage outputs merge last-wins).
   */
  async function lighthouseAllBatch(
    ctx: CollectorContext,
    collected: Partial<CollectedData>,
  ): Promise<CollectedData["lighthouse"]> {
    const prior =
      collected.lighthouse?.status === "ok" ? collected.lighthouse.pages : [];
    const done = new Set([
      ...lighthouseTried,
      ...prior
        .filter((p) => p.formFactor === "mobile")
        .map((p) => normalizeUrl(p.url)),
    ]);
    const live = livePageUrls(collected);
    const next = live
      ?.filter((u) => !done.has(normalizeUrl(u)))
      .slice(0, LIGHTHOUSE_BATCH_SIZE);
    for (const u of next ?? []) lighthouseTried.add(normalizeUrl(u));
    const mobile = await perUrl(
      ctx,
      "lighthouse",
      next ?? null,
      lighthouseRun(ctx, "mobile"),
    );
    const desktop =
      collected.lighthouse === undefined
        ? await perUrl(
            ctx,
            "lighthouse",
            [new URL("/", ctx.origin).href],
            lighthouseRun(ctx, "desktop"),
          )
        : null;
    const pages = [
      ...prior,
      ...[mobile, desktop].flatMap((r) => (r?.status === "ok" ? r.pages : [])),
    ];
    if (pages.length > 0) return { status: "ok", pages };
    return collected.lighthouse ?? mobile;
  }

  return [render, axe, lighthouse] as const;
}
