import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_LOCATION,
  dataforseoSerpLookup,
} from "./serp-originality-deps";

const { search, resolve } = vi.hoisted(() => ({
  search: vi.fn(),
  resolve: vi.fn(),
}));
vi.mock("@/server/lib/dataforseo/serp", () => ({ fetchLiveSerp: search }));
vi.mock("@/server/lib/dataforseo/appendix", () => ({
  resolveGotoUrls: resolve,
}));

const goto = (id: string) => `https://google.com/goto?url=${id}`;

describe("dataforseoSerpLookup", () => {
  it("replaces google.com/goto links with the real page and drops unresolved ones", async () => {
    search.mockResolvedValue({
      data: [
        { type: "organic", rank_group: 1, url: goto("a") },
        { type: "organic", rank_group: 2, url: "https://plain.example/" },
        { type: "organic", rank_group: 3, url: goto("b") },
      ],
      billing: { costUsd: 0.002 },
    });
    resolve.mockResolvedValue(
      new Map([[goto("a"), "https://real.example/page"]]),
    );

    const { hits } = await dataforseoSerpLookup("query", DEFAULT_LOCATION);

    expect(hits).toEqual([
      { rank: 1, url: "https://real.example/page" },
      { rank: 2, url: "https://plain.example/" },
    ]);
  });
});
