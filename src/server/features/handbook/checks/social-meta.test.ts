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
  it("opens P4-09 when og:image is missing", async () => {
    const result = await run([page("/a", { image: "" })]);
    expect(statusOf(result, "P4-09")).toBe("OPEN");
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
