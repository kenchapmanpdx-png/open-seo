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

  // WO-B23-004: x-default is recommended, not required → its own S4 finding.
  it("reports a missing x-default alone as S4, not as an incomplete set", async () => {
    const pair: [string, string][] = [
      ["en", "/en/"],
      ["de", "/de/"],
    ];
    const result = await run([page("/en/", pair), page("/de/", pair)]);
    expect(result.findings.map((f) => [f.severity, f.title])).toEqual([
      ["S4", "Hreflang set has no x-default fallback"],
    ]);
  });

  it("states how many alternates were checked, and is LIMITED when none were crawled", async () => {
    const result = await run([page("/en/", full), page("/de/", full)]);
    expect(result.statuses.find((s) => s.itemId === "P3-24")?.note).toMatch(
      /^2\/2 alternates checked/,
    );
    const offsite: [string, string][] = [
      ["en", "/en/"],
      ["fr", "https://example.fr/"],
      ["x-default", "/en/"],
    ];
    const limited = await run([page("/en/", offsite)]);
    const verdict = limited.statuses.find((s) => s.itemId === "P3-24");
    expect(verdict?.status).toBe("LIMITED");
    expect(verdict?.note).toContain("alternates outside the crawl");
  });
});
