import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CollectedData } from "@/server/features/handbook/contracts/collectors";
import { HANDBOOK_CHECKS } from "./index";
import { llmContext, ORIGIN, snapshot } from "./check-test-fixtures";

/**
 * WO-B20-015 (a) / WO-B20-007: one malformed value read from a site must not
 * stop a check. Every registered check runs against pages, sitemap, robots,
 * headers, JSON-LD and probe data carrying unparseable URLs; any throw is a
 * `check error` in a real run (the runner discards the whole check).
 */
const BAD = [
  "http://",
  "https://exa mple.com/",
  "//",
  "",
  "https://[::1",
  `https://example.com/${"x".repeat(5000)}`,
  "https://example.com/�\u0000",
];

const hostile = (() => {
  const base = snapshot("/", { links: ["/ok.html"] });
  return {
    ...base,
    head: {
      ...base.head,
      canonical: "http://",
      hreflang: BAD.map((href) => ({ lang: "en", href })),
      og: { "og:url": "http://", "og:image": "//" },
    },
    links: BAD.map((href) => ({
      href,
      text: "x",
      rel: null,
      target: null,
      ariaLabel: null,
    })),
    images: BAD.map((src) => ({
      src,
      dataSrc: "http://",
      srcset: "http:// 1x, //  2x",
      alt: null,
      width: null,
      height: null,
      loading: null,
      fetchpriority: null,
    })),
  };
})();

const pages = [snapshot("/ok.html", { links: ["/"] }), hostile];

const collected: Partial<CollectedData> = {
  pages: { status: "ok", snapshots: pages },
  robots: {
    status: "ok",
    hosts: [
      {
        host: "example.com",
        status: 200,
        storageKey: null,
        groups: [
          {
            userAgents: ["*"],
            rules: [{ type: "disallow", path: "/[" }],
          },
        ],
        sitemaps: BAD,
        parseWarnings: [],
      },
    ],
    decisions: [],
  },
  sitemap: {
    status: "ok",
    sources: [
      {
        url: "http://",
        status: 200,
        kind: "urlset",
        storageKey: null,
        errors: [],
      },
    ],
    urls: BAD.map((loc) => ({ loc, lastmod: "not a date", source: "http://" })),
  },
  headers: {
    status: "ok",
    responses: [
      {
        url: `${ORIGIN}/`,
        status: 200,
        headers: [
          ["link", "<http://>; rel=canonical, <//>; rel=preload"],
          ["location", "http://"],
          ["content-security-policy", "default-src http://"],
        ],
      },
    ],
  },
  jsonld: {
    status: "ok",
    pages: pages.map((p) => ({
      url: p.url,
      blocks: [{ index: 0, raw: "{", parseError: "Unexpected end" }],
      nodes: [
        {
          id: "http://",
          types: ["Organization", "LocalBusiness", "Event", "Article"],
          properties: {
            url: "http://",
            sameAs: BAD,
            logo: "//",
            image: ["https://exa mple.com/"],
            mainEntityOfPage: "",
          },
        },
      ],
    })),
  },
  templates: {
    status: "ok",
    templates: [
      {
        key: "t1",
        urlPattern: "/",
        skeletonHash: "h",
        urls: [...pages.map((p) => p.url), "http://"],
        samples: [{ url: hostile.url, rank: 1, reason: "first" }],
      },
    ],
  } as CollectedData["templates"],
  linkTargets: {
    status: "ok",
    found: BAD.length,
    targets: BAD.map((url) => ({
      url,
      sourceUrls: [hostile.url, "http://"],
      probe: { status: 301, finalUrl: "http://", method: "HEAD" as const },
    })),
  },
  variants: {
    status: "ok",
    probes: (["http-apex", "http-www", "https-apex", "https-www"] as const).map(
      (kind) => ({
        kind,
        url: `${ORIGIN}/`,
        finalUrl: "http://",
        status: 301,
        redirectChain: [{ url: "//", status: 301 }],
        title: null,
        words: 0,
      }),
    ),
  },
  outbound: {
    status: "ok",
    links: BAD.map((url) => ({
      url,
      sourceUrls: [hostile.url],
      browser: { status: 404, finalUrl: "//" },
      bot: null,
    })),
  },
};

describe("hostile inputs (WO-B20-015 a)", () => {
  const ctx = llmContext(collected);
  const runnable = HANDBOOK_CHECKS.filter((check) =>
    check.requires.every(
      (key) => (ctx.collected[key] as { status: string }).status === "ok",
    ),
  );

  it("covers the checks that read pages", () => {
    expect(runnable.length).toBeGreaterThan(40);
  });

  it.each(runnable.map((c) => [c.id, c] as const))(
    "%s finishes on malformed URLs",
    async (_id, check) => {
      if (check.appliesTo && !check.appliesTo(ctx)) return;
      await expect(Promise.resolve(check.run(ctx))).resolves.toBeDefined();
    },
  );
});

describe("URL parsing under checks/ (WO-B20-015 a)", () => {
  it("goes through support.ts parseUrl / pathOf / bareHost / siteUrl only", () => {
    const dir = import.meta.dirname;
    const direct = readdirSync(dir)
      .filter(
        (f) =>
          f.endsWith(".ts") &&
          !f.endsWith(".test.ts") &&
          f !== "support.ts" &&
          f !== "check-test-fixtures.ts",
      )
      .filter((f) => readFileSync(join(dir, f), "utf8").includes("new URL("));
    expect(direct).toEqual([]);
  });
});
