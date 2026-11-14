import { describe, expect, it } from "vitest";
import { decide, parseRobots } from "./robots";

const ROBOTS = `User-agent: *
Disallow: /private/
Disallow: /*?sort=

User-agent: GPTBot
User-agent: ClaudeBot
Allow: /

Sitemap: https://example.com/sitemap.xml`;

describe("robots group evaluation", () => {
  const { groups, sitemaps } = parseRobots(ROBOTS);

  it("a named group replaces * entirely for that bot", () => {
    const named = decide("example.com", groups, "GPTBot", "/private/x");
    expect(named).toMatchObject({ allowed: true, matchedGroup: "GPTBot" });
    const star = decide("example.com", groups, "Googlebot", "/private/x");
    expect(star).toMatchObject({ allowed: false, matchedGroup: "*" });
  });

  it("matches wildcards and prefers allow on equal-length ties", () => {
    expect(decide("h", groups, "Bingbot", "/list?sort=asc").allowed).toBe(
      false,
    );
    const tie = parseRobots("User-agent: *\nDisallow: /a\nAllow: /a").groups;
    expect(decide("h", tie, "x", "/a/b").allowed).toBe(true);
    expect(sitemaps).toEqual(["https://example.com/sitemap.xml"]);
  });
});
