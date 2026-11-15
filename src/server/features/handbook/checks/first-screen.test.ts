import { describe, expect, it } from "vitest";
import { context, ORIGIN, statusOf } from "./check-test-fixtures";
import { consentLcpCheck, firstScreenActionCheck } from "./first-screen";

const url = `${ORIGIN}/`;

describe("firstScreenActionCheck", () => {
  it("flags a first screen without a primary action", async () => {
    const result = await firstScreenActionCheck.run(
      context({
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
                opacityZeroWords: 0,
                firstScreenActions: [
                  { tag: "a", text: "About", href: "/about/" },
                ],
              },
              noJs: { status: 200, nojsKey: "n", words: 100 },
              firstScreenKey: null,
              consoleErrors: [],
            },
          ],
        },
      }),
    );
    expect(statusOf(result, "P5-14")).toBe("OPEN");
  });
});

describe("consentLcpCheck", () => {
  it("flags a cookie banner as the LCP element", async () => {
    const result = await consentLcpCheck.run(
      context({
        lighthouse: {
          status: "ok",
          pages: [
            {
              url,
              formFactor: "mobile",
              environment: "test",
              performance: 0.9,
              lcpMs: 2000,
              cls: 0,
              tbtMs: 0,
              lcpElement: "div#cookie-banner > p",
              storageKey: null,
            },
          ],
        },
      }),
    );
    expect(statusOf(result, "P8-09")).toBe("OPEN");
  });
});
