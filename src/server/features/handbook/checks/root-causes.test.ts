import { describe, expect, it } from "vitest";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import { context, ORIGIN, snapshot, textPage } from "./check-test-fixtures";
import { rootCausesCheck } from "./root-causes";

const run = (snapshots: PageSnapshot[], attachmentSitemap: string[] = []) =>
  rootCausesCheck.run(
    context({
      pages: { status: "ok", snapshots },
      sitemap: {
        status: "ok",
        sources: [],
        urls: attachmentSitemap.map((p) => ({
          loc: new URL(p, ORIGIN).href,
          lastmod: null,
          source: `${ORIGIN}/attachment-sitemap.xml`,
        })),
      },
    }),
  );

const attachment = (path: string): PageSnapshot => {
  const s = snapshot(path);
  return {
    ...s,
    markup: {
      ...s.markup,
      headLinks: [
        {
          rel: "alternate",
          href: `${ORIGIN}/wp-json/wp/v2/media/12`,
          as: null,
          type: "application/json",
        },
      ],
    },
  };
};

const withLinks = (page: PageSnapshot, links: string[]): PageSnapshot => ({
  ...page,
  links: snapshot(page.url, { links }).links,
});

const titles = async (snapshots: PageSnapshot[], sitemap?: string[]) =>
  (await run(snapshots, sitemap)).findings.map((f) => [f.itemIds[0], f.urls]);

describe("crawl.root-causes", () => {
  it("reports WordPress attachment pages as one finding (REST media link or attachment sitemap)", async () => {
    expect(
      await titles(
        [
          attachment("/home/y69a5975/"),
          snapshot("/home/photo-2/"),
          snapshot("/about/"),
        ],
        ["/home/photo-2/"],
      ),
    ).toEqual([
      ["P3-12", [`${ORIGIN}/home/y69a5975/`, `${ORIGIN}/home/photo-2/`]],
    ]);
  });

  it("reports placeholder text and the archives that list only demo pages", async () => {
    const lorem = "Far far away, behind the word mountains, far from Vokalia.";
    const result = await run([
      withLinks(textPage("/demo-post/", lorem), ["/about/"]),
      withLinks(snapshot("/tag/art/"), ["/demo-post/", "/about/"]),
      withLinks(snapshot("/tag/news/"), [
        "/demo-post/",
        "/real-post/",
        "/about/",
      ]),
      withLinks(snapshot("/about/"), ["/about/"]),
      textPage("/real-post/", "Our colour team trains every month."),
    ]);
    expect(result.findings.map((f) => [f.itemIds[0], f.urls])).toEqual([
      ["P5-04", [`${ORIGIN}/demo-post/`]],
      ["P3-12", [`${ORIGIN}/demo-post/`, `${ORIGIN}/tag/art/`]],
    ]);
  });

  it("stays silent on a clean site", async () => {
    expect(
      await titles([textPage("/", "Haircuts and colour in Vancouver.")]),
    ).toEqual([]);
  });
});
