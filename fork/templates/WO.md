# WO-B{n}-{nnn}: {title}

- Batch: B{n} · Class: LIGHT · Size: S | M | L
- Contracts: CONTRACTS_VERSION {x.y.z}
- Depends: WO-…, WO-…
- Registry items: P{p}-{nn}, …

## Read first

- {exact file paths}
- Handbook: `fork/handbook/…` §{n} lines {a–b} (quote the rule text below)

## Files (create / modify — no others)

- {path} — create
- {path} — modify ({what})

## Spec

- Rule text (verbatim from handbook): "…"
- Logic: {exact conditions, thresholds, edge cases}
- Status mapping: PASS when … · OPEN when … · PARTIAL when … · N/A when … · BLOCKED when …
- Severity: S{n} ({source})

## Evidence to store

- kind: {…} · url · excerpt rule · storage

## BadGEO fixtures

- `fork/fixtures/badgeo/{page}.html` → expect: [{item ids}]
- negative page (must NOT fire): `{page}.html`

## Tests

- {test file}: {cases}

## Acceptance

```
pnpm types:check
pnpm lint
pnpm test {pattern}
pnpm tsx fork/scripts/badgeo-run.ts --only {item ids}
```

Expected: {…}

## Escalate if

- {conditions} → mark ESCALATE in `fork/queue.md` with a one-line reason; move on.

## Do not

- Edit contracts, schema, migrations, upstream files, other WOs' files, `fork/handbook/`, `fork/fixtures/audits/`.
