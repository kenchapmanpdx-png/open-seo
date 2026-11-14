import { describe, expect, it } from "vitest";
import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import { REGISTRY } from "@/server/features/handbook/registry";
import { createMemoryEvidenceStore } from "./memory-evidence-store";
import { runHandbook } from "./runner";

// A T1+ item with no gate, so it is applicable on any site.
const item = REGISTRY.find(
  (e) =>
    e.tags.tier === "T1+" && !e.tags.gate && !e.tags.audit && !e.tags.review,
);
if (!item) throw new Error("fixture item missing");

const pagesOk = {
  key: "pages" as const,
  dependsOn: [],
  collect: async () => ({ status: "ok" as const, snapshots: [] }),
};

function check(
  result: Awaited<ReturnType<HandbookCheck["run"]>>,
): HandbookCheck {
  return {
    id: "test.check",
    itemIds: [item!.id],
    class: item!.class,
    requires: ["pages"],
    run: () => result,
  };
}

async function run(checks: HandbookCheck[]) {
  const result = await runHandbook(
    {
      runId: "r1",
      origin: "https://example.com",
      mode: "AUDIT",
      registry: REGISTRY,
      collectors: [pagesOk],
      checks,
      maxPages: 10,
    },
    {
      projectId: "p1",
      fetch: async () => {
        throw new Error("no network in tests");
      },
      store: createMemoryEvidenceStore(),
      log: () => {},
    },
  );
  return result.statuses.find((s) => s.itemId === item!.id);
}

const finding = {
  itemIds: [item.id],
  severity: item.severityDefault,
  title: "t",
  detail: "d",
  fix: "f",
  fixability: "FIXABLE" as const,
  effort: "S" as const,
  urls: ["https://example.com/"],
  source: "deterministic" as const,
};

describe("runHandbook invariants", () => {
  it("blocks an item whose finding cites no stored evidence", async () => {
    const status = await run([
      check({
        statuses: [],
        findings: [{ ...finding, evidenceRefs: ["missing"] }],
        evidence: [],
      }),
    ]);
    expect(status).toMatchObject({ status: "BLOCKED" });
    expect(status?.note).toContain("without evidence");
  });

  it("keeps an evidenced OPEN verdict and blocks when a required collector is unavailable", async () => {
    const evidence = [
      {
        ref: "e1",
        kind: "url" as const,
        url: "https://example.com/",
        excerpt: "x",
      },
    ];
    const open = await run([
      check({
        statuses: [{ itemId: item.id, status: "OPEN", evidenceRefs: ["e1"] }],
        findings: [],
        evidence,
      }),
    ]);
    expect(open).toMatchObject({ status: "OPEN", score: 0 });

    const blocked = await run([
      {
        ...check({ statuses: [], findings: [], evidence }),
        requires: ["render"],
      },
    ]);
    expect(blocked?.status).toBe("BLOCKED");
    expect(blocked?.note).toContain("render unavailable");
  });
});
