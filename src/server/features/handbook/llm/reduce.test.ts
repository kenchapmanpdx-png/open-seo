import { describe, expect, it } from "vitest";
import type { LlmsData } from "@/server/features/handbook/contracts/collectors";
import type { PageProfile } from "@/server/features/handbook/contracts/page-profile";
import { snapshot } from "../checks/check-test-fixtures";
import { buildSiteFactMap } from "./reduce";

const LLMS_URL = "https://example.com/llms.txt";

function llms(stated: string, listed: number): LlmsData {
  const entries = Array.from(
    { length: listed },
    (_, i) =>
      `- [Race ${i + 1}](https://example.com/events/race-${i + 1}.md): Vancouver, WA.`,
  );
  return {
    files: [
      {
        url: LLMS_URL,
        status: 200,
        contentType: "text/plain",
        storageKey: null,
        links: [],
        text: `# WHY\n\n> Its calendar lists ${stated} running, trail and triathlon events across Washington and Oregon: 14 produced by WHY RACING EVENTS.\n\n## Events\n\n${entries.join("\n")}`,
      },
    ],
    mdMirrors: [],
  };
}

function profile(names: PageProfile["names"]): PageProfile {
  return {
    url: "https://example.com/about",
    pageType: "about",
    topic: "About",
    names,
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
    promptVersion: "1",
    model: "test",
    scope: "page",
    templateKey: null,
    droppedQuotes: 0,
    truncated: false,
    tokensIn: 0,
    tokensOut: 0,
    costUsd: 0,
  };
}

describe("buildSiteFactMap", () => {
  it("flags a stated event count that differs from the llms.txt list, with both quotes", () => {
    const about = snapshot("/about");
    const map = buildSiteFactMap([], null, llms("21 annual", 19), [
      {
        ...about,
        markup: {
          ...about.markup,
          text: "50,000+ Athletes Served 21 Annual Events 2014 Year Founded",
        },
      },
    ]);
    const conflict = map.statConflicts.find((c) => c.subject === "event count");
    expect(conflict?.values.map((v) => v.value)).toEqual(["21", "19 listed"]);
    expect(conflict?.values.flatMap((v) => v.refs.map((r) => r.quote))).toEqual(
      expect.arrayContaining([
        "## Events",
        expect.stringMatching(
          /^Its calendar lists 21 annual running, trail and triathlon events/,
        ),
        "50,000+ Athletes Served 21 Annual Events 2014 Year Founded",
      ]),
    );
  });

  it("accepts an at-least count the list satisfies", () => {
    const map = buildSiteFactMap([], null, llms("20+", 21), []);
    expect(map.statConflicts).toEqual([]);
  });

  it("clusters spacing variants and the acronym of one brand", () => {
    const quote = "Blue Tree";
    const map = buildSiteFactMap(
      [
        profile(
          ["Blue Tree Funding", "Blue Tree", "BlueTree", "BTF"].map((text) => ({
            kind: "brand" as const,
            text,
            quote,
          })),
        ),
      ],
      null,
      null,
      [],
    );
    expect(map.nameVariants).toHaveLength(1);
    expect(map.nameVariants[0]?.variants.map((v) => v.text)).toEqual([
      "Blue Tree Funding",
      "Blue Tree",
      "BlueTree",
      "BTF",
    ]);
  });
});
