import { describe, expect, it } from "vitest";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import { context, ORIGIN, snapshot } from "./check-test-fixtures";
import { linkHygieneCheck } from "./link-hygiene";

const run = (snapshots: PageSnapshot[]) =>
  linkHygieneCheck.run(context({ pages: { status: "ok", snapshots } }));

const http = ORIGIN.replace("https://", "http://");

describe("crawl.link-hygiene", () => {
  it("reports mixed content, http:// internal links, meta refresh and malformed links", async () => {
    const base = snapshot("/a", {
      links: [
        `${http}/about/`,
        "https://other.org/",
        "/blog/http//example.org/",
        "mailto:info",
      ],
    });
    const page: PageSnapshot = {
      ...base,
      links: [
        ...base.links,
        {
          href: "htp://typo.org/",
          text: "x",
          rel: null,
          target: null,
          ariaLabel: null,
        },
      ],
      images: [{ ...hero, src: `${http}/logo.png` }],
      head: { ...base.head, meta: { "http-equiv:refresh": "0;url=/new/" } },
    };
    const result = await run([page]);
    expect(
      result.findings.map((f) => [f.itemIds[0], f.urls, f.detail]),
    ).toEqual([
      ["SUPP-21", [page.url], `${page.url} — ${http}/logo.png`],
      ["SUPP-22", [page.url], `${page.url} — ${http}/about/`],
      ["SUPP-23", [page.url], expect.stringContaining("0;url=/new/")],
      [
        "SUPP-24",
        [page.url],
        expect.stringMatching(
          /http\/\/example\.org.*mailto:info.*htp:\/\/typo/,
        ),
      ],
    ]);
  });

  it("reports links to temporary redirects and pages without a doctype", async () => {
    const moved: PageSnapshot = {
      ...snapshot("/old"),
      finalUrl: `${ORIGIN}/new`,
      redirectChain: [{ url: `${ORIGIN}/old`, status: 302 }],
    };
    const home: PageSnapshot = {
      ...snapshot("/", { links: ["/old"] }),
      doctype: null,
    };
    const result = await run([
      home,
      moved,
      { ...snapshot("/new"), doctype: "html" },
    ]);
    expect(result.findings.map((f) => [f.itemIds[0], f.detail])).toEqual([
      ["SUPP-25", `${home.url} — ${ORIGIN}/old → 302 → ${ORIGIN}/new`],
      ["SUPP-26", `${home.url} — no <!doctype>`],
    ]);
  });

  it("stays silent on clean https pages", async () => {
    const result = await run([
      snapshot("/a", {
        links: ["/b", "https://other.org/", "tel:+15035550100"],
      }),
    ]);
    expect(result.findings).toEqual([]);
  });
});

const hero: PageSnapshot["images"][number] = {
  src: "",
  dataSrc: null,
  srcset: null,
  alt: "Logo",
  width: "10",
  height: "10",
  loading: null,
  fetchpriority: null,
};
