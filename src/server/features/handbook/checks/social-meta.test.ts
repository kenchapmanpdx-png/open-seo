import { describe, expect, it } from "vitest";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import { context, ORIGIN, snapshot, statusOf } from "./check-test-fixtures";
import { socialMetaCheck } from "./social-meta";

function page(path: string, og: Record<string, string> = {}): PageSnapshot {
  const base = snapshot(path, { robotsMeta: "max-image-preview:large" });
  return {
    ...base,
    head: {
      ...base.head,
      og: {
        title: path,
        description: path,
        url: base.url,
        image: `${ORIGIN}/img${path}.jpg`,
        ...og,
      },
      twitter: { card: "summary_large_image" },
    },
  };
}

const run = (snapshots: PageSnapshot[]) =>
  socialMetaCheck.run(context({ pages: { status: "ok", snapshots } }));

describe("crawl.social-meta", () => {
  // WO-B20-014 (a): samanthaco.ca lacked only og:url on 28 pages.
  it("names the missing tag when every page lacks the same one", async () => {
    const result = await run([
      page("/a", { url: "" }),
      page("/b", { url: "" }),
    ]);
    expect(result.findings.map((f) => f.title)).toEqual([
      "Pages missing og:url",
    ]);
  });

  it("keeps the general title when pages lack different tags", async () => {
    const result = await run([
      page("/a", { url: "" }),
      page("/b", { image: "" }),
    ]);
    expect(result.findings.map((f) => f.title)).toEqual([
      "Pages missing Open Graph / Twitter tags",
    ]);
  });

  it("opens P4-09 when the logo is the site-wide share image", async () => {
    const logo = { image: `${ORIGIN}/logo.png` };
    const result = await run([page("/a", logo), page("/b", logo)]);
    expect(result.findings.map((f) => f.title)).toContain(
      "Site logo used as the share image",
    );
  });

  it("passes P4-11 when max-image-preview:large is present", async () => {
    const result = await run([page("/a")]);
    expect(statusOf(result, "P4-11")).toBe("PASS");
  });
});
