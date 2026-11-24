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

const host = (name: string, status: number) => ({
  host: name,
  status,
  storageKey: null,
  groups: [],
  sitemaps: [],
  parseWarnings: [],
});

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

  it("spoiledspaandsalon shape: one finding for all groups, AdsBot left out, S3 for SEO-tool bots on a parameter rule", async () => {
    const file = [
      "User-agent: *\nDisallow: /*?lightbox=",
      "User-agent: AdsBot-Google\nUser-agent: AdsBot-Google-Mobile\nAllow: /",
      "User-agent: dotbot\nCrawl-delay: 10",
      "User-agent: AhrefsBot\nCrawl-delay: 10",
    ].join("\n\n");
    const minor = await run(file);
    const named = minor.findings.filter((f) => f.title.startsWith("Named"));
    expect(named.map((f) => [f.title, f.severity])).toEqual([
      [
        "Named robots.txt groups miss the * Disallow set (dotbot, AhrefsBot)",
        "S3",
      ],
    ]);
    const gpt = await run(`${file}\n\nUser-agent: GPTBot\nAllow: /`);
    expect(
      gpt.findings.find((f) => f.title.startsWith("Named"))?.severity,
    ).toBe("S1");
  });

  // WO-B20-011; bluebonnetroofs.com: the www sibling only redirects (301) to the 404 host.
  it.each([
    [[host("example.com", 404)]],
    [[host("example.com", 404), host("www.example.com", 301)]],
  ])(
    "reports a 404 robots.txt as one S3 'No robots.txt' finding (%#)",
    async (hosts) => {
      const result = await robotsGroupsCheck.run(
        context({ robots: { status: "ok", hosts, decisions: [] } }),
      );
      expect(
        result.findings.map((f) => [f.itemIds[0], f.severity, f.title]),
      ).toEqual([["P3-15", "S3", "No robots.txt (HTTP 404)"]]);
    },
  );
});
