import { describe, expect, it } from "vitest";
import type { JsonLdNode } from "@/server/features/handbook/contracts/collectors";
import { context, ORIGIN, snapshot, statusOf } from "./check-test-fixtures";
import { jsonLdIntegrityCheck } from "./jsonld-integrity";

const org = (id: string | null, name = "Acme"): JsonLdNode => ({
  id,
  types: ["Organization"],
  properties: { name },
});

function run(pages: { path: string; raw?: string; nodes?: JsonLdNode[] }[]) {
  return jsonLdIntegrityCheck.run(
    context({
      pages: { status: "ok", snapshots: pages.map((p) => snapshot(p.path)) },
      jsonld: {
        status: "ok",
        pages: pages.map((p) => {
          const raw = p.raw ?? "{}";
          let parseError: string | null = null;
          try {
            JSON.parse(raw);
          } catch (error) {
            parseError = String(error);
          }
          return {
            url: new URL(p.path, ORIGIN).href,
            blocks: [{ index: 0, raw, parseError }],
            nodes: p.nodes ?? [org("https://example.com/#org")],
          };
        }),
      },
    }),
  );
}

describe("schema.jsonld-integrity", () => {
  it("opens P6-08 for a block that does not parse", async () => {
    const result = await run([{ path: "/", raw: '{"a": 1,}' }]);
    expect(statusOf(result, "P6-08")).toBe("OPEN");
  });

  it("matches §24 sentinels as typed whole values only", async () => {
    const hit = await run([
      {
        path: "/",
        raw: JSON.stringify({
          address: { streetAddress: "123 Main St" },
          aggregateRating: { ratingValue: 4.7, reviewCount: 1284 },
        }),
      },
    ]);
    expect(hit.findings[0]?.detail).toContain('streetAddress = "123 Main St"');
    expect(hit.findings[0]?.detail).toContain("ratingValue 4.7 + count 1284");

    const clean = await run([
      {
        path: "/",
        raw: JSON.stringify({
          address: { streetAddress: "1234 Main St" },
          aggregateRating: { ratingValue: 4.7, reviewCount: 12 },
        }),
      },
    ]);
    expect(statusOf(clean, "P6-15")).toBe("PASS");
  });

  it("cites only the page whose organization @id departs from the sitewide one", async () => {
    const result = await run([
      { path: "/" },
      { path: "/about" },
      { path: "/contact", nodes: [org("https://example.com/#organization")] },
    ]);
    expect(statusOf(result, "P6-03")).toBe("OPEN");
    expect(result.findings[0]?.urls).toEqual([`${ORIGIN}/contact`]);
  });
});
