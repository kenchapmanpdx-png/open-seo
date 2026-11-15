import { describe, expect, it } from "vitest";
import type { RenderData } from "@/server/features/handbook/contracts/collectors";
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

  it("flags text waiting at opacity:0", async () => {
    const result = await run(rendered("/x", 100, 60));
    expect(statusOf(result, "P2-07")).toBe("OPEN");
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
