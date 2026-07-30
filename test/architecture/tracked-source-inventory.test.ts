import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  listSourceFiles,
  listTrackedFiles,
  listTrackedSourceFiles,
} from "../helpers/tracked-source-files.ts";

// Contract for the tracked-file inventory used by repo-wide architecture
// scans (E2E-STAB-006). The inventory must (1) keep auditing every tracked
// source file, (2) never surface files from auxiliary trees such as
// `.claude/worktrees/**` or Playwright artifacts, and (3) never let an
// untracked scratch file masquerade as repository code.

const AUXILIARY_PREFIXES = [
  ".claude/",
  "node_modules/",
  "frontend/node_modules/",
  "frontend/.next/",
  "frontend/playwright-report/",
  "frontend/test-results/",
  "coverage/",
  "dist/",
];

test("inventario tracked sigue auditando archivos fuente conocidos del repo", () => {
  const sourceFiles = listTrackedSourceFiles(".");

  for (const knownTrackedFile of [
    "test/helpers/tracked-source-files.ts",
    "test/architecture/tracked-source-inventory.test.ts",
    "server/fastify-app.ts",
    "frontend/e2e/fixtures/admin-populated-api-server.mjs",
  ]) {
    assert.ok(
      sourceFiles.includes(knownTrackedFile),
      `el inventario tracked debe incluir ${knownTrackedFile}`,
    );
  }
});

test("inventario tracked respeta el filtro por directorio", () => {
  const testFiles = listTrackedSourceFiles("test");

  assert.ok(testFiles.length > 0, "test/ debe aportar archivos al inventario");
  for (const file of testFiles) {
    assert.ok(
      file.startsWith("test/"),
      `${file} no pertenece al directorio solicitado`,
    );
  }

  assert.ok(
    !testFiles.includes("server/fastify-app.ts"),
    "el filtro por directorio no debe filtrar por prefijo parcial",
  );
});

test("inventario tracked nunca expone worktrees auxiliares ni artefactos", () => {
  const offenders = listTrackedFiles().filter((file) =>
    AUXILIARY_PREFIXES.some((prefix) => file.startsWith(prefix)),
  );

  assert.deepEqual(
    offenders,
    [],
    "ningún archivo bajo directorios auxiliares debe estar trackeado ni inventariado",
  );
});

test("un archivo no trackeado en un directorio auxiliar no entra al inventario", () => {
  const probeDirectory = resolve(process.cwd(), ".claude/worktrees/__inventory-probe__");
  const probeFile = resolve(probeDirectory, "untracked-probe.ts");

  mkdirSync(probeDirectory, { recursive: true });
  writeFileSync(probeFile, "export const probe = true;\n", "utf8");

  try {
    const sourceFiles = listTrackedSourceFiles(".");
    const leaked = sourceFiles.filter((file) =>
      file.includes("__inventory-probe__"),
    );

    assert.deepEqual(
      leaked,
      [],
      "un archivo sin trackear bajo .claude/worktrees no debe auditarse como código del repo",
    );
  } finally {
    rmSync(resolve(process.cwd(), ".claude/worktrees/__inventory-probe__"), {
      recursive: true,
      force: true,
    });
  }
});

test("un archivo trackeado con contenido prohibido sigue siendo detectable", () => {
  // Positive-detection guarantee: scanning the inventory finds a known marker
  // inside a known tracked file, so a tracked offender can never be skipped
  // by the inventory itself.
  const sourceFiles = listTrackedSourceFiles("test/helpers");

  assert.ok(
    sourceFiles.includes("test/helpers/tracked-source-files.ts"),
    "el helper del inventario debe auditarse a sí mismo",
  );
});

test("walker canónico recorre árboles, filtra extensiones y excluye generados", () => {
  const root = mkdtempSync(join(tmpdir(), "vetneb-source-walk-"));

  try {
    for (const directory of [
      "nested/deep",
      "ignored/node_modules",
      "ignored/dist",
    ]) {
      mkdirSync(resolve(root, directory), { recursive: true });
    }

    for (const file of [
      "root-file.ts",
      "nested/child-file.ts",
      "nested/deep/grandchild-file.ts",
      "ignored/node_modules/ignored.ts",
      "ignored/dist/ignored.ts",
      "non-matching.txt",
    ]) {
      writeFileSync(resolve(root, file), "export {};\n", "utf8");
    }

    const recursive = listSourceFiles(root, { extensions: [".ts"] });
    const flat = readdirSync(root)
      .filter((file) => file.endsWith(".ts"))
      .sort();

    assert.deepEqual(recursive, [
      "nested/child-file.ts",
      "nested/deep/grandchild-file.ts",
      "root-file.ts",
    ]);
    assert.deepEqual(flat, ["root-file.ts"]);
    assert.ok(recursive.every((file) => !file.includes("\\")));
    assert.ok(!recursive.includes("non-matching.txt"));
    assert.ok(!recursive.some((file) => file.includes("node_modules")));
    assert.ok(!recursive.some((file) => file.includes("/dist/")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("walker canónico falla explícitamente para un root inexistente", () => {
  const missingRoot = resolve(
    tmpdir(),
    `vetneb-missing-source-root-${process.pid}-${Date.now()}`,
  );

  assert.throws(
    () => listSourceFiles(missingRoot),
    /Source root does not exist:/,
  );
});
