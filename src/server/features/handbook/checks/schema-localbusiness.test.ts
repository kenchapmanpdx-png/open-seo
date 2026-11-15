import { describe, expect, it } from "vitest";
import type { JsonLdNode } from "@/server/features/handbook/contracts/collectors";
import { context, ORIGIN, statusOf } from "./check-test-fixtures";
import { schemaLocalBusinessCheck } from "./schema-localbusiness";

const salon = (street: string, extra: Record<string, unknown> = {}) => ({
  id: `${ORIGIN}/#${street}`,
  types: ["HairSalon"],
  properties: {
    name: "Shear Joy",
    address: { streetAddress: street, addressLocality: "Portland" },
    ...extra,
  },
});

function run(nodes: JsonLdNode[]) {
  return schemaLocalBusinessCheck.run(
    context({
      jsonld: {
        status: "ok",
        pages: [{ url: `${ORIGIN}/`, blocks: [], nodes }],
      },
    }),
  );
}

describe("schema.local-business", () => {
  it("passes a HairSalon with an address", async () => {
    const result = await run([salon("1 Main St")]);
    expect(statusOf(result, "P6-11")).toBe("PASS");
    expect(statusOf(result, "P6-10")).toBe("PASS");
  });

  it("opens P6-11 on a self-serving AggregateRating", async () => {
    const result = await run([
      salon("1 Main St", { aggregateRating: { ratingValue: 5 } }),
    ]);
    expect(statusOf(result, "P6-11")).toBe("OPEN");
  });

  it("opens P6-10 when two locations lack parentOrganization", async () => {
    const result = await run([salon("1 Main St"), salon("9 Oak Ave")]);
    expect(statusOf(result, "P6-10")).toBe("OPEN");
  });
});
