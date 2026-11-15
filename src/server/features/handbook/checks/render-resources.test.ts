import { describe, expect, it } from "vitest";
import { context, ORIGIN, statusOf } from "./check-test-fixtures";
import { renderResourcesCheck } from "./render-resources";

function run(script: string, resourceType = "script") {
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
          {
            url: `${ORIGIN}/`,
            js: {
              finalUrl: `${ORIGIN}/`,
              status: 200,
              renderedKey: "k",
              words: 100,
              requests: [
                {
                  url: `${ORIGIN}${script}`,
                  resourceType,
                  status: 200,
                },
              ],
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
}

describe("renderResourcesCheck", () => {
  it("flags a disallowed script", async () => {
    expect(statusOf(await run("/assets/private/app.js"), "P3-20")).toBe("OPEN");
  });

  it("keeps a blocked XHR below S1 (data vs telemetry is unknown)", async () => {
    const result = await run("/assets/private/beacon", "xhr");
    expect(result.findings.map((f) => f.severity)).toEqual(["S2"]);
  });

  it("passes allowed scripts", async () => {
    expect(statusOf(await run("/assets/app.js"), "P3-20")).toBe("PASS");
  });
});
