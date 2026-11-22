import { describe, expect, it } from "vitest";
import type { JsonLdNode } from "@/server/features/handbook/contracts/collectors";
import { context, ORIGIN } from "./check-test-fixtures";
import { entityNodesCheck } from "./entity-nodes";

const node = (
  type: string,
  name: string,
  id: string | null = null,
  properties: Record<string, unknown> = {},
): JsonLdNode => ({ id, types: [type], properties: { name, ...properties } });

const run = (nodes: JsonLdNode[]) =>
  entityNodesCheck.run(
    context({
      jsonld: {
        status: "ok",
        pages: [
          { url: `${ORIGIN}/`, blocks: [], nodes },
          { url: `${ORIGIN}/about/`, blocks: [], nodes },
        ],
      },
    }),
  );

describe("schema.entity-nodes", () => {
  it("reports two business nodes and two WebSite nodes with differing names as one finding", async () => {
    const result = await run([
      node("BeautySalon", "Vata Salon + Spa", "#salon"),
      node("LocalBusiness", "Vata Salon"),
      node("WebSite", "Vata Salon", "#website"),
      node("WebSite", "Vata Hair Salon & Spa", "#site2"),
    ]);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].urls).toEqual([`${ORIGIN}/`, `${ORIGIN}/about/`]);
    expect(result.findings[0].detail).toMatch(
      /^2 page\(s\).*2 business nodes, 2 WebSite nodes, business names differ, WebSite names differ/,
    );
  });

  it("does not count a distinct organization referenced as brand", async () => {
    const result = await run([
      node("HairSalon", "Vata", "#salon", { brand: { "@id": "#aveda" } }),
      node("Organization", "Aveda", "#aveda"),
      node("WebSite", "Vata", "#website"),
    ]);
    expect(result.findings).toEqual([]);
  });
});
