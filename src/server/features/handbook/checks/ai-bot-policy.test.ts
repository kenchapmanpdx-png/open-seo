import { describe, expect, it } from "vitest";
import { context, statusOf } from "./check-test-fixtures";
import { aiBotPolicyCheck } from "./ai-bot-policy";

const run = (robotsAllowed: boolean, status: number) =>
  aiBotPolicyCheck.run(
    context({
      botFetch: {
        status: "ok",
        fetches: [],
        policyMap: [
          {
            token: "GPTBot",
            robotsAllowed: true,
            status: 200,
            blockedReason: null,
          },
          { token: "Bytespider", robotsAllowed, status, blockedReason: null },
        ],
      },
    }),
  );

describe("botfetch.ai-bot-policy", () => {
  it("opens P9-01 at S4 when robots.txt allows a token the server 403s", async () => {
    const result = await run(true, 403);
    expect(statusOf(result, "P9-01")).toBe("OPEN");
    expect(result.findings[0]?.severity).toBe("S4");
    expect(result.findings[0]?.detail).toBe("Bytespider: HTTP 403");
  });

  it("treats a 403 to a token robots.txt disallows as a stated policy", async () => {
    const result = await run(false, 403);
    expect(result.findings).toEqual([]);
    expect(statusOf(result, "P9-04")).toBe("BLOCKED");
  });

  // WO-B23-006: a 429 left after the collector's retry is rate limiting, not a per-bot block.
  it("does not judge a token still rate-limited (429) and names it in the note", async () => {
    const result = await run(true, 429);
    expect(result.findings).toEqual([]);
    expect(result.statuses.find((s) => s.itemId === "P9-04")?.note).toContain(
      "rate-limited, not judged: Bytespider",
    );
  });
});

// WO-B21-004: aweandorderorganizing.com reported ClaudeBot's 403 twice
// (P9-01 parity + this S4 split). The parity finding owns a token it names.
const page = (bot: "browser" | "ClaudeBot", status: number) => ({
  url: "https://example.com/",
  bot,
  status,
  finalUrl: "https://example.com/",
  bytes: 1000,
  words: 300,
  bodySha256: "abc",
  blockedReason: null,
});
const row = (token: string) => ({
  token,
  robotsAllowed: true,
  status: 403,
  blockedReason: null,
});

describe("botfetch.ai-bot-policy with a parity finding", () => {
  it("does not repeat a token the parity check failed; others still split", async () => {
    const result = await aiBotPolicyCheck.run(
      context({
        botFetch: {
          status: "ok",
          fetches: [page("browser", 200), page("ClaudeBot", 403)],
          policyMap: [row("ClaudeBot"), row("Bytespider")],
        },
      }),
    );
    expect(result.findings.map((f) => f.detail)).toEqual([
      "Bytespider: HTTP 403",
    ]);
  });
});
