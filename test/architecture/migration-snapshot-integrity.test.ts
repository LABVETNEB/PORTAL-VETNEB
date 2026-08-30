import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
const migrationsDir = "drizzle/migrations";
const metaDir = "drizzle/migrations/meta";
const journalPath = `${metaDir}/_journal.json`;
const adrPath = "docs/architecture/migration-snapshot-integrity-adr.md";

// WBR-09 (VET-07): drizzle-kit generate diffs the current schema against the
// LAST *_snapshot.json file physically present on disk (verified by reading
// node_modules/drizzle-kit's own preparePrevSnapshot: it takes
// snapshots[snapshots.length - 1], not a validated historical chain). This
// repo keeps only 4 of 31 snapshots, so generate would treat migration 0014
// as the base state and could regenerate SQL for changes already applied by
// migrations 0015..0030. drizzle-kit migrate is unaffected: it reads only
// meta/_journal.json and the .sql files it names (drizzle-orm's
// readMigrationFiles never touches *_snapshot.json). Policy: MANUAL_MIGRATION_POLICY.
const MIGRATION_POLICY = "MANUAL_MIGRATION_POLICY";

function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(resolve(repoRoot, relativePath), "utf8"));
}

function listSqlStems(dir: string): string[] {
  return readdirSync(resolve(repoRoot, dir), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name.slice(0, -".sql".length))
    .sort();
}

