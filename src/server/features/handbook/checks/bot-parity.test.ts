import { describe, expect, it } from "vitest";
import type { BotFetchData } from "@/server/features/handbook/contracts/collectors";
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
