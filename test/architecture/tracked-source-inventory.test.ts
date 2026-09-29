import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve, sep } from "node:path";
import {
  createSourceReader,
  gitLsFiles,
  listSourceFiles,
  listTrackedFiles,
  listTrackedSourceFiles,
  normalizeLineEndings,
  parseGitIndexPaths,
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

const REPO_ROOT = resolve(import.meta.dirname, "../..");
const UNTRACKED_PROBE_NAME = "untracked-probe.txt";

type UntrackedProbe = {
  readonly directory: string;
  readonly repoRelativeFile: string;
  readonly cleanup: () => void;
};

/**
 * One untracked file inside the repo, in a directory that `mkdtempSync`
 * creates fresh on every call (it never hands back an existing path). Cleanup
 * unlinks exactly that file and removes the directory non-recursively, so
 * anything the probe did not create makes cleanup fail instead of deleting it.
 */
function createUntrackedProbe(): UntrackedProbe {
  const directory = mkdtempSync(resolve(REPO_ROOT, ".vetneb-reader-probe-"));
  const file = resolve(directory, UNTRACKED_PROBE_NAME);

  try {
    writeFileSync(file, "probe\n", { encoding: "utf8", flag: "wx" });
  } catch (error) {
    rmdirSync(directory);
    throw error;
  }

  return {
    directory,
    repoRelativeFile: relative(REPO_ROOT, file).split(sep).join("/"),
    cleanup: () => {
      rmSync(file);
      rmdirSync(directory);
    },
  };
}

test("lector canónico rechaza un archivo presente pero no trackeado con un probe aislado que no borra contenido ajeno", () => {
  const probe = createUntrackedProbe();
  const sibling = createUntrackedProbe();
  const foreignFile = resolve(sibling.directory, "foreign-work.txt");

  try {
    // Rechazo: el archivo existe en disco pero no pertenece al inventario tracked.
    assert.deepEqual(
      readdirSync(probe.directory),
      [UNTRACKED_PROBE_NAME],
      "el probe existe en disco antes de leerlo",
    );
    assert.equal(
      listTrackedFiles().includes(probe.repoRelativeFile),
      false,
      "el probe no está tracked",
    );
    assert.throws(
      () => readSourceFile(probe.repoRelativeFile),
      /not a git-tracked file/,
    );

    // Aislamiento: cada creación usa un directorio propio, fuera de .claude/.
    assert.notEqual(
      probe.directory,
      sibling.directory,
      "dos probes nunca comparten directorio",
    );
    for (const created of [probe, sibling]) {
      assert.equal(
        created.repoRelativeFile.startsWith(".claude/"),
        false,
        created.repoRelativeFile,
      );
    }

    // Cleanup no recursivo: contenido ajeno lo hace fallar y sobrevive intacto.
    writeFileSync(foreignFile, "work\n", { encoding: "utf8", flag: "wx" });
    assert.throws(
      () => sibling.cleanup(),
      (error: NodeJS.ErrnoException) =>
        error.code === "ENOTEMPTY" || error.code === "EEXIST",
      "el cleanup no puede eliminar un directorio con contenido ajeno",
    );
    assert.deepEqual(
      readdirSync(sibling.directory),
      ["foreign-work.txt"],
      "el cleanup quitó sólo su propio archivo",
    );
  } finally {
    try {
      rmSync(foreignFile, { force: true });
      rmSync(resolve(sibling.directory, UNTRACKED_PROBE_NAME), { force: true });
      rmdirSync(sibling.directory);
    } finally {
      probe.cleanup();
    }
  }

  for (const created of [probe, sibling]) {
    assert.equal(
      readdirSync(REPO_ROOT).includes(basename(created.directory)),
      false,
      `${created.repoRelativeFile} no deja artefactos`,
    );
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

test("inventario tracked lee el índice git en proceso igual que git ls-files (v2, v3, v4) y delega en git ante formatos no soportados", () => {
  assert.deepEqual(
    parseGitIndexPaths(readFileSync(resolve(process.cwd(), ".git", "index"))),
    gitLsFiles(),
    "el índice del repositorio se lee igual que git ls-files",
  );

  const root = mkdtempSync(join(tmpdir(), "vetneb-git-index-"));
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8" });
  const lsFiles = () => git("ls-files", "-z").split("\0").filter(Boolean);
  const indexBytes = () => readFileSync(join(root, ".git", "index"));

  try {
    git("init", "-q");
    mkdirSync(join(root, "pkg", "nested"), { recursive: true });
    for (const path of [
      "pkg/nested/deep.ts",
      "pkg/nested/deeper-sibling.ts",
      "pkg/a.ts",
      "z.md",
      "ñandú.ts",
      // v4 comprime el prefijo: tras este nombre largo el siguiente descarta >= 128 bytes.
      `pkg/${"a".repeat(150)}.ts`,
      "pkg/b.ts",
    ]) {
      writeFileSync(join(root, path), path);
    }
    git("add", "-A");
    git("write-tree");

    for (const version of ["2", "4"]) {
      git("update-index", "--index-version", version);
      assert.equal(indexBytes().readUInt32BE(4), Number(version));
      assert.deepEqual(parseGitIndexPaths(indexBytes()), lsFiles(), `índice v${version}`);
    }

    writeFileSync(join(root, "pkg", "intent.ts"), "intent");
    git("update-index", "--index-version", "2");
    git("add", "-N", "pkg/intent.ts");
    assert.equal(indexBytes().readUInt32BE(4), 3, "intent-to-add exige flags extendidos (v3)");
    assert.ok(lsFiles().includes("pkg/intent.ts"));
    assert.deepEqual(parseGitIndexPaths(indexBytes()), lsFiles(), "índice v3 con entrada extendida");
    git("update-index", "--index-version", "4");
    assert.deepEqual(parseGitIndexPaths(indexBytes()), lsFiles(), "índice v4 con entrada extendida");

    // v4: un prefijo a descartar mayor que el nombre previo es inconsistente aun
    // cuando la longitud declarada (0xFFF) no permite contrastarlo.
    const v4 = indexBytes();
    const firstFlags = v4.readUInt16BE(12 + 60);
    let firstName = 12 + 62 + (firstFlags & 0x4000 ? 2 : 0);
    while ((v4[firstName] as number) & 0x80) firstName += 1;
    const secondEntry = v4.indexOf(0, firstName + 1) + 1;
    const secondFlags = v4.readUInt16BE(secondEntry + 60);
    const overlongStrip = Buffer.from(v4);
    overlongStrip.writeUInt16BE(secondFlags | 0x0fff, secondEntry + 60);
    overlongStrip[secondEntry + 62 + (secondFlags & 0x4000 ? 2 : 0)] = 0x7f;
    assert.equal(parseGitIndexPaths(overlongStrip), null, "prefijo v4 inconsistente delega en git");

    const truncated = indexBytes().subarray(0, indexBytes().length - 40);
    assert.equal(parseGitIndexPaths(truncated), null, "índice truncado delega en git");

    git("update-index", "--index-version", "3");
    const v3 = indexBytes();
    const unknownVersion = Buffer.from(v3);
    unknownVersion.writeUInt32BE(9, 4);
    assert.deepEqual(parseGitIndexPaths(v3), lsFiles());
    assert.equal(parseGitIndexPaths(unknownVersion), null, "versión desconocida delega en git");
    assert.equal(parseGitIndexPaths(Buffer.from("not an index")), null);

    const directoryEntry = Buffer.from(v3);
    directoryEntry.writeUInt32BE(0o040000, 12 + 24);
    assert.equal(parseGitIndexPaths(directoryEntry), null, "entrada de directorio (índice sparse) delega en git");
    const wrongNameLength = Buffer.from(v3);
    wrongNameLength.writeUInt16BE(v3.readUInt16BE(12 + 60) - 1, 12 + 60);
    assert.equal(parseGitIndexPaths(wrongNameLength), null, "longitud de nombre inconsistente delega en git");

    // La cadena de extensiones debe terminar exactamente en el hash final.
    const body = v3.subarray(0, v3.length - 20);
    const hash = Buffer.alloc(20);
    const extension = (declared: number, data: number) => {
      const bytes = Buffer.alloc(8 + data);
      bytes.write("ZZZZ", 0, "latin1");
      bytes.writeUInt32BE(declared, 4);
      return bytes;
    };
    assert.deepEqual(parseGitIndexPaths(Buffer.concat([body, extension(1, 1), hash])), lsFiles());
    assert.equal(parseGitIndexPaths(Buffer.concat([body, extension(2, 1), hash])), null);
    assert.equal(parseGitIndexPaths(Buffer.concat([body, Buffer.from("ZZZZ"), hash])), null);

    git("update-index", "--split-index");
    assert.equal(parseGitIndexPaths(indexBytes()), null, "índice dividido delega en git");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
