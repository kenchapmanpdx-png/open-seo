import { describe, expect, it } from "vitest";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import { context, ORIGIN, snapshot, statusOf } from "./check-test-fixtures";
import { labMetricsCheck, pageWeightCheck } from "./lab-performance";

const url = `${ORIGIN}/`;

function withMarkup(markup: Partial<PageSnapshot["markup"]>): PageSnapshot {
  const s = snapshot("/");
  return { ...s, markup: { ...s.markup, ...markup } };
}

describe("labMetricsCheck", () => {
  it("flags lab LCP above 2.5 s", async () => {
    const result = await labMetricsCheck.run(
      context({
        lighthouse: {
          status: "ok",
          pages: [
            {
              url,
              formFactor: "mobile",
              environment: "test",
              performance: 0.6,
              lcpMs: 3100,
              cls: 0,
              tbtMs: 100,
              lcpElement: null,
              storageKey: null,
            },
          ],
        },
      }),
    );
    expect(statusOf(result, "P7-09")).toBe("OPEN");
    expect(statusOf(result, "P7-10")).toBe("PASS");
  });
  it("names the failing templates in P7-09", async () => {
    const run = (path: string, lcpMs: number) => ({
      url: `${ORIGIN}${path}`,
      formFactor: "mobile" as const,
      environment: "test",
      performance: 0.6,
      lcpMs,
      cls: 0,
      tbtMs: 100,
      lcpElement: null,
      storageKey: null,
    });
    const tpl = (key: string, paths: string[]) => ({
      key,
      urlPattern: key,
      skeletonHash: key,
      urls: paths.map((p) => `${ORIGIN}${p}`),
      samples: [
        {
          url: `${ORIGIN}${paths[0]}`,
          rank: 1 as const,
          reason: "first" as const,
        },
      ],
    });
    const result = await labMetricsCheck.run(
      context({
        templates: {
          status: "ok",
          templates: [tpl("/blog/*", ["/blog/a", "/blog/b"]), tpl("/", ["/"])],
        },
        lighthouse: {
          status: "ok",
          pages: [run("/blog/a", 2000), run("/blog/b", 4800), run("/", 1200)],
        },
      }),
    );
    const finding = result.findings.find((f) => f.itemIds.includes("P7-09"));
    expect(finding?.title).toContain("on 1 of 2 measured templates");
    expect(finding?.detail).toContain(
      `template /blog/* — 2 runs, worst LCP 4800 ms (${ORIGIN}/blog/b)`,
    );
  });
});

describe("pageWeightCheck", () => {
  it("flags a rendered page above 5 MB and passes one below", async () => {
    const run = (pageWeightBytes: number) =>
      pageWeightCheck.run(
        context({
          pages: { status: "ok", snapshots: [snapshot("/")] },
          render: {
            status: "ok",
            pages: [
              {
                url,
                js: {
                  finalUrl: url,
                  status: 200,
                  renderedKey: "k",
                  words: 100,
                  requests: [],
                  pageWeightBytes,
                  opacityZeroWords: 0,
                  firstScreenActions: [],
                },
                noJs: { status: 200, nojsKey: "n", words: 100 },
                firstScreenKey: null,
                consoleErrors: [],
              },
            ],
          },
        }),
      );
    expect(statusOf(await run(6_000_000), "P2-05")).toBe("OPEN");
    expect(statusOf(await run(4_000_000), "P2-05")).toBe("PASS");
  });

  it("flags more than five render-blocking head scripts", async () => {
    const scripts = Array.from({ length: 6 }, (_, i) => ({
      src: `${ORIGIN}/s${i}.js`,
      type: null,
      async: false,
      defer: false,
      inHead: true,
    }));
    const result = await pageWeightCheck.run(
      context({
        pages: { status: "ok", snapshots: [withMarkup({ scripts })] },
      }),
    );
    expect(statusOf(result, "P7-05")).toBe("OPEN");
  });

  it("names third-party font CSS in the P7-05 finding", async () => {
    const headLinks = [
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter",
        as: null,
        type: null,
      },
    ];
    const result = await pageWeightCheck.run(
      context({
        pages: { status: "ok", snapshots: [withMarkup({ headLinks })] },
      }),
    );
    expect(statusOf(result, "P7-05")).toBe("OPEN");
    expect(result.findings[0].detail).toContain("Google Fonts");
  });

  const lhPage = (renderBlocking?: { url: string; wastedMs: number }[]) => ({
    status: "ok" as const,
    pages: [
      {
        url,
        formFactor: "mobile" as const,
        environment: "test",
        performance: 0.9,
        lcpMs: 1000,
        cls: 0,
        tbtMs: 0,
        lcpElement: null,
        storageKey: "lh",
        ...(renderBlocking ? { renderBlocking } : {}),
      },
    ],
  });

  it("lists Lighthouse render-blocking URLs ≥ 500 ms as P7-05 evidence", async () => {
    const css = `${ORIGIN}/app.css`;
    const result = await pageWeightCheck.run(
      context({
        pages: { status: "ok", snapshots: [withMarkup({})] },
        lighthouse: lhPage([
          { url: css, wastedMs: 820 },
          { url: `${ORIGIN}/tiny.css`, wastedMs: 40 },
        ]),
      }),
    );
    expect(statusOf(result, "P7-05")).toBe("OPEN");
    expect(result.findings[0].detail).not.toContain("tiny.css");
    expect(result.evidence.find((e) => e.kind === "lighthouse")?.excerpt).toBe(
      `${css} — wastedMs 820`,
    );
  });

  it("keeps P7-05 PASS when Lighthouse has no renderBlocking field", async () => {
    const result = await pageWeightCheck.run(
      context({
        pages: { status: "ok", snapshots: [withMarkup({})] },
        lighthouse: lhPage(),
      }),
    );
    expect(statusOf(result, "P7-05")).toBe("PASS");
  });
});
