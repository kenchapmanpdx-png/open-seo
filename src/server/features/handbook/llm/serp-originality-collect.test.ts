import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type {
  CollectedData,
  PageSnapshot,
  SafeFetch,
} from "@/server/features/handbook/contracts/collectors";
import type { PageProfile } from "@/server/features/handbook/contracts/page-profile";
import type { HandbookMode } from "@/server/features/handbook/contracts/status";
import {
  context,
  ORIGIN,
  snapshot,
  template,
} from "../checks/check-test-fixtures";
import { createMemoryEvidenceStore } from "../engine/memory-evidence-store";
import type { PageMapper } from "./map";
import { serpForRun, type SerpDeps } from "./serp-originality-collect";
import { SerpCreditError } from "./serp-originality-deps";

const DIR = "fork/fixtures/serp-originality";
const serp = z
  .object({ hits: z.array(z.object({ rank: z.number(), url: z.string() })) })
  .parse(JSON.parse(readFileSync(`${DIR}/serp.json`, "utf8")));

function profile(url: string, pageType: PageProfile["pageType"]): PageProfile {
  return {
    url,
    pageType,
    scope: "page",
    topic: "equipment financing",
    names: [],
    stats: [],
    prices: [],
    superlatives: [],
    awards: [],
    placeholders: [],
    undefinedAcronyms: [],
    faqQuestions: [],
    faqPairs: [],
    freshness: [],
    ctaFirstScreen: null,
    keyFactsBlock: null,
    contact: [],
    sections: [],
    videoText: null,
    textSha256: "0".repeat(64),
    promptVersion: "2",
    model: "test",
    templateKey: null,
    droppedQuotes: 0,
    truncated: false,
    tokensIn: 0,
    tokensOut: 0,
    costUsd: 0,
  };
}

/** Competitor pages from the fixture folder by host; `down` hosts fail. */
const offsite =
  (down: string[] = []): SafeFetch =>
  async (url) => {
    const host = new URL(url).hostname.replace(/\.test$/, "");
    const ok = !down.includes(host);
    return {
      url,
      finalUrl: url,
      status: ok ? 200 : 503,
      headers: [["content-type", "text/html"]],
      body: ok ? readFileSync(`${DIR}/${host}.html`, "utf8") : "",
      truncated: false,
      redirectChain: [],
      timingMs: 1,
    };
  };

const mapper: PageMapper = {
  modelId: "test",
  profile: async (job) => ({
    profile: profile(job.url, "article"),
    cached: false,
  }),
  spentUsd: () => 0,
};

const lookup = vi.fn<SerpDeps["lookup"]>();
const deriveQueries = vi.fn<NonNullable<SerpDeps["deriveQueries"]>>();

beforeEach(() => {
  lookup.mockResolvedValue({ hits: serp.hits, costUsd: 0.002 });
  deriveQueries.mockImplementation(async (pages) =>
    pages.map(() => "equipment financing for small business"),
  );
});

/** /b (5 in-links) and /a (3) share template T; /c (guide, 1) is template U. */
function site(): { collected: CollectedData; profiles: PageProfile[] } {
  const linked = (from: string, to: string[]): PageSnapshot =>
    snapshot(from, { links: to });
  const pages = [
    linked("/", ["/a", "/b", "/c", "/contact"]),
    linked("/contact", ["/a", "/b"]),
    linked("/x1", ["/a", "/b"]),
    linked("/x2", ["/b"]),
    linked("/x3", ["/b"]),
    snapshot("/a"),
    snapshot("/b"),
    snapshot("/c"),
  ];
  const at = (p: string) => new URL(p, ORIGIN).href;
  return {
    collected: context({
      pages: { status: "ok", snapshots: pages },
      templates: {
        status: "ok",
        templates: [
          template(
            "T",
            [pages[5], pages[6]].filter((p) => !!p),
          ),
          template(
            "U",
            [pages[7]].filter((p) => !!p),
          ),
        ],
      },
    }).collected,
    profiles: [
      profile(at("/"), "service"),
      profile(at("/contact"), "contact"),
      profile(at("/a"), "service"),
      profile(at("/b"), "service"),
      profile(at("/c"), "guide"),
    ],
  };
}

