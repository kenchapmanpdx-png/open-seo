import { describe, expect, it, vi } from "vitest";
import { AgencyService } from "./agencyService";

const { testDb } = await vi.hoisted(async () => {
  const { createAiVisibilityTestDb } =
    await import("@/server/features/ai-visibility/aiVisibilityTestDb");
  return { testDb: await createAiVisibilityTestDb() };
});
vi.mock("cloudflare:workers", () => ({ env: { DATABASE_PROVIDER: "d1" } }));
vi.mock("@/db", () => ({ db: testDb.db }));
vi.mock("@/db/runBatch", () => ({ runBatch: testDb.runBatch }));

const scope = { projectId: "project", organizationId: "organization" };
const brand = {
  agencyName: "Acme",
  accentColor: "#0a7f5a",
  contactLine: null,
  footerText: null,
  hideOpenseoCredit: true,
  removeLogo: false,
};

describe("AgencyService.saveBrand", () => {
  it("seeds the client report template once and drops an oversized logo", async () => {
    await testDb.seedProject();
    const big = Buffer.alloc(60_000).toString("base64");

    expect(
      await AgencyService.saveBrand(
        { ...scope, userId: "user" },
        { ...brand, logo: { contentType: "image/png", base64: big } },
      ),
    ).toEqual({ logoTooLarge: true, templateSeeded: true });
    expect(
      await AgencyService.saveBrand(
        { ...scope, userId: "user" },
        { ...brand, logo: null },
      ),
    ).toEqual({ logoTooLarge: false, templateSeeded: false });
    expect(await AgencyService.getBrandForRender("organization")).toMatchObject(
      { agencyName: "Acme", logoDataUri: null },
    );
    await expect(
      AgencyService.getSettings({ ...scope, organizationId: "intruder" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
