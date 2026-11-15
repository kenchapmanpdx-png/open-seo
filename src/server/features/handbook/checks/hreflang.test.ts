import { describe, expect, it } from "vitest";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import { context, ORIGIN, snapshot, statusOf } from "./check-test-fixtures";
import { hreflangCheck } from "./hreflang";

function page(path: string, alternates: [string, string][]): PageSnapshot {
  const base = snapshot(path);
  return {
    ...base,
    head: {
      ...base.head,
      hreflang: alternates.map(([lang, href]) => ({
        lang,
        href: new URL(href, ORIGIN).href,
      })),
    },
  };
}

const run = (snapshots: PageSnapshot[]) =>
  hreflangCheck.run(context({ pages: { status: "ok", snapshots } }));

const full: [string, string][] = [
  ["en", "/en/"],
  ["de", "/de/"],
  ["x-default", "/en/"],
];

describe("crawl.hreflang", () => {
  it("passes a reciprocal set with x-default", async () => {
    const result = await run([page("/en/", full), page("/de/", full)]);
    expect(statusOf(result, "P3-24")).toBe("PASS");
  });

  it("opens when an alternate does not link back", async () => {
    const result = await run([
      page("/en/", full),
      page("/de/", [
        ["de", "/de/"],
        ["x-default", "/de/"],
      ]),
    ]);
    expect(statusOf(result, "P3-24")).toBe("OPEN");
  });

  it("opens when x-default is missing", async () => {
    const pair: [string, string][] = [
      ["en", "/en/"],
      ["de", "/de/"],
    ];
    const result = await run([page("/en/", pair), page("/de/", pair)]);
    expect(statusOf(result, "P3-24")).toBe("OPEN");
  });
});
