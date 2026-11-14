import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseSection41 } from "./handbook-parse";
import { HANDBOOK_VERSION, REGISTRY } from "./registry";

const HANDBOOK = `fork/handbook/on-site-seo-geo-reference-unified-v${HANDBOOK_VERSION}.md`;

describe("handbook registry", () => {
  it("matches the handbook §41 checklist item for item", () => {
    const parsed = parseSection41(readFileSync(HANDBOOK, "utf8"));
    expect(parsed).toHaveLength(129);
    expect(
      REGISTRY.map(({ id, phase, text, refs, tags }) => ({
        id,
        phase,
        text,
        refs,
        tags,
      })),
    ).toEqual(parsed);
  });

  it("has unique ids", () => {
    expect(new Set(REGISTRY.map((e) => e.id)).size).toBe(REGISTRY.length);
  });
});
