import { describe, expect, it } from "vitest";
import type { RenderData } from "@/server/features/handbook/contracts/render-data";
import { context, ORIGIN, snapshot, statusOf } from "./check-test-fixtures";
import { renderParityCheck } from "./render-parity";

function rendered(
  path: string,
  words: number,
  opacityZeroWords = 0,
): RenderData["pages"][number] {
  const url = new URL(path, ORIGIN).href;
  return {
    url,
    js: {
      finalUrl: url,
      status: 200,
      renderedKey: "k",
      words,
      requests: [],
      opacityZeroWords,
      firstScreenActions: [],
    },
    noJs: { status: 200, nojsKey: "n", words: 100 },
    firstScreenKey: null,
    consoleErrors: [],
  };
}

const run = (page: RenderData["pages"][number]) =>
  renderParityCheck.run(
    context({
      pages: { status: "ok", snapshots: [snapshot("/x")] },
      render: { status: "ok", pages: [page] },
    }),
  );

describe("renderParityCheck", () => {
  it("flags core content added by JavaScript", async () => {
    const result = await run(rendered("/x", 400));
    expect(statusOf(result, "P2-01")).toBe("OPEN");
    expect(statusOf(result, "P2-09")).toBe("OPEN");
  });

  it("passes when raw and rendered match", async () => {
    const result = await run(rendered("/x", 105));
    expect(
      ["P2-01", "P2-08", "P2-09", "P2-07"].map((id) => statusOf(result, id)),
    ).toEqual(["PASS", "PASS", "PASS", "PASS"]);
  });

  it("lists opacity:0 words per page, S2 when most of the page is hidden", async () => {
    const result = await renderParityCheck.run(
      context({
        pages: { status: "ok", snapshots: [snapshot("/a"), snapshot("/b")] },
        render: {
          status: "ok",
          pages: [rendered("/a", 100, 40), rendered("/b", 100, 60)],
        },
      }),
    );
    const p207 = result.findings.filter((f) => f.itemIds.includes("P2-07"));
    expect(p207.map((f) => [f.severity, f.detail])).toEqual([
      ["S2", expect.stringContaining("/b — 60 of 100 rendered words")],
      ["S3", expect.stringContaining("/a — 40 of 100 rendered words")],
    ]);
  });

  it("divides opacity:0 words by the same walker's main words (WO-B19-006)", async () => {
    const page = rendered("/x", 1241, 365);
    const result = await run({ ...page, js: { ...page.js, mainWords: 400 } });
    const [p207] = result.findings.filter((f) => f.itemIds.includes("P2-07"));
    expect([p207.severity, p207.detail]).toEqual([
      "S2",
      expect.stringContaining("365 of 400 main-content words"),
    ]);
  });

  it("flags a form that exists only in the rendered DOM", async () => {
    const page = rendered("/x", 105);
    const result = await run({ ...page, js: { ...page.js, forms: 1 } });
    expect(statusOf(result, "P2-08")).toBe("OPEN");
    expect(result.findings[0].detail).toContain(
      "forms: raw HTML 0 · rendered 1",
    );
  });

  it("keeps P2-08 PASS when the rendered form count is absent or equal", async () => {
    const page = rendered("/x", 105);
    const equal = await run({ ...page, js: { ...page.js, forms: 0 } });
    expect(statusOf(equal, "P2-08")).toBe("PASS");
  });
});
