import { describe, expect, it } from "vitest";
import { handbookExcluded } from "./exclude";

describe("handbookExcluded (WO-B19-015)", () => {
  it("leaves out the section index with the section", () => {
    const patterns = ["/hvac-chicago/"];
    expect(handbookExcluded(patterns, "https://x.com/hvac-chicago")).toBe(
      "/hvac-chicago/",
    );
    expect(handbookExcluded(patterns, "https://x.com/hvac-chicago/a")).toBe(
      "/hvac-chicago/",
    );
    expect(
      handbookExcluded(patterns, "https://x.com/hvac-chicago-north"),
    ).toBeUndefined();
  });
});