async function run(
  opts: {
    mode?: HandbookMode;
    down?: string[];
    cache?: SerpDeps["cache"];
    collected?: CollectedData;
  } = {},
) {
  const { collected, profiles } = site();
  const result = await serpForRun(
    {
      mode: opts.mode ?? "AUDIT",
      origin: ORIGIN,
      options: { serpOriginality: true, serpOriginalityPages: 10 },
      serp: {
        lookup,
        deriveQueries,
        mapper,
        cache: opts.cache ?? createMemoryEvidenceStore(),
      },
    },
    { projectId: "p1", fetchOffsite: offsite(opts.down), log: () => {} },
    opts.collected ?? collected,
    profiles,
  );
  if (!result) throw new Error("option on: expected a collection");
  return result;
}

describe("collectSerpOriginality", () => {
  it("picks the best-linked page per template first, then fills by in-links; never home or contact", async () => {
    const result = await run();
    if (result.status !== "ran") throw new Error("expected a run");
    expect(result.pages.map((p) => new URL(p.record.url).pathname)).toEqual([
      "/b",
      "/c",
      "/a",
    ]);
    const first = result.pages[0];
    expect(first?.record.blocked).toBeNull();
    expect(first?.competitors).toHaveLength(6);
    // Own host dropped; the PDF kept as non-html.
    expect(first?.record.results.map((r) => r.fetch)).toEqual([
      "ok",
      "ok",
      "ok",
      "non-html",
      "ok",
      "ok",
      "ok",
    ]);
  });

  it("strips the brand from derived queries", async () => {
    const { collected } = site();
    const withOrg: CollectedData = {
      ...collected,
      jsonld: {
        status: "ok",
        pages: [
          {
            url: ORIGIN,
            blocks: [],
            nodes: [
              {
                id: null,
                types: ["Organization"],
                properties: { name: "Acme Lending" },
              },
            ],
          },
        ],
      },
    };
    deriveQueries.mockResolvedValue([
      "Acme Lending equipment financing rates",
      "example.com equipment loans",
      "acme lending's equipment leases",
    ]);
    await run({ collected: withOrg });
    expect(new Set(lookup.mock.calls.map(([q]) => q))).toEqual(
      new Set([
        "equipment financing rates",
        "equipment leases",
        "equipment loans",
      ]),
    );
  });

  it("reuses a cached SERP within 7 days", async () => {
    const cache = createMemoryEvidenceStore();
    await run({ cache });
    await run({ cache });
    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it("blocks a page with fewer than 5 competitor pages fetched", async () => {
    const result = await run({ down: ["lender-a", "bank-c"] });
    if (result.status !== "ran") throw new Error("expected a run");
    expect(result.pages[0]?.record.blocked).toBe("serp pages unavailable");
    expect(result.pages[0]?.record.results.map((r) => r.fetch)).toContain(
      "failed",
    );
  });

  it("blocks every page on a DataForSEO credit error", async () => {
    lookup.mockRejectedValue(new SerpCreditError("Account balance is too low"));
    const result = await run();
    if (result.status !== "ran") throw new Error("expected a run");
    expect(result.blocked).toBe("dataforseo credit");
    expect(
      result.pages.every((p) => p.record.blocked === "dataforseo credit"),
    ).toBe(true);
  });

  it("collects nothing in REVIEW mode (EP-7)", async () => {
    const result = await run({ mode: "REVIEW" });
    expect(result).toEqual({
      status: "na",
      note: "REVIEW mode: search-results data not used, EP-7",
    });
    expect(deriveQueries).not.toHaveBeenCalled();
    expect(lookup).not.toHaveBeenCalled();
  });
});
