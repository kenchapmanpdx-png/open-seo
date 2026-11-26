import { describe, expect, it } from "vitest";
import { mainTextFacts, similarPairs } from "./minhash";

const vocab = Array.from({ length: 400 }, (_, i) => `word${i}`);
const body = (from: number, count: number) =>
  `<main><p>${vocab.slice(from, from + count).join(" ")}</p></main>`;

describe("minhash", () => {
  it("scores identical main text 1.0 and ignores nav/footer", () => {
    const a = mainTextFacts(`<nav>Home About</nav>${body(0, 300)}`);
    const b = mainTextFacts(`${body(0, 300)}<footer>© Other footer</footer>`);
    expect(a.minhash).toEqual(b.minhash);
    expect(similarPairs([a.minhash, b.minhash], 0.8)).toEqual([
      { a: 0, b: 1, jaccard: 1 },
    ]);
  });

  it("estimates ~80 % shingle overlap at ≥ 0.75 and keeps unrelated pages apart", () => {
    // 300 words shifted by 30: Jaccard of 5-word shingles ≈ 266 / 326 = 0.82.
    const sigs = [body(0, 300), body(30, 300), body(100, 300)].map(
      (html) => mainTextFacts(html).minhash,
    );
    const pairs = similarPairs(sigs, 0.75);
    expect(pairs.map(({ a, b }) => [a, b])).toEqual([[0, 1]]);
  });

  it("finds repeated blocks inside one page", () => {
    const slogan =
      "<h2>Give your business a boost with fast simple funding</h2>";
    const facts = mainTextFacts(
      `<main>${slogan.repeat(4)}<p>Short line</p></main>`,
    );
    expect(facts.duplicateBlocks).toEqual([
      { text: "Give your business a boost with fast simple funding", count: 4 },
    ]);
  });

  describe("hidden layout copies (WO-B25-007)", () => {
    const copy =
      "We partner with select companies such as Owens Corning GAF and CertainTeed to install";
    // bluebonnetroofs.com (Showit): one copy per layout, hidden by page rules.
    const showit = `<style>.d .sie-a {left:1px;} .m .sie-a {display:none;} .d .sie-b {display:none;} .m .sie-b {top:2px;}</style>
      <div class="d"><div class="sie-a se"><p>${copy}</p></div><div class="sie-b se"><p>${copy}</p></div></div>`;

    it("does not count a copy each layout hides once (Showit .d / .m)", () => {
      expect(mainTextFacts(showit).duplicateBlocks).toEqual([]);
    });

    it("does not count an aria-hidden marquee copy (valentinecoffeeco.com)", () => {
      const facts = mainTextFacts(
        `<main><div class="marquee__content"><p>${copy}</p></div><div aria-hidden="true" class="marquee__content"><p>${copy}</p></div></main>`,
      );
      expect(facts.duplicateBlocks).toEqual([]);
    });

    it("keeps mainWords and the minhash", () => {
      const plain = `<div><p>${copy}</p><p>${copy}</p></div>`;
      expect(mainTextFacts(showit).mainWords).toBe(
        mainTextFacts(plain).mainWords,
      );
      expect(mainTextFacts(showit).minhash).toEqual(
        mainTextFacts(plain).minhash,
      );
    });

    it("still counts copies visible in the same layout (tinycat, aircor blog meta)", () => {
      // A rule that hides neither copy, and a lone descendant rule that is
      // not a layout family (`.menu .x`), leave both copies counted.
      const facts = mainTextFacts(
        `<style>.blog-meta-secondary {color:red} .menu .sie-a {display:none}</style><div class="sie-a"><p>${copy}</p></div><div class="blog-meta-secondary"><p>${copy}</p></div>`,
      );
      expect(facts.duplicateBlocks).toEqual([{ text: copy, count: 2 }]);
    });

    it("hides per @media layout when two queries hide one copy each", () => {
      const facts = mainTextFacts(
        `<style>@media (max-width: 600px) { .desk {display:none} } @media (min-width: 601px) { .mob { display: none; } }</style><div class="desk"><p>${copy}</p></div><div class="mob"><p>${copy}</p></div>`,
      );
      expect(facts.duplicateBlocks).toEqual([]);
    });
  });

  it("handles 1000 pages in under 2 s", () => {
    const start = performance.now();
    const sigs = Array.from(
      { length: 1000 },
      (_, i) => mainTextFacts(body(i % 100, 300)).minhash,
    );
    similarPairs(sigs, 0.8);
    expect(performance.now() - start).toBeLessThan(2000);
  });
});
