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

  // WO-B20-014 (b): samanthaco.ca showed 2 dead targets as "4 pages".
  it("lists the linking pages in urls and the targets in the detail", async () => {
    const result = await run([
      snapshot("/", { links: ["/old"] }),
      snapshot("/about", { links: ["/old"] }),
      redirect("/old", "/new"),
    ]);
    const [p308] = result.findings.filter((f) => f.itemIds[0] === "P3-08");
    expect(p308?.urls).toEqual([`${ORIGIN}/`, `${ORIGIN}/about`]);
    expect(p308?.detail).toContain(`${ORIGIN}/old → ${ORIGIN}/new`);
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

  it("folds targets that redirect to themselves without the same query into one row", async () => {
    const self = (path: string) =>
      target(`${path}?page_id=7`, {
        status: 301,
        finalUrl: new URL(path, ORIGIN).href,
        method: "HEAD",
      });
    const result = await probed(
      [snapshot("/", { links: ["/a/?page_id=7", "/b/?page_id=7"] })],
      [self("/a/"), self("/b/")],
    );
    const finding = result.findings.find((f) => f.itemIds.includes("P3-08"));
    expect(finding?.detail).toMatch(
      /^2 URLs drop the query \?page_id=7 and redirect to the same page/,
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
