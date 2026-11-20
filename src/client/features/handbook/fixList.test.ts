import { describe, expect, it } from "vitest";
import Papa from "papaparse";
import {
  buildFixGroups,
  fixListCsv,
  loadDone,
  saveDone,
  type Finding,
} from "./fixList";

const finding = (over: Partial<Finding>): Finding => ({
  code: "F01",
  severity: "S2",
  phase: "P1",
  sectionRef: "§1",
  title: "Title",
  detail: "",
  fix: "Fix it",
  fixability: "FIXABLE",
  limitedReason: null,
  effort: "S",
  source: "deterministic",
  itemIds: [],
  urls: [],
  evidence: [],
  categories: ["SEO"],
  ...over,
});

const codes = (groups: ReturnType<typeof buildFixGroups>) =>
  Object.fromEntries(groups.map((g) => [g.key, g.findings.map((f) => f.code)]));

const urls = (n: number) =>
  Array.from({ length: n }, (_, i) => `https://a.test/${i}`);

describe("buildFixGroups", () => {
  it("groups by severity and orders deterministic, then most pages, done last", () => {
    const findings = [
      finding({ code: "F01", severity: "S1", urls: urls(1) }),
      finding({ code: "F02", severity: "S1", urls: urls(9), source: "llm" }),
      finding({ code: "F03", severity: "S1", urls: urls(3) }),
      finding({ code: "F04", severity: "S1", urls: urls(5) }),
      finding({ code: "F05", severity: "S3" }),
      finding({ code: "F06", severity: "S4" }),
    ];
    expect(codes(buildFixGroups(findings, "all", new Set(["F04"])))).toEqual({
      must: ["F03", "F01", "F02", "F04"],
      should: [],
      nice: ["F05", "F06"],
    });
  });

  it("keeps only findings tagged with the chosen category", () => {
    const findings = [
      finding({ code: "F01", categories: ["SEO", "AEO"] }),
      finding({ code: "F02", categories: ["GEO"] }),
      finding({ code: "F03", categories: undefined }),
    ];
    expect(codes(buildFixGroups(findings, "AEO", new Set())).should).toEqual([
      "F01",
    ]);
  });
});

describe("fixListCsv", () => {
  it("writes the spec columns and escapes commas, quotes and newlines", () => {
    const csv = fixListCsv([
      finding({
        severity: "S1",
        categories: ["SEO", "GEO"],
        title: 'Say "hi", world',
        fix: "Line one\nline two",
        urls: urls(60),
      }),
    ]);
    const [header, row] = Papa.parse<string[]>(csv).data;
    expect(header).toEqual([
      "priority",
      "categories",
      "title",
      "how_to_fix",
      "pages_count",
      "pages",
    ]);
    expect(row.slice(0, 5)).toEqual([
      "Must fix",
      "SEO GEO",
      'Say "hi", world',
      "Line one\nline two",
      "60",
    ]);
    expect(row[5].split(" ")).toHaveLength(50);
  });
});

describe("done state", () => {
  it("round-trips through storage and ignores storage failures", () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    };
    saveDone("r1", new Set(["F02"]), storage);
    expect(data.has("fork:fix-done:r1")).toBe(true);
    expect([...loadDone("r1", storage)]).toEqual(["F02"]);

    const broken = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    expect(() => saveDone("r1", new Set(["F01"]), broken)).not.toThrow();
    expect(loadDone("r1", broken).size).toBe(0);
  });
});
