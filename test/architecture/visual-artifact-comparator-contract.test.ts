import test, { after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Contract for the exact PNG visual-artifact comparator
// (frontend/e2e/scripts/compare-visual-artifacts.mjs). Every PNG fixture is
// fabricated inside a temporary directory; no PNG binaries are versioned. Tests
// exercise both the exported pure functions and the real CLI via spawnSync, and
// never mock the PNG decoder under test.

interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface PairResult {
  path: string;
  classification: string;
  byteIdentical: boolean;
  leftSha256: string;
  rightSha256: string;
  leftWidth: number;
  leftHeight: number;
  rightWidth: number;
  rightHeight: number;
  dimensionsIdentical: boolean;
  pixelIdentical: boolean;
  diffPixelCount: number | null;
  diffBoundingBox: BoundingBox | null;
}

interface ComparisonSummary {
  leftCount: number;
  rightCount: number;
  matchedPathCount: number;
  missingLeftCount: number;
  missingRightCount: number;
  dimensionIdenticalCount: number;
  dimensionDifferentCount: number;
  byteIdenticalCount: number;
  byteDifferentCount: number;
  byteDifferentPixelIdenticalCount: number;
  pixelIdenticalCount: number;
  pixelDifferentCount: number;
  requireCountSatisfied: boolean;
  passed: boolean;
}

interface Comparison {
  schemaVersion: number;
  leftRoot: string;
  rightRoot: string;
  requiredCount: number | null;
  summary: ComparisonSummary;
  missingLeft: string[];
  missingRight: string[];
  results: PairResult[];
}

interface ParsedArgs {
  left: string | null;
  right: string | null;
  requireCount: number | null;
  reportDir: string | null;
  help: boolean;
  debug: boolean;
}

interface ComparatorModule {
  SCHEMA_VERSION: number;
  EXIT_PASS: number;
  EXIT_CONTRACT_FAILED: number;
  EXIT_INFRASTRUCTURE: number;
  CLASSIFICATIONS: Record<string, string>;
  parseArgs: (argv: string[]) => ParsedArgs;
  discoverPngFiles: (root: string) => string[];
  sha256Hex: (buffer: Buffer) => string;
  comparePngPair: (leftAbsolute: string, rightAbsolute: string, display?: string) => PairResult;
  compareDirectories: (
    leftRoot: string,
    rightRoot: string,
    options?: { requireCount?: number | null },
  ) => Comparison;
  buildJsonReport: (comparison: Comparison) => string;
  buildCsvReport: (comparison: Comparison) => string;
}

interface PngImage {
  width: number;
  height: number;
  data: Buffer;
}

interface PngStatic {
  new (options: { width: number; height: number }): PngImage;
  sync: {
    write: (png: PngImage, options?: { deflateLevel?: number }) => Buffer;
    read: (buffer: Buffer) => PngImage;
  };
}

const TEST_FILE = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(TEST_FILE), "..", "..");
const CLI_PATH = resolve(REPO_ROOT, "frontend/e2e/scripts/compare-visual-artifacts.mjs");
const CLI_URL = pathToFileURL(CLI_PATH).href;

// Dynamic import with a non-literal specifier keeps these off the TS module graph
// (the .mjs has no declaration file); the typed casts document the real shape.
const comparator = (await import(CLI_URL)) as ComparatorModule;
const PngConstructor = ((await import("pngjs" as string)) as { PNG: PngStatic }).PNG;

const C = comparator.CLASSIFICATIONS;

const SUITE_ROOT = mkdtempSync(join(tmpdir(), "visual-artifact-comparator-"));
after(() => rmSync(SUITE_ROOT, { recursive: true, force: true }));

const REPORT_JSON = "visual-artifact-comparison.json";
const REPORT_CSV = "visual-artifact-comparison.csv";

const EXPECTED_CSV_HEADER =
  "path,classification,byteIdentical,leftSha256,rightSha256,leftWidth,leftHeight," +
  "rightWidth,rightHeight,dimensionsIdentical,pixelIdentical,diffPixelCount," +
  "diffMinX,diffMinY,diffMaxX,diffMaxY";

