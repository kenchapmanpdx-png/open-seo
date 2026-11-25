import { describe, expect, it } from "vitest";
import { HANDBOOK_EFFECTS } from "./contracts/exports";
import { REGISTRY } from "./registry";
import { SUPP_REGISTRY } from "./registry-supp";
import effects from "./registry-effect.json";

describe("registry-effect.json (WO-B22-001)", () => {
  it("names a search or AI effect for every registry and SUPP item", () => {
    const entries = [...REGISTRY, ...SUPP_REGISTRY];
    const byId: Record<string, { effect: string; reason: string }> = effects;
    expect(new Set(Object.keys(byId))).toEqual(
      new Set(entries.map((e) => e.id)),
    );
    for (const entry of entries) {
      const { effect, reason } = byId[entry.id];
      expect(HANDBOOK_EFFECTS).toContain(effect);
      expect(reason.trim()).not.toBe("");
      // A stated effect must rest on the item's handbook sections.
      if (effect !== "hygiene") expect(entry.refs.length).toBeGreaterThan(0);
    }
  });
});
