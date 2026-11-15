import { describe, expect, it, vi } from "vitest";
import { ByokViewService } from "./byokViewService";

const { testDb } = await vi.hoisted(async () => {
  const { createAiVisibilityTestDb } =
    await import("@/server/features/ai-visibility/aiVisibilityTestDb");
  return { testDb: await createAiVisibilityTestDb() };
});
vi.mock("cloudflare:workers", () => ({ env: { DATABASE_PROVIDER: "d1" } }));
vi.mock("@/db", () => ({ db: testDb.db }));
vi.mock("@/db/runBatch", () => ({ runBatch: testDb.runBatch }));

describe("ByokViewService.getComparison", () => {
  it("pairs a BYOK provider with its engine in the closest-dated DataForSEO run", async () => {
    await testDb.seedProject();
    await testDb.client.executeMultiple(`
      INSERT INTO ai_trackers (id, project_id, created_at) VALUES ('tracker', 'project', '2026-01-01');
      INSERT INTO ai_prompts (id, tracker_id, topic, text, created_at) VALUES ('p0', 'tracker', 't', 'best seo tools', '2026-01-01');
      INSERT INTO ai_runs (id, tracker_id, project_id, trigger, status, location_code, language_code, created_at, completed_at) VALUES
        ('far', 'tracker', 'project', 'scheduled', 'completed', 2840, 'en', '2026-10-01T00:00:00Z', '2026-10-01T01:00:00Z'),
        ('near', 'tracker', 'project', 'scheduled', 'completed', 2840, 'en', '2026-11-13T00:00:00Z', '2026-11-13T01:00:00Z');
      INSERT INTO ai_observations (id, run_id, prompt_id, engine, branded, status) VALUES
        ('o-far', 'far', 'p0', 'chatgpt', 0, 'completed'),
        ('o-near', 'near', 'p0', 'chatgpt', 0, 'completed'),
        ('o-near-claude', 'near', 'p0', 'claude', 0, 'completed');
      INSERT INTO ai_matches (id, observation_id, name, domain, own, mentioned, cited, first_mention) VALUES
        ('m1', 'o-near', 'OpenSEO', 'openseo.so', 1, 1, 0, 4);
      INSERT INTO byok_ai_run (id, project_id, organization_id, tracker_id, status, started_at) VALUES
        ('b1', 'project', 'organization', 'tracker', 'completed', '2026-11-14T00:00:00Z');
      INSERT INTO byok_ai_answer (id, run_id, prompt_id, provider, model, web_search, status) VALUES
        ('a1', 'b1', 'p0', 'openai', 'gpt-test', 1, 'completed');
    `);

    const result = await ByokViewService.getComparison({
      projectId: "project",
      organizationId: "organization",
    });

    expect(result?.upstreamRun?.id).toBe("near");
    expect(result?.rows).toMatchObject([
      {
        promptId: "p0",
        engine: "chatgpt",
        provider: "openai",
        dataforseo: { runId: "near", mentioned: true, firstMention: 4 },
        byok: { runId: "b1", mentioned: false },
      },
    ]);
  });
});
