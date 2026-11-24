import { expect, it } from "vitest";
import { createLimiter, readAhead } from "./limiter";

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

// WO-B20-005: the crawl keeps at most `ahead` fetches in flight and reads results by index.
it("readAhead starts at most `ahead` items and returns each item's own result", async () => {
  let inFlight = 0;
  let peak = 0;
  const take = readAhead(
    [1, 2, 3, 4, 5, 6],
    () => 4,
    async (n) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await Promise.resolve();
      inFlight -= 1;
      return n * 10;
    },
  );
  const out: number[] = [];
  for (let i = 0; i < 6; i++) out.push(await take(i));
  expect(out).toEqual([10, 20, 30, 40, 50, 60]);
  expect(peak).toBe(4);
});
