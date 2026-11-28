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
    ["404", { status: 404, finalUrl: "https://example.org/" }],
    ["410", { status: 410, finalUrl: "https://example.org/" }],
    // The probe already retried a 502 / 504 once (ADR-031 §1).
    ["502 after the retry", { status: 502, finalUrl: "https://example.org/" }],
    ["500", { status: 500, finalUrl: "https://example.org/" }],
  ])("opens P5-13 on a dead link (%s)", async (_, browser) => {
    expect(statusOf(await outbound(browser), "P5-13")).toBe("OPEN");
  });

  it.each([
    ["followed", { status: 200, finalUrl: "https://example.org/new" }],
    ["unfollowed 302", { status: 302, finalUrl: "https://example.org/" }],
  ])(
    "reports a %s redirect as a separate S4 info finding",
    async (_, browser) => {
      const result = await outbound(browser);
      expect(result.findings.map((f) => f.title)).toEqual([
        "Outbound links point at redirected URLs (info)",
      ]);
    },
  );

  it("lists a link with no answer as not confirmed dead, outside the finding (WO-B26-006)", async () => {
    const result = await outbound(null);
    expect(statusOf(result, "P5-13")).toBe("PASS");
    expect(JSON.stringify(result)).toContain(
      "could not be reached from this machine (not confirmed dead): https://example.org/",
    );
  });

  const outboundLinks = (
    links: [string, OutboundData["links"][number]["browser"]][],
  ) =>
    outboundLinksCheck.run(
      context({
        pages: { status: "ok", snapshots: [page("noopener")] },
        outbound: {
          status: "ok",
          links: links.map(([url, browser]) => ({
            url,
            sourceUrls: ["https://example.com/"],
            browser,
            bot: null,
          })),
        },
      }),
    );

  it("keeps the not-confirmed-dead line when only redirects are reported", async () => {
    const result = await outboundLinks([
      ["https://example.org/", null],
      [
        "https://moved.example/",
        { status: 301, finalUrl: "https://moved.example/" },
      ],
    ]);
    const redirects = result.findings.find((f) =>
      f.title.includes("redirected"),
    );
    expect(redirects?.detail).toContain(
      "could not be reached from this machine (not confirmed dead): https://example.org/",
    );
  });

  it("counts a no-answer link to a host with no domain as dead", async () => {
    const result = await outboundLinks([["http://myhairstylist/", null]]);
    expect(statusOf(result, "P5-13")).toBe("OPEN");
    expect(result.findings[0]?.detail).toContain("http://myhairstylist/");
  });

  it.each([
    ["platform block", { status: 403, finalUrl: "https://example.org/" }],
    ["other status", { status: 400, finalUrl: "https://example.org/" }],
    [
      "503 (often a bot wall)",
      { status: 503, finalUrl: "https://example.org/" },
    ],
  ])("keeps P5-13 passing on a %s (info only)", async (_, browser) => {
    expect(statusOf(await outbound(browser), "P5-13")).toBe("PASS");
  });
});
