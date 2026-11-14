import { describe, expect, it } from "vitest";
import { context, ORIGIN, statusOf } from "./check-test-fixtures";
import { securityHeadersCheck } from "./security-headers";

const FULL: [string, string][] = [
  ["content-type", "text/html"],
  ["strict-transport-security", "max-age=31536000"],
  [
    "content-security-policy-report-only",
    "default-src 'self'; frame-ancestors 'none'",
  ],
  ["x-content-type-options", "nosniff"],
  ["referrer-policy", "strict-origin-when-cross-origin"],
  ["permissions-policy", "camera=()"],
];

function run(headers: [string, string][]) {
  return securityHeadersCheck.run(
    context({
      headers: {
        status: "ok",
        responses: [{ url: `${ORIGIN}/`, status: 200, headers }],
      },
    }),
  );
}

describe("headers.security-by-value", () => {
  it("passes a full set and records a report-only CSP as its state, not as missing", async () => {
    const result = await run(FULL);
    expect(result.findings).toEqual([]);
    expect(result.statuses.find((s) => s.itemId === "P8-05")?.note).toContain(
      "CSP report-only",
    );
  });

  it("judges values: HSTS max-age=0 is present but open", async () => {
    const result = await run(
      FULL.map(([k, v]) =>
        k === "strict-transport-security" ? [k, "max-age=0"] : [k, v],
      ),
    );
    expect(result.findings.map((f) => f.title)).toEqual([
      "HSTS max-age is 0 (HSTS disabled)",
    ]);
    expect(statusOf(result, "P8-05")).toBe("OPEN");
  });
});
