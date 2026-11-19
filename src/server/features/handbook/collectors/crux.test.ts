import { describe, expect, it, vi } from "vitest";
import type { CollectorContext } from "@/server/features/handbook/contracts/collectors";
import type { LighthouseData } from "@/server/features/handbook/contracts/render-data";
import { withCruxField } from "./crux";

const ctx: CollectorContext = {
  runId: "r1",
  origin: "https://example.com",
  fetch: () => Promise.reject(new Error("unused")),
  fetchOffsite: () => Promise.reject(new Error("unused")),
  storeBody: async (kind, url) => `${kind}:${url}`,
  log: () => {},
};
const lighthouse: LighthouseData = { pages: [] };
const record = {
  record: {
    metrics: {
      largest_contentful_paint: { percentiles: { p75: 2300 } },
      cumulative_layout_shift: { percentiles: { p75: "0.05" } },
      interaction_to_next_paint: { percentiles: { p75: 180 } },
    },
  },
};

describe("withCruxField", () => {
  it("parses p75 for the origin; 404 → an all-null row", async () => {
    const fetchFn = vi.fn(
      async (_url: string | URL | Request, init?: RequestInit) =>
        typeof init?.body === "string" && init.body.includes("PHONE")
          ? Response.json(record)
          : new Response("", { status: 404 }),
    );
    const out = await withCruxField(ctx, {}, lighthouse, "k", fetchFn);
    expect(out.field).toEqual([
      { url: null, formFactor: "PHONE", lcpMs: 2300, cls: 0.05, inpMs: 180 },
      { url: null, formFactor: "DESKTOP", lcpMs: null, cls: null, inpMs: null },
    ]);
  });

  it("leaves field unset without a key and drops failed records", async () => {
    expect(
      (await withCruxField(ctx, {}, lighthouse, undefined)).field,
    ).toBeUndefined();
    const failing = vi.fn(async () => new Response("", { status: 403 }));
    expect(
      (await withCruxField(ctx, {}, lighthouse, "k", failing)).field,
    ).toEqual([]);
  });
});
