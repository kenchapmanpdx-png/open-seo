import { describe, expect, it } from "vitest";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import {
  context,
  ORIGIN,
  snapshot,
  statusOf,
  template,
} from "./check-test-fixtures";
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

  it("reports one P7-02 finding with a row per template group", async () => {
    const page = (path: string) => ({
      ...snapshot(path),
      images: [{ ...hero, width: null }],
    });
    const [a, b, c] = [page("/"), page("/services/a/"), page("/services/b/")];
    const result = await imageMarkupCheck.run(
      context({
        pages: { status: "ok", snapshots: [a, b, c] },
        templates: {
          status: "ok",
          templates: [template("/", [a]), template("/services/*", [b, c])],
        },
      }),
    );
    const p702 = result.findings.filter((f) => f.itemIds[0] === "P7-02");
    expect(p702).toHaveLength(1);
    expect(p702[0].urls).toEqual([a.url, b.url, c.url]);
    expect(p702[0].detail).toMatch(/\/services\/\* \(2 pages\):/);
  });

  it("passes an eager, sized hero with fetchpriority and srcset", async () => {
    const result = await run({});
    expect(statusOf(result, "P7-02")).toBe("PASS");
    expect(statusOf(result, "P7-03")).toBe("PASS");
  });
});
