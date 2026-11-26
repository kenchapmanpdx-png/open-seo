import { describe, expect, it } from "vitest";
import type {
  CollectedData,
  PageSnapshot,
} from "@/server/features/handbook/contracts/collectors";
import { context, snapshot, statusOf } from "./check-test-fixtures";
import { headTagsCheck } from "./head-tags";

function page(
  path: string,
  head: Partial<PageSnapshot["head"]> = {},
  h1 = [path],
): PageSnapshot {
  const base = snapshot(path);
  return {
    ...base,
    h1,
    head: {
      ...base.head,
      title: `${path} · Brand`,
      metaDescription: `About ${path}`,
      viewport: "width=device-width, initial-scale=1",
      ...head,
    },
  };
}

const run = (snapshots: PageSnapshot[], extra: Partial<CollectedData> = {}) =>
  headTagsCheck.run(context({ pages: { status: "ok", snapshots }, ...extra }));

describe("crawl.head-tags", () => {
  it("groups duplicate titles and cites every page", async () => {
    const result = await run([
      page("/a", { title: "Same · Brand" }),
      page("/b", { title: "Same · Brand" }),
    ]);
    const dup = result.findings.find((f) => f.title.startsWith("Duplicate"));
    expect(dup?.urls).toHaveLength(2);
  });

  it("does not count a page canonical to another URL as a duplicate (WO-B19-005)", async () => {
    const shop = page("/shop");
    const pageOne = {
      ...page("/shop?page=1", { title: shop.head.title }, [...shop.h1]),
      head: {
        ...shop.head,
        canonical: shop.url,
      },
    };
    expect(statusOf(await run([shop, pageOne]), "P4-01")).toBe("PASS");
  });

  it("flags titles without the majority brand suffix, not a brand prefix", async () => {
    const result = await run([
      page("/", { title: "Brand | Tagline" }),
      page("/a"),
      page("/b"),
      page("/c"),
      page("/d", { title: "Long event name in Town" }),
    ]);
    const suffix = result.findings.find((f) => f.title.includes("suffix"));
    expect(suffix?.urls).toEqual([snapshot("/d").url]);
  });

  it("counts a title carrying og:site_name as branded when a keyword tagline is the suffix (WO-B25-002)", async () => {
    const site = { og: { site_name: "Brand Co" } };
    const tagged = (path: string) =>
      page(path, {
        ...site,
        title: `${path} — Brand Co | Keyword City Tagline`,
      });
    const result = await run([
      page("/", { ...site, title: "Brand Co | Something else" }),
      tagged("/a"),
      tagged("/b"),
      tagged("/c"),
      tagged("/d"),
      tagged("/e"),
      // nwpersonaltraining.com home: neither the suffix nor the site name.
      page("/f", { ...site, title: "Home | Northwest Personal Training" }),
    ]);
    const suffix = result.findings.find((f) => f.title.includes("suffix"));
    expect(suffix?.urls).toEqual([snapshot("/f").url]);
    expect(suffix?.title).toContain('or site name "Brand Co"');
  });

  it("flags titles over 70 characters only", async () => {
    const result = await run([
      // spoiledspaandsalon.com product page, 84 characters (B18 WO-004).
      page("/long", {
        title:
          "Cord Scrunchie Autumn Winter Corduroy Solid Fabric Scrunchies | Spoiled Salon Grand",
      }),
      page("/edge", { title: `${"x".repeat(62)} · Brand` }),
    ]);
    const long = result.findings.find((f) => f.title.startsWith("Titles over"));
    expect(long?.urls).toEqual([snapshot("/long").url]);
  });

  it("opens P4-03 on a missing description", async () => {
    const result = await run([page("/a", { metaDescription: " " })]);
    expect(statusOf(result, "P4-03")).toBe("OPEN");
  });

  it("opens P4-04 when maximum-scale=1 blocks zoom", async () => {
    const result = await run([
      page("/a", {
        viewport: "width=device-width, initial-scale=1, maximum-scale=1",
      }),
    ]);
    expect(statusOf(result, "P4-04")).toBe("OPEN");
  });

  // WO-B23-005: only a year before the crawl's year reads stale; "Since 2005" is a founding year.
  it("flags only past years in headings, judged by the crawl's Date header", async () => {
    const dated = (h1: string): PageSnapshot => ({
      ...page("/", {}, [h1]),
      headers: [["date", "Wed, 25 Nov 2026 12:00:00 GMT"]],
    });
    const titles = async (h1: string) =>
      (await run([dated(h1)])).findings
        .filter((f) => f.itemIds[0] === "P4-06")
        .map((f) => [f.severity, f.title]);
    expect(await titles("Best plumbers of 2025")).toEqual([
      ["S3", "Past year in listing / evergreen headings"],
    ]);
    expect(await titles("Best plumbers of 2026")).toEqual([]);
    expect(await titles("Plumber in Mesa · Since 2005")).toEqual([]);
    expect(await titles("Est. 2010 · © 2019 Mesa Plumbing")).toEqual([]);
  });

  it("exempts event pages from the year rule", async () => {
    const home = page("/", {}, ["Spring Run 2024"]);
    const result = await run([home], {
      jsonld: {
        status: "ok",
        pages: [
          {
            url: home.url,
            blocks: [],
            nodes: [{ id: null, types: ["SportsEvent"], properties: {} }],
          },
        ],
      },
    });
    expect(statusOf(result, "P4-06")).toBe("PASS");
    expect(statusOf(await run([home]), "P4-06")).toBe("OPEN");
  });
});
