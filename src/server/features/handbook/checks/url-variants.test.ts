import { describe, expect, it } from "vitest";
import type { VariantsData } from "@/server/features/handbook/contracts/collectors";
import { context, ORIGIN, snapshot, statusOf } from "./check-test-fixtures";
import { urlVariantsCheck } from "./url-variants";

type Probe = VariantsData["probes"][number];

function probe(
  kind: Probe["kind"],
  url: string,
  hops: [string, number][],
  status = 200,
  finalUrl = `${ORIGIN}/`,
): Probe {
  return {
    kind,
    url,
    finalUrl,
    status,
    redirectChain: hops.map(([u, s]) => ({ url: u, status: s })),
    title: null,
    words: 0,
  };
}

const run = (probes: Probe[], links: string[] = []) =>
  urlVariantsCheck.run(
    context({
      variants: { status: "ok", probes },
      pages: { status: "ok", snapshots: [snapshot("/", { links })] },
    }),
  );

describe("crawl.url-variants", () => {
  it("opens P3-01 at S4 on a permanent two-hop chain, S1 on a 302", async () => {
    const chain = await run([
      probe("http-apex", "http://example.com/", [
        ["http://example.com/", 301],
        ["https://www.example.com/", 301],
      ]),
    ]);
    expect(statusOf(chain, "P3-01")).toBe("OPEN");
    expect(chain.findings[0]?.severity).toBe("S4");
    const temporary = await run([
      probe("http-apex", "http://example.com/", [["http://example.com/", 302]]),
    ]);
    expect(temporary.findings[0]?.severity).toBe("S1");
  });

  it("passes P3-01 on one 301 hop to the canonical origin", async () => {
    const result = await run([
      probe("http-apex", "http://example.com/", [["http://example.com/", 301]]),
    ]);
    expect(statusOf(result, "P3-01")).toBe("PASS");
  });

  it("passes P3-02 when the toggled slash 404s and opens on 200", async () => {
    const toggled = `${ORIGIN}/about/`;
    const notFound = await run([
      probe("trailing-slash", toggled, [], 404, toggled),
    ]);
    expect(statusOf(notFound, "P3-02")).toBe("PASS");
    const duplicate = await run([
      probe("trailing-slash", toggled, [], 200, toggled),
    ]);
    expect(statusOf(duplicate, "P3-02")).toBe("OPEN");
  });

  it("passes P3-03 when index.html 301s to /, opens when a page links to it", async () => {
    const index = probe("index-html", `${ORIGIN}/index.html`, [
      [`${ORIGIN}/index.html`, 301],
    ]);
    expect(statusOf(await run([index]), "P3-03")).toBe("PASS");
    expect(statusOf(await run([index], ["/index.html"]), "P3-03")).toBe("OPEN");
  });
});
