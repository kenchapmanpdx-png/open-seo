import { describe, expect, it } from "vitest";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import { context, ORIGIN, snapshot, statusOf } from "./check-test-fixtures";
import { redirectedLinksCheck } from "./redirected-links";

const run = (snapshots: PageSnapshot[]) =>
  redirectedLinksCheck.run(context({ pages: { status: "ok", snapshots } }));

const redirect = (path: string, to: string): PageSnapshot => ({
  ...snapshot(path),
  finalUrl: new URL(to, ORIGIN).href,
});

describe("crawl.redirected-links", () => {
  it("opens P3-08 on a link to a 301 target", async () => {
    const result = await run([
      snapshot("/", { links: ["/old"] }),
      redirect("/old", "/new"),
    ]);
    expect(statusOf(result, "P3-08")).toBe("OPEN");
    expect(statusOf(result, "P3-05")).toBe("PASS");
  });

  it("opens P3-05 when a deep URL redirects to the homepage", async () => {
    const result = await run([snapshot("/"), redirect("/events/old", "/")]);
    expect(statusOf(result, "P3-05")).toBe("OPEN");
  });

  it("passes P3-08 when every link targets a final 200 URL", async () => {
    const result = await run([
      snapshot("/", { links: ["/a"] }),
      snapshot("/a", { links: ["/"] }),
    ]);
    expect(statusOf(result, "P3-08")).toBe("PASS");
  });
});
