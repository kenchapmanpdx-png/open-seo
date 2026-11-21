import { describe, expect, it } from "vitest";
import { REGISTRY } from "./registry";
import { SUPP_REGISTRY } from "./registry-supp";
import tags from "./registry-tags.json";

describe("registry-tags.json", () => {
  it("tags every registry and SUPP item with unique SEO / GEO / AEO values", () => {
    const ids = [...REGISTRY, ...SUPP_REGISTRY].map((e) => e.id);
    expect(new Set(Object.keys(tags))).toEqual(new Set(ids));
    for (const values of Object.values(tags)) {
      expect(values.every((v) => ["SEO", "GEO", "AEO"].includes(v))).toBe(true);
      expect(new Set(values).size).toBe(values.length);
    }
  });
});
