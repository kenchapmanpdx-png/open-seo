import { describe, expect, it } from "vitest";
import type { AxeData } from "@/server/features/handbook/contracts/collectors";
import { context, ORIGIN, statusOf } from "./check-test-fixtures";
import { axeRulesCheck } from "./axe-rules";

const ITEMS = ["P8-03", "P8-02", "P8-06"];

const run = (violations: AxeData["pages"][number]["violations"]) =>
  axeRulesCheck.run(
    context({
      axe: { status: "ok", pages: [{ url: `${ORIGIN}/`, violations }] },
    }),
  );

describe("axeRulesCheck", () => {
  it("flags color-contrast violations", async () => {
    const result = await run([
      {
        id: "color-contrast",
        impact: "serious",
        help: "Elements must meet minimum color contrast ratio thresholds",
        nodes: 3,
        sampleTargets: ["main > p"],
      },
    ]);
    expect(statusOf(result, "P8-02")).toBe("OPEN");
  });

  it("passes a page without violations", async () => {
    const result = await run([]);
    expect(ITEMS.map((id) => statusOf(result, id))).toEqual([
      "PASS",
      "PASS",
      "PASS",
    ]);
  });
});
