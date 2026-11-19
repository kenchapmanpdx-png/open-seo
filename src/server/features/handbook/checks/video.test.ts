import { describe, expect, it } from "vitest";
import type { RenderData } from "@/server/features/handbook/contracts/render-data";
import { extractHtmlFacts } from "@/server/features/handbook/engine/html-facts";
import { context, snapshot, statusOf } from "./check-test-fixtures";
import { videoCheck } from "./video";

const url = "https://example.com/";

function page(body: string) {
  const snap = snapshot("/");
  return { ...snap, markup: extractHtmlFacts(body, url).markup };
}

const render = (
  sizes: Record<string, number>,
  firstScreen: string[] = [],
): RenderData => ({
  pages: [
    {
      url,
      js: {
        finalUrl: url,
        status: 200,
        renderedKey: "k",
        words: 100,
        requests: [],
        mediaElements: Object.keys(sizes).map((src) => ({
          kind: "video",
          src,
          firstScreen: firstScreen.includes(src),
          reservedSize: true,
        })),
        opacityZeroWords: 0,
        firstScreenActions: [],
      },
      noJs: { status: 200, nojsKey: "n", words: 100 },
      firstScreenKey: null,
      consoleErrors: [],
    },
  ],
  mediaSizes: Object.entries(sizes).map(([src, bytes]) => ({
    url: new URL(src, url).href,
    bytes,
    method: "head" as const,
  })),
});

const run = (body: string, r?: RenderData) =>
  videoCheck.run(
    context({
      pages: { status: "ok", snapshots: [page(body)] },
      ...(r ? { render: { status: "ok" as const, ...r } } : {}),
    }),
  );

describe("perf.video", () => {
  it("treats a background loop as decorative and a video with controls as content", async () => {
    const decorative = await run(
      '<video src="/bg.mp4" autoplay muted loop playsinline width="16" height="9"></video>',
    );
    expect(statusOf(decorative, "SUPP-12")).toBeUndefined();
    const content = await run(
      '<video src="/talk.mp4" controls preload="none" width="16" height="9"></video>',
    );
    expect(statusOf(content, "SUPP-12")).toBe("OPEN");
    expect(content.findings[0].detail).toContain("no VideoObject");
  });

  it("opens SUPP-08 when videos loading with the page add up to > 5 MB, P7-01 for an oversized hero", async () => {
    const body = [
      '<video src="/hero.mp4" autoplay muted loop width="16" height="9"></video>',
      '<video src="/a.mp4" autoplay muted loop width="16" height="9"></video>',
      '<video src="/b.mp4" preload="auto" muted loop autoplay width="16" height="9"></video>',
    ].join("");
    const small = await run(
      body,
      render({ "/hero.mp4": 1e6, "/a.mp4": 3e6, "/b.mp4": 3e6 }, ["/hero.mp4"]),
    );
    expect(statusOf(small, "SUPP-08")).toBe("OPEN");
    expect(
      small.findings.find((f) => f.itemIds[0] === "SUPP-08")?.detail,
    ).toContain("page loads 7.0 MB");
    const heavyHero = await run(
      '<video src="/hero.mp4" autoplay muted loop width="16" height="9"></video>',
      render({ "/hero.mp4": 12e6 }, ["/hero.mp4"]),
    );
    expect(statusOf(heavyHero, "P7-01")).toBe("OPEN");
    expect(statusOf(heavyHero, "SUPP-08")).toBe("PASS");
  });

  it("opens SUPP-09 and SUPP-10 for an unsized eager YouTube embed, not for a facade", async () => {
    const eager = await run(
      '<iframe src="https://www.youtube.com/embed/abc123"></iframe>',
    );
    expect(statusOf(eager, "SUPP-09")).toBe("OPEN");
    expect(statusOf(eager, "SUPP-10")).toBe("OPEN");
    const facade = await run(
      '<lite-youtube videoid="abc123" style="aspect-ratio: 16 / 9"></lite-youtube>',
    );
    expect(statusOf(facade, "SUPP-09")).toBeUndefined();
    expect(statusOf(facade, "SUPP-10")).toBeUndefined();
  });
});
