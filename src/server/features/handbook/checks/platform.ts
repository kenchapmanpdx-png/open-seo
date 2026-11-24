import type { HandbookCheck } from "@/server/features/handbook/contracts/check";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import {
  createResult,
  formatHeaders,
  headerValue,
  normalizeUrl,
  pathOf,
} from "./support";

/**
 * P0-03 (handbook §0 EP-1): identify the platform (hosted builder vs own
 * stack) from response headers, `<meta name="generator">` and script hosts.
 * Recording each platform limit needs the owner → note only.
 */
const ITEMS = ["P0-03"];

type Signal = { platform: string; builder: boolean; via: string };

const HEADER_SIGNALS: {
  header: string;
  test: RegExp;
  platform: string;
  builder: boolean;
}[] = [
  { header: "x-wix-request-id", test: /./, platform: "Wix", builder: true },
  { header: "x-shopify-stage", test: /./, platform: "Shopify", builder: true },
  { header: "x-vercel-id", test: /./, platform: "Vercel", builder: false },
  { header: "x-nf-request-id", test: /./, platform: "Netlify", builder: false },
  {
    header: "server",
    test: /squarespace/i,
    platform: "Squarespace",
    builder: true,
  },
  { header: "server", test: /wix/i, platform: "Wix", builder: true },
  { header: "server", test: /netlify/i, platform: "Netlify", builder: false },
  {
    header: "server",
    test: /github\.com/i,
    platform: "GitHub Pages",
    builder: false,
  },
  {
    header: "x-powered-by",
    test: /next\.js/i,
    platform: "Next.js",
    builder: false,
  },
  {
    header: "x-powered-by",
    test: /wordpress|wp engine/i,
    platform: "WordPress",
    builder: false,
  },
  { header: "cf-ray", test: /./, platform: "Cloudflare (CDN)", builder: false },
];

const GENERATOR_BUILDERS =
  /wix|squarespace|webflow|shopify|weebly|godaddy|duda|jimdo|framer|carrd|showit/i;

const SCRIPT_SIGNALS: { test: RegExp; platform: string; builder: boolean }[] = [
  {
    test: /static\.wixstatic\.com|static\.parastorage\.com/i,
    platform: "Wix",
    builder: true,
  },
  { test: /cdn\.shopify\.com/i, platform: "Shopify", builder: true },
  { test: /squarespace(-cdn)?\.com/i, platform: "Squarespace", builder: true },
  {
    test: /webflow\.(com|io)|website-files\.com/i,
    platform: "Webflow",
    builder: true,
  },
  // Builders that print no generator meta (field test 8: Showit) are known
  // only by the hosts their engine and media load from.
  {
    test: /lib\.showit\.com|static\.showit\.co/i,
    platform: "Showit",
    builder: true,
  },
  { test: /img1\.wsimg\.com/i, platform: "GoDaddy", builder: true },
  {
    test: /irp\.cdn-website\.com|multiscreensite\.com/i,
    platform: "Duda",
    builder: true,
  },
  { test: /editmysite\.com/i, platform: "Weebly", builder: true },
  {
    test: /jimstatic\.com|jimdo(cdn)?\.com/i,
    platform: "Jimdo",
    builder: true,
  },
  {
    test: /framerusercontent\.com|events\.framer\.com/i,
    platform: "Framer",
    builder: true,
  },
  { test: /\/wp-(content|includes)\//i, platform: "WordPress", builder: false },
  { test: /\/_next\/static\//i, platform: "Next.js", builder: false },
];

const scriptSrcs = (p: PageSnapshot) =>
  p.markup.scripts.map((x) => x.src).filter((x): x is string => !!x);

export const platformCheck: HandbookCheck = {
  id: "crawl.platform",
  itemIds: ITEMS,
  class: "CRAWL",
  requires: ["pages"],
  run(ctx) {
    const out = createResult(ITEMS);
    const { pages, headers } = ctx.collected;
    if (pages.status !== "ok") return out.build();
    const live = pages.snapshots.filter((s) => s.status === 200);
    const home = live.find((s) => pathOf(s.url) === "/") ?? live[0] ?? null;
    if (!home) {
      out.na("P0-03", "no 200 page crawled");
      return out.build();
    }

    const signals: Signal[] = [];
    const responses = headers.status === "ok" ? headers.responses : [];
    const homeResponse =
      responses.find((r) => normalizeUrl(r.url) === normalizeUrl(home.url)) ??
      responses[0];
    for (const r of responses.slice(0, 5))
      for (const s of HEADER_SIGNALS) {
        const value = headerValue(r.headers, s.header);
        if (value !== null && s.test.test(value))
          signals.push({
            platform: s.platform,
            builder: s.builder,
            via: `${s.header}: ${value}`,
          });
      }
    const generators = new Set(
      live.map((p) => p.head.meta.generator).filter((g): g is string => !!g),
    );
    for (const g of generators)
      signals.push({
        platform: g,
        builder: GENERATOR_BUILDERS.test(g),
        via: `<meta name="generator" content="${g}">`,
      });
    for (const src of new Set(live.slice(0, 10).flatMap(scriptSrcs)))
      for (const s of SCRIPT_SIGNALS)
        if (s.test.test(src))
          signals.push({
            platform: s.platform,
            builder: s.builder,
            via: `script ${src}`,
          });

    const unique = [
      ...new Map(
        signals.map((s) => [`${s.platform}|${s.via.split(":")[0]}`, s]),
      ).values(),
    ];
    const evidence = [
      out.evidence(
        "rawHtml",
        home.url,
        [
          `generator: ${[...generators].join(", ") || "(none)"}`,
          ...scriptSrcs(home)
            .slice(0, 10)
            .map((src) => `script ${src}`),
        ].join("\n"),
        home.rawKey,
      ),
      ...(homeResponse
        ? [
            out.evidence(
              "header",
              homeResponse.url,
              formatHeaders(homeResponse.headers),
            ),
          ]
        : []),
    ];
    if (unique.length === 0) {
      out.finding({
        itemIds: ["P0-03"],
        severity: "S4",
        title: "Platform not identified",
        detail:
          "No platform header, generator meta or builder script host found on the crawled pages.",
        fix: "Record the platform (hosted builder or own stack) and its limits (robots.txt, redirects, headers, schema editing) in the audit intake.",
        fixability: "FIXABLE",
        effort: "S",
        urls: [home.url],
        evidenceRefs: evidence,
      });
      return out.build();
    }
    const platforms = [...new Set(unique.map((s) => s.platform))];
    const kind = unique.some((s) => s.builder)
      ? "hosted builder"
      : "own stack / host";
    out.pass(
      "P0-03",
      `platform: ${platforms.join(", ")} (${kind}) via ${unique
        .slice(0, 4)
        .map((s) => s.via)
        .join("; ")}; platform limits need the owner`,
      evidence,
    );
    return out.build();
  },
};
