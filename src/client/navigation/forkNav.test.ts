import { afterEach, describe, expect, it, vi } from "vitest";
import { getForkNavGroups } from "@/client/navigation/forkNav";
import { getProjectNavGroups } from "@/client/navigation/items";

const paths = (groups: { items: readonly { to: string }[] }[]) =>
  groups.flatMap((g) => g.items.map((i) => i.to));

describe("fork sidebar", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("places every upstream item exactly once", () => {
    vi.stubEnv("VITE_FORK_NAV", "0");
    const upstream = paths(getProjectNavGroups("p1"));
    expect(upstream).not.toContain("/p/$projectId/handbook/check");
    vi.unstubAllEnvs();
    const fork = paths(getProjectNavGroups("p1"));

    for (const path of upstream) {
      expect(fork.filter((p) => p === path)).toHaveLength(1);
    }
    expect(fork).toContain("/p/$projectId/handbook/check");
  });

  it("puts an unknown upstream item under More", () => {
    const groups = getForkNavGroups(
      "p1",
      [{ to: "/p/$projectId/new-page", label: "New page" }],
      { to: "/ai", label: "Agent setup" },
    );
    const more = groups?.find((g) => g.label === "More");
    expect(more?.items.map((i) => i.to)).toContain("/p/$projectId/new-page");
  });
});
