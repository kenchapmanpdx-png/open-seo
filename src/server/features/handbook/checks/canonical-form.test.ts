import { describe, expect, it } from "vitest";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import { canonicalFormCheck } from "./canonical-form";
import { context, snapshot, statusOf } from "./check-test-fixtures";

const run = (snapshots: PageSnapshot[]) =>
  canonicalFormCheck.run(context({ pages: { status: "ok", snapshots } }));

describe("crawl.canonical-form", () => {
  it("passes a self-canonical site whose links use the canonical form", async () => {
    const result = await run([
      snapshot("/", { links: ["/about/"] }),
      snapshot("/about/", { links: ["/"] }),
    ]);
    expect(statusOf(result, "P3-04")).toBe("PASS");
  });

  it("opens when a link drops the canonical trailing slash", async () => {
    const result = await run([
      snapshot("/", { links: ["/about"] }),
      snapshot("/about/"),
    ]);
    expect(result.findings.map((f) => f.title)).toEqual([
      "Internal links use a non-canonical URL form",
    ]);
  });

  it("opens on a tracking parameter in the canonical", async () => {
    const result = await run([snapshot("/", { canonical: "/?utm_source=x" })]);
    expect(result.findings.map((f) => f.title)).toContain(
      "Canonical URLs carry tracking parameters",
    );
  });
});
