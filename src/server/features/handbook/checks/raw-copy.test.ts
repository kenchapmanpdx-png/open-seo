import { describe, expect, it } from "vitest";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import { extractHtmlFacts } from "@/server/features/handbook/engine/html-facts";
import { context, ORIGIN, snapshot, statusOf } from "./check-test-fixtures";
import { rawCopyCheck } from "./raw-copy";

function page(
  path: string,
  text: string,
  links: { href: string; text: string }[] = [],
): PageSnapshot {
  const base = snapshot(path);
  return {
    ...base,
    links: links.map((l) => ({
      ...l,
      rel: null,
      target: null,
      ariaLabel: null,
    })),
    markup: { ...base.markup, text },
  };
}

const run = (snapshots: PageSnapshot[]) =>
  rawCopyCheck.run(context({ pages: { status: "ok", snapshots } }));

const titles = async (r: ReturnType<typeof run>) =>
  (await r).findings
    .filter((f) => f.itemIds.includes("P5-08"))
    .map((f) => f.title);

describe("crawl.raw-copy", () => {
  it("opens P2-04 on loading copy in server text", async () => {
    const result = await run([
      page("/", "Upcoming races. Loading events… please"),
    ]);
    expect(statusOf(result, "P2-04")).toBe("OPEN");
  });

  it("ignores error copy in a hidden state template (Shopify search drawer)", async () => {
    const html =
      '<main><p>Fresh roasts every week.</p><div class="search__message hidden"><p data-text>Something went wrong. Please try again!</p></div></main>';
    const base = snapshot("/");
    const markup = extractHtmlFacts(html, `${ORIGIN}/`).markup;
    const result = await run([
      { ...base, markup: { ...base.markup, ...markup } },
    ]);
    expect(statusOf(result, "P2-04")).toBe("PASS");
  });

  it("opens P5-08 on one number shown in two formats", async () => {
    const result = await run([
      page("/", "Call us", [
        { href: "tel:+15551234567", text: "(555) 123-4567" },
      ]),
      page("/a", "Call us", [
        { href: "tel:+1-555-123-4567", text: "555.123.4567" },
      ]),
    ]);
    expect(statusOf(result, "P5-08")).toBe("OPEN");
  });

  it("opens P5-08 on one number in two tel: href formats", async () => {
    const result = await run([
      page("/", "Call us", [
        { href: "tel:+14805550100", text: "Call now" },
        { href: "tel:4805550100", text: "Call now" },
      ]),
    ]);
    expect(statusOf(result, "P5-08")).toBe("OPEN");
  });

  describe("phone part of P5-08 (WO-B25-009)", () => {
    const pages = (hrefs: string[]) =>
      hrefs.map((href, i) =>
        page(`/p${i}`, "Call us", [
          { href, text: ["(360) 574-7292", "360.574.7292"][i % 2] },
        ]),
      );
    const local = (snapshots: PageSnapshot[]) =>
      rawCopyCheck.run({
        ...context({ pages: { status: "ok", snapshots } }),
        siteProfile: [
          { code: "SP7", value: "Y", evidence: "test", confidence: "high" },
        ],
      });

    it("does not count link text: one tel: format is consistent (nwpersonaltraining.com)", async () => {
      expect(
        await titles(run(pages(["tel:3605747292", "tel:3605747292"]))),
      ).toEqual([]);
    });

    it("keeps several tel: href formats open, listing hrefs only (mobilepetgroomingaz.com)", async () => {
      const result = await run(
        pages([
          "tel:16026220510",
          "tel:1-602-622-0510",
          "tel:6026220510",
          "tel:602-622-0510",
        ]),
      );
      const finding = result.findings.find((f) => f.itemIds.includes("P5-08"));
      expect(finding?.title).toBe(
        "NAP facts inconsistent or missing from server HTML",
      );
      expect(finding?.detail).not.toContain("text ");
    });

    it("opens the E.164 rule on SP7 sites only", async () => {
      const one = pages(["tel:3605747292", "tel:3605747292"]);
      expect(await titles(local(one))).toEqual([
        "Phone links are not in E.164 form (tel:+1…)",
      ]);
      expect(await titles(run(one))).toEqual([]);
      expect(
        await titles(local(pages(["tel:+13605747292", "tel:+13605747292"]))),
      ).toEqual([]);
    });
  });

  it("passes P5-16 on a contact page with a mailto link", async () => {
    const result = await run([
      page("/contact", "Write to us", [
        { href: "mailto:hi@example.com", text: "hi@example.com" },
      ]),
    ]);
    expect(statusOf(result, "P5-16")).toBe("PASS");
  });
});
