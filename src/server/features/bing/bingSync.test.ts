import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getBingKey } from "@/server/features/handbook/secrets/CredentialRepository";
import { bindSite, syncAllBingSites } from "./bingSync";

const { testDb } = await vi.hoisted(async () => {
  const { createAiVisibilityTestDb } =
    await import("@/server/features/ai-visibility/aiVisibilityTestDb");
  return { testDb: await createAiVisibilityTestDb() };
});
vi.mock("cloudflare:workers", () => ({ env: { DATABASE_PROVIDER: "d1" } }));
vi.mock("@/db", () => ({ db: testDb.db }));
vi.mock("@/db/runBatch", () => ({ runBatch: testDb.runBatch }));
vi.mock("@/server/features/handbook/secrets/CredentialRepository", () => ({
  getBingKey: vi.fn(),
}));

const SITE = "https://example.com/";
const fixture = (name: string) =>
  readFileSync(path.join(__dirname, "__fixtures__", `${name}.json`), "utf8");

const responses: Record<string, string> = {
  GetUserSites: JSON.stringify({ d: [{ Url: SITE, IsVerified: true }] }),
  GetRankAndTrafficStats: fixture("GetRankAndTrafficStats"),
  GetQueryStats: fixture("GetQueryStats"),
  GetPageStats: fixture("GetPageStats"),
  GetCrawlIssues: JSON.stringify({
    d: [{ Url: `${SITE}gone`, HttpCode: 404, IssueType: "Code4xx" }],
  }),
};

async function counts() {
  const result = await testDb.client.execute(`
    SELECT
      (SELECT count(*) FROM bing_daily_traffic) AS daily,
      (SELECT count(*) FROM bing_query_week) AS queries,
      (SELECT count(*) FROM bing_page_week) AS pages,
      (SELECT count(*) FROM bing_crawl_issue) AS issues`);
  return { ...result.rows[0] };
}

beforeEach(async () => {
  await testDb.seedProject();
  vi.mocked(getBingKey).mockResolvedValue({ key: "k", source: "org" });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      const method = new URL(input).pathname.split("/").at(-1) ?? "";
      return new Response(responses[method] ?? '{"d":[]}');
    }),
  );
});

describe("bing sync", () => {
  it("binds only a listed site, then syncs idempotently and keeps first_seen", async () => {
    await expect(
      bindSite({
        projectId: "project",
        organizationId: "organization",
        siteUrl: "https://other.com/",
      }),
    ).rejects.toThrow("not in this Bing");
    await bindSite({
      projectId: "project",
      organizationId: "organization",
      siteUrl: SITE,
    });

    expect(
      await syncAllBingSites(new Date("2026-11-13T03:17:00Z")),
    ).toMatchObject({ synced: 1 });
    const first = await counts();
    expect(first).toEqual({ daily: 4, queries: 3, pages: 3, issues: 1 });

    await syncAllBingSites(new Date("2026-11-14T03:17:00Z"));
    expect(await counts()).toEqual(first);

    const issue = await testDb.client.execute(
      "SELECT first_seen, last_seen FROM bing_crawl_issue",
    );
    expect({ ...issue.rows[0] }).toEqual({
      first_seen: "2026-11-13",
      last_seen: "2026-11-14",
    });
    const week = await testDb.client.execute(
      "SELECT week_start, avg_click_position FROM bing_query_week LIMIT 1",
    );
    expect({ ...week.rows[0] }).toEqual({
      week_start: "2026-08-10",
      avg_click_position: null,
    });
    const state = await testDb.client.execute(
      "SELECT last_success_at, last_error FROM bing_sync_state",
    );
    expect({ ...state.rows[0] }).toEqual({
      last_success_at: "2026-11-14T03:17:00.000Z",
      last_error: null,
    });
  });

  it("records 'no key' when the organization has no Bing key", async () => {
    await testDb.client.execute(
      "INSERT INTO bing_site (id, project_id, organization_id, site_url, verified) VALUES ('s', 'project', 'organization', 'https://example.com/', 1)",
    );
    vi.mocked(getBingKey).mockResolvedValue(null);
    expect(await syncAllBingSites()).toMatchObject({ skipped: 1 });
    const state = await testDb.client.execute(
      "SELECT last_error FROM bing_sync_state",
    );
    expect(state.rows[0].last_error).toBe("no key");
  });
});
