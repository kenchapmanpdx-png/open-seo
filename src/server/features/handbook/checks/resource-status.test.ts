import { describe, expect, it } from "vitest";
import type { ResourcesData } from "@/server/features/handbook/contracts/collectors";
import { context, statusOf } from "./check-test-fixtures";
import { resourceStatusCheck } from "./resource-status";

type Probe = ResourcesData["resources"][number]["probe"];

const run = (probe: Probe, pages = 1) =>
  resourceStatusCheck.run(
    context({
      resources: {
        status: "ok",
        found: 1,
        resources: [
          {
            url: "https://example.com/logo.png",
            kind: "img",
            sourceUrls: Array.from(
              { length: pages },
              (_, i) => `https://example.com/p${i}`,
            ),
            probe,
          },
        ],
      },
    }),
  );

const answer = (status: number) => ({
  status,
  finalUrl: "https://example.com/logo.png",
  method: "HEAD" as const,
});

describe("crawl.resource-status", () => {
  it("opens one finding per broken resource with its page count", async () => {
    const result = await run(answer(404), 64);
    expect(statusOf(result, "SUPP-20")).toBe("OPEN");
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].title).toBe("Image returns an error on 64 pages");
  });

  it("opens on no answer and on 5xx", async () => {
    expect(statusOf(await run(null), "SUPP-20")).toBe("OPEN");
    expect(statusOf(await run(answer(503)), "SUPP-20")).toBe("OPEN");
  });

  it("does not flag a bot-only 403 that a browser gets", async () => {
    const result = await run({
      ...answer(403),
      browserRetest: { status: 200, finalUrl: "https://example.com/logo.png" },
    });
    expect(statusOf(result, "SUPP-20")).toBe("PASS");
  });
});
