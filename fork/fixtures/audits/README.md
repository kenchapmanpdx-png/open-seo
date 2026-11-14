# Golden audits (expected findings)

| File | Site | Handbook used | Mode | Grade |
|---|---|---|---|---|
| `whyracingevents-2026-11-13.md` | https://whyracingevents.com | v4.2 | REVIEW | 39 (54 uncapped) |
| `ryanmscottsdale-2026-11-13.md` | https://www.ryanmscottsdale.com | v4.0 | AUDIT | 48 |

## Use
- Expected output for the handbook engine: every finding ID (F/A/S prefixes) + every "Passes" line.
- Scoring: per finding → caught / partial / missed; per pass → confirmed / contradicted.
- Live sites change after 2026-11-13. A miss is valid only if the defect still exists on a direct re-fetch; otherwise mark `site-changed`.
- Written under older handbook versions (v4.0 / v4.2). Rules added in v4.3–v4.6 may produce extra findings: expected, not errors.
- Third-party checker sections (Addenda) list tool errors: the engine must not repeat them.
- Off-site / owner-access items (BLOCKED, backlinks, DNS email auth) are out of scope for crawl checks.
