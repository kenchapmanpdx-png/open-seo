import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contractViolation } from "../engine/contract-violation";
import { REGISTRY } from "../registry";
import { context, textPage } from "./check-test-fixtures";
import { duplicatesCheck } from "./duplicates";
import { imageWeightCheck } from "./image-weight";

// WO-B19-008: a PASS without evidence makes the runner drop the whole check
// ("the check itself failed"); only clean sites reach those paths.
const registry = new Map(REGISTRY.map((e) => [e.id, e]));
const url = "https://example.com/";
const words = (n: number) =>
  Array.from({ length: n }, (_, i) => `word${i}`).join(" ");

describe("check contract on a clean site", () => {
  it("no check source passes an item with an empty evidence list", () => {
    const dir = import.meta.dirname;
    const offenders = readdirSync(dir)
      .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
      .filter((f) =>
        /\.pass\([^;]*?,\s*\[\]\s*,?\s*\)/s.test(
          readFileSync(join(dir, f), "utf8"),
        ),
      );
    expect(offenders).toEqual([]);
  });

  it("duplicates passes P3-12 with evidence when no page is thin", async () => {
    const page = { ...textPage("/", words(400)), mainWords: 400 };
    const result = await duplicatesCheck.run(
      context({ pages: { status: "ok", snapshots: [page] } }),
    );
    expect(contractViolation(duplicatesCheck, result, registry)).toBeNull();
  });

  it("image weight passes P2-05 with evidence when no image is heavy", async () => {
    const result = await imageWeightCheck.run(
      context({
        render: {
          status: "ok",
          pages: [
            {
              url,
              js: {
                finalUrl: url,
                status: 200,
                renderedKey: "k",
                words: 100,
                requests: [],
                opacityZeroWords: 0,
                firstScreenActions: [],
              },
              noJs: { status: 200, nojsKey: "n", words: 100 },
              firstScreenKey: null,
              consoleErrors: [],
            },
          ],
        },
      }),
    );
    expect(contractViolation(imageWeightCheck, result, registry)).toBeNull();
  });
});
