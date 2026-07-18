#!/usr/bin/env node
// Exact, native, reusable PNG visual-artifact comparator.
//
// Compares two already-extracted directories of PNG artifacts and distinguishes,
// with zero implicit tolerances:
//   1. binary file identity (SHA-256 / raw bytes),
//   2. exact dimension identity,
//   3. exact decoded RGBA buffer identity,
//   4. real per-pixel differences (count + inclusive bounding box),
//   5. missing / extra files,
//   6. corrupt / undecodable PNG (infrastructure error).
//
// The critical supported case is: two PNGs with different SHA-256 (different
// encoding / compression / metadata), identical dimensions and byte-identical
// decoded RGBA buffers -> global success. No perceptual comparison, no
// thresholds, no smoothing, no rescaling, no alpha shortcuts.
//
// The module exports pure, testable functions and also runs as a CLI. It never
// mutates the input directories and never touches the network.

import { createHash } from "node:crypto";
import { lstatSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { isAbsolute, join, posix, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

import { PNG } from "pngjs";

export const SCHEMA_VERSION = 1;

// Exit codes (documented contract):
//   0 -> comparison completed and the exact visual contract passed.
//   1 -> comparison completed but the contract failed (missing/extra, wrong
//        count, different dimensions, one or more different pixels).
//   2 -> invalid usage or infrastructure error (bad args, missing dir, unreadable
//        file, symlink, corrupt PNG, report write failure, unexpected exception).
export const EXIT_PASS = 0;
export const EXIT_CONTRACT_FAILED = 1;
export const EXIT_INFRASTRUCTURE = 2;

export const CLASSIFICATIONS = Object.freeze({
  BYTE_IDENTICAL: "byte-identical",
  BYTE_DIFFERENT_PIXEL_IDENTICAL: "byte-different-pixel-identical",
  DIMENSION_DIFFERENT: "dimension-different",
  PIXEL_DIFFERENT: "pixel-different",
  MISSING_LEFT: "missing-left",
  MISSING_RIGHT: "missing-right",
});

const CSV_HEADER = [
  "path",
  "classification",
  "byteIdentical",
  "leftSha256",
  "rightSha256",
  "leftWidth",
  "leftHeight",
  "rightWidth",
  "rightHeight",
  "dimensionsIdentical",
  "pixelIdentical",
  "diffPixelCount",
  "diffMinX",
  "diffMinY",
  "diffMaxX",
  "diffMaxY",
];

const JSON_REPORT_NAME = "visual-artifact-comparison.json";
const CSV_REPORT_NAME = "visual-artifact-comparison.csv";

// A usage error maps to exit code 2 and reflects an invalid invocation.
export class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = "UsageError";
  }
}

// An infrastructure error maps to exit code 2 and reflects an environmental
// failure that is not a legitimate visual difference (unreadable file, symlink,
// corrupt PNG, report write failure).
export class InfrastructureError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = "InfrastructureError";
    if (cause !== undefined) this.cause = cause;
  }
}

// ---------------------------------------------------------------------------
// Argument parsing (no external dependency).
// ---------------------------------------------------------------------------

const VALUE_FLAGS = new Set(["--left", "--right", "--require-count", "--report-dir"]);
const BOOLEAN_FLAGS = new Set(["--help", "-h", "--debug"]);

export function parseArgs(argv) {
  const parsed = {
    left: null,
    right: null,
    requireCount: null,
    reportDir: null,
    help: false,
    debug: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    let flag = token;
    let inlineValue = null;
    const equalsIndex = token.startsWith("--") ? token.indexOf("=") : -1;
    if (equalsIndex !== -1) {
      flag = token.slice(0, equalsIndex);
      inlineValue = token.slice(equalsIndex + 1);
    }

    if (BOOLEAN_FLAGS.has(flag)) {
      if (inlineValue !== null) {
        throw new UsageError(`flag ${flag} does not take a value`);
      }
      if (flag === "--help" || flag === "-h") parsed.help = true;
      if (flag === "--debug") parsed.debug = true;
      continue;
    }

    if (VALUE_FLAGS.has(flag)) {
      let value = inlineValue;
      if (value === null) {
        index += 1;
        if (index >= argv.length) {
          throw new UsageError(`flag ${flag} requires a value`);
        }
        value = argv[index];
      }
      assignValueFlag(parsed, flag, value);
      continue;
    }

    throw new UsageError(`unknown argument: ${token}`);
  }

  return parsed;
}

