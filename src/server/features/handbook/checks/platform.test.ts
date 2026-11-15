import { describe, expect, it } from "vitest";
import { context, ORIGIN, snapshot } from "./check-test-fixtures";
import { platformCheck } from "./platform";

describe("platformCheck", () => {
  it("identifies Vercel from x-vercel-id", async () => {
    const result = await platformCheck.run(
      context({
        pages: { status: "ok", snapshots: [snapshot("/")] },
        headers: {
          status: "ok",
          responses: [
            {
              url: `${ORIGIN}/`,
              status: 200,
              headers: [["x-vercel-id", "iad1::abc"]],
            },
          ],
        },
      }),
    );
    const verdict = result.statuses.find((s) => s.itemId === "P0-03");
    expect(verdict?.status).toBe("PASS");
    expect(verdict?.note).toContain("Vercel");
  });
});
