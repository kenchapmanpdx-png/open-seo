import { describe, expect, it } from "vitest";
import type { ItemStatus } from "@/server/features/handbook/contracts/status";
import type { ScoreInput } from "@/server/features/handbook/contracts/scoring";
import { scoreItems } from "./scoring";

type Item = ScoreInput["items"][number];

/** n items of one phase with the same status. */
const items = (phase: string, status: ItemStatus, n: number): Item[] =>
  Array.from({ length: n }, (_, i) => ({
    itemId: `${phase}-${status}-${i}`,
    phase,
    status,
    openSeverities: [],
    openFindingCodes: [],
  }));

const input = (list: Item[]): ScoreInput => ({
  handbookVersion: "4.6",
  mode: "REVIEW",
  items: list,
});

describe("scoreItems (EP-7)", () => {
  it("reproduces the whyracingevents golden grade from its §41 walk", () => {
    // fork/fixtures/audits/whyracingevents-2026-11-13.md, "§41 walk":
    // P2 3.5/8 · P3 8.5/16 · P4 7.5/10 · P5 4/11 · P6 3.5/9 · P7 4/8 · P8 4.5/5 · P9 2.5/5.
    const s1: Item = {
      itemId: "P2-01",
      phase: "P2",
      status: "OPEN",
      openSeverities: ["S1"],
      openFindingCodes: ["F01"],
    };
    const out = scoreItems(
      input([
        s1,
        ...items("P2", "PASS", 2),
        ...items("P2", "PARTIAL", 3),
        ...items("P2", "OPEN", 2),
        ...items("P2", "BLOCKED", 1),
        ...items("P3", "PASS", 6),
        ...items("P3", "PARTIAL", 5),
        ...items("P3", "OPEN", 5),
        ...items("P3", "NA", 4),
        ...items("P4", "PASS", 6),
        ...items("P4", "PARTIAL", 3),
        ...items("P4", "OPEN", 1),
        ...items("P5", "PASS", 1),
        ...items("P5", "PARTIAL", 6),
        ...items("P5", "OPEN", 4),
        ...items("P6", "PASS", 2),
        ...items("P6", "PARTIAL", 3),
        ...items("P6", "OPEN", 4),
        ...items("P7", "PASS", 1),
        ...items("P7", "PARTIAL", 6),
        ...items("P7", "OPEN", 1),
        ...items("P8", "PASS", 4),
        ...items("P8", "PARTIAL", 1),
        ...items("P9", "PASS", 2),
        ...items("P9", "PARTIAL", 1),
        ...items("P9", "OPEN", 2),
        ...items("P10", "OPEN", 3),
      ]),
    );
    expect(out.phases.map((p) => p.score)).toEqual([
      43.8, 53.1, 75, 36.4, 38.9, 50, 90, 50,
    ]);
    expect(out).toMatchObject({
      uncapped: 53.6,
      final: 39,
      grade: "F",
      capReason: "open S1: F01",
    });
  });

  it("spreads the weight of a phase with no applicable item over the rest", () => {
    const out = scoreItems(
      input([
        ...items("P2", "PASS", 1),
        ...items("P3", "OPEN", 1),
        ...items("P9", "NA", 2),
      ]),
    );
    const p9 = out.phases.find((p) => p.phase === "P9");
    expect(p9).toMatchObject({ score: null, effectiveWeight: 0 });
    // P2 100 and P3 0 share the full weight; every other phase is empty.
    expect(out).toMatchObject({ uncapped: 50, final: 50, grade: "D" });
  });

  it("does not cap on an S1 finding whose item already passes", () => {
    const out = scoreItems(
      input([
        {
          itemId: "P3-01",
          phase: "P3",
          status: "PASS",
          openSeverities: ["S1"],
          openFindingCodes: ["F01"],
        },
      ]),
    );
    expect(out).toMatchObject({ final: 100, grade: "A", capReason: null });
  });
});
