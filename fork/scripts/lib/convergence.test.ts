import { describe, expect, it } from "vitest";
import { convergence, readRounds } from "./convergence";
import { renderSection, type VerdictRow } from "./field-ledger";

const row = (over: Partial<VerdictRow>): VerdictRow => ({
  key: `k:${Math.random()}`,
  set: "agree",
  check: "Duplicate title tag",
  count: 1,
  verdict: "agree",
  note: "",
  ...over,
});
const CLEAN = renderSection([
  row({
    set: "app-only",
    check: "F01",
    verdict: "tool-wrong",
    note: "live 2026-11-25: x",
  }),
]);
const MISS = renderSection([
  row({
    set: "tool-only",
    check: "Missing h1",
    verdict: "fixed",
    note: "WO-B23-001",
  }),
]);
const HYGIENE_MISS = renderSection([
  row({
    set: "tool-only",
    check: "No HSTS support",
    verdict: "fixed",
    note: "",
  }),
]);

type R = [string, string, string, number?, string?];
const ledger = (rounds: R[]) =>
  [
    "| Round | Tag | Site | Date | Scope | Sitemap URLs | Recorded misses |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...rounds.map(
      ([round, site, scope, urls, recorded]) =>
        `| ${round} | t | ${site} | 2026-12-01 | ${scope} | ${urls ?? "?"} | ${recorded ?? "—"} |`,
    ),
  ].join("\n");

const run = (rounds: R[], reports: Record<string, string>) =>
  convergence({
    rounds: readRounds(ledger(rounds)),
    readReport: (site) => reports[site] ?? null,
    runErrors: () => 0,
    itemsOf: (check) =>
      ({ "Missing h1": ["P4-01"], "No HSTS support": ["P8-01"] })[check] ?? [],
    effectOf: (id) => (id === "P8-01" ? "hygiene" : "search"),
  });

const round = (name: string, sites: string[], big = 0): R[] =>
  sites.map((s, i) => [name, s, "matched", i === 0 ? big : 5]);

describe("convergence (WO-B22-005)", () => {
  it("two clean rounds with a large matched site are done", () => {
    const reports = {
      a: CLEAN,
      b: CLEAN,
      c: CLEAN,
      d: CLEAN,
      e: CLEAN,
      f: CLEAN,
    };
    const out = run(
      [...round("R1", ["a", "b", "c"], 150), ...round("R2", ["d", "e", "f"])],
      reports,
    );
    expect(
      out.rounds.map((r) => [r.round, r.valid, r.clean, r.streak]),
    ).toEqual([
      ["R1", true, true, 1],
      ["R2", true, true, 2],
    ]);
    expect(out.done).toBe(true);
  });

  it("a non-hygiene fixed miss resets the streak; a hygiene one does not", () => {
    const out = run(
      [
        ...round("R1", ["a", "b", "c"], 150),
        ...round("R2", ["d", "e", "f"]),
        ...round("R3", ["g", "h", "i"]),
      ],
      {
        a: CLEAN,
        b: CLEAN,
        c: HYGIENE_MISS,
        d: MISS,
        e: CLEAN,
        f: CLEAN,
        g: CLEAN,
        h: CLEAN,
        i: CLEAN,
      },
    );
    expect(out.rounds.map((r) => r.streak)).toEqual([1, 0, 1]);
    expect(out.rounds[1].sites[0].misses).toEqual(["Missing h1"]);
    expect(out.done).toBe(false);
  });

  it("a recorded first-pass miss counts unless its item is hygiene", () => {
    const out = run(
      [
        ["R1", "a", "matched", 5, "P8-01 WO-B21-002; P4-01 WO-B21-003"],
        ["R1", "b", "matched"],
        ["R1", "c", "matched"],
      ],
      { a: CLEAN, b: CLEAN, c: CLEAN },
    );
    expect(out.rounds[0].sites[0].misses).toEqual(["P4-01 WO-B21-003"]);
    expect(out.rounds[0].clean).toBe(false);
  });

  it("an unmatched-scope round never counts toward done", () => {
    const reports = {
      a: CLEAN,
      b: CLEAN,
      c: CLEAN,
      d: CLEAN,
      e: CLEAN,
      f: CLEAN,
    };
    const out = run(
      [
        ...round("R1", ["a", "b", "c"], 150),
        ["R2", "d", "unmatched: app 238 vs tool 23"],
        ["R2", "e", "matched"],
        ["R2", "f", "matched"],
      ],
      reports,
    );
    expect(out.rounds[1]).toMatchObject({ valid: false, streak: 1 });
    expect(out.done).toBe(false);
  });

  it("an app-only finding without a live-checked verdict is unexplained", () => {
    const loose = renderSection([
      row({
        set: "app-only",
        check: "F02",
        verdict: "tool-wrong",
        note: "Semrush has no check",
      }),
    ]);
    const out = run(round("R1", ["a", "b", "c"]), {
      a: loose,
      b: CLEAN,
      c: CLEAN,
    });
    expect(out.rounds[0].sites[0].unexplained).toEqual(["F02"]);
    expect(out.rounds[0].clean).toBe(false);
  });
});
