import { describe, expect, it } from "vitest";
import { context, statusOf } from "./check-test-fixtures";
import { imageWeightCheck } from "./image-weight";

const url = "https://example.com/";

const run = (images: Array<number | null>) =>
  imageWeightCheck.run(
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
              requests: images.map((transferBytes, i) => ({
                url: `${url}img/${i}.jpg`,
                resourceType: "image",
                status: 200,
                transferBytes,
              })),
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

describe("perf.image-weight", () => {
  it("opens P2-05 for an image over 500 KB", async () => {
    const result = await run([600_000, 20_000]);
    expect(statusOf(result, "P2-05")).toBe("OPEN");
    expect(result.findings[0].detail).toContain("img/0.jpg");
    expect(result.findings[0].detail).not.toContain("img/1.jpg");
  });

  it("ignores images whose transfer size is unknown", async () => {
    const result = await run([null, 20_000]);
    expect(statusOf(result, "P2-05")).toBe("PASS");
  });
});
