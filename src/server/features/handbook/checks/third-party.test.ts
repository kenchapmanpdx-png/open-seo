import { describe, expect, it } from "vitest";
import type {
  CollectedData,
  PageSnapshot,
} from "@/server/features/handbook/contracts/collectors";
import { context, ORIGIN, snapshot, statusOf } from "./check-test-fixtures";
import { thirdPartyCheck } from "./third-party";

const url = `${ORIGIN}/`;

function page(scripts: PageSnapshot["markup"]["scripts"] = []): PageSnapshot {
  const s = snapshot("/");
  return { ...s, markup: { ...s.markup, scripts } };
}

describe("thirdPartyCheck", () => {
  it("flags a synchronous tag manager in head", async () => {
    const result = await thirdPartyCheck.run(
      context({
        pages: {
          status: "ok",
          snapshots: [
            page([
              {
                src: "https://www.googletagmanager.com/gtm.js?id=GTM-X",
                type: null,
                async: false,
                defer: false,
                inHead: true,
              },
            ]),
          ],
        },
      }),
    );
    expect(statusOf(result, "P7-04")).toBe("OPEN");
  });

  it("blocks P7-04 instead of passing when render evidence is missing", async () => {
    const result = await thirdPartyCheck.run(
      context({ pages: { status: "ok", snapshots: [page()] } }),
    );
    expect(statusOf(result, "P7-04")).toBe("BLOCKED");
  });

  it("flags a pixel request at load when SP6 = Y", async () => {
    const result = await thirdPartyCheck.run({
      ...renderedWith([
        {
          url: "https://connect.facebook.net/en_US/fbevents.js",
          resourceType: "script",
          status: 200,
        },
      ]),
      siteProfile: [
        { code: "SP6", value: "Y", evidence: "test", confidence: "high" },
      ],
    });
    expect(statusOf(result, "P7-04")).toBe("OPEN");
  });

  it("flags a tag that starts before the load event even when SP6 = N", async () => {
    const run = (beforeLoad: boolean) =>
      thirdPartyCheck.run({
        ...renderedWith([
          {
            url: "https://www.googletagmanager.com/gtag/js?id=G-X",
            resourceType: "script",
            status: 200,
            beforeLoad,
          },
        ]),
        siteProfile: [
          { code: "SP6", value: "N", evidence: "test", confidence: "high" },
        ],
      });
    expect(statusOf(await run(true), "P7-04")).toBe("OPEN");
    expect(statusOf(await run(false), "P7-04")).toBe("PASS");
  });
});

type Requests = Extract<
  CollectedData["render"],
  { status: "ok" }
>["pages"][number]["js"]["requests"];

function renderedWith(requests: Requests) {
  return context({
    pages: { status: "ok", snapshots: [page()] },
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
            requests,
            opacityZeroWords: 0,
            firstScreenActions: [],
          },
          noJs: { status: 200, nojsKey: "n", words: 100 },
          firstScreenKey: null,
          consoleErrors: [],
        },
      ],
    },
  });
}