function assignValueFlag(parsed, flag, value) {
  switch (flag) {
    case "--left":
      parsed.left = value;
      return;
    case "--right":
      parsed.right = value;
      return;
    case "--report-dir":
      parsed.reportDir = value;
      return;
    case "--require-count":
      parsed.requireCount = parseRequireCount(value);
      return;
    default:
      throw new UsageError(`unknown argument: ${flag}`);
  }
}

function parseRequireCount(value) {
  if (!/^\d+$/.test(value)) {
    throw new UsageError(`--require-count must be a non-negative integer, received: ${value}`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new UsageError(`--require-count is out of range: ${value}`);
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// Path helpers.
// ---------------------------------------------------------------------------

// Convert a system-relative path into a normalized, forward-slash relative path,
// preserving case. Never leaks OS-specific separators into reports.
function toNormalizedRelative(relativePath) {
  return relativePath.split(sep).join(posix.sep);
}

// Present an absolute root path with forward slashes so report output never
// leaks backslashes and is stable across a single run.
function toDisplayPath(absolutePath) {
  return absolutePath.split(sep).join(posix.sep);
}

function resolveExistingDirectory(rawPath, label) {
  const absolute = isAbsolute(rawPath) ? rawPath : resolve(process.cwd(), rawPath);

  let stats;
  try {
    stats = statSync(absolute);
  } catch {
    throw new InfrastructureError(`${label} directory does not exist: ${toDisplayPath(absolute)}`);
  }

  if (!stats.isDirectory()) {
    throw new InfrastructureError(`${label} path is not a directory: ${toDisplayPath(absolute)}`);
  }

  return absolute;
}

// ---------------------------------------------------------------------------
// Recursive PNG discovery. Deterministic, symlink-rejecting, no readdir-order
// dependence (entries are sorted before descent and the final list is sorted).
// ---------------------------------------------------------------------------

function isPngName(name) {
  return name.toLowerCase().endsWith(".png");
}

export function discoverPngFiles(rootDir) {
  const collected = [];
  walkDirectory(rootDir, "", collected);
  collected.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return collected;
}

function walkDirectory(rootDir, relativeDir, collected) {
  const absoluteDir = relativeDir === "" ? rootDir : join(rootDir, relativeDir);
  const entries = readdirSync(absoluteDir, { withFileTypes: true });
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  for (const entry of entries) {
    const childRelative = relativeDir === "" ? entry.name : `${relativeDir}${sep}${entry.name}`;
    const displayRelative = toNormalizedRelative(childRelative);

    if (entry.isSymbolicLink()) {
      throw new InfrastructureError(
        `symlink encountered inside artifact tree (ambiguous comparison forbidden): ${displayRelative}`,
      );
    }

    if (entry.isDirectory()) {
      walkDirectory(rootDir, childRelative, collected);
      continue;
    }

    if (entry.isFile() && isPngName(entry.name)) {
      collected.push(displayRelative);
    }
  }
}

// ---------------------------------------------------------------------------
// Per-file comparison.
// ---------------------------------------------------------------------------

export function sha256Hex(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function readArtifactBytes(absolutePath, side, displayRelative) {
  // Guard against a symlink that could point outside the tree (defense in depth;
  // discovery already rejects symlinks, but the file is re-checked before read).
  let linkStats;
  try {
    linkStats = lstatSync(absolutePath);
  } catch (error) {
    throw new InfrastructureError(
      `unable to stat ${side} artifact ${displayRelative}: ${describeError(error)}`,
    );
  }
  if (linkStats.isSymbolicLink()) {
    throw new InfrastructureError(
      `symlink encountered inside artifact tree (ambiguous comparison forbidden): ${displayRelative}`,
    );
  }

  try {
    return readFileSync(absolutePath);
  } catch (error) {
    throw new InfrastructureError(
      `unable to read ${side} artifact ${displayRelative}: ${describeError(error)}`,
    );
  }
}

function decodePng(buffer, side, displayRelative) {
  let decoded;
  try {
    decoded = PNG.sync.read(buffer);
  } catch (error) {
    throw new InfrastructureError(
      `unable to decode ${side} PNG ${displayRelative} (corrupt or unsupported): ${describeError(error)}`,
    );
  }

  const { width, height, data } = decoded;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new InfrastructureError(
      `decoded ${side} PNG ${displayRelative} reported invalid dimensions ${width}x${height}`,
    );
  }
  if (data.length !== width * height * 4) {
    throw new InfrastructureError(
      `decoded ${side} PNG ${displayRelative} is not 8-bit RGBA (expected ${width * height * 4} bytes, got ${data.length})`,
    );
  }

  return { width, height, data: Buffer.isBuffer(data) ? data : Buffer.from(data) };
}

// Compare two decoded RGBA buffers of identical geometry. A pixel counts as
// different when at least one of its R, G, B or A bytes differs. Returns the
// exact differing-pixel count and the inclusive bounding box (or null when the
// buffers are byte-identical). Alpha is never ignored.
export function diffRgba(leftData, rightData, width, height) {
  if (leftData.equals(rightData)) {
    return { diffPixelCount: 0, diffBoundingBox: null };
  }

  let diffPixelCount = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * width * 4;
    for (let x = 0; x < width; x += 1) {
      const pixelOffset = rowOffset + x * 4;
      if (
        leftData[pixelOffset] !== rightData[pixelOffset] ||
        leftData[pixelOffset + 1] !== rightData[pixelOffset + 1] ||
        leftData[pixelOffset + 2] !== rightData[pixelOffset + 2] ||
        leftData[pixelOffset + 3] !== rightData[pixelOffset + 3]
      ) {
        diffPixelCount += 1;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  return {
    diffPixelCount,
    diffBoundingBox: { minX, minY, maxX, maxY },
  };
}

function classifyPair({ byteIdentical, dimensionsIdentical, pixelIdentical }) {
  if (!dimensionsIdentical) return CLASSIFICATIONS.DIMENSION_DIFFERENT;
  if (!pixelIdentical) return CLASSIFICATIONS.PIXEL_DIFFERENT;
  return byteIdentical ? CLASSIFICATIONS.BYTE_IDENTICAL : CLASSIFICATIONS.BYTE_DIFFERENT_PIXEL_IDENTICAL;
}

// Compare one PNG present on both sides. Throws InfrastructureError on any
// read/decode failure; a legitimate visual difference never throws.
export function comparePngPair(leftAbsolute, rightAbsolute, displayRelative = "<pair>") {
  const leftBytes = readArtifactBytes(leftAbsolute, "left", displayRelative);
  const rightBytes = readArtifactBytes(rightAbsolute, "right", displayRelative);

  const leftSha256 = sha256Hex(leftBytes);
  const rightSha256 = sha256Hex(rightBytes);
  const byteIdentical = leftBytes.equals(rightBytes);

  const left = decodePng(leftBytes, "left", displayRelative);
  const right = decodePng(rightBytes, "right", displayRelative);

  const dimensionsIdentical = left.width === right.width && left.height === right.height;

  let pixelIdentical = false;
  let diffPixelCount = null;
  let diffBoundingBox = null;

  if (dimensionsIdentical) {
    const diff = diffRgba(left.data, right.data, left.width, left.height);
    diffPixelCount = diff.diffPixelCount;
    diffBoundingBox = diff.diffBoundingBox;
    pixelIdentical = diff.diffPixelCount === 0;
  }

  const classification = classifyPair({ byteIdentical, dimensionsIdentical, pixelIdentical });

  return {
    path: displayRelative,
    classification,
    byteIdentical,
    leftSha256,
    rightSha256,
    leftWidth: left.width,
    leftHeight: left.height,
    rightWidth: right.width,
    rightHeight: right.height,
    dimensionsIdentical,
    pixelIdentical,
    diffPixelCount,
    diffBoundingBox,
  };
}

// ---------------------------------------------------------------------------
// Directory-level comparison.
// ---------------------------------------------------------------------------

// Compare two directories of PNG artifacts. Files are processed sequentially in
// deterministic sorted order for bounded memory and stable output. Throws
// InfrastructureError on symlinks, unreadable files or corrupt PNGs.
export function compareDirectories(leftRoot, rightRoot, options = {}) {
  const requireCount = options.requireCount ?? null;

  const leftPaths = discoverPngFiles(leftRoot);
  const rightPaths = discoverPngFiles(rightRoot);

  const leftSet = new Set(leftPaths);
  const rightSet = new Set(rightPaths);

  const missingRight = leftPaths.filter((path) => !rightSet.has(path)); // present left, absent right
  const missingLeft = rightPaths.filter((path) => !leftSet.has(path)); // present right, absent left
  const matchedPaths = leftPaths.filter((path) => rightSet.has(path));

  const results = [];
  for (const relativePath of matchedPaths) {
    const leftAbsolute = join(leftRoot, relativePath.split(posix.sep).join(sep));
    const rightAbsolute = join(rightRoot, relativePath.split(posix.sep).join(sep));
    results.push(comparePngPair(leftAbsolute, rightAbsolute, relativePath));
  }

  const summary = summarize({
    leftCount: leftPaths.length,
    rightCount: rightPaths.length,
    matchedPaths,
    missingLeft,
    missingRight,
    results,
    requireCount,
  });

  return {
    schemaVersion: SCHEMA_VERSION,
    leftRoot: toDisplayPath(leftRoot),
    rightRoot: toDisplayPath(rightRoot),
    requiredCount: requireCount,
    summary,
    missingLeft,
    missingRight,
    results,
  };
}

function summarize({ leftCount, rightCount, matchedPaths, missingLeft, missingRight, results, requireCount }) {
  const count = (predicate) => results.reduce((total, result) => total + (predicate(result) ? 1 : 0), 0);

  const byteIdenticalCount = count((r) => r.classification === CLASSIFICATIONS.BYTE_IDENTICAL);
  const byteDifferentPixelIdenticalCount = count(
    (r) => r.classification === CLASSIFICATIONS.BYTE_DIFFERENT_PIXEL_IDENTICAL,
  );
  const dimensionDifferentCount = count((r) => r.classification === CLASSIFICATIONS.DIMENSION_DIFFERENT);
  const pixelDifferentCount = count((r) => r.classification === CLASSIFICATIONS.PIXEL_DIFFERENT);
  const byteDifferentCount = count((r) => !r.byteIdentical);
  const dimensionIdenticalCount = count((r) => r.dimensionsIdentical);
  const pixelIdenticalCount = count((r) => r.pixelIdentical);

  const requireCountSatisfied =
    requireCount === null || (leftCount === requireCount && rightCount === requireCount);
  const pathsIdentical = missingLeft.length === 0 && missingRight.length === 0;
  const exactVisualContract = results.every((r) => r.dimensionsIdentical && r.pixelIdentical);

  return {
    leftCount,
    rightCount,
    matchedPathCount: matchedPaths.length,
    missingLeftCount: missingLeft.length,
    missingRightCount: missingRight.length,
    dimensionIdenticalCount,
    dimensionDifferentCount,
    byteIdenticalCount,
    byteDifferentCount,
    byteDifferentPixelIdenticalCount,
    pixelIdenticalCount,
    pixelDifferentCount,
    requireCountSatisfied,
    passed: pathsIdentical && requireCountSatisfied && exactVisualContract,
  };
}

// ---------------------------------------------------------------------------
// Report builders (deterministic, newline-terminated, locale-independent).
// ---------------------------------------------------------------------------

export function buildJsonReport(comparison) {
  return `${JSON.stringify(comparison, null, 2)}\n`;
}

function csvCell(value) {
  if (value === null || value === undefined) return "";
  const text = typeof value === "boolean" ? (value ? "true" : "false") : String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function buildCsvReport(comparison) {
  const rows = [CSV_HEADER.join(",")];

  const detailRows = [
    ...comparison.results.map((result) => ({
      path: result.path,
      classification: result.classification,
      byteIdentical: result.byteIdentical,
      leftSha256: result.leftSha256,
      rightSha256: result.rightSha256,
      leftWidth: result.leftWidth,
      leftHeight: result.leftHeight,
      rightWidth: result.rightWidth,
      rightHeight: result.rightHeight,
      dimensionsIdentical: result.dimensionsIdentical,
      pixelIdentical: result.pixelIdentical,
      diffPixelCount: result.diffPixelCount,
      diffMinX: result.diffBoundingBox ? result.diffBoundingBox.minX : null,
      diffMinY: result.diffBoundingBox ? result.diffBoundingBox.minY : null,
      diffMaxX: result.diffBoundingBox ? result.diffBoundingBox.maxX : null,
      diffMaxY: result.diffBoundingBox ? result.diffBoundingBox.maxY : null,
    })),
    ...comparison.missingLeft.map((path) => missingCsvRow(path, CLASSIFICATIONS.MISSING_LEFT)),
    ...comparison.missingRight.map((path) => missingCsvRow(path, CLASSIFICATIONS.MISSING_RIGHT)),
  ];

  detailRows.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  for (const row of detailRows) {
    rows.push(CSV_HEADER.map((column) => csvCell(row[column])).join(","));
  }

  return `${rows.join("\n")}\n`;
}

function missingCsvRow(path, classification) {
  return {
    path,
    classification,
    byteIdentical: null,
    leftSha256: null,
    rightSha256: null,
    leftWidth: null,
    leftHeight: null,
    rightWidth: null,
    rightHeight: null,
    dimensionsIdentical: null,
    pixelIdentical: null,
    diffPixelCount: null,
    diffMinX: null,
    diffMinY: null,
    diffMaxX: null,
    diffMaxY: null,
  };
}

export function writeReports(comparison, reportDir) {
  const absoluteReportDir = isAbsolute(reportDir) ? reportDir : resolve(process.cwd(), reportDir);

  try {
    mkdirSync(absoluteReportDir, { recursive: true });
  } catch (error) {
    throw new InfrastructureError(
      `unable to create report directory ${toDisplayPath(absoluteReportDir)}: ${describeError(error)}`,
    );
  }

  const jsonPath = join(absoluteReportDir, JSON_REPORT_NAME);
  const csvPath = join(absoluteReportDir, CSV_REPORT_NAME);

  try {
    writeFileSync(jsonPath, buildJsonReport(comparison));
    writeFileSync(csvPath, buildCsvReport(comparison));
  } catch (error) {
    throw new InfrastructureError(
      `unable to write comparison reports into ${toDisplayPath(absoluteReportDir)}: ${describeError(error)}`,
    );
  }

  return { jsonPath, csvPath };
}

// ---------------------------------------------------------------------------
// Human-readable output.
// ---------------------------------------------------------------------------

export function formatHumanReport(comparison) {
  const { summary } = comparison;
  const lines = [];

  lines.push("Visual artifact comparison");
  lines.push(`  left root:                      ${comparison.leftRoot}`);
  lines.push(`  right root:                     ${comparison.rightRoot}`);
  lines.push(`  left PNG count:                 ${summary.leftCount}`);
  lines.push(`  right PNG count:                ${summary.rightCount}`);
  lines.push(`  matched paths:                  ${summary.matchedPathCount}`);
  lines.push(`  missing-left:                   ${summary.missingLeftCount}`);
  lines.push(`  missing-right:                  ${summary.missingRightCount}`);
  lines.push(`  dimension-identical:            ${summary.dimensionIdenticalCount}`);
  lines.push(`  dimension-different:            ${summary.dimensionDifferentCount}`);
  lines.push(`  byte-identical:                 ${summary.byteIdenticalCount}`);
  lines.push(`  byte-different:                 ${summary.byteDifferentCount}`);
  lines.push(`  byte-different-pixel-identical: ${summary.byteDifferentPixelIdenticalCount}`);
  lines.push(`  pixel-identical:                ${summary.pixelIdenticalCount}`);
  lines.push(`  pixel-different:                ${summary.pixelDifferentCount}`);

  if (comparison.requiredCount !== null) {
    lines.push(
      `  require-count:                  ${comparison.requiredCount} (${
        summary.requireCountSatisfied ? "satisfied" : "NOT satisfied"
      })`,
    );
  }

  const byteDifferentPixelIdentical = comparison.results.filter(
    (r) => r.classification === CLASSIFICATIONS.BYTE_DIFFERENT_PIXEL_IDENTICAL,
  );
  if (byteDifferentPixelIdentical.length > 0) {
    lines.push("");
    lines.push("Byte-different but pixel-identical (accepted: encoding/metadata only, not a visual diff):");
    for (const result of byteDifferentPixelIdentical) {
      lines.push(`  - ${result.path}`);
    }
  }

  const offenders = collectOffenders(comparison);
  if (offenders.length > 0) {
    lines.push("");
    lines.push("Contract violations (each unapproved artifact is listed):");
    for (const offender of offenders) {
      lines.push(`  - [${offender.classification}] ${offender.path}${offender.detail}`);
    }
  }

  lines.push("");
  lines.push(`RESULT: ${summary.passed ? "PASS" : "FAIL"}`);
  lines.push(`EXIT CODE: ${summary.passed ? EXIT_PASS : EXIT_CONTRACT_FAILED}`);

  return `${lines.join("\n")}\n`;
}

function collectOffenders(comparison) {
  const offenders = [];

  for (const path of comparison.missingRight) {
    offenders.push({ path, classification: CLASSIFICATIONS.MISSING_RIGHT, detail: "" });
  }
  for (const path of comparison.missingLeft) {
    offenders.push({ path, classification: CLASSIFICATIONS.MISSING_LEFT, detail: "" });
  }
  for (const result of comparison.results) {
    if (result.classification === CLASSIFICATIONS.DIMENSION_DIFFERENT) {
      offenders.push({
        path: result.path,
        classification: result.classification,
        detail: ` (left ${result.leftWidth}x${result.leftHeight}, right ${result.rightWidth}x${result.rightHeight})`,
      });
    } else if (result.classification === CLASSIFICATIONS.PIXEL_DIFFERENT) {
      const box = result.diffBoundingBox;
      const boxText = box ? `, bbox [${box.minX},${box.minY}]-[${box.maxX},${box.maxY}]` : "";
      offenders.push({
        path: result.path,
        classification: result.classification,
        detail: ` (${result.diffPixelCount} pixel(s)${boxText})`,
      });
    }
  }

  offenders.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return offenders;
}

// ---------------------------------------------------------------------------
// Help text.
// ---------------------------------------------------------------------------

export function helpText() {
  return [
    "compare-visual-artifacts — exact PNG visual-artifact comparator",
    "",
    "Usage:",
    "  node e2e/scripts/compare-visual-artifacts.mjs --left <dir> --right <dir> \\",
    "    [--require-count <int>] [--report-dir <dir>] [--debug]",
    "  node e2e/scripts/compare-visual-artifacts.mjs --help",
    "",
    "Arguments:",
    "  --left <dir>          Required. Directory of extracted PNG artifacts (left/baseline).",
    "  --right <dir>         Required. Directory of extracted PNG artifacts (right/candidate).",
    "  --require-count <int> Optional. Non-negative integer. Each side must expose exactly",
    "                        this many PNG files, validated independently.",
    "  --report-dir <dir>    Optional. When set, writes visual-artifact-comparison.json and",
    "                        visual-artifact-comparison.csv into it (created if needed).",
    "                        When omitted, no files are written.",
    "  --debug               Optional. Print raw stack traces on infrastructure errors.",
    "  --help, -h            Print this help and exit 0.",
    "",
    "Behavior:",
    "  Relative paths resolve from the current working directory. Both roots must exist and",
    "  be directories. Discovery is recursive, considers only .png files, normalizes relative",
    "  paths with '/', preserves case, sorts lexicographically, and rejects symlinks. Input",
    "  directories are never modified and the network is never accessed.",
    "",
    "Per-file classification (exactly one):",
    "  byte-identical                 identical raw bytes (implies pixel-identical).",
    "  byte-different-pixel-identical  different PNG bytes, identical dimensions and RGBA.",
    "  dimension-different            decoded dimensions differ.",
    "  pixel-different                identical dimensions, one or more differing RGBA pixels.",
    "Missing files are classified missing-left or missing-right.",
    "",
    "Exit codes:",
    "  0  comparison completed and the exact visual contract passed (identical path sets,",
    "     require-count satisfied, identical dimensions, byte-identical decoded RGBA; PNG",
    "     binary differences are allowed).",
    "  1  comparison completed but the contract failed (missing/extra files, wrong count,",
    "     different dimensions, one or more different pixels).",
    "  2  invalid usage or infrastructure error (bad args, missing directory, unreadable",
    "     file, symlink, corrupt PNG, report write failure, unexpected exception).",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Error helpers.
// ---------------------------------------------------------------------------

function describeError(error) {
  if (error instanceof Error) {
    return error.code ? `${error.code}: ${error.message}` : error.message;
  }
  return String(error);
}

// ---------------------------------------------------------------------------
// CLI orchestration. Returns an exit code and never calls process.exit(); the
// caller sets process.exitCode so stdout/stderr flush naturally.
// ---------------------------------------------------------------------------

export function run(argv, io = {}) {
  const stdout = io.stdout ?? ((text) => process.stdout.write(text));
  const stderr = io.stderr ?? ((text) => process.stderr.write(text));

  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    stderr(`${errorLabel(error)}: ${error.message}\n`);
    stderr(`${helpText()}\n`);
    return EXIT_INFRASTRUCTURE;
  }

  if (options.help) {
    stdout(`${helpText()}\n`);
    return EXIT_PASS;
  }

  try {
    if (options.left === null) throw new UsageError("--left is required");
    if (options.right === null) throw new UsageError("--right is required");

    const leftRoot = resolveExistingDirectory(options.left, "--left");
    const rightRoot = resolveExistingDirectory(options.right, "--right");

    const comparison = compareDirectories(leftRoot, rightRoot, { requireCount: options.requireCount });

    if (options.reportDir !== null) {
      writeReports(comparison, options.reportDir);
    }

    stdout(formatHumanReport(comparison));
    return comparison.summary.passed ? EXIT_PASS : EXIT_CONTRACT_FAILED;
  } catch (error) {
    stderr(`${errorLabel(error)}: ${error.message}\n`);
    if (options.debug && error instanceof Error && error.stack) {
      stderr(`${error.stack}\n`);
    }
    return EXIT_INFRASTRUCTURE;
  }
}

function errorLabel(error) {
  if (error instanceof UsageError) return "Usage error";
  if (error instanceof InfrastructureError) return "Infrastructure error";
  return "Unexpected error";
}

export function main(argv) {
  return run(argv);
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (invokedDirectly) {
  process.exitCode = main(process.argv.slice(2));
}
