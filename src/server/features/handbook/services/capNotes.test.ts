import { describe, expect, it } from "vitest";
import { capNotes } from "./capNotes";
import type { CrawlScope } from "@/server/features/handbook/contracts/exports";

const audit = (pagesCrawled: number, maxPages: number) => ({
  pagesCrawled,
  config: JSON.stringify({ maxPages, lighthouseStrategy: "auto" }),
});

// WO-B27-003 / 004: a run that stored its scope quotes one limit.
const scope = (over: Partial<CrawlScope> = {}): CrawlScope => ({
  limit: 500,
  sitemapTotal: 34,
  sitemapInScope: 34,
  leftOut: [],
  sitemapUnread: [],
  notFollowed: 0,
  variants: { sampled: 0, skipped: 0 },
  ...over,
});

describe("capNotes", () => {
  // WO-B27-001: the read mode is one info line at the top.
  it("states that the site was read with the short app name", () => {
    expect(
      capNotes({ coverageCapped: false, coverageRead: 9 }, null, {
        shortName: true,
      }),
    ).toEqual([
      "This site refuses the app's full crawler name; pages were read with the short name OpenSEO-Handbook/1.0.",
    ]);
  });

  it("names the Handbook page limit when Handbook coverage was capped", () => {
    expect(
      capNotes({ coverageCapped: true, coverageRead: 80 }, audit(30, 500)),
    ).toEqual([
      "Handbook stopped at its page or time limit: 80 pages read; results are incomplete.",
    ]);
  });

  it("names the site audit limit when the audit crawled its maxPages", () => {
    expect(
      capNotes({ coverageCapped: false, coverageRead: 80 }, audit(50, 50)),
    ).toEqual([
      "Site audit stopped at its 50-page limit (Handbook read 80 pages).",
    ]);
  });

  it("states the sections the user left out", () => {
    const scoped = {
      pagesCrawled: 10,
      config: JSON.stringify({
        maxPages: 500,
        lighthouseStrategy: "auto",
        excludePaths: ["/blog/", "/tag/"],
      }),
    };
    expect(
      capNotes({ coverageCapped: false, coverageRead: 10 }, scoped),
    ).toEqual(["Sections left out: /blog/, /tag/."]);
  });

  it("adds no note when neither limit was reached or there is no audit", () => {
    expect(
      capNotes({ coverageCapped: false, coverageRead: 40 }, audit(40, 500)),
    ).toEqual([]);
    expect(capNotes({ coverageCapped: false, coverageRead: 40 }, null)).toEqual(
      [],
    );
  });

  it("a small site read whole gets no scope note", () => {
    expect(
      capNotes({ coverageCapped: false, coverageRead: 34 }, audit(34, 500), {
        scope: scope(),
      }),
    ).toEqual([]);
  });

  it("a hit limit states the leave-outs, the unread sitemap pages and the basis", () => {
    const notes = capNotes(
      { coverageCapped: true, coverageRead: 501 },
      audit(500, 500),
      {
        scope: scope({
          sitemapTotal: 612,
          sitemapInScope: 481,
          leftOut: [{ section: "/blogs/", count: 131 }],
          sitemapUnread: [
            { section: "/pages/", urls: ["https://s.test/pages/a"] },
          ],
          notFollowed: 7,
          variants: { sampled: 1, skipped: 56 },
        }),
      },
    );
    expect(notes).toEqual([
      "Scope: 481 of 612 sitemap pages; left out /blogs/ (131); page limit 500.",
      "Page limit 500 reached: 501 pages read; 1 in-scope sitemap pages not read (/pages/ 1); 7 discovered URLs not followed; 56 parameter variants of known pages skipped (1 read as samples, not counted).",
      "Site-wide findings are based on 480 of 481 in-scope sitemap pages.",
    ]);
  });
});
