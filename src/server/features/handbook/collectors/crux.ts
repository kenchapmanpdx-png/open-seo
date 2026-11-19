import { sort } from "remeda";
import { z } from "zod";
import type {
  CollectedData,
  CollectorContext,
} from "@/server/features/handbook/contracts/collectors";
import type { LighthouseData } from "@/server/features/handbook/contracts/render-data";

/**
 * CrUX field data (FULL-READ §3.10, P7-10): p75 LCP / CLS / INP for the
 * origin and the rank-1 page of the largest templates (cap 5), PHONE and
 * DESKTOP, from the CrUX API (`records:queryRecord`) when `CRUX_API_KEY` is
 * set. The key goes in the `X-Goog-Api-Key` header and is never logged.
 * 404 = CrUX has no data → an all-null row; any other error drops the row
 * (logged), so an empty `field` means the API failed.
 */
const ENDPOINT = "https://chromeuxreport.googleapis.com/v1/records:queryRecord";
const MAX_TEMPLATES = 5;
const FORM_FACTORS = ["PHONE", "DESKTOP"] as const;

type Field = NonNullable<LighthouseData["field"]>[number];

const metric = z
  .object({ percentiles: z.object({ p75: z.coerce.number() }) })
  .optional()
  .catch(undefined);
const recordSchema = z.object({
  record: z.object({
    metrics: z.object({
      largest_contentful_paint: metric,
      cumulative_layout_shift: metric,
      interaction_to_next_paint: metric,
    }),
  }),
});
const p75 = (m: z.infer<typeof metric>) => {
  const n = m?.percentiles.p75;
  return n !== undefined && Number.isFinite(n) ? n : null;
};

async function queryRecord(
  ctx: CollectorContext,
  key: string,
  fetchFn: typeof fetch,
  target: { url: string | null; origin: string },
  formFactor: Field["formFactor"],
): Promise<Field | null> {
  const empty = {
    url: target.url,
    formFactor,
    lcpMs: null,
    cls: null,
    inpMs: null,
  };
  try {
    const res = await fetchFn(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        ...(target.url ? { url: target.url } : { origin: target.origin }),
        formFactor,
      }),
    });
    if (res.status === 404) return empty;
    if (!res.ok) {
      ctx.log("handbook.crux.error", {
        target: target.url ?? target.origin,
        status: res.status,
      });
      return null;
    }
    const parsed = recordSchema.safeParse(await res.json());
    if (!parsed.success) return empty;
    const m = parsed.data.record.metrics;
    return {
      ...empty,
      lcpMs: p75(m.largest_contentful_paint),
      cls: p75(m.cumulative_layout_shift),
      inpMs: p75(m.interaction_to_next_paint),
    };
  } catch (error) {
    ctx.log("handbook.crux.error", {
      target: target.url ?? target.origin,
      error: String(error),
    });
    return null;
  }
}

/** Lighthouse data with `field` added; unchanged when no CrUX key is set. */
export async function withCruxField(
  ctx: CollectorContext,
  collected: Partial<CollectedData>,
  lighthouse: LighthouseData,
  key: string | undefined = typeof process === "undefined"
    ? undefined
    : process.env.CRUX_API_KEY,
  fetchFn: typeof fetch = fetch,
): Promise<LighthouseData> {
  if (!key) return lighthouse;
  const origin = new URL(ctx.origin).origin;
  const templates =
    collected.templates?.status === "ok" ? collected.templates.templates : [];
  const urls = sort(templates, (a, b) => b.urls.length - a.urls.length)
    .slice(0, MAX_TEMPLATES)
    .flatMap((t) => t.samples.filter((s) => s.rank === 1).map((s) => s.url));
  const targets = [null, ...new Set(urls)];
  const rows = await Promise.all(
    targets.flatMap((url) =>
      FORM_FACTORS.map((ff) =>
        queryRecord(ctx, key, fetchFn, { url, origin }, ff),
      ),
    ),
  );
  return { ...lighthouse, field: rows.filter((r) => r !== null) };
}
