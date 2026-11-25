import { describe, expect, it } from "vitest";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import { canonicalFormCheck } from "./canonical-form";
import { context, snapshot, statusOf, textPage } from "./check-test-fixtures";

const run = (snapshots: PageSnapshot[]) =>
  canonicalFormCheck.run(context({ pages: { status: "ok", snapshots } }));
const graded = (r: Awaited<ReturnType<typeof run>>) =>
  r.findings.map((f) => [f.severity, f.title, ...f.urls]);

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

  // WO-B20-009 (theogdenver.com /menus): one 301 to the canonical is S3; a 302 stays S1.
  it("grades link forms by what the linked form answers", async () => {
    const redirected = (path: string, status: number) => ({
      ...snapshot(path),
      finalUrl: `https://example.com${path}/`,
      redirectChain: [{ url: `https://example.com${path}`, status }],
    });
    const result = await run([
      snapshot("/", { links: ["/menus", "/events"] }),
      snapshot("/menus/"),
      snapshot("/events/"),
      redirected("/menus", 301),
      redirected("/events", 302),
    ]);
    expect(result.findings.map((f) => [f.severity, f.title, f.detail])).toEqual(
      [
        [
          "S1",
          "Internal links use a non-canonical URL form",
          "https://example.com/ — https://example.com/events → https://example.com/events/",
        ],
        [
          "S3",
          "Internal links use a non-canonical URL form (one permanent redirect)",
          "https://example.com/ — https://example.com/menus → https://example.com/menus/",
        ],
      ],
    );
  });

  // WO-B23-001: canonicals are recommended, not required (Google picks one itself) → S3, no cap.
  it("grades a missing canonical S3 and a canonical to another page S1", async () => {
    const result = await run([
      snapshot("/", { canonical: null, links: ["/about/", "/team/"] }),
      snapshot("/about/", { canonical: null, links: ["/"] }),
      snapshot("/team/", { canonical: "/" }),
    ]);
    expect(graded(result)).toEqual([
      [
        "S3",
        "Indexable pages without a canonical",
        "https://example.com/",
        "https://example.com/about/",
      ],
      [
        "S1",
        "Indexable pages are not self-canonical",
        "https://example.com/team/",
      ],
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
      "Paginated pages canonical to page 1": [
        "S3",
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

  // Field test 7 (theogdenver.com /press/?p=2…6 → /press/): §11 forbids it because content
  // linked only from page 2+ is orphaned. S1 only when that happens; else S3 with the reason.
  it("grades page 2 canonical to page 1 by what only page 2 links", async () => {
    const press = (path: string, text: string, links: string[]) => ({
      ...snapshot(path, { canonical: "/press/", links }),
      markup: textPage(path, text).markup,
    });
    const offsite = await run([
      snapshot("/", { links: ["/press/"] }),
      press("/press/", "New press.", [
        "/press/?p=2",
        "https://news.example.org/a",
      ]),
      press("/press/?p=2", "Old press.", [
        "/press/?p=1",
        "https://news.example.org/b",
      ]),
      // theogdenver r3: ?p=1 is the series' own page 1 (a canonicalised duplicate), not orphaned content.
      press("/press/?p=1", "New press.", []),
    ]);
    const orphaning = await run([
      snapshot("/", { links: ["/press/"] }),
      press("/press/", "New press.", ["/press/?p=2"]),
      press("/press/?p=2", "Old press.", ["/press/", "/press/old-story/"]),
      snapshot("/press/old-story/"),
    ]);
    expect(graded(offsite)).toEqual([
      [
        "S3",
        "Paginated pages canonical to page 1",
        "https://example.com/press/?p=2",
      ],
      [
        "S3",
        "Internal links point at a canonicalised duplicate",
        "https://example.com/press/?p=2",
      ],
    ]);
    expect(graded(orphaning)).toEqual([
      [
        "S1",
        "Paginated pages canonical to page 1",
        "https://example.com/press/?p=2",
      ],
    ]);
    expect(orphaning.findings[0]?.detail).toContain(
      "https://example.com/press/old-story/",
    );
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
