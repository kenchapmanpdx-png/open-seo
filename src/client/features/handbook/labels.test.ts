import { describe, expect, it } from "vitest";
import { ITEM_STATUSES } from "@/server/features/handbook/contracts/status";
import { MORE_TOOLS, SEVERITY_LABELS, STATUS_LABELS } from "./labels";

describe("labels", () => {
  it("has a plain label for every item status and severity", () => {
    for (const s of ITEM_STATUSES) expect(STATUS_LABELS[s].label).toBeTruthy();
    for (const s of ["S1", "S2", "S3", "S4"] as const)
      expect(SEVERITY_LABELS[s].label).toBeTruthy();
  });

  it("names every More tools entry in plain words (WO-B16-001)", () => {
    for (const tool of MORE_TOOLS) {
      expect(tool.help).toBeTruthy();
      expect(tool.label).not.toMatch(
        /overview|byok|common crawl|agency|-cc|copy rules|sidecar/i,
      );
    }
  });
});
