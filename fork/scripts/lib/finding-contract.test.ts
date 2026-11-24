import { describe, expect, it } from "vitest";
import { findingContractIssues } from "./finding-contract";

const O = "https://site.test";
const collected = {
  pages: { snapshots: [{ url: `${O}/` }, { url: `${O}/team` }] },
  robots: { hosts: [{ host: "site.test", status: 404 }] },
  linkTargets: { targets: [{ url: `${O}/old` }] },
};
const finding = (over: Partial<Record<string, unknown>>) => ({
  title: "Thin pages",
  detail: "",
  itemIds: ["P3-12"],
  urls: [`${O}/team`],
  ...over,
});

describe("findingContractIssues (WO-B20-015 e)", () => {
  it("passes findings that list pages the run read", () => {
    const report = {
      findings: [
        finding({}),
        finding({
          title: "Internal links point at redirected or retired URLs",
          urls: [`${O}/team`],
          detail: `${O}/old → 404`,
        }),
        finding({
          title: "No robots.txt (HTTP 404)",
          urls: [`${O}/robots.txt`],
        }),
      ],
    };
    expect(findingContractIssues(report, collected)).toEqual([]);
  });

  it("flags link targets in urls, a wrong page count, an unshown tag and an unstated status", () => {
    const report = {
      findings: [
        // salonvata B19 shape: the targets in urls instead of the linking pages
        finding({
          title: "Internal links point at redirected or retired URLs",
          urls: [`${O}/old`],
        }),
        finding({ title: "Thin pages (3 pages)" }),
        finding({ title: "Pages missing og:url, og:image", detail: "og:url" }),
        finding({
          title: "robots.txt has no Sitemap: line",
          urls: [`${O}/robots.txt`],
        }),
        finding({ urls: [`${O}/never-fetched`] }),
      ],
    };
    const issues = findingContractIssues(report, collected);
    expect(issues).toHaveLength(5);
    expect(issues.join("\n")).toMatch(
      /lists targets[\s\S]*says 3 pages[\s\S]*og:image[\s\S]*answered 404[\s\S]*never fetched/,
    );
  });
});
