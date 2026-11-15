import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryEvidenceStore } from "@/server/features/handbook/engine/memory-evidence-store";
import { runByokTracker, runDueByokSchedules } from "./byokRunService";
import type { ByokRunInput, ByokRunResult } from "./types";

const { testDb, fakeRun } = await vi.hoisted(async () => {
  const { createAiVisibilityTestDb } =
    await import("@/server/features/ai-visibility/aiVisibilityTestDb");
  return {
    testDb: await createAiVisibilityTestDb(),
    fakeRun: vi.fn<(input: ByokRunInput) => Promise<ByokRunResult>>(),
  };
});
vi.mock("cloudflare:workers", () => ({ env: { DATABASE_PROVIDER: "d1" } }));
vi.mock("@/db", () => ({ db: testDb.db }));
vi.mock("@/db/runBatch", () => ({ runBatch: testDb.runBatch }));
vi.mock("@/server/lib/runtime-env", () => ({
  getOptionalEnvValue: (name: string) =>
    Promise.resolve(name === "BYOK_RUN_BUDGET_USD" ? "2" : undefined),
}));
vi.mock("@/server/features/handbook/secrets/CredentialRepository", () => ({
  getByokKey: () => Promise.resolve({ key: "sk-test", source: "org" }),
}));
vi.mock("./index", () => ({
  byokProviders: { openai: { id: "openai", run: fakeRun } },
}));

const ONE_DOLLAR = 1_000_000;

function result(over: Partial<ByokRunResult["answer"]> = {}): ByokRunResult {
  return {
    answer: {
      provider: "openai",
      model: "gpt-test",
      modelVersion: null,
      answerMarkdown: "OpenSEO is good",
      answerText: "OpenSEO is good",
      citations: [],
      webQueries: [],
      usage: { inputTokens: 1, outputTokens: 1, searchCalls: 1 },
      ...over,
    },
    rawOutput: {},
    costUsdMicros: ONE_DOLLAR,
  };
}

async function seed(prompts: string[]) {
  await testDb.seedProject();
  await testDb.client.executeMultiple(`
    INSERT INTO ai_trackers (id, project_id, created_at) VALUES ('tracker', 'project', '2026-01-01');
    INSERT INTO byok_ai_tracker_provider (tracker_id, provider, model) VALUES ('tracker', 'openai', 'gpt-test');
    ${prompts
      .map(
        (text, i) =>
          `INSERT INTO ai_prompts (id, tracker_id, topic, text, created_at) VALUES ('p${i}', 'tracker', 't', '${text}', '2026-01-0${i + 1}');`,
      )
      .join("\n")}
  `);
}

const rows = async (sql: string) => (await testDb.client.execute(sql)).rows;

beforeEach(() => {
  fakeRun.mockResolvedValue(result());
});

describe("runByokTracker", () => {
  it("stops calling once committed + in-flight spend reaches the budget", async () => {
    await seed(["a", "b", "c", "d"]);
    const summary = await runByokTracker({
      trackerId: "tracker",
      organizationId: "organization",
      store: createMemoryEvidenceStore(),
    });

    expect(fakeRun).toHaveBeenCalledTimes(2);
    expect(summary).toMatchObject({
      status: "completed",
      completed: 2,
      failed: 2,
      costUsdMicros: 2 * ONE_DOLLAR,
    });
    expect(
      await rows("SELECT status, error FROM byok_ai_answer ORDER BY prompt_id"),
    ).toMatchObject([
      { status: "completed", error: null },
      { status: "completed", error: null },
      { status: "failed", error: "budget" },
      { status: "failed", error: "budget" },
    ]);
  });

  it("stores fan-out rows, categorized sources and brand matches", async () => {
    await seed(["Best SEO tools"]);
    fakeRun.mockResolvedValue(
      result({
        webQueries: ["  best seo tools ", "openseo pricing", " "],
        citations: [
          {
            url: "https://openseo.so/pricing",
            domain: "openseo.so",
            title: null,
            position: 0,
          },
        ],
      }),
    );
    await runByokTracker({
      trackerId: "tracker",
      organizationId: "organization",
      store: createMemoryEvidenceStore(),
    });

    expect(
      await rows(
        "SELECT normalized, is_fanout FROM ai_web_query ORDER BY position",
      ),
    ).toMatchObject([
      { normalized: "best seo tools", is_fanout: 0 },
      { normalized: "openseo pricing", is_fanout: 1 },
      { normalized: "", is_fanout: 0 },
    ]);
    expect(await rows("SELECT category FROM byok_ai_source")).toMatchObject([
      { category: "brand" },
    ]);
    expect(
      await rows("SELECT own, mentioned, cited FROM byok_ai_match"),
    ).toMatchObject([{ own: 1, mentioned: 1, cited: 1 }]);
  });

  it("refuses a tracker from another organization", async () => {
    await seed(["a"]);
    expect(
      await runByokTracker({ trackerId: "tracker", organizationId: "other" }),
    ).toBeNull();
    expect(fakeRun).not.toHaveBeenCalled();
  });
});

describe("runDueByokSchedules", () => {
  it("advances a due schedule once, so an overlapping tick does not start it again", async () => {
    await seed(["a"]);
    await testDb.client.execute(
      "INSERT INTO byok_ai_schedule (tracker_id, interval_days, next_run_at) VALUES ('tracker', 7, '2026-11-01T00:00:00.000Z')",
    );
    const now = new Date("2026-11-14T00:00:00.000Z");

    expect(await runDueByokSchedules(now)).toEqual({ started: 1 });
    expect(await runDueByokSchedules(now)).toEqual({ started: 0 });
    expect(await rows("SELECT next_run_at FROM byok_ai_schedule")).toEqual([
      expect.objectContaining({ next_run_at: "2026-11-21T00:00:00.000Z" }),
    ]);
  });
});