function listSnapshotIndices(dir: string): string[] {
  return readdirSync(resolve(repoRoot, dir), { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^\d+_snapshot\.json$/.test(entry.name))
    .map((entry) => entry.name.match(/^(\d+)_snapshot\.json$/)![1])
    .sort();
}

type JournalEntry = { idx: number; tag: string };
type Journal = { entries: JournalEntry[] };

function validateSqlJournalCorrespondence(
  sqlStems: readonly string[],
  journalTags: readonly string[],
): { sqlWithoutJournal: string[]; journalWithoutSql: string[] } {
  const sqlSet = new Set(sqlStems);
  const tagSet = new Set(journalTags);

  return {
    sqlWithoutJournal: sqlStems.filter((stem) => !tagSet.has(stem)).sort(),
    journalWithoutSql: journalTags.filter((tag) => !sqlSet.has(tag)).sort(),
  };
}

function validateJournalIndices(entries: readonly JournalEntry[]): {
  duplicateIndices: number[];
  isContiguousFromZero: boolean;
} {
  const idxs = entries.map((entry) => entry.idx);
  const seen = new Set<number>();
  const duplicates = new Set<number>();

  for (const idx of idxs) {
    if (seen.has(idx)) {
      duplicates.add(idx);
    }
    seen.add(idx);
  }

  const sorted = [...idxs].sort((a, b) => a - b);
  const isContiguousFromZero = sorted.every((value, index) => value === index);

  return {
    duplicateIndices: [...duplicates].sort((a, b) => a - b),
    isContiguousFromZero,
  };
}

function validateSnapshotsAgainstJournal(
  snapshotIndices: readonly string[],
  journalTags: readonly string[],
): { snapshotWithoutJournal: string[] } {
  return {
    snapshotWithoutJournal: snapshotIndices
      .filter((index) => !journalTags.some((tag) => tag.startsWith(`${index}_`)))
      .sort(),
  };
}

function validatePackageScripts(scripts: Readonly<Record<string, string>>): {
  dbGenerateScriptPresent: boolean;
  dbMigrateScriptPresent: boolean;
  drizzleGenerateAliases: string[];
} {
  const GENERATE_PATTERN = /\bdrizzle-kit\s+generate\b/;

  return {
    dbGenerateScriptPresent: Object.prototype.hasOwnProperty.call(scripts, "db:generate"),
    dbMigrateScriptPresent: scripts["db:migrate"] === "drizzle-kit migrate",
    drizzleGenerateAliases: Object.entries(scripts)
      .filter(([, value]) => GENERATE_PATTERN.test(value))
      .map(([key]) => key)
      .sort(),
  };
}

function loadRealState() {
  const sqlStems = listSqlStems(migrationsDir);
  const journal = readJson(journalPath) as Journal;
  const journalTags = journal.entries.map((entry) => entry.tag);
  const snapshotIndices = listSnapshotIndices(metaDir);
  const pkg = readJson("package.json") as { scripts: Record<string, string> };

  return { sqlStems, journal, journalTags, snapshotIndices, pkg };
}

test("SQL migrations and journal entries correspond exactly", () => {
  const { sqlStems, journalTags } = loadRealState();
  const { sqlWithoutJournal, journalWithoutSql } = validateSqlJournalCorrespondence(
    sqlStems,
    journalTags,
  );

  assert.deepEqual(sqlWithoutJournal, [], "every .sql file must have a journal entry");
  assert.deepEqual(journalWithoutSql, [], "every journal entry must have a .sql file");
});

test("journal indices are unique and contiguous from zero", () => {
  const { journal } = loadRealState();
  const { duplicateIndices, isContiguousFromZero } = validateJournalIndices(journal.entries);

  assert.deepEqual(duplicateIndices, [], "journal must not contain duplicate idx values");
  assert.equal(isContiguousFromZero, true, "journal idx must be 0..N-1 with no gaps");
});

test("existing snapshots correspond to real journal entries", () => {
  const { snapshotIndices, journalTags } = loadRealState();
  const { snapshotWithoutJournal } = validateSnapshotsAgainstJournal(snapshotIndices, journalTags);

  assert.deepEqual(
    snapshotWithoutJournal,
    [],
    "every meta/*_snapshot.json must correspond to a real journal entry",
  );
});

test("WBR-09: db:generate is retired and db:migrate is preserved", () => {
  const { pkg } = loadRealState();
  const { dbGenerateScriptPresent, dbMigrateScriptPresent, drizzleGenerateAliases } =
    validatePackageScripts(pkg.scripts);

  assert.equal(dbGenerateScriptPresent, false, "db:generate must not be exposed");
  assert.equal(dbMigrateScriptPresent, true, "db:migrate must remain drizzle-kit migrate");
  assert.deepEqual(
    drizzleGenerateAliases,
    [],
    "no script may alias `drizzle-kit generate` under another name",
  );
});

test("canonical migration policy is documented", () => {
  const adr = readFileSync(resolve(repoRoot, adrPath), "utf8");

  assert.match(adr, new RegExp(MIGRATION_POLICY));
  assert.match(adr, /db:generate`? is retired/i);
  assert.match(adr, /fuente de verdad/i);
});

test("negative proof: mutated inputs are correctly rejected by the pure validators", () => {
  const { sqlStems, journal, journalTags, snapshotIndices, pkg } = loadRealState();

  // A. a journal entry without a matching .sql file must be detected.
  const journalWithExtraEntry = [...journalTags, "0031_phantom_migration"];
  assert.deepEqual(
    validateSqlJournalCorrespondence(sqlStems, journalWithExtraEntry).journalWithoutSql,
    ["0031_phantom_migration"],
  );

  // B. a stray .sql file without a journal entry must be detected.
  const sqlWithExtraFile = [...sqlStems, "0031_untracked_change"];
  assert.deepEqual(
    validateSqlJournalCorrespondence(sqlWithExtraFile, journalTags).sqlWithoutJournal,
    ["0031_untracked_change"],
  );

  // C. a duplicated idx must be detected.
  const entriesWithDuplicateIdx: JournalEntry[] = [
    ...journal.entries,
    { idx: journal.entries[0]!.idx, tag: "duplicate" },
  ];
  const duplicateResult = validateJournalIndices(entriesWithDuplicateIdx);
  assert.deepEqual(duplicateResult.duplicateIndices, [journal.entries[0]!.idx]);

  // D. a gap in the idx sequence must be detected.
  const entriesWithGap: JournalEntry[] = journal.entries.filter((entry) => entry.idx !== 1);
  assert.equal(validateJournalIndices(entriesWithGap).isContiguousFromZero, false);

  // E. a snapshot whose index has no journal entry must be detected.
  const snapshotsWithPhantom = [...snapshotIndices, "9999"];
  assert.deepEqual(
    validateSnapshotsAgainstJournal(snapshotsWithPhantom, journalTags).snapshotWithoutJournal,
    ["9999"],
  );

  // F. reintroducing db:generate must be detected.
  const scriptsWithRegression = { ...pkg.scripts, "db:generate": "drizzle-kit generate" };
  assert.equal(validatePackageScripts(scriptsWithRegression).dbGenerateScriptPresent, true);

  // G. an alias under a different key must also be detected structurally.
  const scriptsWithHiddenAlias = { ...pkg.scripts, "db:regen": "drizzle-kit generate --custom" };
  assert.deepEqual(validatePackageScripts(scriptsWithHiddenAlias).drizzleGenerateAliases, [
    "db:regen",
  ]);

  // H. removing db:migrate must be detected.
  const { ["db:migrate"]: _removed, ...scriptsWithoutMigrate } = pkg.scripts;
  assert.equal(validatePackageScripts(scriptsWithoutMigrate).dbMigrateScriptPresent, false);
});

test("migration snapshot integrity guardrail source stays ascii only", () => {
  const source = readFileSync(
    resolve(repoRoot, "test/architecture/migration-snapshot-integrity.test.ts"),
    "utf8",
  );

  for (let index = 0; index < source.length; index += 1) {
    assert.equal(
      source.charCodeAt(index) <= 0x7f,
      true,
      `migration snapshot integrity source must stay ascii-only at index ${index}`,
    );
  }
});
