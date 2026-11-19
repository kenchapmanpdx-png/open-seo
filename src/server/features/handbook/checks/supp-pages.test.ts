import { describe, expect, it } from "vitest";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import { context, ORIGIN, snapshot } from "./check-test-fixtures";
import { suppPagesCheck } from "./supp-pages";

const run = (snapshots: PageSnapshot[], sitemap: string[]) =>
  suppPagesCheck.run(
    context({
      pages: { status: "ok", snapshots },
      sitemap: {
        status: "ok",
        sources: [],
        urls: sitemap.map((p) => ({
          loc: new URL(p, ORIGIN).href,
          lastmod: null,
          source: "s",
        })),
      },
    }),
  );

const urlsOf = async (snapshots: PageSnapshot[], sitemap: string[]) =>
  (await run(snapshots, sitemap)).findings
    .filter((f) => f.itemIds[0] === "SUPP-05")
    .flatMap((f) => f.urls);

describe("crawl.supp-pages", () => {
  it("flags dev / numbered-copy slugs that are indexable and in the sitemap", async () => {
    const pages = ["/landing-dev.html", "/about-2/", "/top-10", "/test"];
    expect(
      await urlsOf(
        [
          ...pages.map((p) => snapshot(p)),
          snapshot("/staging", { robotsMeta: "noindex" }),
        ],
        [...pages.slice(0, 3), "/staging"],
      ),
    ).toEqual([`${ORIGIN}/landing-dev.html`, `${ORIGIN}/about-2/`]);
  });

  it("flags empty social meta only", async () => {
    const base = snapshot("/a");
    const page = {
      ...base,
      head: { ...base.head, og: { title: "A" }, twitter: { site: "" } },
    };
    const result = await run([page, snapshot("/b")], []);
    expect(result.findings).toMatchObject([
      { itemIds: ["SUPP-06"], urls: [`${ORIGIN}/a`] },
    ]);
  });
});
