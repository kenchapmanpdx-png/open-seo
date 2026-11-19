import { describe, expect, it } from "vitest";
import { numericMismatches } from "./numeric-parity";

describe("numericMismatches", () => {
  it("flags a zero placeholder that JS turns into the real value", () => {
    expect(
      numericMismatches(
        "Pocket Nurse plan $ 0 /mo approval 0 % terms up to 0 mo apply",
        "Pocket Nurse plan $ 99 /mo approval 100 % terms up to 84 mo apply",
      ).map(({ raw, rendered }) => `${raw} → ${rendered}`),
    ).toEqual(["$ 0 /mo → $ 99 /mo", "0 % → 100 %", "0 mo → 84 mo"]);
  });

  it("ignores zeros that stay zero and dates that change", () => {
    expect(
      numericMismatches(
        "Search found 0 results. Updated November 17, 2026 at 09:30",
        "Search found 0 results. Updated November 18, 2026 at 10:05",
      ),
    ).toEqual([]);
  });

  it("ignores a value that starts non-zero (count-up from the final value)", () => {
    expect(
      numericMismatches(
        "Served 99 clinics this year",
        "Served 120 clinics this year",
      ),
    ).toEqual([]);
  });
});
