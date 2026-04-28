import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const migrationsDir = resolve(process.cwd(), "drizzle", "migrations");
const metaDir = join(migrationsDir, "meta");
const journalPath = join(metaDir, "_journal.json");

function readText(path: string): string {
  return readFileSync(path, "utf8");
}

function getSqlMigrationFiles(): string[] {
  return readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
}

test("drizzle migrations directory keeps SQL files and journal metadata", () => {
  assert.ok(existsSync(migrationsDir), "drizzle/migrations debe existir");
  assert.ok(existsSync(metaDir), "drizzle/migrations/meta debe existir");
  assert.ok(existsSync(journalPath), "drizzle/migrations/meta/_journal.json debe existir");

  const sqlFiles = getSqlMigrationFiles();
  assert.ok(sqlFiles.length > 0, "debe existir al menos una migración SQL");

  for (const file of sqlFiles) {
    const fullPath = join(migrationsDir, file);
    assert.ok(statSync(fullPath).size > 0, `${file} no debe estar vacía`);
  }
});

test("drizzle SQL migrations do not contain corrupted markers", () => {
  const forbiddenPatterns = [
    {
      pattern: /^<<<<<<<(?: .*)?$/m,
      label: "merge conflict start marker",
    },
    {
      pattern: /^=======$/m,
      label: "merge conflict separator marker",
    },
    {
      pattern: /^>>>>>>>(?: .*)?$/m,
      label: "merge conflict end marker",
    },
    {
      pattern: /`r`n/,
      label: "PowerShell literal newline marker",
    },
    {
      pattern: /\u0000/,
      label: "NUL byte",
    },
  ];

  for (const file of getSqlMigrationFiles()) {
    const content = readText(join(migrationsDir, file));

    for (const { pattern, label } of forbiddenPatterns) {
      assert.ok(
        !pattern.test(content),
        `${file} contiene marcador corrupto: ${label}`,
      );
    }
  }
});

test("drizzle migration prefixes and journal entries are consistent", () => {
  const sqlFiles = getSqlMigrationFiles();
  const prefixes = sqlFiles.map((file) => file.split("_")[0]);

  assert.equal(
    new Set(prefixes).size,
    prefixes.length,
    "no debe haber prefijos numéricos de migración duplicados",
  );

  const journal = JSON.parse(readText(journalPath)) as {
    version?: string;
    dialect?: string;
    entries?: Array<{ idx?: number; tag?: string }>;
  };

  assert.equal(journal.dialect, "postgresql");
  assert.ok(Array.isArray(journal.entries), "_journal.json debe tener entries");

  const sqlBaseNames = new Set(sqlFiles.map((file) => basename(file, ".sql")));

  for (const entry of journal.entries ?? []) {
    assert.equal(typeof entry.idx, "number", "cada entry debe tener idx numérico");
    assert.equal(typeof entry.tag, "string", "cada entry debe tener tag string");
    assert.ok(
      sqlBaseNames.has(entry.tag ?? ""),
      `_journal.json referencia una migración inexistente: ${entry.tag}`,
    );
  }

  assert.equal(
    new Set((journal.entries ?? []).map((entry) => entry.idx)).size,
    journal.entries?.length ?? 0,
    "_journal.json no debe duplicar idx",
  );
  assert.equal(
    new Set((journal.entries ?? []).map((entry) => entry.tag)).size,
    journal.entries?.length ?? 0,
    "_journal.json no debe duplicar tags",
  );
});
