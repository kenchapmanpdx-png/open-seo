import { describe, expect, it } from "vitest";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import { context, ORIGIN, snapshot, statusOf } from "./check-test-fixtures";
import { imageMarkupCheck } from "./image-markup";

type Img = PageSnapshot["images"][number];

const hero: Img = {
  src: `${ORIGIN}/hero.jpg`,
  dataSrc: null,
  srcset: "hero-800.jpg 800w",
  alt: "Runners",
  width: "1200",
  height: "630",
  loading: "eager",
  fetchpriority: "high",
};

const run = (img: Partial<Img>) =>
  imageMarkupCheck.run(
    context({
      pages: {
        status: "ok",
        snapshots: [{ ...snapshot("/"), images: [{ ...hero, ...img }] }],
      },
    }),
  );

describe("perf.image-markup", () => {
  it("opens P7-03 on a data-src hero", async () => {
    const result = await run({ src: "", dataSrc: `${ORIGIN}/hero.jpg` });
    expect(statusOf(result, "P7-03")).toBe("OPEN");
  });

  it("opens P7-02 when an image has no dimensions", async () => {
    expect(statusOf(await run({ width: null }), "P7-02")).toBe("OPEN");
  });

  it("passes an eager, sized hero with fetchpriority and srcset", async () => {
    const result = await run({});
    expect(statusOf(result, "P7-02")).toBe("PASS");
    expect(statusOf(result, "P7-03")).toBe("PASS");
  });
});
