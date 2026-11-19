import { describe, expect, it } from "vitest";
import type { CollectorContext } from "@/server/features/handbook/contracts/collectors";
import { snapshot } from "@/server/features/handbook/checks/check-test-fixtures";
import { llmsCollector } from "./fetch-collectors";

const ORIGIN = "https://example.com";
const pages = Array.from({ length: 250 }, (_, i) => snapshot(`/p${i}`));

async function probed(withLlmsTxt: boolean) {
  const mdFetches: string[] = [];
  const ctx: CollectorContext = {
    runId: "r1",
    origin: ORIGIN,
    fetch: async (url) => {
      if (url.endsWith(".md")) mdFetches.push(url);
      const found = url.endsWith("/llms.txt") && withLlmsTxt;
      return {
        url,
        finalUrl: url,
        status: found ? 200 : 404,
        headers: [["content-type", "text/plain"]],
        body: found ? "# Example" : "",
        truncated: false,
        redirectChain: [],
        timingMs: 1,
      };
    },
    fetchOffsite: () => Promise.reject(new Error("unused")),
    storeBody: async (kind, url) => `${kind}:${url}`,
    log: () => {},
  };
  await llmsCollector.collect(ctx, {
    pages: { status: "ok", snapshots: pages },
  });
  return mdFetches.length;
}

describe("llms collector .md mirrors", () => {
  it("probes every page's mirror up to 200 once llms.txt exists, else the first 5", async () => {
    expect(await probed(true)).toBe(200);
    expect(await probed(false)).toBe(5);
  });
});
