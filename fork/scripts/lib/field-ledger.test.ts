import { describe, expect, it } from "vitest";
import { compareExport } from "./external-audit";
import {
  buildRows,
  mergeVerdicts,
  openRows,
  readVerdicts,
  renderSection,
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
      "app:F-2",
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
    expect(again.find((r) => r.key === "app:F-2")?.note).toBe("WO-B18-004");
  });
});
