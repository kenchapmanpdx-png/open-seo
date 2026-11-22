import { describe, expect, it } from "vitest";
import { extractHtmlFacts } from "./html-facts";

describe("extractHtmlFacts markup", () => {
  it("records headings with their landmark, scripts, head links and link targets", () => {
    const facts = extractHtmlFacts(
      `<html><head>
        <script src="/a.js" defer></script>
        <link rel="preload" href="/hero.jpg" as="image">
        <link rel="canonical" href="/">
      </head><body>
        <nav aria-label="Primary"><h2>Menu</h2><a href="https://x.test/" target="_blank">X</a></nav>
        <main><h1>Title</h1><ul><li>a</li></ul><button aria-label="Close"></button></main>
        <script>var hidden = "not text";</script>
      </body></html>`,
      "https://example.com/",
    );
    expect(facts.markup.headings).toEqual([
      { level: 2, text: "Menu", landmark: "nav" },
      { level: 1, text: "Title", landmark: null },
    ]);
    expect(facts.markup.scripts[0]).toMatchObject({
      src: "https://example.com/a.js",
      defer: true,
      inHead: true,
    });
    expect(facts.markup.headLinks).toEqual([
      {
        rel: "preload",
        href: "https://example.com/hero.jpg",
        as: "image",
        type: null,
      },
    ]);
    expect(facts.links[0]?.target).toBe("_blank");
    expect(facts.markup).toMatchObject({
      mainCount: 1,
      navLabels: ["Primary"],
      buttons: [{ text: "", ariaLabel: "Close" }],
      counts: { lists: 1 },
    });
    expect(facts.markup.text).not.toContain("not text");
  });

  it("records the doctype and http-equiv metas", () => {
    const html = `<head><meta http-equiv="Refresh" content="0;url=/b/"></head><body></body>`;
    const withDoctype = extractHtmlFacts(
      `<!DOCTYPE html>${html}`,
      "https://example.com/a",
    );
    expect(withDoctype.doctype).toBe("!DOCTYPE html");
    expect(withDoctype.head.meta["http-equiv:refresh"]).toBe("0;url=/b/");
    expect(extractHtmlFacts(html, "https://example.com/a").doctype).toBeNull();
  });

  it("collects prose paragraphs with the preceding H2, skipping landmarks, lists and quotes", () => {
    const facts = extractHtmlFacts(
      `<body><header><p>Header</p></header><main>
        <p>Intro <b>bold</b><br>line</p><h2>One</h2><p>First</p>
        <ul><li><p>Item</p></li></ul><blockquote><p>Quote</p></blockquote>
        <aside><h2>Related</h2><p>Aside</p></aside><h2>Two</h2><p>Second</p>
      </main><footer><p>Footer</p></footer></body>`,
      "https://example.com/",
    );
    expect(facts.markup.prose).toEqual([
      { h2: -1, text: "Intro bold line" },
      { h2: 0, text: "First" },
      { h2: 1, text: "Second" },
    ]);
  });
});
