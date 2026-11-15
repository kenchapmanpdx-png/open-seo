import { describe, expect, it } from "vitest";
import { countsAsAiUserFetchHit } from "./browser-agents";
import { classifyTrafficEvent } from "./classifier";
import type { TrafficEvent } from "./contracts";
import { parseCidr, parseIp } from "./ip-verify";
import { RULES_VERSION } from "./rules";

function event(overrides: Partial<TrafficEvent>): TrafficEvent {
  return {
    eventId: "e1",
    observedAt: "2026-11-14T00:00:00Z",
    method: "GET",
    host: "example.com",
    path: "/",
    queryString: null,
    status: 200,
    userAgent: null,
    remoteIp: null,
    referer: null,
    sourceType: "vercel-drain",
    ...overrides,
  };
}

const GPTBOT_UA =
  "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot";
const CHATGPT_USER_UA =
  "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot";

describe("classifyTrafficEvent", () => {
  it("drops the fork's own fetchers as self", () => {
    const result = classifyTrafficEvent(
      event({
        userAgent:
          "Mozilla/5.0 (compatible; OpenSEO-Handbook/1.0; +https://openseo.so)",
      }),
    );
    expect(result).toMatchObject({
      kind: "self",
      rulesVersion: RULES_VERSION,
    });
  });

  it("verifies GPTBot only from a published IP", () => {
    expect(
      classifyTrafficEvent(
        event({ userAgent: GPTBOT_UA, remoteIp: "132.196.86.5" }),
      ),
    ).toMatchObject({
      kind: "crawler",
      ruleId: "openai-gptbot",
      operator: "OpenAI",
      verification: "verified",
    });
    expect(
      classifyTrafficEvent(event({ userAgent: GPTBOT_UA, remoteIp: "8.8.8.8" }))
        .verification,
    ).toBe("claimed_unverified");
    expect(
      classifyTrafficEvent(event({ userAgent: GPTBOT_UA })).verification,
    ).toBe("claimed_unverified");
  });

  it("keeps user fetches apart from crawlers and flags scanner probes", () => {
    expect(
      classifyTrafficEvent(event({ userAgent: CHATGPT_USER_UA })),
    ).toMatchObject({
      kind: "user_fetch",
      ruleId: "openai-chatgpt-user",
      verification: "claimed_unverified",
    });
    expect(
      classifyTrafficEvent(event({ userAgent: CHATGPT_USER_UA, path: "/.env" }))
        .verification,
    ).toBe("unknown_ai_like");
  });

  it("names the engine from referer, utm_source, or the referer's utm", () => {
    expect(
      classifyTrafficEvent(event({ referer: "https://chatgpt.com/" })),
    ).toMatchObject({
      kind: "referral",
      operator: "OpenAI",
      evidenceType: "referer",
    });
    expect(
      classifyTrafficEvent(event({ queryString: "utm_source=perplexity" })),
    ).toMatchObject({ product: "Perplexity", evidenceType: "utm" });
    expect(
      classifyTrafficEvent(
        event({ referer: "https://example.com/?utm_source=chatgpt.com" }),
      ).evidenceType,
    ).toBe("referer-utm");
  });

  it("returns none for ordinary visitors", () => {
    expect(
      classifyTrafficEvent(
        event({
          userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/130",
          referer: "https://www.google.com/",
        }),
      ).kind,
    ).toBe("none");
  });
});

describe("ip parsing", () => {
  it("matches IPv4-mapped IPv6 against IPv4 ranges and rejects bad input", () => {
    const cidr = parseCidr("132.196.86.0/24");
    const ip = parseIp("::ffff:132.196.86.5");
    expect(cidr && ip && (ip.addr & cidr.mask) === cidr.network).toBe(true);
    expect(parseIp("256.1.1.1")).toBeNull();
    expect(parseCidr("10.0.0.0/33")).toBeNull();
  });
});

describe("countsAsAiUserFetchHit", () => {
  it("counts only a browser agent's page loads", () => {
    const page = { method: "GET", path: "/pricing", queryString: null };
    const asset = {
      method: "GET",
      path: "/_next/static/a.js",
      queryString: null,
    };
    expect(countsAsAiUserFetchHit("google-agent", page)).toBe(true);
    expect(countsAsAiUserFetchHit("google-agent", asset)).toBe(false);
    expect(countsAsAiUserFetchHit("openai-chatgpt-user", asset)).toBe(true);
  });
});
