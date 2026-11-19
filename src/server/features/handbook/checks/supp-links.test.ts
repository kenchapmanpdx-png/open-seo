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

const ids = async (snapshots: PageSnapshot[]) =>
  (await run(snapshots)).findings.flatMap((f) => f.itemIds);

describe("crawl.supp-links", () => {
  it("flags generic anchors and new-tab targets on internal links only", async () => {
    expect(
      await ids([
        page([
          { href: "https://example.com/pricing", text: "Read more »" },
          {
            href: "https://example.com/about",
            text: "About",
            target: "_blank",
          },
        ]),
      ]),
    ).toEqual(["SUPP-01", "SUPP-02"]);
  });

  it("ignores descriptive, aria-labelled and external links", async () => {
    expect(
      await ids([
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
          { href: "https://other.org/", text: "Click here", target: "_blank" },
        ]),
      ]),
    ).toEqual([]);
  });
});
