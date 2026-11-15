import { describe, expect, it } from "vitest";
import { context, ORIGIN, statusOf } from "./check-test-fixtures";
import { schemaBasicsCheck } from "./schema-basics";

function run(block: Record<string, unknown>) {
  const raw = JSON.stringify({ "@context": "https://schema.org", ...block });
  return schemaBasicsCheck.run(
    context({
      jsonld: {
        status: "ok",
        pages: [
          {
            url: `${ORIGIN}/`,
            blocks: [{ index: 0, raw, parseError: null }],
            nodes: [
              {
                id: null,
                types: [String(block["@type"])],
                properties: block,
              },
            ],
          },
        ],
      },
    }),
  );
}

const site = {
  "@type": "WebSite",
  name: "Example",
  url: `${ORIGIN}/`,
  alternateName: "Ex",
};

describe("schema.basics", () => {
  it("opens P6-02 on a relative url", async () => {
    expect(statusOf(await run({ ...site, url: "/x" }), "P6-02")).toBe("OPEN");
  });

  it("opens P6-02 on an empty description", async () => {
    expect(statusOf(await run({ ...site, description: "" }), "P6-02")).toBe(
      "OPEN",
    );
  });

  it("opens P6-01 when the WebSite node lacks alternateName", async () => {
    const result = await run({ ...site, alternateName: undefined });
    expect(statusOf(result, "P6-01")).toBe("OPEN");
    expect(statusOf(await run(site), "P6-01")).toBe("PASS");
  });
});
