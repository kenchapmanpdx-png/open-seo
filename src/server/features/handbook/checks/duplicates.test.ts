import { describe, expect, it } from "vitest";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import { mainTextFacts } from "@/server/features/handbook/engine/minhash";
import { context, snapshot } from "./check-test-fixtures";
import { duplicatesCheck } from "./duplicates";

const body = (seed: string, n: number) =>
  `<main><p>${Array.from({ length: n }, (_, i) => `${seed}${i}`).join(" ")}</p></main>`;

const page = (
  path: string,
  html: string,
  overrides: Parameters<typeof snapshot>[1] = {},
): PageSnapshot => ({ ...snapshot(path, overrides), ...mainTextFacts(html) });

const run = async (snapshots: PageSnapshot[]) => {
  const result = await duplicatesCheck.run(
    context({ pages: { status: "ok", snapshots } }),
  );
  return result.findings.map((f) => ({ title: f.title, urls: f.urls }));
};

describe("crawl.duplicates", () => {
  it("clusters near-duplicate pages but skips a copy canonicalised away", async () => {
    const twin = body("word", 300);
    const findings = await run([
      page("/a", twin),
      page("/b", twin),
      page("/copy", twin, { canonical: "/a" }),
      page("/other", body("other", 300)),
    ]);
    expect(findings).toHaveLength(1);
    expect(findings[0].title).toContain("Near-duplicate");
    expect(findings[0].urls).toEqual([
      "https://example.com/a",
      "https://example.com/b",
    ]);
  });

  it("flags indexable pages under 50 main words as thin, not noindex ones", async () => {
    const findings = await run([
      page("/full", body("full", 80)),
      page("/thin", body("thin", 30)),
      page("/search", body("search", 10), { robotsMeta: "noindex" }),
    ]);
    expect(findings).toHaveLength(1);
    expect(findings[0].title).toContain("Thin pages");
    expect(findings[0].urls).toEqual(["https://example.com/thin"]);
  });
});
