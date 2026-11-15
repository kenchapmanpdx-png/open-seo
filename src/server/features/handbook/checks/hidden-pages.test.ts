import { describe, expect, it } from "vitest";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import { context, snapshot, statusOf } from "./check-test-fixtures";
import { hiddenPagesCheck } from "./hidden-pages";

const run = (snapshots: PageSnapshot[], disallow: string[] = []) =>
  hiddenPagesCheck.run(
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

describe("robots.hidden-pages", () => {
  it("opens P3-14 when a page is noindex and Disallowed", async () => {
    const result = await run(
      [snapshot("/"), snapshot("/hidden", { robotsMeta: "noindex" })],
      ["/hidden"],
    );
    expect(statusOf(result, "P3-14")).toBe("OPEN");
  });

  it("opens P3-16 when an admin path is linked from a public page", async () => {
    const result = await run(
      [snapshot("/", { links: ["/admin/"] })],
      ["/admin/"],
    );
    expect(statusOf(result, "P3-16")).toBe("OPEN");
  });

  it("passes P3-14 for an unlinked noindex-only page", async () => {
    const result = await run([
      snapshot("/"),
      snapshot("/hidden", { robotsMeta: "noindex" }),
    ]);
    expect(statusOf(result, "P3-14")).toBe("PASS");
  });
});
