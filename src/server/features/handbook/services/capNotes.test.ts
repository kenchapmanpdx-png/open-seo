import { describe, expect, it } from "vitest";
import { capNotes } from "./capNotes";

const audit = (pagesCrawled: number, maxPages: number) => ({
  pagesCrawled,
  config: JSON.stringify({ maxPages, lighthouseStrategy: "auto" }),
});

describe("capNotes", () => {
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
});
