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

/** Outcome metric row; values are strings, null = not connected. */
const metric = (
  over: Partial<{ itemId: string; url: string; metric: string }> & {
    before: string | null;
    after: string | null;
  },
) => ({
  itemId: "P3-01",
  url: "https://example.com/a",
  metric: "handbook_status",
  source: "test",
  beforeValue: over.before,
  afterValue: over.after,
  ...over,
});
const check = (completedAt: string, offsetWeeks: number) => ({
  offsetWeeks,
  dueAt: completedAt,
  status: "done",
  completedAt,
  metrics: [
    metric({ before: "OPEN", after: "PASS" }),
    // Two finding classes on one URL: clicks count once.
    metric({ metric: "gsc_clicks_28d", before: "10", after: "25" }),
    metric({
      itemId: "P3-02",
      metric: "gsc_clicks_28d",
      before: "10",
      after: "25",
    }),
    metric({ metric: "bing_clicks_28d", before: null, after: null }),
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

  it("applies the agency brand within the cap, a 50 KB logo included", () => {
    const findings = Array.from({ length: 600 }, (_, i) => ({
      ...finding("x".repeat(1_800)),
      code: `F${i}`,
    }));
    const logo = `data:image/png;base64,${Buffer.alloc(50_000).toString("base64")}`;
    const html = renderClientReportHtml(report({ findings }), [], {
      brand: {
        agencyName: "Acme <SEO>",
        accentColor: "#0a7f5a",
        contactLine: "hello@acme.test",
        footerText: null,
        hideOpenseoCredit: true,
        logoDataUri: logo,
      },
    });
    expect(html).toContain("Acme &lt;SEO&gt;");
    expect(html).toContain("h1,h2{color:#0a7f5a}");
    expect(html).toContain(`<img src="${logo}"`);
    expect(html).not.toContain("Prepared with OpenSEO");
    expect(new TextEncoder().encode(html).length).toBeLessThanOrEqual(500_000);
  });
  it("shows completed outcome checks up to the report date, never estimates", () => {
    const html = renderClientReportHtml(report(), [], {
      outcomes: [
        {
          batchId: "b1",
          baselineRunId: "r0",
          fixedAt: "2026-09-01T00:00:00.000Z",
          checks: [
            check("2026-10-01T00:00:00.000Z", 4),
            check("2026-12-01T00:00:00.000Z", 12),
          ],
        },
      ],
    });
    expect(html).toContain("Results since last report");
    expect(html).toContain("checked 4 weeks later");
    expect(html).not.toContain("checked 12 weeks later");
    expect(html).toContain("<td>0 of 1</td><td>1 of 1</td>");
    expect(html).toContain("<td>10</td><td>25</td>");
    expect(html).toContain("<td>not connected</td><td>not connected</td>");
  });
});
