import { describe, expect, it } from "vitest";
import type { PageSnapshot } from "@/server/features/handbook/contracts/collectors";
import { context, ORIGIN, snapshot, statusOf } from "./check-test-fixtures";
import { resourceHintsCheck } from "./resource-hints";

const url = `${ORIGIN}/`;

function withMarkup(markup: Partial<PageSnapshot["markup"]>): PageSnapshot {
  const s = snapshot("/");
  return { ...s, markup: { ...s.markup, ...markup } };
}

describe("resourceHintsCheck", () => {
  it("flags a preconnect to an origin the page never requests", async () => {
    const result = await resourceHintsCheck.run(
      context({
        pages: {
          status: "ok",
          snapshots: [
            withMarkup({
              headLinks: [
                {
                  rel: "preconnect",
                  href: "https://fonts.example.net",
                  as: null,
                  type: null,
                },
              ],
            }),
          ],
        },
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
                requests: [{ url, resourceType: "document", status: 200 }],
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
    expect(statusOf(result, "P7-06")).toBe("OPEN");
  });
});
