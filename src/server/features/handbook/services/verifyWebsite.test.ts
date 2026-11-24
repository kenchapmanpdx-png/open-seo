import { describe, expect, it, vi } from "vitest";
import { domainField } from "@/types/schemas/domain";
import { SafeFetchBlockedError } from "@/server/features/handbook/engine/safe-fetch";
import type * as SafeFetchModule from "@/server/features/handbook/engine/safe-fetch";
import { verifyWebsite } from "./verifyWebsite";

vi.mock("@/server/features/handbook/engine/safe-fetch", async (original) => ({
  ...(await original<typeof SafeFetchModule>()),
  // Only acme.com resolves in this test.
  createSafeFetch: () => async (url: string) => {
    if (new URL(url).hostname !== "acme.com")
      throw new SafeFetchBlockedError(url, "dns");
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

  it("rejects two hosts glued together (resolves nowhere)", async () => {
    const host = domainField.parse("aircorheatingcooling.comsamanthaco.ca");
    await expect(verifyWebsite(host)).rejects.toThrow(
      "aircorheatingcooling.comsamanthaco.ca does not exist (no DNS record)",
    );
  });

  it("accepts a site that answers", async () => {
    await expect(verifyWebsite("acme.com")).resolves.toEqual({
      domain: "acme.com",
    });
  });
});
