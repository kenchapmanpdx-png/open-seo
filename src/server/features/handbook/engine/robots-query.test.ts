import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * WO-B23-003: "may this URL be crawled" is asked with path + query string
 * (Google matches rules like `Disallow: /*?s=`). Every robots `decide(` call
 * outside the robots engine and the group check passes `search`, or the line
 * above says why not (`// robots path: …`).
 */
const ROOT = join(import.meta.dirname, "..");
const EXEMPT = new Set(["engine/robots.ts", "checks/robots-groups.ts"]);

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? sources(join(dir, e.name))
      : e.name.endsWith(".ts") && !e.name.endsWith(".test.ts")
        ? [join(dir, e.name)]
        : [],
  );
}

describe("robots decide() inputs (WO-B23-003)", () => {
  it("passes the query string, or says why not", () => {
    const offenders = sources(ROOT).flatMap((file) => {
      const rel = relative(ROOT, file);
      const text = readFileSync(file, "utf8");
      if (
        EXEMPT.has(rel) ||
        !/import \{[^}]*\bdecide\b[^}]*\} from "[^"]*robots"/.test(text)
      )
        return [];
      const lines = text.split("\n");
      return lines.flatMap((line, i) => {
        if (!/\bdecide\(/.test(line) || /function decide/.test(line)) return [];
        const call =
          lines
            .slice(i, i + 6)
            .join(" ")
            .split(")")[0] ?? "";
        const why = /\/\/ robots path:/.test(lines[i - 1] ?? "");
        return /search/.test(call) || why ? [] : [`${rel}:${i + 1}`];
      });
    });
    expect(offenders).toEqual([]);
  });
});
