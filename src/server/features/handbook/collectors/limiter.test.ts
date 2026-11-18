import { expect, it } from "vitest";
import { createLimiter } from "./limiter";

it("never runs more than N tasks at once and finishes them all", async () => {
  const limit = createLimiter(3);
  let inFlight = 0;
  let peak = 0;
  const task = (i: number) =>
    limit(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, (i % 4) * 2));
      inFlight -= 1;
      if (i === 5) throw new Error("boom");
      return i;
    });
  const results = await Promise.allSettled(
    Array.from({ length: 20 }, (_, i) => task(i)),
  );
  expect(peak).toBe(3);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(19);
});
