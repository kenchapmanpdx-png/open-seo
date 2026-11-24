import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { listPage } from "./pagination";

describe("listPage", () => {
  it("reads every numbered-page form and its first page", () => {
    expect(
      [
        "https://example.com/press/?p=2",
        "https://example.com/shop?page=3&sort=new",
        "https://example.com/blog/page/4/",
        "https://example.com/events/page/2.html",
        "https://example.com/?s=coffee",
        "https://example.com/press/?p=about",
      ].map(listPage),
    ).toEqual([
      { page: 2, firstPage: "https://example.com/press/" },
      { page: 3, firstPage: "https://example.com/shop?sort=new" },
      { page: 4, firstPage: "https://example.com/blog/" },
      { page: 2, firstPage: "https://example.com/events/" },
      null,
      null,
    ]);
  });

  // Run 96 (ADR-035 class guard): crawl, intake, P3-04 and P3-21 disagreed on
  // what a paginated URL is because each kept its own regex.
  it("is the only pagination pattern in the Handbook sources", () => {
    const root = join(__dirname, "..");
    const pattern = /page=\\d|\\\/page\\\/\\d|"paged"|"pagenum"/;
    const offenders = ["engine", "checks", "collectors"].flatMap((dir) =>
      readdirSync(join(root, dir))
        .filter(
          (f) =>
            f.endsWith(".ts") &&
            !f.endsWith(".test.ts") &&
            !(dir === "engine" && f === "pagination.ts"),
        )
        .filter((f) => pattern.test(readFileSync(join(root, dir, f), "utf8")))
        .map((f) => `${dir}/${f}`),
    );
    expect(offenders).toEqual([]);
  });
});
