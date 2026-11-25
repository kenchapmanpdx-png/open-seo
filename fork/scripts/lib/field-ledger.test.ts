import { describe, expect, it } from "vitest";
import { compareExport } from "./external-audit";
import {
  buildRows,
  ledgerDrift,
  ledgerRow,
  mergeVerdicts,
  openRows,
  readVerdicts,
  renderSection,
  upsertLedger,
  upsertSection,
} from "./field-ledger";

const result = compareExport(
  [
    { name: "Missing h1", failed: 3, urls: [] },
    { name: "Title element is too long", failed: 1, urls: [] },
    { name: "Low text to HTML ratio", failed: 9, urls: [] },
  ],
  {
    findings: [
      { code: "F-1", title: "No H1", itemIds: ["P4-08"] },
      { code: "F-2", title: "Robots group", itemIds: ["P3-01"] },
    ],
  },
);

describe("field-test verdicts", () => {
  it("keeps verdicts written on an earlier pass and stays open until every miss has one", () => {
    const first = buildRows(result);
    expect(openRows(first).map((r) => r.key)).toEqual([
      "tool:Title element is too long",
      "app:Robots group",
    ]);
    // Someone writes the verdicts into the report; a rerun keeps them.
    const written = renderSection(
      first.map((r) =>
        r.verdict ? r : { ...r, verdict: "fixed", note: "WO-B18-004" },
      ),
    );
    const text = upsertSection("# Field test\n", written, "unused");
    const again = mergeVerdicts(buildRows(result), readVerdicts(text));
    expect(openRows(again)).toEqual([]);
    expect(again.find((r) => r.key === "app:Robots group")?.note).toBe(
      "WO-B18-004",
    );
  });
});

describe("field-test ledger counts (WO-B22-003)", () => {
  // valentinecoffeeco 2026-11-23: header and ledger said 43 open, the table 0.
  const closed = buildRows(result).map((r) => ({ ...r, verdict: "skip" }));
  const report = (rows: typeof closed, header = openRows(rows).length) =>
    upsertSection(null, renderSection(rows), "# t").replace(
      /Open rows: \d+\./,
      `Open rows: ${header}.`,
    );
  const ledger = (open: number) =>
    upsertLedger("# Field tests\n", {
      ...ledgerRow("a.com", "2026-11-23", "Semrush", closed, {
        app: 1,
        tool: 1,
      }),
      open,
    });

  it("reports a ledger row or report header that disagrees with the verdict table", () => {
    const drift = ledgerDrift(ledger(43), () => report(closed, 43));
    expect(drift).toEqual([
      { site: "a.com", date: "2026-11-23", ledger: "43", header: 43, table: 0 },
    ]);
  });

  it("is empty when row, header and table agree", () => {
    expect(ledgerDrift(ledger(0), () => report(closed))).toEqual([]);
  });

  it("leaves an earlier day's row byte-identical when a later day is added", () => {
    const first = ledger(0);
    const next = upsertLedger(
      first,
      ledgerRow("a.com", "2026-11-25", "Semrush", buildRows(result), {
        app: 1,
        tool: 1,
      }),
    );
    expect(next.startsWith(first)).toBe(true);
  });
});
