import { describe, expect, it } from "vitest";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import { context, snapshot, statusOf } from "./check-test-fixtures";
import { listNavigationCheck } from "./list-navigation";

const run = (snapshots: PageSnapshot[], disallow: string[] = []) =>
  listNavigationCheck.run(
    context({
      pages: { status: "ok", snapshots },
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
                rules: disallow.map((path) => ({ type: "disallow", path })),
              },
            ],
            sitemaps: [],
            parseWarnings: [],
          },
        ],
        decisions: [],
      },
    }),
  );

describe("crawl.list-navigation", () => {
  it("opens P3-21 when page 2 canonicalises to page 1", async () => {
    const result = await run([
      snapshot("/blog/", { links: ["/blog/page/2"] }),
      snapshot("/blog/page/2", { canonical: "/blog/" }),
    ]);
    expect(statusOf(result, "P3-21")).toBe("OPEN");
  });

  // Field test 7 (theogdenver.com /press/?p=2): every numbered-page form, not only ?page=.
  it("opens P3-21 for a ?p=2 page canonical to page 1", async () => {
    const result = await run([
      snapshot("/press/", { links: ["/press/?p=2"] }),
      snapshot("/press/?p=2", { canonical: "/press/" }),
    ]);
    expect(statusOf(result, "P3-21")).toBe("OPEN");
  });

  it("passes P3-21 when page 1 canonicalises to the list (WO-B19-005)", async () => {
    const result = await run([
      snapshot("/shop", { links: ["/shop?page=1"] }),
      snapshot("/shop?page=1", { canonical: "/shop" }),
    ]);
    expect(statusOf(result, "P3-21")).toBe("PASS");
  });

  it("opens P3-23 when search is both Disallowed and noindex", async () => {
    const result = await run(
      [
        snapshot("/", { links: ["/search?q=x"] }),
        snapshot("/search?q=x", { robotsMeta: "noindex" }),
      ],
      ["/search"],
    );
    expect(statusOf(result, "P3-23")).toBe("OPEN");
  });

  it("passes P3-23 when search is only Disallowed", async () => {
    const result = await run(
      [snapshot("/", { links: ["/search?q=x"] })],
      ["/search"],
    );
    expect(statusOf(result, "P3-23")).toBe("PASS");
  });
});
