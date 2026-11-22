import { describe, expect, it } from "vitest";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import { context, snapshot } from "./check-test-fixtures";
import { suppLinksCheck } from "./supp-links";

function page(
  links: { href: string; text: string; target?: string; ariaLabel?: string }[],
): PageSnapshot {
  return {
    ...snapshot("/a"),
    links: links.map((l) => ({
      href: l.href,
      text: l.text,
      rel: null,
      target: l.target ?? null,
      ariaLabel: l.ariaLabel ?? null,
    })),
  };
}

const run = (snapshots: PageSnapshot[]) =>
  suppLinksCheck.run(context({ pages: { status: "ok", snapshots } }));

const titles = async (snapshots: PageSnapshot[]) =>
  (await run(snapshots)).findings.map((f) => f.title);

describe("crawl.supp-links", () => {
  it("flags generic anchors (internal and external), unnamed links and internal new-tab targets", async () => {
    expect(
      await titles([
        page([
          { href: "https://example.com/pricing", text: "Read more »" },
          {
            href: "https://example.com/about",
            text: "About",
            target: "_blank",
          },
          { href: "https://other.org/", text: "Website", target: "_blank" },
          { href: "https://example.com/contact", text: " " },
        ]),
      ]),
    ).toEqual([
      expect.stringMatching(/^Generic anchor text .* internal links$/),
      expect.stringMatching(/^Generic anchor text .* external links$/),
      expect.stringMatching(/^Links with no anchor text/),
      expect.stringMatching(/^Internal links open a new tab/),
    ]);
  });

  it("ignores descriptive and aria-labelled links, in-page controls and external new-tab links", async () => {
    expect(
      await titles([
        page([
          {
            href: "https://example.com/pricing",
            text: "Read the pricing guide",
          },
          {
            href: "https://example.com/faq",
            text: "Learn more",
            ariaLabel: "Learn more about refunds",
          },
          { href: "https://other.org/", text: "Aveda", target: "_blank" },
          { href: "https://example.com/a#menu", text: "" },
          { href: "javascript:void(0)", text: "" },
          { href: "https://example.com/x", text: "", ariaLabel: "Instagram" },
        ]),
      ]),
    ).toEqual([]);
  });
});
