import { describe, expect, it, vi } from "vitest";
import { CcService } from "./ccService";

const { testDb } = await vi.hoisted(async () => {
  const { createAiVisibilityTestDb } =
    await import("@/server/features/ai-visibility/aiVisibilityTestDb");
  return { testDb: await createAiVisibilityTestDb() };
});
vi.mock("cloudflare:workers", () => ({ env: { DATABASE_PROVIDER: "d1" } }));
vi.mock("@/db", () => ({ db: testDb.db }));
vi.mock("@/db/runBatch", () => ({ runBatch: testDb.runBatch }));

describe("CcService.getBaseline", () => {
  it("diffs releases and finds the competitor gap, scoped to the org", async () => {
    await testDb.seedProject();
    await testDb.client.executeMultiple(`
      INSERT INTO cc_release (id, window_label, status) VALUES
        ('cc-main-2026-may-jun-jul', 'May-Jul 2026', 'imported'),
        ('cc-main-2026-aug-sep-oct', 'Aug-Oct 2026', 'imported');
      INSERT INTO cc_target (id, project_id, organization_id, domain, enabled) VALUES
        ('own', 'project', 'organization', 'openseo.so', 1),
        ('rival', 'project', 'organization', 'rival.com', 1);
      INSERT INTO cc_backlink_summary (id, target_id, release_id, referring_domains, referring_hosts_sum) VALUES
        ('old', 'own', 'cc-main-2026-may-jun-jul', 2, 0),
        ('new', 'own', 'cc-main-2026-aug-sep-oct', 2, 0),
        ('r', 'rival', 'cc-main-2026-aug-sep-oct', 2, 0);
      INSERT INTO cc_backlink_domain (id, summary_id, linking_domain, num_hosts) VALUES
        ('1', 'old', 'kept.org', 5), ('2', 'old', 'gone.org', 3),
        ('3', 'new', 'kept.org', 5), ('4', 'new', 'fresh.org', 9),
        ('5', 'r', 'kept.org', 5), ('6', 'r', 'gap.org', 7);
    `);

    expect(
      await CcService.getBaseline({
        projectId: "project",
        organizationId: "organization",
      }),
    ).toMatchObject({
      domain: "openseo.so",
      releaseId: "cc-main-2026-aug-sep-oct",
      previousReleaseId: "cc-main-2026-may-jun-jul",
      newLinkingDomains: [{ domain: "fresh.org", numHosts: 9 }],
      lostLinkingDomains: [{ domain: "gone.org", numHosts: 3 }],
      competitorGap: [
        { domain: "gap.org", numHosts: 7, competitors: ["rival.com"] },
      ],
    });
    await expect(
      CcService.getBaseline({
        projectId: "project",
        organizationId: "intruder",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
