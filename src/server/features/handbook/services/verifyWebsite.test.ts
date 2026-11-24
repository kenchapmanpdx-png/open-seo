import { describe, expect, it, vi } from "vitest";
import { domainField } from "@/types/schemas/domain";
import { SafeFetchBlockedError } from "@/server/features/handbook/engine/safe-fetch";
import type * as SafeFetchModule from "@/server/features/handbook/engine/safe-fetch";
import { verifyWebsite } from "./verifyWebsite";

vi.mock("@/server/features/handbook/engine/safe-fetch", async (original) => ({
  ...(await original<typeof SafeFetchModule>()),
  // Only acme.com resolves in this test.
  createSafeFetch: () => async (url: string) => {
    const host = new URL(url).hostname;
    // workerd: a host with no DNS record fails at the fetch, not the policy.
    if (host === "down.acme.com")
      throw new Error("internal error; reference = x");
    if (host !== "acme.com") throw new SafeFetchBlockedError(url, "dns");
    return { status: 200 };
  },
}));

/** WO-B20-010 / WO-B20-015 (f): hostile Website values never reach a run. */
describe("Check a site website value", () => {
  it.each([
    "exa mple.com",
    "localhost",
    "10.0.0.1",
    "http://192.168.1.1/",
    "acme",
  ])("rejects %s at the schema", (website) => {
    expect(domainField.safeParse(website).success).toBe(false);
  });

  // The reason is returned, not thrown: a thrown AppError reaches the client
  // as its bare code, and the form showed "Please check your input" (run 98).
  it("returns the reason for two hosts glued together (resolves nowhere)", async () => {
    const host = domainField.parse("aircorheatingcooling.comsamanthaco.ca");
    await expect(verifyWebsite(host)).resolves.toEqual({
      ok: false,
      reason:
        "aircorheatingcooling.comsamanthaco.ca does not exist (no DNS record). Check the spelling.",
    });
  });

  it("returns a reason when the fetch itself fails (workerd, no DNS record)", async () => {
    await expect(verifyWebsite("down.acme.com")).resolves.toEqual({
      ok: false,
      reason:
        "down.acme.com did not answer. Check the spelling and that the site is online.",
    });
  });

  it("accepts a site that answers", async () => {
    await expect(verifyWebsite("acme.com")).resolves.toEqual({
      ok: true,
      domain: "acme.com",
    });
  });
});
