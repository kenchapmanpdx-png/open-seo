import { describe, expect, it } from "vitest";
import { cachePolicyCheck } from "./cache-policy";
import { context, ORIGIN, statusOf } from "./check-test-fixtures";

const response = (path: string, contentType: string, cacheControl: string) => ({
  url: `${ORIGIN}${path}`,
  status: 200,
  headers: [
    ["content-type", contentType],
    ["cache-control", cacheControl],
  ] as const,
});

const run = (responses: ReturnType<typeof response>[]) =>
  cachePolicyCheck.run(context({ headers: { status: "ok", responses } }));

describe("headers.cache-policy", () => {
  it("opens on a hashed script without immutable", async () => {
    const result = await run([
      response("/app.3f9a1c.js", "text/javascript", "public, max-age=31536000"),
    ]);
    expect(statusOf(result, "P7-07")).toBe("OPEN");
  });

  it("opens on HTML cached for a day", async () => {
    const result = await run([response("/", "text/html", "max-age=86400")]);
    expect(statusOf(result, "P7-07")).toBe("OPEN");
  });

  it("passes immutable assets and revalidated HTML", async () => {
    const result = await run([
      response(
        "/app.3f9a1c.js",
        "text/javascript",
        "public, max-age=31536000, immutable",
      ),
      response("/", "text/html", "max-age=0, must-revalidate"),
    ]);
    expect(statusOf(result, "P7-07")).toBe("PASS");
  });
});
