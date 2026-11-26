import { describe, expect, it } from "vitest";
import type { VariantsData } from "@/server/features/handbook/contracts/collectors";
import { context, ORIGIN, snapshot, statusOf } from "./check-test-fixtures";
import { notFoundCheck } from "./not-found";

const URL_ = `${ORIGIN}/handbook-probe-x-not-found`;

function run(
  status: number,
  extra: Partial<VariantsData["probes"][number]> = {},
) {
  return notFoundCheck.run(
    context({
      variants: {
        status: "ok",
        probes: [
          {
            kind: "unknown-path",
            url: URL_,
            finalUrl: URL_,
            status,
            redirectChain: [],
            title: "Page not found",
            words: 12,
            ...extra,
          },
        ],
      },
      pages: { status: "ok", snapshots: [snapshot("/")] },
    }),
  );
}

describe("crawl.not-found", () => {
  it("opens P3-10 at S1 when an unknown path answers 200", async () => {
    const result = await run(200);
    expect(statusOf(result, "P3-10")).toBe("OPEN");
    expect(result.findings[0]?.severity).toBe("S1");
  });

  it("opens P3-10 when an unknown path redirects to the homepage", async () => {
    const result = await run(200, {
      finalUrl: `${ORIGIN}/`,
      redirectChain: [{ url: URL_, status: 302 }],
    });
    expect(statusOf(result, "P3-10")).toBe("OPEN");
  });

  it("passes both items on a real 404 with its own template", async () => {
    const result = await run(404);
    expect(statusOf(result, "P3-10")).toBe("PASS");
    expect(statusOf(result, "P3-11")).toBe("PASS");
  });

  it("opens P3-11 when the 404 body is the size of the homepage", async () => {
    const result = await run(404, { words: 100 });
    expect(statusOf(result, "P3-11")).toBe("OPEN");
  });

  it("cites the live page (and its canonical) the 404 body duplicates", async () => {
    const about = snapshot("/about", { canonical: "/about-rms" });
    const result = await notFoundCheck.run(
      context({
        variants: {
          status: "ok",
          probes: [
            {
              kind: "unknown-path",
              url: URL_,
              finalUrl: URL_,
              status: 404,
              redirectChain: [],
              title: "About | RMS",
              words: 300,
            },
          ],
        },
        pages: {
          status: "ok",
          snapshots: [
            { ...about, head: { ...about.head, title: "About | RMS" } },
          ],
        },
      }),
    );
    expect(result.findings[0]?.urls).toEqual([URL_, `${ORIGIN}/about-rms`]);
  });

  it("does not take a shared bare-brand title as a twin unless the word counts agree (WO-B25-003)", async () => {
    const page = (path: string, title: string, words: number) => {
      const s = snapshot(path);
      return {
        ...s,
        wordsRaw: words,
        head: { ...s.head, title, og: { site_name: "Brand" } },
      };
    };
    const probe = (title: string, words: number) =>
      notFoundCheck.run(
        context({
          variants: {
            status: "ok",
            probes: [
              {
                kind: "unknown-path",
                url: URL_,
                finalUrl: URL_,
                status: 404,
                redirectChain: [],
                title,
                words,
              },
            ],
          },
          pages: {
            status: "ok",
            snapshots: [
              page("/", "Brand | Tagline", 600),
              page("/cart", "Brand", 120),
            ],
          },
        }),
      );
    // love4pawsrescue.com: the 404 template and /cart share the bare brand.
    expect(statusOf(await probe("Brand", 209), "P3-11")).toBe("PASS");
    // The 404 body is /cart itself: same bare title, same size.
    expect(statusOf(await probe("Brand", 125), "P3-11")).toBe("OPEN");
  });

  it("still takes a non-brand shared title as a twin (example.com)", async () => {
    const home = snapshot("/");
    const result = await notFoundCheck.run(
      context({
        variants: {
          status: "ok",
          probes: [
            {
              kind: "unknown-path",
              url: URL_,
              finalUrl: URL_,
              status: 404,
              redirectChain: [],
              title: "Example Domain",
              words: 27,
            },
          ],
        },
        pages: {
          status: "ok",
          snapshots: [
            {
              ...home,
              wordsRaw: 27,
              head: { ...home.head, title: "Example Domain" },
            },
          ],
        },
      }),
    );
    expect(statusOf(result, "P3-11")).toBe("OPEN");
  });
});
