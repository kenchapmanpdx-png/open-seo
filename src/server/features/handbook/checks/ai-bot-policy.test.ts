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
});
