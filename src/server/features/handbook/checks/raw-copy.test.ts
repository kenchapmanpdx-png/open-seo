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

  it("passes P5-16 on a contact page with a mailto link", async () => {
    const result = await run([
      page("/contact", "Write to us", [
        { href: "mailto:hi@example.com", text: "hi@example.com" },
      ]),
    ]);
    expect(statusOf(result, "P5-16")).toBe("PASS");
  });
});
