import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import {
  compareReleaseIds,
  formatReleaseWindow,
  isValidReleaseId,
  reverseDomain,
} from "../../../../src/server/features/backlinks/providers/commoncrawl/release";
import { listCachedReleases, pruneOldReleases } from "./cache";
import { downloadFile } from "./download";
import { probeLatestRelease } from "./release-discovery";
import { queryBacklinks } from "./query";

const tmpDirs: string[] = [];
function tmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-test-"));
  tmpDirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("release ids", () => {
  it.each([
    ["cc-main-2026-may-jun-jul", true],
    ["cc-main-2025-nov-dec-jan", true],
    ["cc-main-24-jan-feb-mar", false],
    ["CC-MAIN-2024-jan-feb-mar", false],
    ["cc-main-2024-jan-feb", false],
    ["cc-main-2024-jan-feb-mar ", false],
  ])("isValidReleaseId(%s) = %s", (id, valid) => {
    expect(isValidReleaseId(id)).toBe(valid);
  });

  it("orders by crawl window and labels cross-year windows", () => {
    const ids = [
      "cc-main-2026-aug-sep-oct",
      "cc-main-2025-nov-dec-jan",
      "not-a-release",
      "cc-main-2026-may-jun-jul",
    ];
    expect(ids.sort(compareReleaseIds)).toEqual([
      "not-a-release",
      "cc-main-2025-nov-dec-jan",
      "cc-main-2026-may-jun-jul",
      "cc-main-2026-aug-sep-oct",
    ]);
    expect(formatReleaseWindow("cc-main-2026-may-jun-jul")).toBe(
      "May-Jul 2026",
    );
    expect(formatReleaseWindow("cc-main-2025-nov-dec-jan")).toBe(
      "Nov 2025-Jan 2026",
    );
  });

  it("reverses domains both ways", () => {
    expect(reverseDomain("blog.example.com")).toBe("com.example.blog");
    expect(reverseDomain(reverseDomain("example.co.uk"))).toBe("example.co.uk");
  });
});

describe("probeLatestRelease", () => {
  it("walks back month by month to the newest published window", async () => {
    const probed: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      probed.push(url);
      return new Response(null, {
        status: url.includes("cc-main-2026-aug-sep-oct") ? 200 : 404,
        headers: { "content-length": "123" },
      });
    };
    const result = await probeLatestRelease({
      now: new Date("2026-11-14T00:00:00Z"),
      fetchImpl,
    });
    expect(result?.release).toBe("cc-main-2026-aug-sep-oct");
    expect(result?.vertexBytes).toBe(123);
    // nov, oct, sep, aug → 4 HEAD pairs
    expect(probed).toHaveLength(8);
  });
});

describe("downloadFile", () => {
  it("downloads once, then reuses the cached file", async () => {
    const dest = path.join(tmpDir(), "rel", "vertices.txt.gz");
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return new Response("hello");
    };
    const first = await downloadFile({
      url: "https://x",
      destPath: dest,
      fetchImpl,
    });
    const second = await downloadFile({
      url: "https://x",
      destPath: dest,
      fetchImpl,
    });
    expect(first).toMatchObject({ bytes: 5, cached: false });
    expect(second).toMatchObject({ cached: true, sha256: first.sha256 });
    expect(calls).toBe(1);
    expect(fs.existsSync(`${dest}.partial`)).toBe(false);
  });
});

describe("cache", () => {
  it("keeps the newest two releases by crawl window", () => {
    const dir = tmpDir();
    for (const id of [
      "cc-main-2026-feb-mar-apr",
      "cc-main-2026-aug-sep-oct",
      "cc-main-2026-may-jun-jul",
    ]) {
      fs.mkdirSync(path.join(dir, id));
    }
    fs.mkdirSync(path.join(dir, "not-a-release"));
    expect(pruneOldReleases(2, dir)).toEqual(["cc-main-2026-feb-mar-apr"]);
    expect(listCachedReleases(dir)).toEqual([
      "cc-main-2026-aug-sep-oct",
      "cc-main-2026-may-jun-jul",
    ]);
  });
});

describe("queryBacklinks", () => {
  it("returns inbound linking domains per target, biggest first, capped", async () => {
    const dir = tmpDir();
    const vertexPath = path.join(dir, "vertices.txt.gz");
    const edgesPath = path.join(dir, "edges.txt.gz");
    const vertices = [
      [0, "com.target", 3],
      [1, "com.rival", 2],
      [2, "org.big", 900],
      [3, "net.mid", 40],
      [4, "io.small", 1],
      [5, "com.unrelated", 7],
    ];
    const edges = [
      [2, 0],
      [3, 0],
      [4, 0],
      [2, 1],
      [5, 3],
    ];
    const tsv = (rows: (string | number)[][]) =>
      gzipSync(rows.map((r) => r.join("\t")).join("\n") + "\n");
    fs.writeFileSync(vertexPath, tsv(vertices));
    fs.writeFileSync(edgesPath, tsv(edges));

    const rows = await queryBacklinks({
      vertexPath,
      edgesPath,
      targets: ["target.com", "rival.com", "missing.com"],
      limitPerTarget: 2,
    });
    expect(rows).toEqual([
      { targetDomain: "rival.com", linkingDomain: "big.org", numHosts: 900 },
      { targetDomain: "target.com", linkingDomain: "big.org", numHosts: 900 },
      { targetDomain: "target.com", linkingDomain: "mid.net", numHosts: 40 },
    ]);
  });
});
