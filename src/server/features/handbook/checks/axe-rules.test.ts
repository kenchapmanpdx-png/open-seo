import { describe, expect, it } from "vitest";
import type { AxeData } from "@/server/features/handbook/contracts/render-data";
import { context, ORIGIN, statusOf } from "./check-test-fixtures";
import { axeRulesCheck } from "./axe-rules";

const ITEMS = ["P8-03", "P8-02", "P8-06"];

const run = (violations: AxeData["pages"][number]["violations"]) =>
  axeRulesCheck.run(
    context({
      axe: { status: "ok", pages: [{ url: `${ORIGIN}/`, violations }] },
    }),
  );

const contrastExcerpt = (result: Awaited<ReturnType<typeof run>>) =>
  result.evidence.find((e) => e.excerpt.startsWith("color-contrast:"))?.excerpt;

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
    // No sampleTexts (sidecar < 1.3.0): selectors only.
    expect(contrastExcerpt(result)).toMatch(/\nmain > p$/);
  });

  it("quotes the node text of each contrast sample when the sidecar sends it", async () => {
    const result = await run([
      {
        id: "color-contrast",
        impact: "serious",
        help: "Elements must meet minimum color contrast ratio thresholds",
        nodes: 2,
        sampleTargets: ["main > p", ".badge"],
        sampleTexts: ["Book your table", ""],
      },
    ]);
    expect(contrastExcerpt(result)).toContain(
      'main > p — "Book your table"\n.badge',
    );
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

  it("merges one rule across pages into one finding grouped by template", async () => {
    const page = (path: string): AxeData["pages"][number] => ({
      url: `${ORIGIN}${path}`,
      violations: [
        {
          id: "label",
          impact: "critical",
          help: "Form elements must have labels",
          nodes: 1,
          sampleTargets: ["input"],
        },
      ],
    });
    const result = await axeRulesCheck.run(
      context({
        axe: {
          status: "ok",
          pages: [page("/a"), page("/b"), page("/c")],
        },
      }),
    );
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].urls).toHaveLength(3);
    expect(result.findings[0].detail).toMatch(
      /^Templates: \(no template\) \(3 pages\)/,
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
