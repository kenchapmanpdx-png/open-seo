import type { Intake } from "./intake";

/**
 * Items the operator turned off (ADR-020, FULL-READ §5.5): they report N/A
 * with a note, are excluded from the score (N/A always is) and their checks
 * do not run. P5-03 (off-site source fetch) is off unless
 * `HANDBOOK_SOURCE_CHECK=on`; "claim with no on-page source" stays a P5-04
 * finding.
 */
function operatorDisabled(
  env: Readonly<Record<string, string | undefined>>,
): Map<string, string> {
  const off = new Map<string, string>();
  if (env.HANDBOOK_SOURCE_CHECK?.toLowerCase() !== "on")
    off.set("P5-03", "operator: no external verification");
  return off;
}

/** Intake with operator-disabled items moved from applicable to excluded (N/A). */
export function withOperatorDisabled(intake: Intake): Intake {
  const off = operatorDisabled(
    typeof process === "undefined" ? {} : process.env,
  );
  const applicable = new Map(intake.applicable);
  const excluded = [...intake.excluded];
  for (const [itemId, note] of off)
    if (applicable.delete(itemId))
      excluded.push({ itemId, status: "NA", note });
  return { ...intake, applicable, excluded };
}
