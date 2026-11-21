import { describe, expect, it } from "vitest";
import type {
  LinkTargetsData,
  PageSnapshot,
} from "@/server/features/handbook/contracts/collectors";
import { context, ORIGIN, snapshot, statusOf } from "./check-test-fixtures";
import { redirectedLinksCheck } from "./redirected-links";

const run = (snapshots: PageSnapshot[]) =>
  redirectedLinksCheck.run(context({ pages: { status: "ok", snapshots } }));

const probed = (
  snapshots: PageSnapshot[],
  targets: LinkTargetsData["targets"],
) =>
  redirectedLinksCheck.run(
    context({
      pages: { status: "ok", snapshots },
      linkTargets: { status: "ok", targets, found: targets.length },
    }),
  );

const target = (
  path: string,
  probe: LinkTargetsData["targets"][number]["probe"],
) => ({ url: new URL(path, ORIGIN).href, sourceUrls: [ORIGIN + "/"], probe });

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

  it("opens P3-08 on un-crawled redirecting targets, one row per final URL", async () => {
    const moved = {
      status: 301,
      finalUrl: new URL("/privacy/", ORIGIN).href,
      method: "HEAD" as const,
    };
    const result = await probed(
      [snapshot("/", { links: ["/?page_id=7", "/a/?page_id=7"] })],
      [target("/?page_id=7", moved), target("/a/?page_id=7", moved)],
    );
    expect(statusOf(result, "P3-08")).toBe("OPEN");
    const finding = result.findings.find((f) => f.itemIds.includes("P3-08"));
    expect(finding?.detail).toMatch(
      /^2 URLs → https:\/\/example\.com\/privacy\/, e\.g\./,
    );
  });

  it("counts un-crawled targets with no answer without flagging them", async () => {
    const result = await probed(
      [snapshot("/", { links: ["/gone"] })],
      [target("/gone", null)],
    );
    expect(statusOf(result, "P3-08")).toBe("PASS");
  });
});