// ---------------------------------------------------------------------------
// Fixture helpers.
// ---------------------------------------------------------------------------

let caseCounter = 0;
function makeCaseDir(label: string): string {
  caseCounter += 1;
  const dir = join(SUITE_ROOT, `${label}-${caseCounter}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function gradientData(width: number, height: number, seed: number): Buffer {
  const data = Buffer.alloc(width * height * 4);
  for (let index = 0; index < data.length; index += 1) {
    data[index] = (index * 31 + seed * 7 + 13) % 256;
  }
  // Force some non-opaque alpha so encoders keep the alpha channel meaningful.
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    data[pixel * 4 + 3] = pixel % 2 === 0 ? 255 : 200;
  }
  return data;
}

function encodePng(width: number, height: number, data: Buffer, deflateLevel?: number): Buffer {
  const png = new PngConstructor({ width, height });
  data.copy(png.data);
  return deflateLevel === undefined
    ? PngConstructor.sync.write(png)
    : PngConstructor.sync.write(png, { deflateLevel });
}

function writePng(root: string, relativePath: string, buffer: Buffer): string {
  const absolute = join(root, relativePath.split("/").join(sep));
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, buffer);
  return absolute;
}

function runCli(
  args: string[],
  options: { cwd?: string; debug?: boolean } = {},
): { status: number | null; stdout: string; stderr: string } {
  const finalArgs = options.debug ? [...args, "--debug"] : args;
  const result = spawnSync(process.execPath, [CLI_PATH, ...finalArgs], {
    cwd: options.cwd ?? REPO_ROOT,
    encoding: "utf8",
  });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function hashTree(root: string): Map<string, string> {
  const hashes = new Map<string, string>();
  for (const relativePath of comparator.discoverPngFiles(root)) {
    const absolute = join(root, relativePath.split("/").join(sep));
    hashes.set(relativePath, comparator.sha256Hex(readFileSync(absolute)));
  }
  return hashes;
}

function detectSymlinkSupport(): boolean {
  const probe = makeCaseDir("symlink-probe");
  const target = join(probe, "target.png");
  writeFileSync(target, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  try {
    symlinkSync(target, join(probe, "link.png"));
    return true;
  } catch {
    return false;
  }
}

const SYMLINK_SUPPORTED = detectSymlinkSupport();

// ---------------------------------------------------------------------------
// 1. Two binary-identical PNGs.
// ---------------------------------------------------------------------------

test("1: binary-identical PNGs pass with byte-identical and pixel-identical", () => {
  const left = makeCaseDir("identical-left");
  const right = makeCaseDir("identical-right");
  const bytes = encodePng(6, 4, gradientData(6, 4, 1));
  writePng(left, "a.png", bytes);
  writePng(right, "a.png", bytes);

  const comparison = comparator.compareDirectories(left, right);
  assert.equal(comparison.summary.passed, true);
  assert.equal(comparison.results.length, 1);
  const [result] = comparison.results;
  assert.equal(result.classification, C.BYTE_IDENTICAL);
  assert.equal(result.byteIdentical, true);
  assert.equal(result.pixelIdentical, true);
  assert.equal(result.dimensionsIdentical, true);
  assert.equal(result.diffPixelCount, 0);
  assert.equal(result.diffBoundingBox, null);

  const cli = runCli(["--left", left, "--right", right]);
  assert.equal(cli.status, comparator.EXIT_PASS);
  assert.match(cli.stdout, /RESULT: PASS/);
  assert.match(cli.stdout, /byte-identical:\s+1/);
});

// ---------------------------------------------------------------------------
// 2. Same pixels, different bytes (different compression) -> accepted.
// ---------------------------------------------------------------------------

test("2: same pixels with different bytes classify byte-different-pixel-identical and pass", () => {
  const left = makeCaseDir("bdpi-left");
  const right = makeCaseDir("bdpi-right");
  const data = gradientData(8, 5, 2);
  const leftBytes = encodePng(8, 5, data, 0);
  const rightBytes = encodePng(8, 5, data, 9);

  // Prove the SHA-256 digests really differ before comparing.
  assert.notEqual(comparator.sha256Hex(leftBytes), comparator.sha256Hex(rightBytes));
  assert.equal(leftBytes.equals(rightBytes), false);

  writePng(left, "same.png", leftBytes);
  writePng(right, "same.png", rightBytes);

  const comparison = comparator.compareDirectories(left, right);
  assert.equal(comparison.summary.passed, true);
  const [result] = comparison.results;
  assert.equal(result.classification, C.BYTE_DIFFERENT_PIXEL_IDENTICAL);
  assert.equal(result.byteIdentical, false);
  assert.equal(result.pixelIdentical, true);
  assert.equal(result.dimensionsIdentical, true);
  assert.equal(result.diffPixelCount, 0);
  assert.equal(result.diffBoundingBox, null);
  assert.equal(comparison.summary.byteDifferentCount, 1);
  assert.equal(comparison.summary.byteDifferentPixelIdenticalCount, 1);
  assert.equal(comparison.summary.pixelIdenticalCount, 1);

  const cli = runCli(["--left", left, "--right", right]);
  assert.equal(cli.status, comparator.EXIT_PASS);
  assert.match(cli.stdout, /byte-different-pixel-identical:\s+1/);
  assert.match(cli.stdout, /Byte-different but pixel-identical/);
  assert.match(cli.stdout, /- same\.png/);
});

// ---------------------------------------------------------------------------
// 3. A single differing RGBA pixel.
// ---------------------------------------------------------------------------

test("3: a single differing pixel fails with exact count and a one-pixel bounding box", () => {
  const left = makeCaseDir("one-pixel-left");
  const right = makeCaseDir("one-pixel-right");
  const width = 10;
  const height = 8;
  const data = gradientData(width, height, 3);
  const mutated = Buffer.from(data);
  const target = { x: 5, y: 4 };
  const offset = (target.y * width + target.x) * 4 + 3; // alpha byte
  mutated[offset] = mutated[offset] ^ 0x01;

  writePng(left, "one.png", encodePng(width, height, data));
  writePng(right, "one.png", encodePng(width, height, mutated));

  const comparison = comparator.compareDirectories(left, right);
  assert.equal(comparison.summary.passed, false);
  const [result] = comparison.results;
  assert.equal(result.classification, C.PIXEL_DIFFERENT);
  assert.equal(result.dimensionsIdentical, true);
  assert.equal(result.pixelIdentical, false);
  assert.equal(result.diffPixelCount, 1);
  assert.deepEqual(result.diffBoundingBox, {
    minX: target.x,
    minY: target.y,
    maxX: target.x,
    maxY: target.y,
  });

  const cli = runCli(["--left", left, "--right", right]);
  assert.equal(cli.status, comparator.EXIT_CONTRACT_FAILED);
  assert.match(cli.stdout, /RESULT: FAIL/);
  assert.match(cli.stdout, /pixel-different/);
});

// ---------------------------------------------------------------------------
// 4. Several differing pixels in separate positions.
// ---------------------------------------------------------------------------

test("4: several differing pixels produce the exact count and inclusive bounding box", () => {
  const left = makeCaseDir("multi-pixel-left");
  const right = makeCaseDir("multi-pixel-right");
  const width = 16;
  const height = 12;
  const data = gradientData(width, height, 4);
  const mutated = Buffer.from(data);
  const targets = [
    { x: 2, y: 3 },
    { x: 11, y: 1 },
    { x: 6, y: 9 },
  ];
  for (const point of targets) {
    const offset = (point.y * width + point.x) * 4; // red byte
    mutated[offset] = mutated[offset] ^ 0xff;
  }

  writePng(left, "multi.png", encodePng(width, height, data));
  writePng(right, "multi.png", encodePng(width, height, mutated));

  const [result] = comparator.compareDirectories(left, right).results;
  assert.equal(result.classification, C.PIXEL_DIFFERENT);
  assert.equal(result.diffPixelCount, targets.length);
  assert.deepEqual(result.diffBoundingBox, {
    minX: Math.min(...targets.map((point) => point.x)),
    minY: Math.min(...targets.map((point) => point.y)),
    maxX: Math.max(...targets.map((point) => point.x)),
    maxY: Math.max(...targets.map((point) => point.y)),
  });
});

// ---------------------------------------------------------------------------
// 5. Different dimensions.
// ---------------------------------------------------------------------------

test("5: different dimensions fail and classify dimension-different", () => {
  const left = makeCaseDir("dimension-left");
  const right = makeCaseDir("dimension-right");
  writePng(left, "size.png", encodePng(6, 6, gradientData(6, 6, 5)));
  writePng(right, "size.png", encodePng(8, 6, gradientData(8, 6, 5)));

  const comparison = comparator.compareDirectories(left, right);
  assert.equal(comparison.summary.passed, false);
  const [result] = comparison.results;
  assert.equal(result.classification, C.DIMENSION_DIFFERENT);
  assert.equal(result.dimensionsIdentical, false);
  assert.equal(result.pixelIdentical, false);
  assert.equal(result.diffPixelCount, null);
  assert.equal(result.diffBoundingBox, null);
  assert.equal(comparison.summary.dimensionDifferentCount, 1);

  const cli = runCli(["--left", left, "--right", right]);
  assert.equal(cli.status, comparator.EXIT_CONTRACT_FAILED);
  assert.match(cli.stdout, /dimension-different/);
});

// ---------------------------------------------------------------------------
// 6. File missing in left (present only in right) -> missing-left.
// ---------------------------------------------------------------------------

test("6: a file absent from left is reported as missing-left and fails", () => {
  const left = makeCaseDir("missing-left-left");
  const right = makeCaseDir("missing-left-right");
  const shared = encodePng(4, 4, gradientData(4, 4, 6));
  writePng(left, "shared.png", shared);
  writePng(right, "shared.png", shared);
  writePng(right, "only-in-right.png", encodePng(4, 4, gradientData(4, 4, 61)));

  const comparison = comparator.compareDirectories(left, right);
  assert.equal(comparison.summary.passed, false);
  assert.deepEqual(comparison.missingLeft, ["only-in-right.png"]);
  assert.deepEqual(comparison.missingRight, []);

  const cli = runCli(["--left", left, "--right", right]);
  assert.equal(cli.status, comparator.EXIT_CONTRACT_FAILED);
  assert.match(cli.stdout, /missing-left:\s+1/);
  assert.match(cli.stdout, /\[missing-left\] only-in-right\.png/);
});

// ---------------------------------------------------------------------------
// 7. File missing in right (present only in left) -> missing-right.
// ---------------------------------------------------------------------------

test("7: a file absent from right is reported as missing-right and fails", () => {
  const left = makeCaseDir("missing-right-left");
  const right = makeCaseDir("missing-right-right");
  const shared = encodePng(4, 4, gradientData(4, 4, 7));
  writePng(left, "shared.png", shared);
  writePng(right, "shared.png", shared);
  writePng(left, "only-in-left.png", encodePng(4, 4, gradientData(4, 4, 71)));

  const comparison = comparator.compareDirectories(left, right);
  assert.equal(comparison.summary.passed, false);
  assert.deepEqual(comparison.missingRight, ["only-in-left.png"]);
  assert.deepEqual(comparison.missingLeft, []);

  const cli = runCli(["--left", left, "--right", right]);
  assert.equal(cli.status, comparator.EXIT_CONTRACT_FAILED);
  assert.match(cli.stdout, /missing-right:\s+1/);
  assert.match(cli.stdout, /\[missing-right\] only-in-left\.png/);
});

// ---------------------------------------------------------------------------
// 8. --require-count not satisfied, validated per side.
// ---------------------------------------------------------------------------

test("8: unsatisfied --require-count fails and is validated independently per side", () => {
  const left = makeCaseDir("count-left");
  const right = makeCaseDir("count-right");
  const shared = encodePng(4, 4, gradientData(4, 4, 8));
  writePng(left, "a.png", shared);
  writePng(right, "a.png", shared);
  writePng(left, "b.png", encodePng(4, 4, gradientData(4, 4, 81)));
  writePng(right, "b.png", encodePng(4, 4, gradientData(4, 4, 81)));

  // Both sides identical (2 files each) but require-count demands 3.
  const comparison = comparator.compareDirectories(left, right, { requireCount: 3 });
  assert.equal(comparison.summary.requireCountSatisfied, false);
  assert.equal(comparison.summary.passed, false);

  const cli = runCli(["--left", left, "--right", right, "--require-count", "3"]);
  assert.equal(cli.status, comparator.EXIT_CONTRACT_FAILED);
  assert.match(cli.stdout, /require-count:\s+3 \(NOT satisfied\)/);

  // Satisfied when the true count is requested.
  const satisfied = comparator.compareDirectories(left, right, { requireCount: 2 });
  assert.equal(satisfied.summary.requireCountSatisfied, true);
  assert.equal(satisfied.summary.passed, true);

  // Independent per-side validation: right has one extra file, count 2 fails on right only.
  writePng(right, "c.png", encodePng(4, 4, gradientData(4, 4, 82)));
  const unbalanced = comparator.compareDirectories(left, right, { requireCount: 2 });
  assert.equal(unbalanced.summary.leftCount, 2);
  assert.equal(unbalanced.summary.rightCount, 3);
  assert.equal(unbalanced.summary.requireCountSatisfied, false);
});

// ---------------------------------------------------------------------------
// 9. Nonexistent directory -> exit 2.
// ---------------------------------------------------------------------------

test("9: a nonexistent directory is an infrastructure error (exit 2)", () => {
  const left = makeCaseDir("exists-left");
  writePng(left, "a.png", encodePng(4, 4, gradientData(4, 4, 9)));
  const missing = join(SUITE_ROOT, "does-not-exist-xyz");

  const cli = runCli(["--left", left, "--right", missing]);
  assert.equal(cli.status, comparator.EXIT_INFRASTRUCTURE);
  assert.match(cli.stderr, /Infrastructure error/);
  assert.match(cli.stderr, /does not exist/);
});

// ---------------------------------------------------------------------------
// 10. Incomplete or invalid arguments -> exit 2.
// ---------------------------------------------------------------------------

test("10: incomplete or invalid arguments are usage errors (exit 2)", () => {
  const left = makeCaseDir("args-left");
  writePng(left, "a.png", encodePng(4, 4, gradientData(4, 4, 10)));

  const missingRight = runCli(["--left", left]);
  assert.equal(missingRight.status, comparator.EXIT_INFRASTRUCTURE);
  assert.match(missingRight.stderr, /--right is required/);

  const missingLeft = runCli(["--right", left]);
  assert.equal(missingLeft.status, comparator.EXIT_INFRASTRUCTURE);
  assert.match(missingLeft.stderr, /--left is required/);

  const unknown = runCli(["--left", left, "--right", left, "--bogus"]);
  assert.equal(unknown.status, comparator.EXIT_INFRASTRUCTURE);
  assert.match(unknown.stderr, /unknown argument/);

  const negativeCount = runCli(["--left", left, "--right", left, "--require-count", "-1"]);
  assert.equal(negativeCount.status, comparator.EXIT_INFRASTRUCTURE);
  assert.match(negativeCount.stderr, /non-negative integer/);

  // Exported parser fails closed on the same invalid inputs.
  assert.throws(() => comparator.parseArgs(["--require-count", "-1"]), /non-negative integer/);
  assert.throws(() => comparator.parseArgs(["--require-count", "1.5"]), /non-negative integer/);
  assert.throws(() => comparator.parseArgs(["--bogus"]), /unknown argument/);
  assert.throws(() => comparator.parseArgs(["--left"]), /requires a value/);
});

// ---------------------------------------------------------------------------
// 11. Corrupt PNG -> exit 2 with a useful message and no raw stack by default.
// ---------------------------------------------------------------------------

test("11: a corrupt PNG is an infrastructure error with a useful message and no raw stack", () => {
  const left = makeCaseDir("corrupt-left");
  const right = makeCaseDir("corrupt-right");
  const corrupt = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from("not-a-valid-idat-stream"),
  ]);
  writePng(left, "broken.png", corrupt);
  writePng(right, "broken.png", corrupt);

  const cli = runCli(["--left", left, "--right", right]);
  assert.equal(cli.status, comparator.EXIT_INFRASTRUCTURE);
  assert.match(cli.stderr, /Infrastructure error/);
  assert.match(cli.stderr, /decode|corrupt/i);
  // Default mode must not leak a raw stack trace.
  assert.doesNotMatch(cli.stderr, /\n\s+at\s/);

  // Explicit debug mode surfaces the stack for developers.
  const debug = runCli(["--left", left, "--right", right], { debug: true });
  assert.equal(debug.status, comparator.EXIT_INFRASTRUCTURE);
  assert.match(debug.stderr, /\n\s+at\s/);
});

// ---------------------------------------------------------------------------
// 12. Symlink -> exit 2 (skipped where symlink creation needs privileges).
// ---------------------------------------------------------------------------

test(
  "12: a symlink inside the tree is rejected as an infrastructure error (exit 2)",
  {
    skip: SYMLINK_SUPPORTED
      ? false
      : "symlink creation is not permitted without privileges on this platform (Windows unprivileged)",
  },
  () => {
    const left = makeCaseDir("symlink-left");
    const right = makeCaseDir("symlink-right");
    const real = encodePng(4, 4, gradientData(4, 4, 12));
    const realTarget = writePng(left, "real.png", real);
    writePng(right, "real.png", real);
    // A symlink named as a PNG must be rejected, not followed.
    symlinkSync(realTarget, join(left, "link.png"));

    const cli = runCli(["--left", left, "--right", right]);
    assert.equal(cli.status, comparator.EXIT_INFRASTRUCTURE);
    assert.match(cli.stderr, /symlink/i);
  },
);

// ---------------------------------------------------------------------------
// 13. Nested directories -> normalized forward-slash paths, deterministic order.
// ---------------------------------------------------------------------------

test("13: nested directories yield deterministic, forward-slash normalized paths", () => {
  const left = makeCaseDir("nested-left");
  const right = makeCaseDir("nested-right");
  // Create in deliberately non-sorted order.
  const relativePaths = [
    "z/last.png",
    "a/deep/first.png",
    "a/second.png",
    "top.png",
  ];
  for (const relativePath of relativePaths) {
    const bytes = encodePng(3, 3, gradientData(3, 3, relativePath.length));
    writePng(left, relativePath, bytes);
    writePng(right, relativePath, bytes);
  }

  const discovered = comparator.discoverPngFiles(left);
  assert.deepEqual(discovered, [
    "a/deep/first.png",
    "a/second.png",
    "top.png",
    "z/last.png",
  ]);

  const comparison = comparator.compareDirectories(left, right);
  const resultPaths = comparison.results.map((result) => result.path);
  assert.deepEqual(resultPaths, [...resultPaths].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
  for (const path of resultPaths) {
    assert.equal(path.includes("\\"), false, `${path} must not contain backslashes`);
  }
  assert.equal(comparison.summary.passed, true);
});

// ---------------------------------------------------------------------------
// 14. JSON report: schemaVersion, summary, classification, final newline, parseable.
// ---------------------------------------------------------------------------

test("14: JSON report carries schemaVersion, summary, classification and a final newline", () => {
  const left = makeCaseDir("json-left");
  const right = makeCaseDir("json-right");
  const data = gradientData(6, 6, 14);
  writePng(left, "a.png", encodePng(6, 6, data, 0));
  writePng(right, "a.png", encodePng(6, 6, data, 9));
  const reportDir = makeCaseDir("json-report");

  const cli = runCli(["--left", left, "--right", right, "--report-dir", reportDir]);
  assert.equal(cli.status, comparator.EXIT_PASS);

  const raw = readFileSync(join(reportDir, REPORT_JSON), "utf8");
  assert.equal(raw.endsWith("\n"), true);
  assert.doesNotMatch(raw, /\x1b\[/); // no ANSI

  const parsed = JSON.parse(raw) as Comparison;
  assert.equal(parsed.schemaVersion, 1);
  assert.equal(parsed.summary.matchedPathCount, 1);
  assert.equal(parsed.summary.byteDifferentPixelIdenticalCount, 1);
  assert.equal(parsed.results[0].classification, C.BYTE_DIFFERENT_PIXEL_IDENTICAL);
  assert.equal(parsed.results[0].path.includes("\\"), false);

  // Determinism: an identical run yields an identical report.
  const reportDir2 = makeCaseDir("json-report");
  runCli(["--left", left, "--right", right, "--report-dir", reportDir2]);
  const raw2 = readFileSync(join(reportDir2, REPORT_JSON), "utf8");
  assert.equal(raw, raw2);
});

// ---------------------------------------------------------------------------
// 15. CSV report: stable header, valid escaping, stable order, final newline.
// ---------------------------------------------------------------------------

test("15: CSV report has a stable header, valid escaping, stable order and a final newline", () => {
  const left = makeCaseDir("csv-left");
  const right = makeCaseDir("csv-right");
  const shared = encodePng(4, 4, gradientData(4, 4, 15));
  writePng(left, "plain.png", shared);
  writePng(right, "plain.png", shared);
  // A comma in the file name exercises CSV quoting.
  writePng(left, "with,comma.png", shared);
  writePng(right, "with,comma.png", shared);
  writePng(left, "only-left.png", encodePng(4, 4, gradientData(4, 4, 151)));
  const reportDir = makeCaseDir("csv-report");

  const cli = runCli(["--left", left, "--right", right, "--report-dir", reportDir]);
  assert.equal(cli.status, comparator.EXIT_CONTRACT_FAILED); // missing-right present

  const raw = readFileSync(join(reportDir, REPORT_CSV), "utf8");
  assert.equal(raw.endsWith("\n"), true);
  assert.doesNotMatch(raw, /\x1b\[/); // no ANSI
  assert.doesNotMatch(raw, /\r/); // no CR, locale/OS independent

  const lines = raw.replace(/\n$/, "").split("\n");
  assert.equal(lines[0], EXPECTED_CSV_HEADER);
  assert.equal(lines.length, 4, "header + 3 detail rows");
  // Deterministic sort by path: only-left.png < plain.png < with,comma.png.
  assert.ok(lines[1].startsWith("only-left.png,"), "missing-right row sorts first");
  assert.match(lines[1], /,missing-right,/);
  assert.ok(lines[2].startsWith("plain.png,"), "plain.png sorts second");
  // Comma-bearing path must be CSV-quoted and sort last.
  assert.ok(lines[3].startsWith('"with,comma.png",'), "comma-bearing path must be CSV-quoted");

  // Determinism across identical runs.
  const reportDir2 = makeCaseDir("csv-report");
  runCli(["--left", left, "--right", right, "--report-dir", reportDir2]);
  assert.equal(raw, readFileSync(join(reportDir2, REPORT_CSV), "utf8"));
});

// ---------------------------------------------------------------------------
// 16. Without --report-dir: no reports, no repository modification.
// ---------------------------------------------------------------------------

test("16: without --report-dir no reports are written and the repository is untouched", () => {
  const left = makeCaseDir("noreport-left");
  const right = makeCaseDir("noreport-right");
  const bytes = encodePng(4, 4, gradientData(4, 4, 16));
  writePng(left, "a.png", bytes);
  writePng(right, "a.png", bytes);

  const cli = runCli(["--left", left, "--right", right]);
  assert.equal(cli.status, comparator.EXIT_PASS);

  // No report files are written anywhere without --report-dir (checking the repo
  // root plus the working roots; a full REPO_ROOT snapshot would race with other
  // parallel test files, so the invariant asserted is report absence).
  for (const root of [left, right, SUITE_ROOT, REPO_ROOT]) {
    const entries = readdirSync(root);
    assert.equal(entries.includes(REPORT_JSON), false, `${REPORT_JSON} must not appear in ${root}`);
    assert.equal(entries.includes(REPORT_CSV), false, `${REPORT_CSV} must not appear in ${root}`);
  }
});

// ---------------------------------------------------------------------------
// 17. Inputs are immutable: hashes before and after are identical.
// ---------------------------------------------------------------------------

test("17: the comparator never mutates its input PNGs", () => {
  const left = makeCaseDir("immutable-left");
  const right = makeCaseDir("immutable-right");
  const data = gradientData(8, 6, 17);
  writePng(left, "nested/a.png", encodePng(8, 6, data, 0));
  writePng(right, "nested/a.png", encodePng(8, 6, data, 9));
  writePng(left, "b.png", encodePng(4, 4, gradientData(4, 4, 172)));
  writePng(right, "b.png", encodePng(4, 4, gradientData(4, 4, 173)));

  const leftBefore = hashTree(left);
  const rightBefore = hashTree(right);

  const reportDir = makeCaseDir("immutable-report");
  comparator.compareDirectories(left, right, { requireCount: 2 });
  runCli(["--left", left, "--right", right, "--require-count", "2", "--report-dir", reportDir]);

  assert.deepEqual([...hashTree(left).entries()].sort(), [...leftBefore.entries()].sort());
  assert.deepEqual([...hashTree(right).entries()].sort(), [...rightBefore.entries()].sort());
});

// ---------------------------------------------------------------------------
// 18. --help documents every argument and exit code, exit 0.
// ---------------------------------------------------------------------------

test("18: --help documents every argument and exit code and exits 0", () => {
  const cli = runCli(["--help"]);
  assert.equal(cli.status, comparator.EXIT_PASS);
  for (const flag of ["--left", "--right", "--require-count", "--report-dir", "--help"]) {
    assert.ok(cli.stdout.includes(flag), `help must document ${flag}`);
  }
  assert.match(cli.stdout, /Exit codes:/);
  for (const code of ["0", "1", "2"]) {
    assert.match(cli.stdout, new RegExp(`\\n\\s+${code}\\s`), `help must document exit code ${code}`);
  }
});

// ---------------------------------------------------------------------------
// Extra: relative paths resolve from the current working directory.
// ---------------------------------------------------------------------------

test("relative --left/--right resolve from process.cwd()", () => {
  const base = makeCaseDir("relative");
  const left = join(base, "left");
  const right = join(base, "right");
  const bytes = encodePng(4, 4, gradientData(4, 4, 99));
  writePng(left, "a.png", bytes);
  writePng(right, "a.png", bytes);

  const cli = runCli(["--left", "left", "--right", "right"], { cwd: base });
  assert.equal(cli.status, comparator.EXIT_PASS);
  assert.match(cli.stdout, /RESULT: PASS/);
});

// ---------------------------------------------------------------------------
// Extra: exported comparePngPair works directly on two files.
// ---------------------------------------------------------------------------

test("comparePngPair compares two files directly and matches directory results", () => {
  const dir = makeCaseDir("pair");
  const data = gradientData(5, 5, 55);
  const leftFile = writePng(dir, "left.png", encodePng(5, 5, data, 0));
  const rightFile = writePng(dir, "right.png", encodePng(5, 5, data, 9));

  const result = comparator.comparePngPair(leftFile, rightFile, "pair.png");
  assert.equal(result.classification, C.BYTE_DIFFERENT_PIXEL_IDENTICAL);
  assert.equal(result.pixelIdentical, true);
  assert.equal(result.diffPixelCount, 0);
  assert.equal(result.leftWidth, 5);
  assert.equal(result.rightHeight, 5);
});
