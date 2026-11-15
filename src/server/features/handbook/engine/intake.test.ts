import { describe, expect, it } from "vitest";
import type { CollectedData } from "@/server/features/handbook/contracts/collectors";
import {
  ORIGIN,
  snapshot,
} from "@/server/features/handbook/checks/check-test-fixtures";
import { runIntake } from "./intake";

function template(pattern: string, count: number) {
  const urls = Array.from(
    { length: count },
    (_, i) => `${ORIGIN}${pattern.replace("*", `p${i}`)}`,
  );
  return {
    key: `${pattern}:${count}`,
    urlPattern: pattern,
    skeletonHash: String(count),
    urls,
    samples: [{ url: urls[0], rank: 1 as const, reason: "first" as const }],
  };
}

const intake = (collected: Partial<CollectedData>) =>
  runIntake({ collected, registry: [], mode: "AUDIT", maxPages: 60 });

const pages = (...snapshots: ReturnType<typeof snapshot>[]) =>
  ({ status: "ok", snapshots }) as const;

describe("runIntake", () => {
  it("keeps two small collection templates at T2 and a 10-URL one at T3", () => {
    const base = { pages: pages(snapshot("/"), snapshot("/about")) };
    expect(
      intake({
        ...base,
        templates: {
          status: "ok",
          templates: [template("/*", 5), template("/x/*", 4)],
        },
      }).tier,
    ).toBe("T2");
    expect(
      intake({
        ...base,
        templates: { status: "ok", templates: [template("/events/*", 11)] },
      }).tier,
    ).toBe("T3");
  });

  it("answers SP7 '?' for a bare Maps link", () => {
    const sp7 = intake({
      pages: pages(snapshot("/", { links: ["https://maps.app.goo.gl/abc"] })),
    }).siteProfile.find((a) => a.code === "SP7");
    expect(sp7?.value).toBe("?");
  });
});
