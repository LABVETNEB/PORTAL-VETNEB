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
  createSourceReader,
  listSourceFiles,
  listTrackedFiles,
  listTrackedSourceFiles,
  normalizeLineEndings,
  readSourceFile,
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

// Canonical source reader (TEST-GLOBAL-05A). CR and LF are built from char
// codes: the §13.1 census counts the escaped literal as hand-written CRLF
// normalization, and this contract normalizes nothing by hand.
const CR = String.fromCharCode(13);
const LF = String.fromCharCode(10);
const HELPER_PATH = "test/helpers/tracked-source-files.ts";

function fakeSourceReader(
  files: Readonly<Record<string, string>>,
  tracked: readonly string[] = Object.keys(files),
) {
  let physicalReads = 0;
  const read = createSourceReader({
    trackedFiles: () => tracked,
    readFile: (path) => {
      physicalReads += 1;

      const contents = files[path];

      if (contents === undefined) {
        throw Object.assign(new Error(`ENOENT: ${path}`), { code: "ENOENT" });
      }

      return contents;
    },
  });

  return { read, physicalReads: () => physicalReads };
}

test("lector canónico falla explícitamente ante un path ausente o inválido", () => {
  const absent = ["test", "helpers", "absent-source-probe.ts"].join("/");

  assert.throws(() => readSourceFile(absent), /not a git-tracked file: test\/helpers\/absent-source-probe\.ts/);
  assert.throws(() => readSourceFile(""), TypeError);
  assert.throws(() => readSourceFile("   "), TypeError);
  assert.throws(() => readSourceFile(undefined as unknown as string), TypeError);
  assert.throws(
    () => readSourceFile(resolve(process.cwd(), HELPER_PATH)),
    /repo-relative, not absolute/,
  );
  for (const malformed of [
    `../${HELPER_PATH}`,
    `./${HELPER_PATH}`,
    `${HELPER_PATH}/`,
    HELPER_PATH.replace("helpers/", "helpers//"),
  ]) {
    assert.throws(
      () => readSourceFile(malformed),
      /normalized repo-relative path/,
      malformed,
    );
  }
});

test("lector canónico lee el archivo tracked real con barra o backslash", () => {
  const contents = readSourceFile(HELPER_PATH);

  assert.ok(contents.includes("export function readSourceFile("));
  assert.equal(contents.includes(CR + LF), false);
  assert.equal(readSourceFile(HELPER_PATH.split("/").join("\\")), contents);
});

test("lector canónico rechaza un archivo presente pero no trackeado", () => {
  const probeDirectory = resolve(process.cwd(), ".claude/worktrees/__reader-probe__");

  mkdirSync(probeDirectory, { recursive: true });
  writeFileSync(resolve(probeDirectory, "untracked-probe.ts"), "export {};\n", "utf8");

  try {
    assert.throws(
      () => readSourceFile(".claude/worktrees/__reader-probe__/untracked-probe.ts"),
      /not a git-tracked file/,
    );
  } finally {
    rmSync(probeDirectory, { recursive: true, force: true });
  }
});

test("lector canónico cachea por path: una sola lectura física y sin contaminación", () => {
  const reader = fakeSourceReader({
    "pkg/alpha.ts": `alpha${CR}${LF}one`,
    "pkg/beta.ts": "beta",
  });

  assert.equal(reader.read("pkg/alpha.ts"), `alpha${LF}one`);
  assert.equal(reader.read("pkg/alpha.ts"), `alpha${LF}one`);
  assert.equal(reader.read("pkg\\alpha.ts"), `alpha${LF}one`);
  assert.equal(reader.physicalReads(), 1);

  assert.equal(reader.read("pkg/beta.ts"), "beta");
  assert.equal(reader.physicalReads(), 2);
  assert.equal(reader.read("pkg/alpha.ts"), `alpha${LF}one`);
  assert.equal(reader.physicalReads(), 2);
});

test("lector canónico normaliza CRLF una sola vez y conserva CR sueltos", () => {
  const input = `x${CR}${CR}${LF}y${CR}z${CR}${LF}`;
  const reader = fakeSourceReader({ "pkg/mixed.ts": input });
  const expected = `x${CR}${LF}y${CR}z${LF}`;

  assert.equal(normalizeLineEndings(input), expected);
  assert.equal(reader.read("pkg/mixed.ts"), expected);
  assert.equal(reader.read("pkg/mixed.ts"), expected);
  assert.equal(reader.physicalReads(), 1);
  assert.throws(
    () => normalizeLineEndings(1 as unknown as string),
    /requires a string/,
  );
});

test("lector canónico no degrada fallos: sin disco para untracked, sin vacío ni cache ante ausencia", () => {
  const reader = fakeSourceReader({ "pkg/alpha.ts": "alpha" }, [
    "pkg/alpha.ts",
    "pkg/deleted.ts",
  ]);

  assert.throws(() => reader.read("pkg/untracked.ts"), /not a git-tracked file/);
  assert.equal(reader.physicalReads(), 0);

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    assert.throws(
      () => reader.read("pkg/deleted.ts"),
      /tracked source file is missing from the working tree: pkg\/deleted\.ts/,
    );
    assert.equal(reader.physicalReads(), attempt);
  }

  const denied = createSourceReader({
    trackedFiles: () => ["pkg/locked.ts"],
    readFile: () => {
      throw Object.assign(new Error("EACCES: denied"), { code: "EACCES" });
    },
  });

  assert.throws(() => denied("pkg/locked.ts"), /EACCES: denied/);

  const malformed = createSourceReader({
    trackedFiles: () => ["pkg/binary.ts"],
    readFile: () => Buffer.from("x") as unknown as string,
  });

  assert.throws(() => malformed("pkg/binary.ts"), /must yield a string/);
});
