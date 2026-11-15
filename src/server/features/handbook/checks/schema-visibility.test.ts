import { describe, expect, it } from "vitest";
import type { JsonLdNode } from "@/server/features/handbook/contracts/collectors";
import { context, ORIGIN, snapshot, statusOf } from "./check-test-fixtures";
import { schemaVisibilityCheck } from "./schema-visibility";

const TEXT = "Do you ship? Yes, worldwide. Widget costs $25.";

function run(pages: Record<string, JsonLdNode[]>) {
  const snapshots = Object.keys(pages).map((path) => {
    const s = snapshot(path);
    return { ...s, markup: { ...s.markup, text: TEXT } };
  });
  return schemaVisibilityCheck.run(
    context({
      pages: { status: "ok", snapshots },
      jsonld: {
        status: "ok",
        pages: Object.entries(pages).map(([path, nodes]) => ({
          url: `${ORIGIN}${path}`,
          blocks: [],
          nodes,
        })),
      },
    }),
  );
}

const faq = (answer: string): JsonLdNode => ({
  id: null,
  types: ["FAQPage"],
  properties: {
    mainEntity: [
      {
        "@type": "Question",
        name: "Do you ship?",
        acceptedAnswer: { "@type": "Answer", text: answer },
      },
    ],
  },
});

const product = (price: string): JsonLdNode => ({
  id: null,
  types: ["Product"],
  properties: {
    name: "Widget",
    hasMerchantReturnPolicy: { "@type": "MerchantReturnPolicy" },
    offers: { price, priceCurrency: "USD", availability: "InStock" },
  },
});

describe("schema.visibility", () => {
  it("opens P6-07 when the marked-up answer is not visible", async () => {
    expect(
      statusOf(await run({ "/a": [faq("Yes, worldwide.")] }), "P6-07"),
    ).toBe("PASS");
    expect(statusOf(await run({ "/a": [faq("Only to Mars.")] }), "P6-07")).toBe(
      "OPEN",
    );
  });

  it("opens P6-07 when the same FAQ set is on two pages", async () => {
    const result = await run({
      "/a": [faq("Yes, worldwide.")],
      "/b": [faq("Yes, worldwide.")],
    });
    expect(statusOf(result, "P6-07")).toBe("OPEN");
  });

  it("opens P6-13 when the product price is not in the text", async () => {
    expect(statusOf(await run({ "/p": [product("25")] }), "P6-13")).toBe(
      "PASS",
    );
    expect(statusOf(await run({ "/p": [product("30")] }), "P6-13")).toBe(
      "OPEN",
    );
  });
});
