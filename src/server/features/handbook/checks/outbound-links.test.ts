import { describe, expect, it } from "vitest";
import type {
  OutboundData,
  PageSnapshot,
} from "@/server/features/handbook/contracts/collectors";
import { context, snapshot, statusOf } from "./check-test-fixtures";
import { outboundLinksCheck } from "./outbound-links";

function page(rel: string | null): PageSnapshot {
  const base = snapshot("/");
  return {
    ...base,
    links: [
      {
        href: "https://example.org/",
        text: "x",
        rel,
        target: "_blank",
        ariaLabel: null,
      },
    ],
  };
}

const run = (s: PageSnapshot) =>
  outboundLinksCheck.run(context({ pages: { status: "ok", snapshots: [s] } }));

describe("botfetch.outbound-links", () => {
  it('opens P4-12 on target="_blank" without rel', async () => {
    expect(statusOf(await run(page(null)), "P4-12")).toBe("OPEN");
  });

  it('passes P4-12 with rel="noopener"', async () => {
    expect(statusOf(await run(page("noopener")), "P4-12")).toBe("PASS");
  });

  const outbound = (browser: OutboundData["links"][number]["browser"]) =>
    outboundLinksCheck.run(
      context({
        pages: { status: "ok", snapshots: [page("noopener")] },
        outbound: {
          status: "ok",
          links: [
            {
              url: "https://example.org/",
              sourceUrls: ["https://example.com/"],
              browser,
              bot: null,
            },
          ],
        },
      }),
    );

  it.each([
    ["no answer", null],
    ["404", { status: 404, finalUrl: "https://example.org/" }],
    ["410", { status: 410, finalUrl: "https://example.org/" }],
  ])("opens P5-13 on a dead link (%s)", async (_, browser) => {
    expect(statusOf(await outbound(browser), "P5-13")).toBe("OPEN");
  });

  it.each([
    ["redirect", { status: 200, finalUrl: "https://example.org/new" }],
    ["platform block", { status: 403, finalUrl: "https://example.org/" }],
    ["other status", { status: 400, finalUrl: "https://example.org/" }],
  ])("keeps P5-13 passing on a %s (info only)", async (_, browser) => {
    expect(statusOf(await outbound(browser), "P5-13")).toBe("PASS");
  });
});
