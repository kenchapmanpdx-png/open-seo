# Kickoff

## 1. Before start (once)

- Do every row in `fork/BLUEPRINT.md` §7.
- `bash fork/scripts/preflight.sh` → no `MISS` lines (`OPT` = optional feature, skipped as `BLOCKED-KEN`).
- Check `/usage` in Claude Code: most of the week unused.

## 2. Start (unattended)

```
bash fork/scripts/autopilot.sh
```

- Runs B1 → B7 on Opus 5.5 with no input (SINGLE mode). Each run = fresh context; `STATE.md` carries state. First run = B1 R1 (`fork/batches/B1-heavy-foundation.md`).
- Watch: `tail -f fork/runs/autopilot.log` · `fork/STATE.md` · `fork/reports/`.
- Stops only when: done (0) · needs Ken (2, see `needs_ken:` in `STATE.md`) · 3 runs with no commit (3) · usage limit (4) · 60 runs (5). Fix, then run the same command again.

## 3. Fallback (interactive)

```
claude --model claude-opus-5-5 --permission-mode auto
```

Type once: `Read fork/STATE.md and continue the build. Interactive autopilot: keep going through checkpoints until status: done.`

## Notes

- Universal prompt for any manual session: `Read fork/STATE.md and continue the build.`
- Previous session-1 instructions (P0 + P1 task 1) now live in B1 R1 + R2, with additions (ADRs, contracts, core engine, exemplars, B2 queue).
- Model switching, runs, escalation, autonomy: `fork/BLUEPRINT.md` §1.
