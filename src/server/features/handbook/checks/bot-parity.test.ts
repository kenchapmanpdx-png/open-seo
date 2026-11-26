import { sort } from "remeda";
import { describe, expect, it } from "vitest";
import {
  BOT_USER_AGENTS,
  type BotFetchData,
} from "@/server/features/handbook/contracts/collectors";
import {
  AI_BOTS,
  SEARCH_BOTS,
} from "@/server/features/handbook/contracts/bot-classes";
import { parseRobots } from "@/server/features/handbook/engine/robots";
import { context, ORIGIN, statusOf } from "./check-test-fixtures";
import { botParityCheck } from "./bot-parity";

type Fetch = BotFetchData["fetches"][number];

const fetchOf = (bot: Fetch["bot"], overrides: Partial<Fetch> = {}): Fetch => ({
  url: `${ORIGIN}/`,
  bot,
  status: 200,
  finalUrl: `${ORIGIN}/`,
  bytes: 1000,
  words: 300,
  bodySha256: "abc",
  blockedReason: null,
  ...overrides,
});

function run(fetches: Fetch[], robotsTxt = "User-agent: *\nAllow: /\n") {
  return botParityCheck.run(
    context({
      botFetch: { status: "ok", fetches },
      robots: {
        status: "ok",
        hosts: [
          {
            host: "example.com",
            status: 200,
            storageKey: null,
            groups: parseRobots(robotsTxt).groups,
            sitemaps: [],
            parseWarnings: [],
          },
        ],
        decisions: [],
      },
    }),
  );
}

const blocked = { status: 403, blockedReason: "HTTP 403" };

describe("botfetch.parity", () => {
  it("opens P9-01 when a robots-allowed bot gets 403", async () => {
    const result = await run([fetchOf("browser"), fetchOf("GPTBot", blocked)]);
    expect(statusOf(result, "P9-01")).toBe("OPEN");
  });

  it("treats a bot that robots.txt blocks as a deliberate choice", async () => {
    const result = await run(
      [fetchOf("browser"), fetchOf("GPTBot", blocked)],
      "User-agent: GPTBot\nDisallow: /\n",
    );
    expect(statusOf(result, "P9-01")).toBe("PASS");
  });

  it("ignores a challenge marker the browser response carries too", async () => {
    const marker = { blockedReason: "challenge page" };
    const result = await run([
      fetchOf("browser", marker),
      fetchOf("ClaudeBot", marker),
    ]);
    expect(statusOf(result, "P9-01")).toBe("PASS");
  });

  it("reports an intermittent block as S2 with the per-UA rate", async () => {
    const result = await run([
      fetchOf("browser"),
      fetchOf("PerplexityBot", {
        blockedReason: "interstitial:openresty",
        words: 9,
      }),
      fetchOf("PerplexityBot", { round: 2 }),
    ]);
    expect(statusOf(result, "P9-01")).toBe("OPEN");
    expect(result.findings[0]?.severity).toBe("S2");
    expect(result.findings[0]?.detail).toContain(
      "PerplexityBot: 1 of 2 fetches (50 %)",
    );
  });
});

// WO-B21-004: aweandorderorganizing.com (Cloudflare) answered ClaudeBot 403
// on every fetch while Googlebot / Bingbot got the page; the S1 capped the
// grade at 39. Only a failing search crawler can stop indexing.
describe("botfetch.parity severity by crawler class", () => {
  const severityOf = async (bots: Fetch["bot"][]) =>
    (
      await run([
        fetchOf("browser"),
        ...(["Googlebot", "Bingbot"] as const)
          .filter((bot) => !bots.includes(bot))
          .map((bot) => fetchOf(bot)),
        ...bots.map((bot) => fetchOf(bot, blocked)),
      ])
    ).findings.map((f) => f.severity);

  it("is S2 when only AI crawlers are blocked", async () => {
    expect(await severityOf(["ClaudeBot"])).toEqual(["S2"]);
  });

  it("is S1 when a search crawler is blocked, alone or with AI crawlers", async () => {
    expect(await severityOf(["Googlebot"])).toEqual(["S1"]);
    const mixed = await run([
      fetchOf("browser"),
      fetchOf("Bingbot", blocked),
      fetchOf("GPTBot", blocked),
    ]);
    expect(mixed.findings[0]?.severity).toBe("S1");
    expect(mixed.findings[0]?.detail).toMatch(/search crawlers: Bingbot/);
    expect(mixed.findings[0]?.detail).toMatch(/AI crawlers: GPTBot/);
  });
});

