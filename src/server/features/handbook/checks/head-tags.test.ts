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

  it("exempts event pages from the year rule", async () => {
    const home = page("/", {}, ["Spring Run 2026"]);
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
