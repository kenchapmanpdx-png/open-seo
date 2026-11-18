import { describe, expect, it } from "vitest";
import type { RenderData } from "@/server/features/handbook/contracts/render-data";
import { context, ORIGIN, snapshot } from "./check-test-fixtures";
import { auditProcessCheck } from "./audit-process";

function rendered(path: string, words: number): RenderData["pages"][number] {
  const url = new URL(path, ORIGIN).href;
  return {
    url,
    js: {
      finalUrl: url,
      status: 200,
      renderedKey: "k",
      words,
      requests: [],
      opacityZeroWords: 0,
      firstScreenActions: [],
    },
    noJs: { status: 200, nojsKey: "n", words: 100 },
    firstScreenKey: null,
    consoleErrors: [],
  };
}

describe("auditProcessCheck", () => {
  it("records Mode 1 / Mode 2 per rendered template sample", async () => {
    const result = await auditProcessCheck.run(
      context({
        pages: {
          status: "ok",
          snapshots: [snapshot("/a"), snapshot("/b")],
        },
        render: {
          status: "ok",
          pages: [rendered("/a", 100), rendered("/b", 400)],
        },
      }),
    );
    const verdict = result.statuses.find((s) => s.itemId === "P1-02");
    expect(verdict?.status).toBe("PASS");
    expect(verdict?.note).toContain("1 Mode 1, 1 Mode 2");
  });
});
