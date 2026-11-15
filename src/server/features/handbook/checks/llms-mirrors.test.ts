import { describe, expect, it } from "vitest";
import type { LlmsData } from "@/server/features/handbook/contracts/collectors";
import { context, ORIGIN, snapshot, statusOf } from "./check-test-fixtures";
import { llmsMirrorsCheck } from "./llms-mirrors";

const run = (llms: LlmsData) =>
  llmsMirrorsCheck.run(
    context({
      llms: { status: "ok", ...llms },
      pages: {
        status: "ok",
        snapshots: [snapshot("/"), snapshot("/gone", { status: 404 })],
      },
    }),
  );

describe("crawl.llms-mirrors", () => {
  it("opens P9-02 when llms.txt links a 404 page", async () => {
    const result = await run({
      files: [
        {
          url: `${ORIGIN}/llms.txt`,
          status: 200,
          contentType: "text/plain",
          storageKey: null,
          links: [`${ORIGIN}/`, `${ORIGIN}/gone`],
        },
      ],
      mdMirrors: [],
    });
    expect(statusOf(result, "P9-02")).toBe("OPEN");
  });

  it("opens P9-03 when a 200 mirror's page has no alternate link", async () => {
    const result = await run({
      files: [],
      mdMirrors: [
        {
          pageUrl: `${ORIGIN}/`,
          mdUrl: `${ORIGIN}/index.md`,
          status: 200,
          headers: [["x-robots-tag", "noindex"]],
        },
      ],
    });
    expect(statusOf(result, "P9-03")).toBe("OPEN");
  });
});
