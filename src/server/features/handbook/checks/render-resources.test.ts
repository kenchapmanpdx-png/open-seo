import { describe, expect, it } from "vitest";
import { context, ORIGIN, statusOf } from "./check-test-fixtures";
import { renderResourcesCheck } from "./render-resources";

type Measured = {
  sameContent: boolean;
  missing?: string[];
};

function run(
  script: string,
  resourceType = "script",
  measured?: Measured,
  unmeasuredPath?: string,
) {
  const page = (path: string, withEffect: boolean) => ({
    url: `${ORIGIN}${path}`,
    js: {
      finalUrl: `${ORIGIN}${path}`,
      status: 200,
      renderedKey: "k",
      words: 100,
      requests: [{ url: `${ORIGIN}${script}`, resourceType, status: 200 }],
      opacityZeroWords: 0,
      firstScreenActions: [],
      ...(measured && withEffect
        ? {
            robotsBlocked: {
              urls: [`${ORIGIN}${script}`],
              wordsNormal: 100,
              wordsBlocked: measured.sameContent ? 100 : 20,
              sameContent: measured.sameContent,
              missing: measured.missing ?? [],
            },
          }
        : {}),
    },
    noJs: { status: 200, nojsKey: "n", words: 100 },
    firstScreenKey: null,
    consoleErrors: [],
  });
  return renderResourcesCheck.run(
    context({
      robots: {
        status: "ok",
        decisions: [],
        hosts: [
          {
            host: new URL(ORIGIN).host,
            status: 200,
            storageKey: null,
            sitemaps: [],
            parseWarnings: [],
            groups: [
              {
                userAgents: ["*"],
                rules: [{ type: "disallow", path: "/assets/private/" }],
              },
            ],
          },
        ],
      },
      render: {
        status: "ok",
        pages: [
          page("/", true),
          ...(unmeasuredPath ? [page(unmeasuredPath, false)] : []),
        ],
      },
    }),
  );
}

describe("renderResourcesCheck", () => {
  it("flags a disallowed script", async () => {
    expect(statusOf(await run("/assets/private/app.js"), "P3-20")).toBe("OPEN");
  });

  it("keeps a blocked XHR below S1 (data vs telemetry is unknown)", async () => {
    const result = await run("/assets/private/beacon", "xhr");
    expect(result.findings.map((f) => f.severity)).toEqual(["S2"]);
    // The runner rejects a below-default severity that has no reason.
    expect(result.findings[0]?.severityReason).toBeTruthy();
  });

  it("passes allowed scripts", async () => {
    expect(statusOf(await run("/assets/app.js"), "P3-20")).toBe("PASS");
  });

  // WO-B19-004: severity by effect, measured by a re-render without the blocked requests.
  it("keeps a blocked script that changes nothing at S4", async () => {
    const result = await run("/assets/private/telemetry.js", "script", {
      sameContent: true,
    });
    expect(result.findings.map((f) => [f.severity, f.severityReason])).toEqual([
      ["S4", "blocked resources do not change the rendered content"],
    ]);
  });

  it("opens S1 with the missing text when the blocked script feeds content", async () => {
    const result = await run("/assets/private/menu.js", "script", {
      sameContent: false,
      missing: ["Espresso 3.50 dollars, flat white 4.25 dollars."],
    });
    expect(result.findings[0].severity).toBe("S1");
    expect(result.findings[0].detail).toContain("missing: Espresso 3.50");
  });

  // A one-page template gets no re-render of its own (valentinecoffeeco /cart).
  it("carries a measured 'unchanged' to an unmeasured page blocked by the same rules", async () => {
    const result = await run(
      "/assets/private/telemetry.js",
      "script",
      { sameContent: true },
      "/cart",
    );
    expect(result.findings.map((f) => [f.severity, f.urls])).toEqual([
      ["S4", [`${ORIGIN}/`, `${ORIGIN}/cart`]],
    ]);
  });

  it("does not carry 'unchanged' when the same rule changed content elsewhere", async () => {
    const result = await run(
      "/assets/private/menu.js",
      "script",
      { sameContent: false },
      "/cart",
    );
    expect(result.findings.map((f) => f.severity)).toEqual(["S1", "S1"]);
  });

  it("keeps an unmeasured page with a cleared script and an unmeasured fetch at S2", async () => {
    const result = await renderResourcesCheck.run(
      context({
        robots: {
          status: "ok",
          decisions: [],
          hosts: [
            {
              host: new URL(ORIGIN).host,
              status: 200,
              storageKey: null,
              sitemaps: [],
              parseWarnings: [],
              groups: [
                {
                  userAgents: ["*"],
                  rules: [
                    { type: "disallow", path: "/assets/private/" },
                    { type: "disallow", path: "/recommendations/" },
                  ],
                },
              ],
            },
          ],
        },
        render: {
          status: "ok",
          pages: [
            renderPage("/", ["/assets/private/t.js"], true),
            renderPage("/cart", ["/assets/private/t.js", "/recommendations/x"]),
          ],
        },
      }),
    );
    expect(result.findings.map((f) => [f.severity, f.urls])).toEqual([
      ["S4", [`${ORIGIN}/`]],
      ["S2", [`${ORIGIN}/cart`]],
    ]);
  });
});

function renderPage(path: string, paths: string[], measured = false) {
  return {
    url: `${ORIGIN}${path}`,
    js: {
      finalUrl: `${ORIGIN}${path}`,
      status: 200,
      renderedKey: "k",
      words: 100,
      requests: paths.map((p) => ({
        url: `${ORIGIN}${p}`,
        resourceType: p.endsWith(".js") ? "script" : "fetch",
        status: 200,
      })),
      opacityZeroWords: 0,
      firstScreenActions: [],
      ...(measured
        ? {
            robotsBlocked: {
              urls: paths.map((p) => `${ORIGIN}${p}`),
              wordsNormal: 100,
              wordsBlocked: 100,
              sameContent: true,
              missing: [],
            },
          }
        : {}),
    },
    noJs: { status: 200, nojsKey: "n", words: 100 },
    firstScreenKey: null,
    consoleErrors: [],
  };
}
