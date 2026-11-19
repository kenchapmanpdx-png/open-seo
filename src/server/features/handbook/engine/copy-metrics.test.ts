import { describe, expect, it } from "vitest";
import { COPY_METRIC_IDS, type CopyMetricId } from "../contracts/scaled-copy";
import { measureProse, proseWords, type Paragraph } from "./copy-metrics";

const p = (text: string, h2 = -1): Paragraph => ({ h2, text });
const filler = (n: number) => Array.from({ length: n }, () => "word").join(" ");
const sentence = (n: number) => `Word ${filler(n - 2)} end.`;

function metric(prose: Paragraph[], id: CopyMetricId) {
  const found = measureProse(prose).find((m) => m.id === id);
  if (!found) throw new Error(`missing ${id}`);
  return { value: found.value, over: found.over };
}

describe("copy metrics", () => {
  it("returns all 17 ids in report order; number-only metrics never flag", () => {
    const metrics = measureProse([p(filler(50))]);
    expect(metrics.map((m) => m.id)).toEqual([...COPY_METRIC_IDS]);
    for (const m of metrics.filter((x) => x.threshold === null)) {
      expect(m.over).toBe(false);
    }
  });

  it("E7a counts framing phrases", () => {
    expect(metric([p("Why the price matters to us.")], "E7a")).toEqual({
      value: 1,
      over: true,
    });
    expect(metric([p(filler(20))], "E7a").over).toBe(false);
  });

  it("E7b flags one phrase above 1 per 500 words", () => {
    expect(metric([p(`It is not just fast ${filler(95)}`)], "E7b")).toEqual({
      value: 5,
      over: true,
    });
    expect(metric([p(`not just ${filler(998)}`)], "E7b").over).toBe(false);
  });

  it("E9 rates three-item lists per 500 words", () => {
    const list = "We sell apples, pears, and plums.";
    expect(metric([p(`${list} ${filler(44)}`)], "E9")).toEqual({
      value: 10,
      over: true,
    });
    expect(metric([p(`${list} ${filler(594)}`)], "E9").over).toBe(false);
  });

  it("E13 takes the lowest sentence-length SD over 300-word windows", () => {
    const even = Array.from({ length: 20 }, () => sentence(16)).join(" ");
    expect(metric([p(even)], "E13")).toEqual({ value: 0, over: true });
    const varied = Array.from(
      { length: 12 },
      () => `${sentence(4)} ${sentence(28)}`,
    ).join(" ");
    expect(metric([p(varied)], "E13")).toEqual({ value: 11.98, over: false });
    expect(metric([p(sentence(299))], "E13")).toEqual({
      value: null,
      over: false,
    });
  });

  it("E6a counts numbers and proper nouns per 150 words", () => {
    expect(metric([p(filler(150))], "E6a")).toEqual({ value: 0, over: true });
    expect(
      metric([p(`In 2024 we hired Acme for ${filler(145)}`)], "E6a"),
    ).toEqual({ value: 2, over: false });
  });

  it("E6b needs a specific detail in every H2 section of 50+ words", () => {
    const prose = [
      p(`Since 2019 ${filler(60)}`, 0),
      p(filler(60), 1),
      p(filler(10), 2),
    ];
    expect(metric(prose, "E6b")).toEqual({ value: 0.5, over: true });
    expect(metric([p(filler(60), -1)], "E6b")).toEqual({
      value: null,
      over: false,
    });
  });

  it("E17 checks the last paragraph for a number or proper noun", () => {
    expect(
      metric([p("Call 555 0100."), p("Thanks for reading.")], "E17"),
    ).toEqual({ value: 0, over: true });
    expect(metric([p("Thanks for reading Acme.")], "E17").over).toBe(false);
  });

  it("E19 counts wondering phrases and a Here's opener", () => {
    expect(
      metric([p("Here's the plan. You might be wondering why.")], "E19"),
    ).toEqual({ value: 2, over: true });
    expect(metric([p("The plan is simple.")], "E19").over).toBe(false);
  });

  it("E16 counts markdown left in visible text", () => {
    expect(
      metric([p("## Intro **bold** and [docs](https://x.test)")], "E16"),
    ).toEqual({ value: 3, over: true });
    expect(metric([p("Plain text.")], "E16").over).toBe(false);
  });

  it("E4 flags mean word length above 5.0", () => {
    expect(metric([p("internationalization communication")], "E4").over).toBe(
      true,
    );
    expect(metric([p("the cat sat")], "E4")).toEqual({ value: 3, over: false });
  });

  it("E5 reports the share of 10+ character words, number only", () => {
    expect(metric([p("internationalization cat")], "E5")).toEqual({
      value: 0.5,
      over: false,
    });
  });

  it("E8 counts listed intensifiers", () => {
    expect(metric([p("This is Crucial and highly useful.")], "E8")).toEqual({
      value: 2,
      over: true,
    });
    expect(metric([p("This is useful.")], "E8").over).toBe(false);
  });

  it("HB5 counts hype verbs in the first 200 words only", () => {
    expect(metric([p(`Leveraging data ${filler(10)}`)], "HB5")).toEqual({
      value: 1,
      over: true,
    });
    expect(metric([p(`${filler(200)} unlock harnesses`)], "HB5").over).toBe(
      false,
    );
  });

  it("E11 takes the highest connector rate per 1,000 words", () => {
    expect(
      metric([p(`However, on the other hand ${filler(95)}`)], "E11"),
    ).toEqual({ value: 10, over: true });
    expect(metric([p(`However ${filler(999)}`)], "E11").over).toBe(false);
  });

  it("E10 reports hedges per 1,000 words, number only", () => {
    expect(metric([p(`may might could ${filler(997)}`)], "E10")).toEqual({
      value: 3,
      over: false,
    });
  });

  it("E15 reports paragraphs per 500 words, number only", () => {
    expect(metric([p(filler(50)), p(filler(50))], "E15")).toEqual({
      value: 10,
      over: false,
    });
  });

  it("E12 flags more than 3 em dashes per 1,000 words", () => {
    expect(metric([p(`one — two ${filler(98)}`)], "E12")).toEqual({
      value: 10,
      over: true,
    });
    expect(metric([p(`one - two ${filler(98)}`)], "E12").over).toBe(false);
  });
});

describe("copy metric tokens", () => {
  it("counts inner apostrophes and hyphens as one word and skips numbers", () => {
    expect(proseWords([p("It’s a well-known fact: 42 cats.")])).toBe(5);
  });

  it("does not split sentences after listed abbreviations", () => {
    // Dr. keeps Smith mid-sentence: 2 proper nouns in 3 words.
    expect(metric([p("Ask Dr. Smith.")], "E6a").value).toBe(100);
    // A real stop makes Smith a sentence start: 1 proper noun in 5 words.
    expect(metric([p("Ask Bob. Smith said no.")], "E6a").value).toBe(30);
  });

  it("does not treat I or its contractions as proper nouns", () => {
    expect(metric([p("Then I’m sure I know.")], "E6a").value).toBe(0);
  });
});
