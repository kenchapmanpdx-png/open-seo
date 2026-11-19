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
