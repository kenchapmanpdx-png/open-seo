import { describe, expect, it, vi } from "vitest";
import { BingService } from "./bingService";

const { testDb } = await vi.hoisted(async () => {
  const { createAiVisibilityTestDb } =
    await import("@/server/features/ai-visibility/aiVisibilityTestDb");
  return { testDb: await createAiVisibilityTestDb() };
});
vi.mock("cloudflare:workers", () => ({ env: { DATABASE_PROVIDER: "d1" } }));
vi.mock("@/db", () => ({ db: testDb.db }));
vi.mock("@/db/runBatch", () => ({ runBatch: testDb.runBatch }));

describe("BingService tenant scope", () => {
  it("reads a project's Bing data only for its own organization", async () => {
    await testDb.seedProject();
    await testDb.client.executeMultiple(`
      INSERT INTO bing_site (id, project_id, organization_id, site_url, verified)
        VALUES ('site', 'project', 'organization', 'https://example.com/', 1);
      INSERT INTO bing_daily_traffic (site_id, day, impressions, clicks)
        VALUES ('site', '2026-11-10', 40, 3), ('site', '2026-11-11', 60, 2);
      INSERT INTO bing_crawl_issue (site_id, url, issue_type, http_code, first_seen, last_seen)
        VALUES ('site', 'https://example.com/x', 'Code4xx', 404, '2026-11-10', '2026-11-11');
    `);
    const now = new Date("2026-11-14T12:00:00Z");

    expect(
      await BingService.getSummary(
        { projectId: "project", organizationId: "organization" },
        now,
      ),
    ).toMatchObject({
      siteUrl: "https://example.com/",
      clicks28d: 5,
      impressions28d: 100,
      blockingCrawlIssues: 1,
    });
    await expect(
      BingService.getSummary(
        { projectId: "project", organizationId: "intruder" },
        now,
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
