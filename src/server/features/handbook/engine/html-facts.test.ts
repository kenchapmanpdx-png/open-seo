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
});
