import { describe, expect, it, vi } from "vitest";
import { AiTrafficService } from "./aiTrafficService";

const { testDb } = await vi.hoisted(async () => {
  const { createAiVisibilityTestDb } =
    await import("@/server/features/ai-visibility/aiVisibilityTestDb");
  return { testDb: await createAiVisibilityTestDb() };
});
vi.mock("cloudflare:workers", () => ({ env: { DATABASE_PROVIDER: "d1" } }));
vi.mock("@/db", () => ({ db: testDb.db }));
vi.mock("@/db/runBatch", () => ({ runBatch: testDb.runBatch }));

describe("AiTrafficService", () => {
  it("treats another organization's project as not found", async () => {
    await testDb.seedProject();
    await expect(
      AiTrafficService.getSummary({
        projectId: "project",
        organizationId: "other-organization",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      AiTrafficService.getSummary({
        projectId: "project",
        organizationId: "organization",
      }),
    ).resolves.toMatchObject({ crawlers: [], discarded: 0 });
  });
});
