import { describe, expect, it } from "vitest";
import { parseRobots } from "@/server/features/handbook/engine/robots";
import { context, statusOf } from "./check-test-fixtures";
import { robotsGroupsCheck } from "./robots-groups";

function run(text: string) {
  const { groups, sitemaps } = parseRobots(text);
  return robotsGroupsCheck.run(
    context({
      robots: {
        status: "ok",
        hosts: [
          {
            host: "example.com",
            status: 200,
            storageKey: null,
            groups,
            sitemaps,
            parseWarnings: [],
          },
        ],
        decisions: [],
      },
    }),
  );
}

describe("robots.group-evaluation", () => {
  it("opens P3-15/P9-05 when a named Allow-only group skips the * Disallows, proving it per bot", async () => {
    const result = await run(
      "User-agent: *\nDisallow: /cart/\n\nUser-agent: GPTBot\nAllow: /\n",
    );
    expect(statusOf(result, "P3-15")).toBe("OPEN");
    expect(statusOf(result, "P9-05")).toBe("OPEN");
    expect(result.evidence[0]?.excerpt).toContain(
      "/cart/: GPTBot allowed (group GPTBot) · unlisted bot blocked (group *)",
    );
  });

  it("passes when named and * agents share one group, and flags a ?param= rule without its &param= shape", async () => {
    const result = await run(
      "User-agent: GPTBot\nUser-agent: *\nDisallow: /api/\nDisallow: /*?sort=\n",
    );
    expect(result.findings.map((f) => f.title)).toEqual([
      "robots.txt parameter rules miss the `&param=` shape",
    ]);
    expect(statusOf(result, "P9-05")).toBe("PASS");
  });
});
