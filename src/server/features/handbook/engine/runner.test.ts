import { describe, expect, it } from "vitest";
import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import { REGISTRY } from "@/server/features/handbook/registry";
import type { Judge } from "@/server/features/handbook/contracts/llm";
import { LlmBudgetError } from "../llm/judge";
import { createMemoryEvidenceStore } from "./memory-evidence-store";
import { buildReportJson } from "./report";
import { runHandbook } from "./runner";
import type { CollectedData } from "@/server/features/handbook/contracts/collectors";
import { snapshot } from "@/server/features/handbook/checks/check-test-fixtures";

// A T1+ item with no gate, so it is applicable on any site (not a process
// item the runner decides itself).
const item = REGISTRY.find(
  (e) =>
    e.tags.tier === "T1+" &&
    !e.tags.gate &&
    !e.tags.audit &&
    !e.tags.review &&
    e.phase !== "P0",
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

async function run(
  checks: HandbookCheck[],
  itemId = item!.id,
  judge: Judge | null = null,
) {
  const result = await runHandbook(
    {
      runId: "r1",
      origin: "https://example.com",
      mode: "AUDIT",
      registry: REGISTRY,
      collectors: [pagesOk],
      checks,
      maxPages: 10,
      judge,
    },
    {
      projectId: "p1",
      fetch: async () => {
        throw new Error("no network in tests");
      },
      fetchOffsite: async () => {
        throw new Error("no network in tests");
      },
      store: createMemoryEvidenceStore(),
      log: () => {},
    },
  );
  return result.statuses.find((s) => s.itemId === itemId);
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

const llmCheck = (itemId: string): HandbookCheck => ({
  id: `llm.${itemId}`,
  itemIds: [itemId],
  class: "LLM",
  requires: ["pages"],
  run: async (ctx) => {
    await ctx.judge?.({ itemId, rubricId: "r", pages: [] });
    throw new Error("judge expected to throw");
  },
});

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

  it("caps the off-site fetches one check can make", async () => {
    const errors: string[] = [];
    await run([
      {
        ...check({ statuses: [], findings: [], evidence: [] }),
        run: async (ctx) => {
          for (let i = 0; i < 11; i++)
            await ctx
              .fetchOffsite?.("https://source.test/")
              .catch((e: unknown) => errors.push(String(e)));
          return { statuses: [], findings: [], evidence: [] };
        },
      },
    ]);
    expect(errors.filter((e) => e.includes("limit (10)"))).toHaveLength(1);
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

  it("opens P1-04 when a checker-only finding cites a URL never fetched directly", async () => {
    const status = await run(
      [
        check({
          statuses: [],
          findings: [{ ...finding, evidenceRefs: ["a1"] }],
          evidence: [
            { ref: "a1", kind: "axe", url: finding.urls[0], excerpt: "x" },
          ],
        }),
      ],
      "P1-04",
    );
    expect(status?.status).toBe("OPEN");
    expect(status?.note).toContain(finding.urls[0]);
  });

  it("blocks LLM items without a judge, and every later LLM item once the budget is spent", async () => {
    const checks = [llmCheck("P5-01"), llmCheck("P5-04")];
    expect(await run(checks, "P5-04")).toMatchObject({
      status: "BLOCKED",
      note: "no llm key",
    });
    let calls = 0;
    const judge: Judge = async () => {
      calls += 1;
      throw new LlmBudgetError(1, 1);
    };
    expect(await run(checks, "P5-04", judge)).toMatchObject({
      status: "BLOCKED",
      note: "llm budget",
    });
    expect(calls).toBe(1);
  });

  it("opens P1-03 when an OPEN item has no finding", async () => {
    const evidence = [
      {
        ref: "e1",
        kind: "url" as const,
        url: "https://example.com/",
        excerpt: "x",
      },
    ];
    const status = await run(
      [
        check({
          statuses: [{ itemId: item.id, status: "OPEN", evidenceRefs: ["e1"] }],
          findings: [],
          evidence,
        }),
      ],
      "P1-03",
    );
    expect(status).toMatchObject({ status: "OPEN" });
    expect(status?.note).toContain(item.id);
  });

  it("passes RV-02 once the review report renders every section", async () => {
    const runtime = {
      projectId: "p1",
      fetch: async () => {
        throw new Error("no network in tests");
      },
      fetchOffsite: async () => {
        throw new Error("no network in tests");
      },
      store: createMemoryEvidenceStore(),
      log: () => {},
    };
    const result = await runHandbook(
      {
        runId: "r1",
        origin: "https://example.com",
        mode: "REVIEW",
        registry: REGISTRY,
        collectors: [pagesOk],
        checks: [],
        maxPages: 10,
      },
      runtime,
    );
    const report = buildReportJson({
      result,
      registry: REGISTRY,
      handbookVersion: "4.6",
      runId: "r1",
      origin: "https://example.com",
      mode: "REVIEW",
      startedAt: "2026-11-14T00:00:00.000Z",
      finishedAt: null,
    });
    expect(report.items.find((i) => i.itemId === "RV-02")).toMatchObject({
      status: "PASS",
    });
  });
});

const renderedPage = (url: string, renderOnlyLinks: string[]) => ({
  url,
  js: {
    finalUrl: url,
    status: 200,
    renderedKey: "k",
    words: 1,
    requests: [],
    renderOnlyLinks,
    opacityZeroWords: 0,
    firstScreenActions: [],
  },
  noJs: { status: 200, nojsKey: "k", words: 1 },
  firstScreenKey: null,
  consoleErrors: [],
});

describe("render-discovered second pass", () => {
  it("crawls and renders JS-only links after the render stage", async () => {
    const origin = "https://example.com";
    const pages = {
      key: "pages" as const,
      dependsOn: [],
      collect: async () => ({
        status: "ok" as const,
        snapshots: [snapshot("/")],
      }),
    };
    const render = {
      key: "render" as const,
      dependsOn: [],
      collect: async (_ctx: unknown, collected: Partial<CollectedData>) => ({
        status: "ok" as const,
        pages:
          collected.pages?.status === "ok"
            ? collected.pages.snapshots.map((s) =>
                renderedPage(
                  s.url,
                  s.url === `${origin}/` ? [`${origin}/js`] : [],
                ),
              )
            : [],
      }),
    };
    const result = await runHandbook(
      {
        runId: "r1",
        origin,
        mode: "AUDIT",
        registry: REGISTRY,
        collectors: [pages, render],
        checks: [],
        maxPages: 10,
      },
      {
        projectId: "p1",
        fetch: async (url) => ({
          url,
          finalUrl: url,
          status: 200,
          headers: [["content-type", "text/html"]],
          body: "<html><body><p>js page</p></body></html>",
          truncated: false,
          redirectChain: [],
          timingMs: 1,
        }),
        fetchOffsite: async () => {
          throw new Error("no network in tests");
        },
        store: createMemoryEvidenceStore(),
        log: () => {},
      },
    );
    const { pages: crawled, render: rendered } = result.collected;
    expect(
      crawled.status === "ok" &&
        crawled.snapshots.map((s) => [s.url, s.discoveredBy ?? null]),
    ).toEqual([
      [`${origin}/`, null],
      [`${origin}/js`, "render"],
    ]);
    expect(
      rendered.status === "ok" && rendered.pages.map((p) => p.url),
    ).toEqual([`${origin}/`, `${origin}/js`]);
  });
});
