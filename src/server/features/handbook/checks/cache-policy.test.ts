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

// WO-B21-002: aweandorderorganizing.com (Weebly) served
// `/files/main_style.css?1672701721` with no Cache-Control; P7-07 read PASS
// "0 hashed asset(s) immutable for a year".
describe("headers.cache-policy unhashed static files", () => {
  const css = (path: string, headers: [string, string][]) => ({
    url: `${ORIGIN}${path}`,
    status: 200,
    headers: [["content-type", "text/css"], ...headers] as const,
  });
  const html = response("/", "text/html", "no-cache");

  it("reports a probed static file with no caching header (S4)", async () => {
    const result = await cachePolicyCheck.run(
      context({
        headers: {
          status: "ok",
          responses: [html, css("/files/main_style.css?1672701721", [])],
        },
      }),
    );
    expect(statusOf(result, "P7-07")).not.toBe("PASS");
    expect(result.findings.map((f) => [f.severity, f.urls])).toEqual([
      ["S4", [`${ORIGIN}/files/main_style.css?1672701721`]],
    ]);
  });

  it.each([
    ["no-cache", css("/a.css", [["cache-control", "no-cache"]])],
    ["max-age", css("/a.css", [["cache-control", "max-age=3600"]])],
    [
      "Expires only",
      css("/a.css", [["expires", "Wed, 21 Oct 2026 07:28:00 GMT"]]),
    ],
    ["404", { ...css("/a.css", []), status: 404 }],
    [
      "cross-origin",
      { ...css("/a.css", []), url: "https://cdn.example.net/a.css" },
    ],
  ])("raises no finding for an unhashed file with %s", async (_, asset) => {
    const result = await cachePolicyCheck.run(
      context({ headers: { status: "ok", responses: [html, asset] } }),
    );
    expect(result.findings).toEqual([]);
  });
});
