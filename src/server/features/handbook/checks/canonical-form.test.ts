import { describe, expect, it } from "vitest";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import { canonicalFormCheck } from "./canonical-form";
import { context, snapshot, statusOf, textPage } from "./check-test-fixtures";

const run = (snapshots: PageSnapshot[]) =>
  canonicalFormCheck.run(context({ pages: { status: "ok", snapshots } }));

describe("crawl.canonical-form", () => {
  it("passes a self-canonical site whose links use the canonical form", async () => {
    const result = await run([
      snapshot("/", { links: ["/about/"] }),
      snapshot("/about/", { links: ["/"] }),
    ]);
    expect(statusOf(result, "P3-04")).toBe("PASS");
  });

  it("opens when a link drops the canonical trailing slash", async () => {
    const result = await run([
      snapshot("/", { links: ["/about"] }),
      snapshot("/about/"),
    ]);
    expect(result.findings.map((f) => f.title)).toEqual([
      "Internal links use a non-canonical URL form",
    ]);
  });

  it("opens on a tracking parameter in the canonical", async () => {
    const result = await run([snapshot("/", { canonical: "/?utm_source=x" })]);
    expect(result.findings.map((f) => f.title)).toContain(
      "Canonical URLs carry tracking parameters",
    );
  });

  // WO-B19-005: decide by content, never by parameter name (§10: page 2+ must stay self-canonical).
  it("accepts a canonicalised duplicate but not page 2 canonical to page 1", async () => {
    const shop = (path: string, text: string, canonical: string) => ({
      ...textPage(path, text),
      head: { ...snapshot(path, { canonical }).head },
    });
    const result = await run([
      { ...shop("/shop", "Ten coffees.", "/shop"), links: [] },
      {
        ...shop("/", "Home.", "/"),
        links: snapshot("/", { links: ["/shop?page=1"] }).links,
      },
      shop("/shop?page=1", "Ten coffees.", "/shop"),
      shop("/shop?page=2", "Ten more coffees.", "/shop"),
      shop("/tag/hvac%20service", "Tagged.", "/tag/hvac+service"),
    ]);
    const byTitle = Object.fromEntries(
      result.findings.map((f) => [f.title, [f.severity, ...f.urls]]),
    );
    // A link to a correctly canonicalised duplicate is not a canonical error (§17 S1).
    expect(byTitle).toEqual({
      "Indexable pages are not self-canonical": [
        "S1",
        "https://example.com/shop?page=2",
      ],
      "Internal links point at a canonicalised duplicate": [
        "S3",
        "https://example.com/",
      ],
    });
    // The runner rejects a below-default severity that has no reason.
    expect(
      result.findings.every((f) => f.severity === "S1" || f.severityReason),
    ).toBe(true);
  });

  it("keeps a tracking-parameter canonical out of the duplicate rule and ignores self links", async () => {
    const result = await run([
      snapshot("/", { links: ["/promo"] }),
      snapshot("/promo", {
        canonical: "/promo?utm_source=x",
        links: ["/promo"],
      }),
    ]);
    expect(result.findings.map((f) => f.title)).toEqual([
      "Indexable pages are not self-canonical",
      "Canonical URLs carry tracking parameters",
    ]);
  });
});
