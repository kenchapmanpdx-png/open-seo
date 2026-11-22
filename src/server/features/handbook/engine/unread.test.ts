import { describe, expect, it } from "vitest";
import { unreadCoverage } from "./unread";

const o = "https://salon.test";

describe("unreadCoverage", () => {
  it("lists crawled URLs the run did not read, one class each", () => {
    const result = unreadCoverage(
      [
        { url: `${o}/`, status: 200 },
        { url: `${o}/about`, status: 301, redirectUrl: `${o}/about-us/` },
        { url: `${o}/?page_id=16404`, status: 301, redirectUrl: null },
        { url: `${o}/gone/`, status: 404 },
        { url: `${o}/award.pdf`, status: 200 },
        { url: `${o}/?attachment_id=9`, status: 200 },
        { url: `${o}/team/`, status: 200 },
        // Read via a redirect: the snapshot's finalUrl counts as read.
        { url: `${o}/services`, status: 200 },
      ],
      [
        { url: `${o}/`, finalUrl: `${o}/` },
        { url: `${o}/old-services`, finalUrl: `${o}/services/` },
      ],
    );
    expect(result.total).toBe(6);
    expect(result.byClass).toEqual({
      redirect: 2,
      "404": 1,
      "non-HTML": 1,
      attachment: 1,
      unseen: 1,
    });
    expect(result.rows.map((r) => [r.class, r.url])).toEqual([
      ["unseen", `${o}/team/`],
      ["404", `${o}/gone/`],
      ["redirect", `${o}/?page_id=16404`],
      ["redirect", `${o}/about`],
      ["attachment", `${o}/?attachment_id=9`],
      ["non-HTML", `${o}/award.pdf`],
    ]);
    expect(result.rows.find((r) => r.url === `${o}/about`)?.target).toBe(
      `${o}/about-us/`,
    );
  });
});
