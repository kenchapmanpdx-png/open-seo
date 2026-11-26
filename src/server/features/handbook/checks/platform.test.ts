import { describe, expect, it } from "vitest";
import { context, ORIGIN, snapshot } from "./check-test-fixtures";
import { platformCheck } from "./platform";

describe("platformCheck", () => {
  it("identifies Vercel from x-vercel-id", async () => {
    const result = await platformCheck.run(
      context({
        pages: { status: "ok", snapshots: [snapshot("/")] },
        headers: {
          status: "ok",
          responses: [
            {
              url: `${ORIGIN}/`,
              status: 200,
              headers: [["x-vercel-id", "iad1::abc"]],
            },
          ],
        },
      }),
    );
    const verdict = result.statuses.find((s) => s.itemId === "P0-03");
    expect(verdict?.status).toBe("PASS");
    expect(verdict?.note).toContain("Vercel");
  });

  // Field test 8 (bluebonnetroofs.com, Showit): no header or generator, only
  // the builder's script hosts. Every builder the generator list names must
  // be recognised from its script host too.
  it.each([
    ["Showit", "https://lib.showit.com/engine/2.8.0/showit.min.js"],
    ["GoDaddy", "https://img1.wsimg.com/blobby/go/app.js"],
    ["Duda", "https://irp.cdn-website.com/js/runtime.js"],
    ["Weebly", "https://cdn2.editmysite.com/js/site/main.js"],
    ["Jimdo", "https://assets.jimstatic.com/web.js"],
    ["Framer", "https://framerusercontent.com/sites/x/script.mjs"],
    ["Wix", "https://static.parastorage.com/services/wix.js"],
    // theogdenver.com (WO-B25-006): BentoBox prints no generator meta.
    [
      "BentoBox",
      "https://theme-assets.getbento.com/sensei/abc/assets/js/head.min.js",
    ],
  ])("identifies %s from its script host", async (platform, src) => {
    const page = snapshot("/");
    const markup = {
      ...page.markup,
      scripts: [{ src, type: null, async: false, defer: false, inHead: true }],
    };
    const withScript = { ...page, markup };
    const result = await platformCheck.run(
      context({
        pages: { status: "ok", snapshots: [withScript] },
        headers: { status: "ok", responses: [] },
      }),
    );
    const verdict = result.statuses.find((s) => s.itemId === "P0-03");
    expect(verdict?.status).toBe("PASS");
    expect(verdict?.note).toContain(platform);
  });

  it("keeps a header platform over a BentoBox script (WO-B25-006)", async () => {
    const page = snapshot("/");
    const markup = {
      ...page.markup,
      scripts: [
        {
          src: "https://app-assets.getbento.com/widget.js",
          type: null,
          async: false,
          defer: false,
          inHead: true,
        },
      ],
    };
    const result = await platformCheck.run(
      context({
        pages: { status: "ok", snapshots: [{ ...page, markup }] },
        headers: {
          status: "ok",
          responses: [
            {
              url: `${ORIGIN}/`,
              status: 200,
              headers: [["x-wix-request-id", "1"]],
            },
          ],
        },
      }),
    );
    const verdict = result.statuses.find((s) => s.itemId === "P0-03");
    expect(verdict?.note).toContain("Wix");
  });
});
