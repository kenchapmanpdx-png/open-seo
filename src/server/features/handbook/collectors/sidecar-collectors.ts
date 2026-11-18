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
import { extractHtmlFacts } from "@/server/features/handbook/engine/html-facts";

/**
 * K3 client collectors (ADR-004): `render`, `axe` and `lighthouse` call the
 * local render sidecar for one sample URL per template (rank 1, max 16;
 * Lighthouse: home + first 2 samples, mobile). The sidecar is operator
 * config (never a site URL), so it is called with plain fetch, not the
 * site-scoped SSRF fetch. Per-URL failures are logged and skipped; when
 * every URL fails the collector is unavailable with the first reason.
 */
export type SidecarConfig = { url: string; token: string };

const MAX_SAMPLES = 16;
const RENDER_TIMEOUT_MS = 90_000;
const LIGHTHOUSE_TIMEOUT_MS = 180_000;

type Outcome<T> = { ok: true; value: T } | { ok: false; reason: string };

async function call<T extends z.ZodTypeAny>(
  config: SidecarConfig,
  path: string,
  body: RenderRequest | AxeRequest | LighthouseRequest,
  schema: T,
  timeoutMs: number,
): Promise<Outcome<z.output<T>>> {
  try {
    const res = await fetch(`${config.url.replace(/\/$/, "")}${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
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
    return {
      ok: false,
      reason: `sidecar ${path} unreachable: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function sampleUrls(collected: Partial<CollectedData>): string[] | null {
  const templates = collected.templates;
  if (!templates || templates.status !== "ok") return null;
  return templates.templates
    .flatMap((t) => t.samples.filter((s) => s.rank === 1).map((s) => s.url))
    .slice(0, MAX_SAMPLES);
}

/** Runs `each` per URL; unavailable only when every URL failed. */
async function perUrl<T>(
  ctx: CollectorContext,
  key: string,
  urls: readonly string[] | null,
  each: (url: string) => Promise<Outcome<T>>,
): Promise<
  { status: "ok"; pages: T[] } | { status: "unavailable"; reason: string }
> {
  if (!urls) return { status: "unavailable", reason: "templates unavailable" };
  if (urls.length === 0)
    return { status: "unavailable", reason: "no template samples" };
  const pages: T[] = [];
  let firstError: string | null = null;
  for (const url of urls) {
    const outcome = await each(url);
    if (outcome.ok) pages.push(outcome.value);
    else {
      firstError ??= outcome.reason;
      ctx.log("handbook.sidecar.skip", { key, url, reason: outcome.reason });
    }
  }
  return pages.length > 0
    ? { status: "ok", pages }
    : { status: "unavailable", reason: firstError ?? "no pages rendered" };
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
  const render: Collector<"render"> = {
    key: "render",
    dependsOn: ["templates"],
    collect: (ctx, collected) =>
      perUrl(ctx, "render", sampleUrls(collected), async (url) => {
        const base = { url, viewport: "mobile", scrollToEnd: false } as const;
        const [js, noJs] = await Promise.all([
          call(
            config,
            "/render",
            { ...base, javascript: true, screenshot: "firstScreen" },
            renderResponseSchema,
            RENDER_TIMEOUT_MS,
          ),
          call(
            config,
            "/render",
            { ...base, javascript: false, screenshot: "none" },
            renderResponseSchema,
            RENDER_TIMEOUT_MS,
          ),
        ]);
        if (!js.ok) return js;
        if (!noJs.ok) return noJs;
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
        const page: RenderData["pages"][number] = {
          url,
          js: {
            finalUrl: js.value.finalUrl,
            status: js.value.status,
            renderedKey,
            words: jsFacts.words,
            requests: js.value.requests,
            opacityZeroWords: js.value.opacityZeroWords,
            firstScreenActions: js.value.firstScreenActions,
            forms: jsFacts.markup.counts.forms,
          },
          noJs: {
            status: noJs.value.status,
            nojsKey,
            words: extractHtmlFacts(noJs.value.html, noJs.value.finalUrl).words,
          },
          firstScreenKey,
          consoleErrors: js.value.consoleErrors,
        };
        return { ok: true, value: page };
      }),
  };

  const axe: Collector<"axe"> = {
    key: "axe",
    dependsOn: ["templates"],
    collect: (ctx, collected) =>
      perUrl(ctx, "axe", sampleUrls(collected), async (url) => {
        const res = await call(
          config,
          "/axe",
          { url, viewport: "mobile", scrollToEnd: true },
          axeResponseSchema,
          RENDER_TIMEOUT_MS,
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
      }),
  };

  const lighthouse: Collector<"lighthouse"> = {
    key: "lighthouse",
    dependsOn: ["templates"],
    collect: (ctx, collected) => {
      const samples = sampleUrls(collected);
      const home = new URL("/", ctx.origin).href;
      const urls = samples
        ? [home, ...samples.filter((u) => u !== home)].slice(0, 3)
        : null;
      return perUrl(ctx, "lighthouse", urls, async (url) => {
        const res = await call(
          config,
          "/lighthouse",
          { url, formFactor: "mobile" },
          lighthouseResponseSchema,
          LIGHTHOUSE_TIMEOUT_MS,
        );
        if (!res.ok) return res;
        const storageKey = await ctx.storeBody(
          "lighthouse",
          url,
          encode(JSON.stringify(res.value.report)),
          "application/json",
        );
        const page: LighthouseData["pages"][number] = {
          url,
          formFactor: "mobile",
          environment: res.value.environment,
          performance: res.value.categories.performance,
          lcpMs: res.value.metrics.lcpMs,
          cls: res.value.metrics.cls,
          tbtMs: res.value.metrics.tbtMs,
          lcpElement: res.value.lcpElement,
          storageKey,
          renderBlocking: renderBlocking(res.value.report),
        };
        return { ok: true, value: page };
      });
    },
  };

  return [render, axe, lighthouse] as const;
}
