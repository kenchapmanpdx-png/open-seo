# SEO/GEO app — handoff supplement (2026-11-21 00:10 MST)

Replaces: the 2026-11-20-2359 and 2026-11-21-0005 copies (delete both). Change vs 0005: decisions in §10 made; §1, §3, §7, §8 updated to match.
Purpose: facts the repo handoff lacks. Build state source of truth stays `fork/STATE.md`, `fork/reports/B*.md`, `fork/queue.md`.
Destination: repo `fork/project-docs/` (docs only; nothing reads it at runtime). No secrets, no personal data.
Tags: SUPPORTED = read in a named doc or chat on 2026-11-21 · SPECULATIVE = reasoned, not observed · CARRIED = from an earlier answer, not re-opened.
Times: MST = UTC−7.

## 1. State delta vs repo handoff

- B1–B14 done. B13 done 2026-11-20 15:52, tag `handbook-v3.2.0`. B14 done 2026-11-20 17:03, commit `f154304`, tag `handbook-v3.3.0`. Live check via "Check a site": PASS 59/59/59, LLM $0.0876. SUPPORTED (repo handoff text, chat).
- K1 DONE 2026-11-20: installer wrote `OpenSEO-keepalive.vbs` into the Windows Startup folder; "Takes effect at the next sign-in". Signing out still stops the app. D7 (healthy ≤ 5 min after sign-in) has no test evidence. SPECULATIVE.
- B14 screens were opened once in the running app after the build (dashboard + Fix list only). SUPPORTED (chat). Seen:
  - Sidebar: new groups; "Check a site" and "Fix list" under "Check & Fix".
  - Dashboard: "Your top 5 fixes" card above the tabs.
  - Fix list: score boxes Overall D · 40.7, SEO 44, GEO 54, AEO 33; All / SEO / GEO / AEO filters; Download CSV; checkbox per fix; groups Must fix / Should fix / Nice to have.
  - Not opened: "Check a site" page, Handbook run page, other fork pages.
- Owner expectation gap: owner expected B14 to change aesthetics as well as function and reported seeing no change. B14 changed layout, wording, labels; colors, fonts and dark theme are still upstream's. A visual restyle was not planned. SUPPORTED (chat). Decided 2026-11-21: restyle goes into B16 (§10).
- The 4 known gaps in the repo handoff come from that same look:
  1. Handbook page: row of technical buttons (AI traffic, Bing, Agency, Copy rules).
  2. "Couldn't check (29)": raw codes, e.g. `P2-05 render unavailable: collector not configured.`
  3. Fix list shows a yellow "Grade provisional" note; the audit shown was an older one run without the render sidecar.
  4. Many "Nice to have" rows repeat the same text ("Images without dimensions"), once per page group.
- Loops per `fork/MAINTENANCE.md`: M1 upstream rebase (weekly; next due 2026-11-26), M2 handbook update, M3 new golden audit, M4 guide refresh, M5 ops review (weekly). M6 (external-export loop) is planned in B15 item 11, not built.
- Housekeeping noted by a build session on 2026-11-16: `fork/FORK.md` list of fork-only folders out of date; 162 fork files showed as upstream edits. SUPPORTED (chat). Whether fixed since: unknown; check before M1.

## 2. Run-3 crash (not in repo)

Site: salonvata.com (test site). All times 2026-11-19 MST, from blueprint v3 §3 (stored there in UTC).

| Run | Audit start | Handbook start → finish                                 | Audit end | Result                                                                                               |
| --- | ----------- | ------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------- |
| 1   | —           | off                                                     | —         | completed, 50 pages (upstream default limit)                                                         |
| 2   | 22:47:37    | off (toggle not saved)                                  | 22:50:22  | completed, 155 pages, 2 min 45 s                                                                     |
| 3   | 23:00:34    | 23:03:16 → 23:12:58, completed, 80/80 pages, LLM $0.220 | 23:25:31  | failed, `errorCode: db_error`, 12 min 33 s after Handbook finished = inside upstream `finalizeAudit` |
| 4   | 23:43:56    | 23:46:40 → 23:55:39, completed, 80/80 pages, LLM $0.223 | 23:55:41  | completed; finalize 2 s; grade F 35.2 provisional                                                    |

