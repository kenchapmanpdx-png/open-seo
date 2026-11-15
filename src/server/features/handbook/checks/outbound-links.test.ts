import { describe, expect, it } from "vitest";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
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
});
