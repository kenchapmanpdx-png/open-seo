# ADR-030: Novice cleanup and fork theme layer

- Status: accepted
- Date: 2026-11-21 · Batch: B16 · Spec: `fork/NOVICE-CLEANUP.md`

## Context

- G1–G5 re-verified in code at `ken/main` `29befdd` (B16 R1, run 81) and again at `14cd8d0` after B15 / B17 (run 86): G1, G2, G3, G5 unchanged. G4: B17 #5 folds P7-02 into one finding on new runs (r85b goldens: 0 same-title rows); stored older runs still repeat it (why r75: 15 rows), so the display merge stays.
- The upstream theme sets tokens on `[data-theme="openseo"]` / `[data-theme="openseo-dark"]` in `src/client/styles/app.css`; `src/client/lib/theme.ts` switches the attribute. Fonts come from Tailwind's `--font-sans` / `--default-font-family`.
- `ForkHealthChip.tsx` (fork file) renders inside `AppShell.tsx` on every app page.

## Decision

1. Theme layer = `src/client/features/handbook/fork-theme.css` + `forkTheme.ts`. `ForkHealthChip.tsx` calls `applyForkLook()` from an effect; it adds the CSS (imported `?inline`, as upstream does for Leaflet) as one `<style id="fork-theme">` and sets `data-fork-look` on `<html>`. A bare `import "./fork-theme.css"` fails lint (`no-unassigned-import`). No upstream file edited.
2. Selectors `:root[data-fork-look="x"][data-theme="openseo"]` and the `openseo-dark` pair: higher specificity than upstream's `[data-theme]`, so import order does not matter. Only custom properties, plus `font-size`, `font-family` (via `--font-sans`) and `font-variant-numeric` on the root. No component CSS, no `!important`.
3. Look constant `FORK_LOOK` in `forkTheme.ts` (`upstream` | `a` | `b` | `c`). `?look=a|b|c|upstream` on any URL stores a preview in `sessionStorage` for that tab; the stored preview wins over the constant. Bad values are ignored.
4. Look C "dark by default" = dark sidebar in light and dark mode; tokens inside `[data-sidebar="sidebar"]` (card, accent, muted text) are dark too, so boxes in the sidebar (project switcher) keep readable text. The light / dark choice stays upstream's (theme preference, system default): changing the default would need an upstream edit.
5. Pages without the app shell (`sharePage.tsx`, `widgets/main.tsx`) keep the upstream look (the chip is not mounted there).
6. Same-title merge (WO-B16-004): display only. Key = priority group + exact title. A merged row keeps every finding as a sub-row with its own checkbox (done state stays per finding code). The merged checkbox is checked when every sub-row is. Top-5 counts a merged row once. CSV keeps one row per finding.
7. "Couldn't check" causes (WO-B16-002): one pure function `blockedCauses(report)` in `fixList.ts`, first matching rule wins (table in `fork/reports/B16.md` and RUNBOOK § "Couldn't check"); unknown notes → "Could not be checked (other)". Raw id + note only under "Details".
8. Not-final note (WO-B16-003): text built by a pure function from the run date, the stored reason and the newest completed run id; the stored reason and export wording stay.

## Consequences

- Rollback = `FORK_LOOK = "upstream"` (one line).
- A first-paint flash of the upstream look is possible until the chip's chunk loads (accepted; spec §6).
- Upstream components with fixed colours (tag chips, `bg-red-50`, …) do not follow the look.
