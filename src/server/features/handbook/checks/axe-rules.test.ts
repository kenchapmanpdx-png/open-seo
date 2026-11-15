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

  it("labels each contrast hit with the template its URL samples", async () => {
    const url = `${ORIGIN}/events/ho-ho-5k`;
    const result = await axeRulesCheck.run(
      context({
        axe: {
          status: "ok",
          pages: [
            {
              url,
              violations: [
                {
                  id: "color-contrast",
                  impact: "serious",
                  help: "contrast",
                  nodes: 2,
                  sampleTargets: [".breadcrumb > a"],
                },
              ],
            },
          ],
        },
        templates: {
          status: "ok",
          templates: [
            {
              key: "events",
              urlPattern: "/events/*",
              skeletonHash: "h",
              urls: [url],
              samples: [],
            },
          ],
        },
      }),
    );
    expect(result.findings[0].detail).toContain(
      `${url} [template /events/*] — 2 nodes (serious): .breadcrumb > a`,
    );
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
