// Upstream rebase helper (MAINTENANCE M1, "Migration collisions").
// Run at a rebase stop where the replayed fork commit adds a drizzle migration
// whose number upstream now uses. The fork migration NN moves to NN+1; upstream's
// NN stays. Journal entries keep their original `when`, so databases that already
// applied the fork migrations do not apply them again.
//
//   node fork/scripts/migration-renumber.mjs "$(git rev-parse REBASE_HEAD)"
//
// Tables that upstream added since the fork point are copied into the moved
// fork snapshot and its prevId is chained to the snapshot before it. Changes
// upstream made to existing tables are not copied: after the rebase both
// `drizzle-kit generate` configs must print "No schema changes"; otherwise ESCALATE.
import { execFileSync } from "node:child_process";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";

const commit = process.argv[2];
if (!commit) {
  console.error(
    "usage: node fork/scripts/migration-renumber.mjs <replayed-commit>",
  );
  process.exit(2);
}
const git = (...a) =>
  execFileSync("git", a, { encoding: "utf8", maxBuffer: 1 << 28 });
const show = (rev, p) => git("show", `${rev}:${p}`);
const pad = (n) => String(n).padStart(4, "0");
const forkPoint = git("merge-base", "upstream/main", "ORIG_HEAD").trim();

function latestSnapshot(rev, dialect) {
  const journal = JSON.parse(
    show(rev, `drizzle/${dialect}/meta/_journal.json`),
  );
  const tag = journal.entries.at(-1).tag;
  return JSON.parse(
    show(rev, `drizzle/${dialect}/meta/${tag.slice(0, 4)}_snapshot.json`),
  );
}

for (const dialect of ["sqlite", "pg"]) {
  const dir = `drizzle/${dialect}`;
  const added = git("show", "--name-status", "--format=", commit, "--", dir)
    .split("\n")
    .filter((l) => /^A\s+drizzle\/\w+\/\d{4}_[\w-]+\.sql$/.test(l))
    .map((l) => l.split(/\s+/)[1]);
  if (added.length === 0) continue;
  if (added.length !== 1)
    throw new Error(`${dialect}: expected one new .sql, got ${added}`);

  const [, num, name] = added[0].match(/(\d{4})_([\w-]+)\.sql$/);
  const oldNum = Number(num);
  const newNum = oldNum + 1;
  const newSql = `${dir}/${pad(newNum)}_${name}.sql`;
  const oldSnap = `${dir}/meta/${pad(oldNum)}_snapshot.json`;
  const newSnap = `${dir}/meta/${pad(newNum)}_snapshot.json`;
  const journalPath = `${dir}/meta/_journal.json`;

  // SQL file moves to the next number.
  writeFileSync(newSql, show(commit, added[0]));
  git("rm", "-q", "--cached", "--ignore-unmatch", added[0]);
  if (existsSync(added[0])) unlinkSync(added[0]);
  git("add", newSql);

  // Snapshot: HEAD keeps oldNum; the fork snapshot moves to newNum.
  const headSnap = JSON.parse(show("HEAD", oldSnap));
  const forkSnap = JSON.parse(show(commit, oldSnap));
  const before = latestSnapshot(forkPoint, dialect).tables;
  const upstream = latestSnapshot("upstream/main", dialect).tables;
  forkSnap.prevId = headSnap.id;
  for (const [key, table] of Object.entries(upstream)) {
    if (!before[key] && !forkSnap.tables[key]) forkSnap.tables[key] = table;
  }
  forkSnap.tables = Object.fromEntries(
    Object.entries(forkSnap.tables).sort(([a], [b]) => a.localeCompare(b)),
  );
  writeFileSync(oldSnap, show("HEAD", oldSnap));
  writeFileSync(newSnap, JSON.stringify(forkSnap, null, 2));
  git("add", oldSnap, newSnap);

  // Journal: HEAD's entries + the fork entry at newNum, original `when` kept.
  const headJ = JSON.parse(show("HEAD", journalPath));
  const forkJ = JSON.parse(show(commit, journalPath));
  const entry = forkJ.entries.find((e) => e.tag === `${num}_${name}`);
  if (!entry)
    throw new Error(`${dialect}: fork journal entry ${num}_${name} not found`);
  if (headJ.entries.at(-1).idx !== oldNum) {
    throw new Error(
      `${dialect}: HEAD journal ends at ${headJ.entries.at(-1).idx}, expected ${oldNum}`,
    );
  }
  headJ.entries.push({ ...entry, idx: newNum, tag: `${pad(newNum)}_${name}` });
  writeFileSync(journalPath, JSON.stringify(headJ, null, 2));
  git("add", journalPath);

  console.log(`${dialect}: ${added[0]} -> ${newSql}`);
}
