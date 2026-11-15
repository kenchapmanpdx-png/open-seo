import { describe, expect, it, vi } from "vitest";
import { OverviewService } from "./overviewService";

const { testDb } = await vi.hoisted(async () => {
  const { createAiVisibilityTestDb } =
    await import("@/server/features/ai-visibility/aiVisibilityTestDb");
  return { testDb: await createAiVisibilityTestDb() };
});
vi.mock("cloudflare:workers", () => ({ env: { DATABASE_PROVIDER: "d1" } }));
vi.mock("@/db", () => ({ db: testDb.db }));

const scope = { projectId: "project", organizationId: "organization" };

describe("OverviewService", () => {
  it("projects scheduled BYOK spend to a month and counts each answer once", async () => {
    await testDb.seedProject();
    await testDb.client.executeMultiple(`
      INSERT INTO ai_trackers (id, project_id, created_at) VALUES ('tracker', 'project', '2026-01-01');
      INSERT INTO ai_prompts (id, tracker_id, topic, text, created_at) VALUES ('p1', 'tracker', 't', 'q', '2026-01-01');
      INSERT INTO byok_ai_schedule (tracker_id, interval_days, next_run_at) VALUES ('tracker', 10, '2026-12-01');
      INSERT INTO byok_ai_run (id, project_id, organization_id, tracker_id, status, cost_usd_micros, started_at, finished_at)
        VALUES ('old', 'project', 'organization', 'tracker', 'completed', 9000000, '2026-09-01', '2026-09-01'),
               ('r1', 'project', 'organization', 'tracker', 'completed', 1000000, '2026-11-01', '2026-11-01'),
               ('r2', 'project', 'organization', 'tracker', 'completed', 3000000, '2026-11-10', '2026-11-10');
      INSERT INTO byok_ai_answer (id, run_id, prompt_id, provider, model, web_search, status)
        VALUES ('a1', 'r2', 'p1', 'openai', 'm', 1, 'completed'),
               ('a2', 'r2', 'p1', 'anthropic', 'm', 1, 'completed');
      INSERT INTO byok_ai_match (id, answer_id, name, domain, own, mentioned, cited)
        VALUES ('m1', 'a1', 'OpenSEO', 'openseo.so', 1, 1, 0),
               ('m2', 'a1', 'OpenSEO', 'www.openseo.so', 1, 1, 0);
    `);

    const overview = await OverviewService.get(
      scope,
      new Date("2026-11-14T00:00:00.000Z"),
    );

    // 30-day window: r1 + r2 = $4 over 2 runs → $2/run × 3 runs a month.
    expect(overview.cost.last30Days.byokUsd).toBe(4);
    expect(overview.cost.estimateUsd).toBe(6);
    expect(overview.aiAnswers.byok).toMatchObject({
      answers: 2,
      mentioned: 1,
      rate: 0.5,
    });
  });
});
