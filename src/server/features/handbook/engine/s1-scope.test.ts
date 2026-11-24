import { describe, expect, it } from "vitest";
import type { FindingDraft } from "@/server/features/handbook/contracts/check";
import type { RobotsHost } from "@/server/features/handbook/contracts/collectors";
import { REGISTRY } from "../registry";
import { SUPP_REGISTRY } from "../registry-supp";
import { context, ORIGIN, snapshot } from "../checks/check-test-fixtures";
import { ACCESS_S1, PAGE_SCOPED_S1, scopeS1ToIndexable } from "./s1-scope";
import { contractViolation } from "./contract-violation";

const robots: RobotsHost = {
  host: "example.com",
  status: 200,
  storageKey: null,
  groups: [{ userAgents: ["*"], rules: [{ type: "disallow", path: "/cart" }] }],
  sitemaps: [],
  parseWarnings: [],
};

const collected = context({
  pages: {
    status: "ok",
    snapshots: [
      snapshot("/"),
      snapshot("/cart"),
      snapshot("/private", { robotsMeta: "noindex" }),
    ],
  },
  robots: { status: "ok", hosts: [robots], decisions: [] },
}).collected;

const finding = (itemId: string, paths: string[]): FindingDraft => ({
  itemIds: [itemId],
  severity: "S1",
  title: "t",
  detail: "d",
  fix: "f",
  fixability: "FIXABLE",
  effort: "S",
  urls: paths.map((p) => new URL(p, ORIGIN).href),
  source: "deterministic",
  evidenceRefs: ["e1"],
});

const scopedAll = (f: FindingDraft) =>
  scopeS1ToIndexable(
    [
      {
        checkId: "c",
        checkClass: "RENDER",
        result: { statuses: [], findings: [f], evidence: [] },
      },
    ],
    collected,
  )[0]?.result.findings ?? [];
const scoped = (f: FindingDraft) => scopedAll(f)[0];

describe("scopeS1ToIndexable (ADR-034)", () => {
  it("keeps S1 when an affected page is indexable", () => {
    expect(scoped(finding("P3-20", ["/"]))?.severity).toBe("S1");
  });

  it("drops to S3 with the reason when every page is Disallowed or noindex", () => {
    const f = scoped(finding("P3-20", ["/cart", "/private"]));
    expect(f?.severity).toBe("S3");
    expect(f?.severityReason).toMatch(
      /cannot index .*\/cart \(robots\.txt disallow: \/cart.*\/private \(noindex\)/,
    );
  });

  it("splits a mixed finding: S1 on the indexable pages, S3 on the rest", () => {
    const [s1, s3] = scopedAll(finding("P2-01", ["/", "/cart"]));
    expect([s1?.severity, s1?.urls]).toEqual(["S1", [`${ORIGIN}/`]]);
    expect([s3?.severity, s3?.urls]).toEqual(["S3", [`${ORIGIN}/cart`]]);
  });

  it("leaves access items S1 (noindex on content is the defect)", () => {
    expect(scoped(finding("P3-01", ["/private"]))?.severity).toBe("S1");
  });

  it("classifies every S1-default item as page-scoped or access", () => {
    const s1 = [
      ...REGISTRY.filter((e) => e.severityDefault === "S1").map((e) => e.id),
      ...SUPP_REGISTRY.filter((e) => e.severityDefault === "S1").map(
        (e) => e.id,
      ),
    ];
    const unclassified = s1.filter(
      (id) => PAGE_SCOPED_S1.has(id) === ACCESS_S1.has(id),
    );
    expect(unclassified).toEqual([]);
  });

  // WO-B20-015 (d): an S1 needs its condition in the ADR-034 table.
  it("makes an S1 on an item outside the table a contract violation", () => {
    const raised = {
      ...finding("P4-01", ["/"]),
      severityReason: "raised",
    };
    const violation = contractViolation(
      {
        id: "c",
        itemIds: ["P4-01"],
        class: "CRAWL",
        requires: [],
        run: () => ({ statuses: [], findings: [], evidence: [] }),
      },
      {
        statuses: [],
        findings: [raised],
        evidence: [{ ref: "e1", kind: "url", url: ORIGIN, excerpt: "x" }],
      },
      new Map(REGISTRY.map((e) => [e.id, e])),
    );
    expect(violation).toContain("has no ADR-034 S1 entry");
  });
});
