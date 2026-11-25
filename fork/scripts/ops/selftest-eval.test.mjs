// Self-test verdict (WO-B13-016). Run: node --test fork/scripts/ops/selftest-eval.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluate } from "./selftest-eval.mjs";

const e2e = (handbook = {}, audit = {}) => ({
  audit: { status: "completed", ...audit },
  handbook: {
    status: "completed",
    grade: "D",
    provisional: false,
    ...handbook,
  },
});
const clean = { missing: 0, unexpected: 0 };

test("passes: BadGEO clean, audit and Handbook completed with a grade", () => {
  assert.equal(evaluate(e2e(), clean).ok, true);
});

test("live part skipped (SELFTEST_INAPP=0): BadGEO alone decides", () => {
  const r = evaluate(null, clean);
  assert.equal(r.e2e, null);
  assert.equal(r.ok, true);
});

const failing = [
  ["BadGEO missing", e2e(), { missing: 1, unexpected: 0 }],
  ["BadGEO counts unreadable", e2e(), { missing: null, unexpected: null }],
  ["audit failed", e2e({}, { status: "failed" }), clean],
  ["Handbook failed", e2e({ status: "failed" }), clean],
  ["no grade", e2e({ grade: null }), clean],
  ["provisional", e2e({ provisional: true }), clean],
  ["no result file", { audit: null, handbook: null }, clean],
];
for (const [name, result, badgeo] of failing) {
  test(`fails: ${name}`, () => {
    assert.equal(evaluate(result, badgeo).ok, false);
  });
}

test("fails: a field-test ledger row drifted (or the count is unreadable)", () => {
  assert.equal(evaluate(e2e(), clean, undefined, 1).ok, false);
  assert.equal(evaluate(e2e(), clean, undefined, null).ok, false);
});
