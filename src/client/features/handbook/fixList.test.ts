import { describe, expect, it } from "vitest";
import Papa from "papaparse";
import {
  blockedCauses,
  buildFixGroups,
  fixListCsv,
  loadDone,
  newerCompletedRun,
  notFinalNote,
  saveDone,
  topFixes,
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

describe("topFixes", () => {
  it("lists at most 5 open fixes, Must before Should, no Nice to have", () => {
    const findings = [
      finding({ code: "S2a", severity: "S2", title: "S2a" }),
      finding({ code: "S2b", severity: "S2", title: "S2b" }),
      finding({ code: "S2c", severity: "S2", title: "S2c" }),
      finding({ code: "S3a", severity: "S3", title: "S3a" }),
      finding({ code: "S1a", severity: "S1", title: "S1a" }),
      finding({ code: "S1b", severity: "S1", title: "S1b" }),
      finding({ code: "S1c", severity: "S1", title: "S1c" }),
    ];
    expect(
      topFixes(findings, new Set(["S1b"])).map((r) => r.findings[0].code),
    ).toEqual(["S1a", "S1c", "S2a", "S2b", "S2c"]);
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

describe("same-title rows (WO-B16-004)", () => {
  const same = Array.from({ length: 15 }, (_, i) =>
    finding({
      code: `D${i}`,
      severity: "S3",
      title: "Images without dimensions",
    }),
  );

  it("shows 15 same-title findings as 1 row with 15 sub-rows; CSV keeps 15", () => {
    const nice = buildFixGroups(same, "all", new Set())[2];
    expect(nice.rows).toHaveLength(1);
    expect(nice.rows[0].findings).toHaveLength(15);
    expect(Papa.parse(fixListCsv(same).trim()).data).toHaveLength(16);
  });

  it("marks a merged row done only when every sub-row is, and counts it once in the top 5", () => {
    const all = same.map((f) => f.code);
    const nice = (done: string[]) =>
      buildFixGroups(same, "all", new Set(done))[2].rows[0].done;
    expect(nice(all.slice(1))).toBe(false);
    expect(nice(all)).toBe(true);

    const must = same.map((f) => ({ ...f, severity: "S1" as const }));
    expect(topFixes(must, new Set())).toHaveLength(1);
  });
});

const blockedReport = (notes: (string | null)[]) => ({
  items: notes.map((note, i) => ({
    itemId: `P1-${i}`,
    phase: "P1",
    status: "BLOCKED" as const,
    note,
    findingCodes: [],
  })),
});

describe("blockedCauses (WO-B16-002)", () => {
  it("groups runner notes into plain causes and never drops an item", () => {
    const notes = [
      "render unavailable: collector not configured",
      "axe unavailable: sidecar /axe unreachable: fetch failed",
      "total page weight not measured: render unavailable (3 pages, HTML ≤ 500 KB)",
      "no llm key",
      "check error: This request requires more credits, or fewer max_tokens.",
      "llm unsure (model, confidence 0.4): unclear",
      "CRUX_API_KEY not set (lab: …)",
      'gate "SPN" = ? (one local signal)',
      "Owner to record the AI-bot decisions: allowed GPTBot",
      "dataforseo credit",
      "check error: boom",
      "something new",
      null,
    ];
    const causes = blockedCauses(blockedReport(notes));
    expect(causes.map((c) => [c.key, c.items.length])).toEqual([
      ["browser", 3],
      ["ai-budget", 1],
      ["ai-off", 1],
      ["ai-unsure", 1],
      ["crux", 1],
      ["search-data", 1],
      ["owner-fact", 1],
      ["owner-decision", 1],
      ["check-failed", 1],
      ["other", 2],
    ]);
    const shown = causes.map((c) => `${c.label} ${c.action}`).join(" ");
    expect(shown).not.toMatch(/P\d+-\d+|unavailable|sidecar|llm|gate /);
  });
});

describe("notFinalNote (WO-B16-003)", () => {
  const runDate = "2026-11-20T10:00:00Z";

  it("is null without a reason and names the date and plain cause with one", () => {
    expect(
      notFinalNote({ reason: null, runDate, newerRunId: "r2" }),
    ).toBeNull();
    const note = notFinalNote({
      reason: "collector not configured",
      runDate,
      newerRunId: null,
    });
    expect(note?.title).toBe("This grade is not final");
    expect(note?.body).toMatch(/2026/);
    expect(note?.body).toMatch(/browser helper \(it was not set up\)/);
    expect(note?.newerRunId).toBeNull();
  });

  it("links the newest later completed check of the same site", () => {
    const run = { id: "r1", origin: "https://a.test", startedAt: runDate };
    const runs = [
      { ...run, status: "completed" },
      {
        id: "r2",
        origin: run.origin,
        status: "completed",
        startedAt: "2026-11-21T00:00:00Z",
      },
      {
        id: "r3",
        origin: run.origin,
        status: "completed",
        startedAt: "2026-11-22T00:00:00Z",
      },
      {
        id: "r4",
        origin: run.origin,
        status: "failed",
        startedAt: "2026-11-23T00:00:00Z",
      },
      {
        id: "r5",
        origin: "https://b.test",
        status: "completed",
        startedAt: "2026-11-24T00:00:00Z",
      },
    ];
    expect(newerCompletedRun(runs, run)).toBe("r3");
    expect(newerCompletedRun(runs.slice(0, 1), run)).toBeNull();
  });
});