// WO-B25-008: nwpersonaltraining.com. ClaudeBot got the nginx 403 on every
// fetch (reproduced live); Googlebot got full pages, then a WP Defender
// lockout keyed on our IP (not reproduced live): not tested from our IP.
describe("botfetch.parity refusals that did not reproduce", () => {
  const at = (path: string) => ({
    url: `${ORIGIN}${path}`,
    finalUrl: `${ORIGIN}${path}`,
  });
  const paths = ["/", "/contact/", "/a/", "/b/", "/c/", "/d/", "/e/"];
  const nginx = { ...blocked, bytes: 146, bodySha256: "nginx" };
  const lockout = { ...blocked, bytes: 9292, bodySha256: "defender" };

  it("names only bots refused on every fetch; a lockout bot is 'not tested'", async () => {
    const result = await run([
      ...paths.map((p) => fetchOf("browser", at(p))),
      ...paths
        .slice(2)
        .map((p) => fetchOf("ClaudeBot", { ...at(p), ...nginx })),
      ...paths.slice(0, 2).map((p) => fetchOf("Googlebot", at(p))),
      ...paths
        .slice(2)
        .map((p) => fetchOf("Googlebot", { ...at(p), ...lockout })),
    ]);
    const finding = result.findings[0];
    expect(finding?.severity).toBe("S2");
    expect(finding?.detail).toContain("AI crawlers: ClaudeBot");
    expect(finding?.detail).not.toContain("search crawlers");
    expect(finding?.detail).toContain(
      "Googlebot: not tested from our IP (5 of 7 fetches refused after 2 full pages",
    );
  });

  it("keeps a bot refused on every fetch with different bodies (aweandorder)", async () => {
    const result = await run([
      ...paths.map((p) => fetchOf("browser", at(p))),
      ...paths.map((p, i) =>
        fetchOf("ClaudeBot", { ...at(p), ...blocked, bodySha256: `cf${i}` }),
      ),
    ]);
    expect(result.findings[0]?.severity).toBe("S2");
    expect(result.findings[0]?.detail).toContain("ClaudeBot: 7 of 7 fetches");
  });

  // BadGEO /partners/acme.html: GPTBot (probe only, round 1) refused on one
  // URL and served full pages after it. Not a lockout: the refusal keys on
  // the URL, so the bot stays refused.
  it("keeps a bot refused on one URL that still gets full pages after it", async () => {
    const result = await run([
      ...paths.map((p) => fetchOf("browser", at(p))),
      fetchOf("GPTBot", at("/")),
      fetchOf("GPTBot", { ...at("/a/"), ...blocked }),
      ...paths.slice(3).map((p) => fetchOf("GPTBot", at(p))),
    ]);
    expect(result.findings[0]?.severity).toBe("S2");
    expect(result.findings[0]?.detail).toContain("AI crawlers: GPTBot");
    expect(result.findings[0]?.detail).not.toContain("not tested");
  });

  it("passes with a note when the only refusing bot was not tested", async () => {
    const result = await run([
      ...paths.map((p) => fetchOf("browser", at(p))),
      fetchOf("Googlebot", at("/")),
      ...paths
        .slice(2)
        .map((p) => fetchOf("Googlebot", { ...at(p), ...lockout })),
    ]);
    expect(statusOf(result, "P9-01")).toBe("PASS");
    expect(result.statuses[0]?.note).toContain("Googlebot: not tested");
  });
});

const byName = (a: string, b: string) => a.localeCompare(b);

describe("bot classes", () => {
  it("put every fetched bot in exactly one class", () => {
    const classes = [...SEARCH_BOTS, ...AI_BOTS];
    expect(sort(classes, byName)).toEqual(
      sort(Object.keys(BOT_USER_AGENTS), byName),
    );
  });
});
