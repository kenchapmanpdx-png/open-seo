import { describe, expect, it, vi } from "vitest";
import { classifyAndRollup, pruneAndReclassify } from "./aiTrafficJobs";

const { testDb } = await vi.hoisted(async () => {
  const { createAiVisibilityTestDb } =
    await import("@/server/features/ai-visibility/aiVisibilityTestDb");
  return { testDb: await createAiVisibilityTestDb() };
});
vi.mock("cloudflare:workers", () => ({ env: { DATABASE_PROVIDER: "d1" } }));
vi.mock("@/db", () => ({ db: testDb.db }));
vi.mock("@/db/runBatch", () => ({ runBatch: testDb.runBatch }));

const NOW = new Date("2026-11-14T12:00:00Z");
const GPTBOT =
  "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot";

async function seed() {
  await testDb.seedProject();
  await testDb.client.executeMultiple(`
    DELETE FROM ai_traffic_site;
    INSERT INTO ai_traffic_site (id, project_id, organization_id, vercel_project_id)
      VALUES ('site', 'project', 'organization', 'prj_1');
    INSERT INTO ai_traffic_event (id, site_id, event_id, observed_at, method, host, path, user_agent, remote_ip, referer) VALUES
      ('e1', 'site', 'r1', '2026-11-14T09:00:00.000Z', 'GET', 'a.com', '/pricing', '${GPTBOT}', '132.196.86.5', NULL),
      ('e2', 'site', 'r2', '2026-11-14T10:00:00.000Z', 'GET', 'a.com', '/blog', 'Mozilla/5.0 Chrome/130', NULL, 'https://chatgpt.com/'),
      ('e3', 'site', 'r3', '2026-11-14T11:00:00.000Z', 'GET', 'a.com', '/', 'OpenSEO-Audit/1.0', NULL, NULL),
      ('e4', 'site', 'r4', '2026-07-01T11:00:00.000Z', 'GET', 'a.com', '/old', '${GPTBOT}', NULL, NULL);
  `);
}

async function daily() {
  const result = await testDb.client.execute(
    "SELECT day, kind, rule_id, verification, hits, distinct_paths FROM ai_traffic_daily ORDER BY kind",
  );
  return result.rows.map((row) => ({ ...row }));
}

describe("ai traffic jobs", () => {
  it("classifies new events and rolls up today without self traffic, idempotently", async () => {
    await seed();
    expect(await classifyAndRollup(NOW)).toEqual({
      classified: 4,
      rollupRows: 2,
    });
    const expected = [
      {
        day: "2026-11-14",
        kind: "crawler",
        rule_id: "openai-gptbot",
        verification: "verified",
        hits: 1,
        distinct_paths: 1,
      },
      {
        day: "2026-11-14",
        kind: "referral",
        rule_id: "chatgpt.com",
        verification: "",
        hits: 1,
        distinct_paths: 1,
      },
    ];
    expect(await daily()).toEqual(expected);

    await classifyAndRollup(NOW);
    expect(await daily()).toEqual(expected);
  });

  it("deletes events past retention with their classes", async () => {
    await seed();
    await classifyAndRollup(NOW);
    await pruneAndReclassify(NOW);
    const events = await testDb.client.execute(
      "SELECT id FROM ai_traffic_event ORDER BY id",
    );
    const classes = await testDb.client.execute(
      "SELECT count(*) AS n FROM ai_traffic_class",
    );
    expect(events.rows.map((row) => row.id)).toEqual(["e1", "e2", "e3"]);
    expect(classes.rows[0].n).toBe(3);
  });
});
