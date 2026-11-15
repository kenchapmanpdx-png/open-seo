import { describe, expect, it, vi } from "vitest";
import { runForkScheduledJobs } from "./forkScheduledJobs";

describe("runForkScheduledJobs", () => {
  it("runs the jobs for the cron and isolates a failing job", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const after = vi.fn(async () => {});
    const other = vi.fn(async () => {});
    await expect(
      runForkScheduledJobs("*/5 * * * *", {
        "*/5 * * * *": [
          { name: "boom", run: () => Promise.reject(new Error("x")) },
          { name: "after", run: after },
        ],
        "17 3 * * *": [{ name: "other", run: other }],
      }),
    ).resolves.toBeUndefined();
    expect(after).toHaveBeenCalledOnce();
    expect(other).not.toHaveBeenCalled();
  });
});
