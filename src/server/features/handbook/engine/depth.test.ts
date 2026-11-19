import { describe, expect, it } from "vitest";
import {
  depthLine,
  estimateRunMinutes,
  infiniteSpaceGuard,
  resolveDepth,
  resolveLighthouseScope,
  resolveMaxPages,
  stratifiedFill,
} from "./depth";

const site = "https://example.com";

describe("depth + caps", () => {
  it("CLI wins over env; default full; quick keeps the caller's cap", () => {
    expect(resolveDepth(undefined)).toBe("full");
    expect(resolveDepth("quick")).toBe("quick");
    expect(resolveDepth("quick", "full")).toBe("full");
    expect(
      resolveMaxPages({ depth: "full", env: undefined, quickDefault: 60 }),
    ).toBe(1000);
    expect(
      resolveMaxPages({ depth: "quick", env: undefined, quickDefault: 60 }),
    ).toBe(60);
    expect(
      resolveMaxPages({
        depth: "full",
        env: "300",
        cli: "40",
        quickDefault: 60,
      }),
    ).toBe(40);
  });

  it("stratified fill keeps every template's first URL before seconds", () => {
    const groups = new Map([
      ["/blog/*", ["/blog/a", "/blog/b", "/blog/c"]],
      ["/shop/*", ["/shop/a", "/shop/b"]],
      ["/", ["/"]],
    ]);
    expect(stratifiedFill(groups, 4)).toEqual([
      "/blog/a",
      "/shop/a",
      "/",
      "/blog/b",
    ]);
  });

  it("guard caps /page/N/ at 20 and drops query variants of a listed path", () => {
    const pages = Array.from(
      { length: 40 },
      (_, i) => `${site}/calendar/page/${i + 1}/`,
    );
    const kept = infiniteSpaceGuard([
      `${site}/shop/`,
      `${site}/shop/?sort=price`,
      `${site}/search?q=a`,
      `${site}/search?q=b`,
      ...pages,
    ]);
    expect(kept.filter((u) => u.includes("/page/"))).toHaveLength(20);
    expect(kept).not.toContain(`${site}/shop/?sort=price`);
    expect(kept.filter((u) => u.includes("/search"))).toEqual([
      `${site}/search?q=a`,
    ]);
  });

  it("flags partial coverage below 90 % read", () => {
    expect(depthLine("full", { discovered: 100, read: 89, capped: true })).toBe(
      "Depth: full · read 89 of 100 discovered · partial coverage",
    );
    expect(depthLine("full", { discovered: 100, read: 90, capped: true })).toBe(
      "Depth: full · read 90 of 100 discovered",
    );
  });

  it("Lighthouse all adds 0.6 min per page to the estimate; default templates", () => {
    expect(estimateRunMinutes(100, "all")).toBe(
      estimateRunMinutes(100, "templates") + 60,
    );
    expect(resolveLighthouseScope(undefined)).toBe("templates");
    expect(resolveLighthouseScope("templates", "all")).toBe("all");
  });
});
