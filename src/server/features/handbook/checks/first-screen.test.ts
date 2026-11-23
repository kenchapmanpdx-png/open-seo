import { describe, expect, it } from "vitest";
import { context, ORIGIN, statusOf } from "./check-test-fixtures";
import { consentLcpCheck, firstScreenActionCheck } from "./first-screen";

const url = `${ORIGIN}/`;

describe("firstScreenActionCheck", () => {
  const run = (text: string) =>
    firstScreenActionCheck.run(
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
                firstScreenActions: [{ tag: "a", text, href: "/x/" }],
              },
              noJs: { status: 200, nojsKey: "n", words: 100 },
              firstScreenKey: null,
              consoleErrors: [],
            },
          ],
        },
      }),
    );

  it("flags a first screen without a primary action", async () => {
    expect(statusOf(await run("About"), "P5-14")).toBe("OPEN");
  });

  it.each(["Make An Appointment", "Schedule a visit", "Reserve a table"])(
    "accepts %s as a primary action",
    async (text) => {
      expect(statusOf(await run(text), "P5-14")).toBe("PASS");
    },
  );
});

describe("consentLcpCheck", () => {
  const run = (lcpElement: string) =>
    consentLcpCheck.run(
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
              lcpElement,
              storageKey: null,
            },
          ],
        },
      }),
    );

  it.each([
    "div#cookie-banner > p",
    "div.banner > p · We use cookies to improve your visit",
  ])("flags a cookie banner as the LCP element (%s)", async (lcp) => {
    expect(statusOf(await run(lcp), "P8-09")).toBe("OPEN");
  });

  it("passes page text that only mentions consent (wsparkdental /terms)", async () => {
    const lcp =
      "section.section > main.container > div.service-description > p · By providing my phone number, I consent to receive SMS text messages";
    expect(statusOf(await run(lcp), "P8-09")).toBe("PASS");
  });
});
