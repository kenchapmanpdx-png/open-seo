# ADR-005: Check contract and status model (K1)

- Status: accepted
- Date: 2026-11-14 · Batch: B1

## Context

- Handbook item statuses (§0 Definition of done): `DONE · N/A (reason) · DEFERRED (trigger) · BLOCKED (needs X) · OPEN · LIMITED (platform, evidence)`; "PASS/FAIL apply to phase gates only". EP-7 (REVIEW): per item "PASS · finding ID · BLOCKED · N/A · LIMITED"; scoring counts partial pass 0.5, LIMITED 0.5.
- BLUEPRINT §3.3 names PASS/OPEN/PARTIAL/BLOCKED/N/A/LIMITED.
- Several §41 items bundle multiple requirements (e.g. security headers); EP-7 recognizes partial passes.

## Decision

- Item status enum: `PASS | PARTIAL | OPEN | BLOCKED | NA | LIMITED | DEFERRED`.
  - `PASS` = handbook DONE / EP-7 PASS (evidence recorded).
  - `PARTIAL` = some sub-requirements pass, at least one finding open; score 0.5.
  - `OPEN` = at least one finding, nothing passes; score 0.
  - `BLOCKED` = required evidence unavailable (owner access, DATA account, LLM disabled); excluded from score; `note` names what is missing.
  - `NA` = not applicable (tier, gate, mode); `note` gives the reason; excluded.
  - `LIMITED` = defect exists but is a platform limit with evidence (EP-1); score 0.5; never a top fix.
  - `DEFERRED` = trigger-bound (e.g. pre-launch checks → P10); excluded; `note` names the trigger.
- Status precedence when several checks cover one item: `OPEN` > `PARTIAL` > `LIMITED` > `PASS`; `BLOCKED` only when no check produced a verdict; `NA`/`DEFERRED` come from intake, before checks run.
- K1 `HandbookCheck`: `{ id, itemIds, class, requires: CollectorKey[], appliesTo?(ctx), run(ctx) → CheckResult }`; `CheckResult = { statuses: ItemVerdict[], findings: FindingDraft[], evidence: EvidenceDraft[] }`.
- Invariants enforced by the runner (not by each check): every `FindingDraft` references ≥ 1 evidence draft and ≥ 1 item id in the check's `itemIds`; a `PASS` verdict references ≥ 1 evidence draft; a check that throws yields `BLOCKED` with `note: "check error: <code>"` and is logged; LLM-derived findings carry `source: "llm"` and never set release-blocking.
- Finding codes `F01…` assigned at reconcile in severity, then phase, then first-URL order (stable across reruns of the same site state).

## Alternatives

| Option                                | Why not                                                                                                               |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Handbook vocabulary verbatim (`DONE`) | EP-7 REVIEW reports use PASS; UI and score read better with one term; mapping DONE↔PASS is 1:1 and stated in exports. |
| No PARTIAL                            | EP-7 scores partial passes; bundled items would be forced to OPEN.                                                    |

## Consequences

- `seo-geo-status.md` export (K7) writes `DONE` for `PASS` in non-REVIEW modes (handbook template wording).

## Verification

- Runner unit tests for each invariant; BadGEO pages exercise PASS / PARTIAL / OPEN / BLOCKED.
