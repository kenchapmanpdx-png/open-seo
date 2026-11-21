// Weekly self-test verdict (WO-B13-016). `evaluate(e2e, badgeo, at)` builds
// fork/runs/_ops/selftest.json from the in-app E2E result (E2EResult, written
// by inapp-audit.mjs; null when SELFTEST_INAPP=0 skips the live part) and the
// BadGEO counts. ok = BadGEO 0 missing / 0 unexpected and, when the live part
// ran, audit completed, Handbook completed, a grade, not provisional.
//
//   node fork/scripts/ops/selftest-eval.mjs <e2e.json|-> <missing> <unexpected>
//   (prints the selftest JSON; exit 0 when ok, 1 when not, 2 on usage)
import { readFileSync } from "node:fs";

export function evaluate(e2e, badgeo, at = new Date().toISOString()) {
  const h = e2e?.handbook ?? null;
  const live = e2e
    ? {
        auditStatus: e2e.audit?.status ?? null,
        handbookStatus: h?.status ?? null,
        grade: h?.grade ?? null,
        provisional: h?.provisional ?? null,
      }
    : null;
  const badgeoOk = badgeo.missing === 0 && badgeo.unexpected === 0;
  const liveOk =
    live === null ||
    (live.auditStatus === "completed" &&
      live.handbookStatus === "completed" &&
      live.grade !== null &&
      live.provisional === false);
  return { at, badgeo, e2e: live, ok: badgeoOk && liveOk };
}

const count = (v) => (/^\d+$/.test(v ?? "") ? Number(v) : null);

if (import.meta.url === `file://${process.argv[1]}`) {
  const [file, missing, unexpected] = process.argv.slice(2);
  if (!file) {
    console.error(
      "usage: selftest-eval.mjs <e2e.json|-> <missing> <unexpected>",
    );
    process.exit(2);
  }
  let e2e = null;
  if (file !== "-") {
    try {
      e2e = JSON.parse(readFileSync(file, "utf8"));
    } catch {
      // No or unreadable result: the live part failed before writing it.
      e2e = { audit: null, handbook: null };
    }
  }
  const result = evaluate(e2e, {
    missing: count(missing),
    unexpected: count(unexpected),
  });
  console.log(JSON.stringify(result));
  process.exit(result.ok ? 0 : 1);
}
