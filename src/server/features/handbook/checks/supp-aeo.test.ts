import { describe, expect, it } from "vitest";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import { extractHtmlFacts } from "../engine/html-facts";
import { context, ORIGIN, snapshot } from "./check-test-fixtures";
import { suppAeoCheck } from "./supp-aeo";

const flagged = async (item: string, snapshots: PageSnapshot[]) =>
  (
    await suppAeoCheck.run(context({ pages: { status: "ok", snapshots } }))
  ).findings
    .filter((f) => f.itemIds.includes(item))
    .flatMap((f) => f.urls);

const withRobots = (path: string, robotsMeta: string) =>
  snapshot(path, { robotsMeta });

/** Snapshot whose markup comes from parsing `body` (raw-HTML path). */
function fromHtml(path: string, body: string): PageSnapshot {
  const base = snapshot(path);
  const facts = extractHtmlFacts(`<html><body>${body}</body></html>`, base.url);
  return { ...base, wordsRaw: facts.words, markup: facts.markup };
}

describe("crawl.supp-aeo", () => {
  it("flags max-snippet below 160 characters only", async () => {
    expect(
      await flagged("SUPP-13", [
        withRobots("/a", "max-snippet:-1"),
        withRobots("/b", "index, max-snippet:159"),
        withRobots("/c", "max-snippet:160"),
      ]),
    ).toEqual([`${ORIGIN}/b`]);
  });

  it("flags a UA-specific nosnippet in X-Robots-Tag", async () => {
    const page = { ...snapshot("/x"), xRobotsTag: "googlebot: nosnippet" };
    expect(await flagged("SUPP-13", [page])).toEqual([`${ORIGIN}/x`]);
  });

  it("flags data-nosnippet around the first answer paragraph, not a later one", async () => {
    const answer = `<p>${"Entry closes on Friday at noon for every race. ".repeat(2)}</p>`;
    const filler = `<p>${"More detail about the course and the rules. ".repeat(12)}</p>`;
    const nav = "<nav><p>Home · Events · Results · Contact</p></nav>";
    const first = fromHtml(
      "/first",
      `${nav}<div data-nosnippet>${answer}</div>${filler}`,
    );
    const later = fromHtml(
      "/later",
      `${nav}${answer}<div data-nosnippet>${filler.slice(0, 120)}</p></div>${filler}`,
    );
    expect(await flagged("SUPP-13", [first, later])).toEqual([
      `${ORIGIN}/first`,
    ]);
  });

  it("flags three list-like lines outside list markup, not two", async () => {
    const three = fromHtml(
      "/three",
      "<p>• Bring water<br>• Wear the bib<br>• Check in by 8</p>",
    );
    const two = fromHtml("/two", "<p>• Bring water<br>• Wear the bib</p>");
    expect(await flagged("SUPP-14", [three, two])).toEqual([`${ORIGIN}/three`]);
  });
});