- Symptom: app-wide "Something went wrong" + "could not verify DataForSEO setup" on every page; seen ≈ 23:15 (reported). App restarted 23:35:41 (blueprint); comparison v3 says sidecar + app restarted 23:35.
- Run 3 audit id: `b634ee10-80d3-4210-8cd0-5b6a7d48be72`; its Handbook run page: `/handbook/hb-b634ee10-…`. `hb-b379783f…` is the other completed run named in WO-B13-008; probably run 4. SPECULATIVE.
- Run 3 Handbook result (comparison v3): 56 findings (S2 13, S3 35, S4 8), ids F01–F62, grade F 34.5 provisional.
- Crash class = database: SUPPORTED (`db_error` on the run-3 audit row; app-wide errors until restart; run 4 on a fresh process finalised in 2 s). Not memory (process stayed up, no `oom`). Not Handbook code (it had completed; its errors are swallowed).
- Mechanism: SPECULATIVE (blueprint tag INFERRED). Clients opened by upstream workflow steps and requests stay pinned to session-pooler slots (port 5432, pool 15); back-to-back audits plus UI polling on one process passed 15. The failure write at 23:25:31 succeeded, so exhaustion was intermittent. WO-B13-003 measures it; the plan does not depend on it.
- Fix as specified: WO-B13-004, `OPENSEO_DB_POOL_MODE=transaction` (default). `run-local.sh` derives port 6543 from `SUPABASE_DB_URL` for `prod` / `dev`; `.env.local` untouched; `POSTGRES_DATABASE_URL`, migrations and scripts stay on session 5432. WO-B13-009 also moves the Handbook hook after `finalizeAudit`, so Handbook trouble cannot fail or delay the audit.
- Gate G1 (test mode off): full → full → 25-page audit, each started when the previous completes. Pass = all audits and Handbook runs `completed`, 0 `db_error`; 0 app-log matches for P1 (pool errors) and P4 (prepared statement); serverConns peak ≤ 12; `ui-smoke.mjs` 0 problems during the third audit and 10 min after.
- Rollback: `Environment=OPENSEO_DB_POOL_MODE=session` in `fork/deploy/openseo-app.service`.
- G1 result and which conditional upstream edits were applied: not visible from the old Project. Read `fork/reports/B13.md`. Do not assume.
- Provisional grades: before B13 the in-app Handbook never passed a sidecar config (blueprint E10), so every in-app grade was provisional whether or not the sidecar ran. Comparison v3's stated cause ("sidecar not started with its token") is superseded. WO-B13-007 specifies the probe and banner `Grade provisional — browser checks skipped: <reason>.`
- Doc conflicts:
  - Run 2 time: comparison v3 "22:47–22:59"; blueprint 22:47:37 → 22:50:22. Blueprint read from run rows.
  - Run 4 exists only in the blueprint; comparison v3 stops at run 3. Run numbers 1–3 match across both. Prefer audit ids and timestamps.
  - Comparison v3 lists the crash cause as SPECULATIVE; blueprint v3 supersedes it.

## 3. Batch labels and scope

| Label                               | Meaning                                             | Source                                    | Status                             |
| ----------------------------------- | --------------------------------------------------- | ----------------------------------------- | ---------------------------------- |
| B13                                 | dependability (`fork/DEPENDABILITY.md`)             | blueprint v3                              | done                               |
| B14                                 | novice layout (`fork/NOVICE-UI.md`)                 | owner instruction 2026-11-20 02:02        | done                               |
| B15                                 | accuracy, Handbook only (blueprint §9 items 0–12)   | same instruction; "B15 gets its own spec" | not started; no spec               |
| B16 (was "B15" in the repo handoff) | novice cleanup of the 4 known gaps + visual restyle | decision 2026-11-21 (§10)                 | approved; no spec; runs before B15 |

- B15 start rule (blueprint §9): after B14 is green and loop M5 has one clean review ≥ 24 h later. No M5 review seen. SUPPORTED.
- Order: B16 first, then B15. Reason: B15 cannot start until the M5 review ≥ 24 h rule is met, and usability is the owner's stated main complaint.
- Overlap of the 4 known gaps with existing items:
  - Gap 4 = T16 = B15 item 5 (grouping). Fold into B15.
  - Gap 3: banner text exists (WO-B13-007). Re-run that site with the sidecar up before changing wording.
  - Gaps 1 and 2: new; B16 candidates.
