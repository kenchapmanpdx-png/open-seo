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

  // WO-B23-002: per-crawler groups are documented practice; the app cannot know intent → S3, no cap.
  it("reports a real named-group gap as S3 'intended?' naming the bot and route", async () => {
    const result = await run(
      "User-agent: *\nDisallow: /admin/\n\nUser-agent: Googlebot\nAllow: /\n",
    );
    expect(result.findings.map((f) => [f.severity, f.title, f.detail])).toEqual(
      [
        [
          "S3",
          "Named robots.txt groups miss the * Disallow set (Googlebot) — intended?",
          "A named group replaces `*` for that bot (RFC 9309), so these bots may crawl paths unlisted bots may not:\nGooglebot: /admin/",
        ],
      ],
    );
  });

  // WO-B21-005, aweandorderorganizing.com: `NerdyBot: Disallow: /` blocks
  // more than `*`, yet was reported as missing /ajax/, /apps/ (S1 cap).
  it("passes a named group whose own rules already block every * route", async () => {
    const result = await run(
      "User-agent: NerdyBot\nDisallow: /\n\nUser-agent: *\nDisallow: /ajax/\nDisallow: /apps/\n",
    );
    expect(result.findings).toEqual([]);
    expect(statusOf(result, "P3-15")).toBe("PASS");
  });

  // mobilepetgroomingaz.com: `*?lightbox=` sampled as "x?lightbox=" (no
  // leading slash), so PetalBot's `Disallow: /` never matched it.
  it("evaluates a pattern that starts with * as a path under /", async () => {
    const result = await run(
      "User-agent: *\nDisallow: *?lightbox=\n\nUser-agent: PetalBot\nDisallow: /\n\nUser-agent: dotbot\nCrawl-delay: 10\n",
    );
    expect(
      result.findings
        .filter((f) => f.title.startsWith("Named"))
        .map((f) => f.title),
    ).toEqual([
      "Named robots.txt groups miss the * Disallow set (dotbot) — intended?",
    ]);
  });

  it.each([
    ["broader own rule", "User-agent: Googlebot\nDisallow: /private\n"],
    [
      "same route through a longer rule",
      "User-agent: Googlebot\nAllow: /\nDisallow: /private/x\nDisallow: /private/\n",
    ],
  ])(
    "passes a named group that blocks every * route by evaluation (%s)",
    async (_, named) => {
      const result = await run(
        `User-agent: *\nDisallow: /private/\n\n${named}`,
      );
      expect(result.findings).toEqual([]);
    },
  );

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
        "Named robots.txt groups miss the * Disallow set (dotbot, AhrefsBot) — intended?",
        "S3",
      ],
    ]);
    const gpt = await run(`${file}\n\nUser-agent: GPTBot\nAllow: /`);
    expect(
      gpt.findings.find((f) => f.title.startsWith("Named"))?.severityReason,
    ).toMatch(/^the named group lets this crawler/);
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
