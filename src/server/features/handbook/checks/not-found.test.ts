import { describe, expect, it } from "vitest";
import type { VariantsData } from "@/server/features/handbook/contracts/collectors";
import { context, ORIGIN, snapshot, statusOf } from "./check-test-fixtures";
import { notFoundCheck } from "./not-found";

const URL_ = `${ORIGIN}/handbook-probe-x-not-found`;

function run(
  status: number,
  extra: Partial<VariantsData["probes"][number]> = {},
) {
  return notFoundCheck.run(
    context({
      variants: {
        status: "ok",
        probes: [
          {
            kind: "unknown-path",
            url: URL_,
            finalUrl: URL_,
            status,
            redirectChain: [],
            title: "Page not found",
            words: 12,
            ...extra,
          },
        ],
      },
      pages: { status: "ok", snapshots: [snapshot("/")] },
    }),
  );
}

describe("crawl.not-found", () => {
  it("opens P3-10 at S1 when an unknown path answers 200", async () => {
    const result = await run(200);
    expect(statusOf(result, "P3-10")).toBe("OPEN");
    expect(result.findings[0]?.severity).toBe("S1");
  });

  it("opens P3-10 when an unknown path redirects to the homepage", async () => {
    const result = await run(200, {
      finalUrl: `${ORIGIN}/`,
      redirectChain: [{ url: URL_, status: 302 }],
    });
    expect(statusOf(result, "P3-10")).toBe("OPEN");
  });

  it("passes both items on a real 404 with its own template", async () => {
    const result = await run(404);
    expect(statusOf(result, "P3-10")).toBe("PASS");
    expect(statusOf(result, "P3-11")).toBe("PASS");
  });

  it("opens P3-11 when the 404 body is the size of the homepage", async () => {
    const result = await run(404, { words: 100 });
    expect(statusOf(result, "P3-11")).toBe("OPEN");
  });
});
