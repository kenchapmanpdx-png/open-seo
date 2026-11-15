import { describe, expect, it } from "vitest";
import type { ReportJson } from "@/server/features/handbook/contracts/exports";
import { renderClientReportHtml } from "./client-report";

const report = (over: Partial<ReportJson> = {}): ReportJson => ({
  reportVersion: "1",
  contractsVersion: "1.2.0",
  handbookVersion: "4.6",
  generatedAt: "2026-11-15T00:00:00.000Z",
  site: { origin: "https://example.com", platform: null },
  run: {
    id: "r1",
    mode: "AUDIT",
    tier: "T2",
    tierEvidence: "12 pages",
    startedAt: "2026-11-15T00:00:00.000Z",
    finishedAt: null,
  },
  score: null,
  siteProfile: [],
  findings: [],
  items: [
    {
      itemId: "P3-01",
      phase: "P3",
      status: "PASS",
      note: null,
      findingCodes: [],
    },
    {
      itemId: "P3-02",
      phase: "P3",
      status: "PARTIAL",
      note: null,
      findingCodes: ["F01"],
    },
  ],
  release: { status: "CLEAR", blockingItemIds: [] },
  checkerErrors: [],
  outsideScope: [],
  ...over,
});

const finding = (detail: string): ReportJson["findings"][number] => ({
  code: "F01",
  severity: "S2",
  phase: "P4",
  sectionRef: "§2",
  title: "Bare titles",
  detail,
  fix: "Rewrite titles",
  fixability: "FIXABLE",
  limitedReason: null,
  effort: "S",
  source: "deterministic",
  itemIds: ["P3-02"],
  urls: ["https://example.com/a"],
  evidence: [
    { kind: "rawHtml", url: "https://example.com/a", excerpt: detail },
  ],
});

describe("renderClientReportHtml", () => {
  it("renders page text as escaped text, never markup", () => {
    const html = renderClientReportHtml(
      report({ findings: [finding('<script>alert("x")</script>')] }),
      [],
    );
    expect(html).not.toContain("<script");
    expect(html).toContain("&lt;script&gt;");
  });

  it("stays within 500 KB and ends with </html> on oversized input", () => {
    const big = "x".repeat(1_800);
    const findings = Array.from({ length: 600 }, (_, i) => ({
      ...finding(big),
      code: `F${i}`,
      urls: [`https://example.com/p${i}`],
    }));
    const screenshots = new Map(
      findings.map((f) => [
        f.urls[0],
        `data:image/png;base64,${"A".repeat(5_000)}`,
      ]),
    );
    const html = renderClientReportHtml(report({ findings }), [], {
      screenshots,
    });
    expect(new TextEncoder().encode(html).length).toBeLessThanOrEqual(500_000);
    expect(html.trimEnd().endsWith("</html>")).toBe(true);
  });
});