- Not possible under fork rules (upstream Site Audit code): T2 crawl priority, T8 HSTS in the Site Audit summary, T9 Site Audit orphan logic. Handbook covers the findings.

## 4. Training backlog T1–T20 → status

Source: comparison v3 (T1–T8 v1, T9–T13 [v2], T14–T20 [v3]). Status from blueprint §9 ("Done in B13: T3, T4, T18, T19; T2 partly"). "Done per spec" = confirm in `fork/reports/B13.md`. The repo's older 8-item list predates this table.

| T    | Item                                                                                 | Priority      | Status                                                                                    | Where                                        |
| ---- | ------------------------------------------------------------------------------------ | ------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------- |
| T1   | Status-check every linked resource: `<img>`, CSS/JS, external `<a>`                  | Must          | OPEN                                                                                      | B15 #2 (img, CSS, JS); external links B15 #4 |
| T2   | Crawl priority; default limit                                                        | Must          | PARTLY: 500-page "Run full audit" button (WO-B13-014). Crawl priority not possible        | —                                            |
| T3   | Handbook on by default                                                               | Must          | Done per spec                                                                             | WO-B13-014                                   |
| T4   | Crash after Handbook-enabled audit                                                   | Must          | Done per spec                                                                             | WO-B13-004 (+009)                            |
| T5   | Root cause: WordPress attachment pages                                               | Should        | OPEN                                                                                      | B15 #8 (needs #1)                            |
| T6   | Root cause: theme demo content                                                       | Should        | OPEN                                                                                      | B15 #8                                       |
| T7   | Anchor text: empty, generic                                                          | Should        | OPEN                                                                                      | B15 #6                                       |
| T8   | HSTS in Site Audit summary                                                           | Nice          | NOT POSSIBLE (upstream)                                                                   | Handbook has it                              |
| T9   | Orphans: sitemap URLs with 0 inlinks (37) and 1 inlink ("weak")                      | Must → Should | Handbook F16 already finds 37. Weak-link part OPEN (B15 #9). Site Audit part not possible | —                                            |
| T10  | Entity-consistency rule (deterministic)                                              | Should        | OPEN                                                                                      | B15 #7                                       |
| T11  | Golden: salonvata                                                                    | Must          | OPEN                                                                                      | B15 #1                                       |
| T12  | Template-level reporting                                                             | Should        | OPEN                                                                                      | B15 #5                                       |
| T13  | 19 Semrush-only GAP checks                                                           | Should        | OPEN                                                                                      | B15 #10 (needs #2–#9)                        |
| T14  | Query-string link targets (`?page_id=15790`)                                         | Must          | OPEN                                                                                      | B15 #3                                       |
| T15  | Outbound link classes: dead vs bot-block vs redirect                                 | Must          | OPEN                                                                                      | B15 #4                                       |
| T16  | Group F33–F47 into one finding                                                       | Should        | OPEN                                                                                      | B15 #5                                       |
| T17  | Demo-content finding (lorem ipsum, demo slugs)                                       | Should        | OPEN                                                                                      | B15 #8                                       |
| T18  | No silent provisional grade                                                          | Must          | Done per spec                                                                             | WO-B13-007, 014                              |
| T19  | Runs list "0 findings / —" bug                                                       | Must (bug)    | Done per spec                                                                             | WO-B13-008                                   |
| T20  | Broken-image check in Handbook                                                       | Must          | OPEN                                                                                      | B15 #2                                       |
| Skip | text-HTML ratio, unminified counts, underscores, llms.txt, nofollow, AMP, URL length | —             | —                                                                                         | —                                            |

B15 items with no T id:

- #0 (first) Coverage gap: Handbook read 80 URLs, site audit crawled 155 (runs 3, 4). Seeds are status-200 `audit_pages` rows only. List the 75, classify (redirect, 404, attachment, non-HTML, unseen), fix any missing 200 page.
- #11 External-export importer + loop M6: `fork/scripts/import-external-audit.ts <xlsx>` maps export rows to registry items, lists misses both ways. Needs #1.
- #12 AI-judge stability (optional): findings such as F25 change between runs.

Golden (B15 #1): source `fork/fixtures/audits/salonvata.com-app-vs-semrush-2026-11-19.md` (= comparison v3; owner-only path, pushed on a separate go when B15 launches; never edited by the agent) → `fork/fixtures/expected/salonvata.com.expected.yaml` through loop M3. Golden content per T11: 8 dead internal targets, broken logo (64 pages), 2 dead external links, 37 orphans, entity conflict, attachment + demo root causes.

Semrush catalog totals (comparison v3, 101 checks): SA 23 · HB 40 · GAP 19 · SKIP 19. Fork read at `363194f`.

## 5. Handbook lineage, citation rule, lint

- Current: `on-site-seo-geo-reference-unified-v4.6.md` (§0–§41) + `on-site-seo-geo-reference-v4.6-archive.md` (A version history, §34, §38, §40, E maintainer notes; the implementing LLM does not load it).
- "v4.1" names two different files (merge-decisions 2026-11-14):
  - v4.1-audit, 2026-11-12: v4.0 + 27 defect-audit fixes (2,443 lines).
  - v4.1-FT1, 2026-11-13: v4.0 + field test FT1 (56 scripted edits; 2,412 → 2,544 lines).
  - v4.2 = v4.1-FT1 + FT1 crawler cross-check. It lacked the 27 audit fixes.
  - v4.3 = v4.2 + the 27 audit fixes re-applied (43 anchors, each matched once) + FT2 (7 edits). 2,556 → 2,597 lines. SUPPORTED.
- Citation rule: cite v4.3 or later. For v4.1 write `v4.1-audit` or `v4.1-FT1`.
- v4.4 = v4.3 + severity calibration + re-verified owner-page items. v4.5 = v4.4 + two items closed against primary pages + watchlist row F-16. v4.6 = desk gap fill: 76 anchored edits; §34 / §38 / §40 moved to the archive; §41 129 items (was 118).
- Before any M2 edit (archive §E4):
  - Lineage fingerprints must be present: `Page-type applicability` · `Source check:` · `seo-keyword-map.md` · `Set up at launch` · `AI answer panel` · `MistralAI-Training`.
  - Every in-place replacement → a §38 entry in the archive quoting the replaced wording. Appends need none.
  - One rule lives in up to four places (body, §29, §32, §41): search its key term in all four.
  - Run the lint before release.
  - v4.6 added scored items (P5 ×4, P6 ×2, P7 ×1): re-score FT1 / FT2 on v4.6 before comparing with later runs.
- Field tests (archive §E1, as of 2026-11-14). Done: FT1 Squarespace local-business site (T2); FT2 own-stack Vercel site (T3). Queue: FT3 Shopify store (T4) · FT4 WordPress local-service site (T2) · FT5 full AUDIT → fix → P10 on an owned site with repo access · FT6 repeatability (one site scored twice). A later audit doc exists (`bluetreefunding-com-seo-geo-audit-handbook-v4.6-2026-11-15-1846`); not listed in §E1.
- Not applied in v4.6 (owner decision or data needed): severity-weighted EP-7 scoring; generating §29 / §32 / §41 from tagged body lines.
- `handbook_lint.py`: RECOVERED from the v4.6 build chat. Not in the old Project. Delivered beside this file: 150 lines, 6,366 bytes, unchanged.
  - Suggested path: `fork/project-docs/handbook_lint.py`. Needs `pip install protego` for the robots check (skipped with a note if missing).
  - Run: `python3 handbook_lint.py <core.md> [archive.md]`. Exit 1 on any FAIL.
  - Checks: section order 1–41 · § references resolve · JSON-LD blocks parse · robots template group test (Protego) · §41 items each tagged + § reference, no duplicates · retired threshold wording · header version = status-template version · archive companion (§34, §38, §40 present; core stubs).
  - Run 2026-11-21 on the Project's v4.6 core (270,566 bytes, 2,624 lines): 7 PASS · 1 NOTE (archive not passed) · 0 FAIL, exit 0. 41 sections; 13 JSON-LD blocks; robots 21 named + 1 unlisted agent × 20 paths, 0 mismatches; 129 §41 items; version 4.6. SUPPORTED.
  - Red tests 2026-11-21, each exit 1 with the expected FAIL: header version → 4.5 · `## 12.` heading removed · every `Disallow: /cart…` line removed (66 mismatches) · tag removed from one §41 item · first JSON block broken. SUPPORTED.
  - Archive check: not run on the real archive in this pass (only a headings-only stub). The v4.6 decision record states "archive holds §34, §38, §40" at build time (CARRIED). Run once with the real archive.

## 6. LLM routing and evals

- AI judge route (2026-11-16): commit `44f52d2c` makes the Handbook judge work against Anthropic's OpenAI-compatible endpoint (`OPENROUTER_BASE_URL=https://api.anthropic.com/v1/`, model `claude-sonnet-5-5`). Two incompatibilities fixed; the brief was: strip JSON-schema keywords Anthropic rejects (`maxItems` on arrays) from `response_format` only, keep full Zod validation, no contract change. SUPPORTED (chat).
- Permanent switch = `.env.local` edit setting `OPENROUTER_API_KEY` (Anthropic key), `OPENROUTER_BASE_URL`, `HANDBOOK_LLM_MODEL`, `OPENROUTER_MODEL`. Owner reported it done ("i think its done"); the check output was not shown. B14's live check recorded LLM spend, so a judge route works. SPECULATIVE on which until `ops status` / health confirms.
- Blueprint E22 still says "the OpenRouter key reaches Handbook stages": the variable name is reused for the Anthropic key.
- Eval (`fork/scripts/llm-eval.ts`, 14 cases, 2026-11-16):

|                    | Local qwen3:14b (Ollama) | Claude Sonnet 5.5 direct |
| ------------------ | ------------------------ | ------------------------ |
| Caught             | 6/14 (43%)               | 11/14 (79%)              |
| False alarms       | 0                        | 0                        |
| Cost per full eval | $0                       | $0.20                    |
| 80% bar            | FAIL                     | FAIL, 1 case short       |

- Sonnet misses: why-F16, why-F19, why-HUB (the local model missed the same 3). why-F19's fixture gives the judge only `llms.txt`; the real defect is a mismatch with the rest of the site → likely a fixture defect. SPECULATIVE. Fix in M2 / M3. AI-judged findings never block a release.
- Side effects: the upstream chat assistant shares the `OPENROUTER_*` settings, so it also calls Anthropic directly; tool support on that endpoint untested. SPECULATIVE. The budget cap uses OpenRouter's price table for Anthropic models, unchecked; affects the cap only, not the bill.
- Per-run LLM budget default: chat 2026-11-16 says $1 (ADR-007); blueprint E31 (code read 2026-11-20) says `HANDBOOK_LLM_BUDGET_USD` default $5. Conflict; trust the code.
- OpenRouter route (abandoned): the account balance went negative; OpenRouter then blocked every request, including BYOK ones, with workspace "BYOK-only routing" switched on. SUPPORTED (chat). If that toggle is still on, any non-Claude model request through OpenRouter fails; current state not checked.
- DataForSEO: free-tier credit only (owner declined the paid minimum top-up). Calls fail when it runs out. Audits do not use it; keyword / SERP features and SERP originality do. SUPPORTED (chat, blueprint D-I).
- Ubuntu 26.04 + Playwright 1.59.1: host libraries installed by hand; needs `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64` (unit files, `ops e2e`, `ops selftest` export it). SUPPORTED.
- App: `http://localhost:3001` (`vite preview`, workerd runtime) via `systemctl --user` services; sidecar = Docker container `sidecar-sidecar-1`. Ops: `bash fork/scripts/run-local.sh ops <verb>` — `status`, `logs`, `sockets`, `measure`, `restart app|sidecar|tick`, `maint on|off`, `testmode on [--rerun]|off`, `e2e`, `selftest`, `watchdog`, `backfill-grades`, `units`.

## 7. Upstream rebase M1 (open)

- Queue row `M1-2026-11-20`: force-push `git push --force-with-lease origin ken/rebase-v0.1.31:ken/main`; B13+ commits after `32da778f` need a cherry-pick onto `ken/rebase-v0.1.31` first. State: OPEN. SUPPORTED (repo handoff text).
- Nothing prepared. Chat: "The build can't do it unattended… I'll prepare that as a separate job when you want it." SUPPORTED.
- Precedent: run 64, rebase onto v0.1.30; `fork/MAINTENANCE.md` M1; `fork/scripts/migration-renumber.mjs`. CARRIED.
- Conflict surface from B13: up to 6 small upstream edits in 5 files (A1, A2, A4 ×2, A5, A6; 2 certain, 4 conditional); applied ones are logged in `fork/UPSTREAM-EDITS.md`. B14 upstream edits (authorisations A12–A17 in `fork/NOVICE-UI.md`): not read here.
- Check the `fork/FORK.md` fork-only folder list first (§1 housekeeping).
- Decided 2026-11-21: the repo session prepares M1 now (it has the clone and the test environment). Prep only: cherry-pick the B13+ commits after `32da778f` onto `ken/rebase-v0.1.31`, run `fork/FORK.md` session-end checks vs `fork/BASELINE.md`, report conflicts and results, stop.
- Force-push rewrites public `ken/main`: runs only on the owner's explicit "push".

## 8. Old-Project documents → role

Old Project = "Coding / Claude Code". Repo copies live in `fork/project-docs/` (manifest in the repo handoff; said to include the AEO guide, AEO results and the v4.6 archive: CARRIED).

| Group                  | Files in the old Project                                                                                                                                                                                                                                                                                                                                                                          | Note                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| App specs              | dependability blueprint v3 parts 1, 2 · `seo-geo-app-b14-novice-ui-spec-2026-11-20-0215` · `salonvata-app-vs-semrush-comparison-v3-2026-11-19-2355` · `seo-geo-app-full-read-blueprint-2026-11-16` · `seo-geo-app-blueprint-2026-11-14` · `seo-geo-app-build-plan-2026-11-14` · `seo-geo-app-b11-scaled-content-copy-quality-spec-v2-2026-11-20-1030` · `copy-rules-web-pages-v2-2026-11-20-1030` | blueprint v3 supersedes v1 and v2 (neither in the Project)                |
| Handbook               | v4.6 core + archive · `seo-geo-merge-decisions-` 2026-11-01, 2026-11-11, 2026-11-13, 2026-11-14, 2026-11-14-v4.6 · prompts: research, merge, redteam, redteam-r2 · kickoff ×2 (root + `claude/`) · offsite findings 2026-11-01                                                                                                                                                                    | merge decisions = zero-loss audit trail                                   |
| Audits                 | whyracingevents 2026-11-13 (FT2) · ryanmscottsdale 2026-11-13 (FT1) · bluetreefunding handbook-v4.6 2026-11-15                                                                                                                                                                                                                                                                                    | field tests / goldens                                                     |
| AEO                    | master guide v4 · consolidated v2 · gap-fill run A · run B parts 1, 2 · 5 prompt docs · `prompt-improvement-spec-v2`                                                                                                                                                                                                                                                                              |                                                                           |
| Human-sounding writing | v3: current ×5 + history ×2 = 7 files                                                                                                                                                                                                                                                                                                                                                             | "×9" in an earlier chat and one repo-handoff line is wrong; 7 exist       |
| Practices              | `Claude and LLM practices MASTER.md` · `advanced-claude-llm-practices-core-2026-11-09` · `claude-llm-practices-merge-decisions-2026-11-09` · `claude-llm-advanced-practices-research-prompt`                                                                                                                                                                                                      | created 2026-11-09, before the app (2026-11-14); general Claude practices |
| Unrelated              | website playbooks, supplement-brand SEO docs, pressure tests, wiki report, app-blueprint guide, PRD prompt, Claude Code docs, admin guide, animation guide, one HTML file                                                                                                                                                                                                                         | leave behind                                                              |

- Decided 2026-11-21: move nothing. Handbook maintenance (merge decisions, red-team prompts) and the human-sounding master stay in the old Project, where that work happens; the app repo receives released versions only. The v4.6 archive already in the repo carries §34 merge records and §38 replaced wording.
- Plugins: two older chats give conflicting SEO-plugin recommendations; no install decision recorded; order of the two chats unknown. Low priority. CARRIED.

## 9. Residual weaknesses

SUPPORTED

- Crash class = database (§2).
- Transaction-pooler compatibility of app code: one Postgres client, every Drizzle query unprepared, no session-only SQL in `src/`. Client cap 200 on free compute; pool size configurable.
- Handbook seeds from status-200 rows and caps at its own page limit (155 audited vs 80 read).
- Comparison v3: Handbook findings read from the run page 2026-11-19 23:45 · 4 of 8 dead internal targets verified in a real browser, other 4 from app output only · logo broken (`naturalWidth` 0) · Semrush checked 1,474 internal links, 0 failed · 37 zero-inlink sitemap URLs (Semrush pages export) · F15 lists 7 targets, `?page_id=15790` absent.

SPECULATIVE

- Pinned-slot mechanism (§2).
- App log for 2026-11-19 22:40–23:40 may no longer exist.
- Semrush missed the dead links because sitemap mode does not status-check targets outside the sitemap.
- F60 403 / 400 results are platform bot-blocking, not dead links; not browser-verified.
- Provisional grade will drop or hold after a render-enabled rerun; S1 render defects untested.
- Schema conflict seen on home only; other templates assumed identical. Semrush "Software App items" label = misclassification; home only.
- "HB" rows in the Semrush catalog mean a check file with that name exists; coverage of each check not tested.
- App run 2 listed many attachment paths as both 301 and 200; likely http/www variants.
- Miniflare after an app restart: workflow instances resume, die or freeze; reconciler built for each; terminate on a frozen local instance untested.
- Windows keepalive prevents WSL shutdown on this Windows build: untested.
- Supabase free plan pauses idle projects; the 5-min cron probably counts as activity. A pause shows as watchdog W2b (red, no restarts).
- Windows toast and Docker Desktop start from systemd services: best effort.
- Playwright harness breaks when upstream changes the audit UI after a rebase: loud failure, fix local to `inapp-audit.mjs`.
- AI-judge findings (F03, F06, F24, F25) vary between runs.
- Full list at plan time: `fork/DEPENDABILITY.md` §13. Items B13 settled are in `fork/reports/B13.md`.

NOT SOLVED (blueprint §13)

- PC off, asleep, or rebooted and not signed in = app down, nothing running to alert. Always-on host is a separate decision.
- Upstream Site Audit: crawl priority, 50-page default in its own form, JS rendering needs Context.dev.
- One Handbook run per machine (lease); a second audit's Handbook queues.
- Automatic re-run crawls the site a second time; at most once per 6 h per site.
- Upstream edits widen the weekly rebase conflict surface (§7).
- Weekly self-test audit (+ ≤ 20 during B13) hits salonvata.com; a host-side block is possible.
- Last-good build fallback serves older code after a failed build until fixed; status shows `warn`.

Nothing in §9 was re-tested after the dates shown. §5 lint results are the only fresh runs.

## 10. Decisions (2026-11-21 00:10, delegated by the owner)

| #   | Decision                                                                                                                                                                                 | Action for the repo session                          |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 1   | Novice cleanup = B16. B15 = accuracy only                                                                                                                                                | Use these labels in `fork/STATE.md`, queue and specs |
| 2   | Visual restyle: yes, inside B16. Limits: fork-owned theme layer only (no new upstream edits beyond the allowed list); spec offers 2–3 looks as screenshots; owner picks one before build | Write the B16 spec: 4 known gaps (§1) + restyle      |
| 3   | Order: B16 → B15. B15 spec written after the first clean M5 review                                                                                                                       | —                                                    |
| 4   | Old-Project docs: move nothing (§8)                                                                                                                                                      | —                                                    |
| 5   | M1 rebase prep: go, prep only (§7)                                                                                                                                                       | Do before B16 starts; due 2026-11-26                 |

Still the owner's: pick the look (decision 2); say "push" for the M1 force-push.

## 11. Index: question → section

| Q   | Topic               | Section                     |
| --- | ------------------- | --------------------------- |
| 1   | crash cause and fix | §2                          |
| 2   | T backlog status    | §4                          |
| 3   | B15 meaning         | §3                          |
| 4   | `handbook_lint.py`  | §5                          |
| 5   | "v4.1" ambiguity    | §5                          |
| 6   | old-Project memory  | private block (not in repo) |
| 7   | docs to move        | §8                          |
| 8   | verification status | §9                          |
| 9   | practices docs      | §8                          |
| 10  | rebase prep         | §7                          |
| 11  | plugins             | §8                          |
