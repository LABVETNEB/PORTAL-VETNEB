import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyMetric,
  expectedFor,
  parseCssColor,
  tallyBy,
  validateDriveReference,
  type DriveMetric,
  type DriveReference,
} from "../../../frontend/e2e/helpers/drive-fidelity.ts";
import { readSourceFile } from "../../helpers/tracked-source-files.ts";

const REFERENCE = JSON.parse(readSourceFile("frontend/e2e/fixtures/drive-ui-reference.v1.json")) as DriveReference;

const px = (expected: number, tolerance: number): DriveMetric => ({
  id: "m.px",
  component: "c",
  category: "geometry",
  state: "default",
  kind: "px",
  expected,
  tolerance,
  evidence: "OBSERVADO",
  section: "x",
});

const color = (expected: string): DriveMetric => ({ ...px(0, 0), kind: "color", expected });

test("DRV V1: the committed Drive reference is well formed", () => {
  assert.deepEqual(validateDriveReference(REFERENCE), []);
  assert.ok(REFERENCE.metrics.length > 0);
});

test("DRV V1: only OBSERVADO or DERIVADO Drive values are comparable", () => {
  for (const metric of REFERENCE.metrics) {
    assert.ok(["OBSERVADO", "DERIVADO"].includes(metric.evidence), metric.id);
  }
  const bad = { ...REFERENCE, metrics: [{ ...REFERENCE.metrics[0], evidence: "INFERIDO" }] };
  assert.ok(validateDriveReference(bad as DriveReference).some((error) => error.includes("evidence")));
});

test("DRV V1: an id cannot be both comparable and not comparable", () => {
  const clash = { ...REFERENCE, notComparable: [{ id: REFERENCE.metrics[0].id, reason: "r", section: "s" }] };
  assert.ok(validateDriveReference(clash as DriveReference).length > 0);
});

test("DRV V1: every colour in the reference is compared as colour, never as text", () => {
  for (const metric of REFERENCE.metrics) {
    if (typeof metric.expected === "string" && /rgb|oklab|oklch|color\(/.test(metric.expected)) {
      assert.equal(metric.kind, "color", metric.id);
    }
  }
});

test("DRV V1: px metrics use the Drive tolerance inclusively", () => {
  assert.equal(classifyMetric(px(64, 1), 65, 1920).status, "IGUAL");
  assert.equal(classifyMetric(px(64, 1), 55.33, 1920).status, "DIFERENTE");
  assert.equal(classifyMetric(px(64, 1), 55.33, 1920).delta, -8.67);
  assert.equal(classifyMetric(px(64, 1), null, 1920).status, "AUSENTE");
});

test("DRV V1: a non-numeric geometry reading is an instrument error, not a difference", () => {
  const result = classifyMetric(px(64, 1), "64px", 1920);
  assert.ok(result.instrumentError);
});

test("DRV V1: a missing equivalent component is NO_COMPARABLE with its reason", () => {
  const result = classifyMetric(px(32, 0.5), { notApplicable: "no chips here" }, 1920);
  assert.equal(result.status, "NO_COMPARABLE");
  assert.equal(result.reason, "no chips here");
  assert.equal(result.measured, null);
});

test("DRV V1: tokens compare normalised computed values", () => {
  const token: DriveMetric = { ...px(0, 0), kind: "token", expected: "14px" };
  assert.equal(classifyMetric(token, " 14PX ", 1920).status, "IGUAL");
  assert.equal(classifyMetric(token, "13px", 1920).status, "DIFERENTE");
});

test("DRV V1: colour parser reads the forms Chromium serialises", () => {
  assert.deepEqual(parseCssColor("rgb(194, 231, 255)"), { r: 194, g: 231, b: 255, a: 1 });
  assert.deepEqual(parseCssColor("rgba(0, 0, 0, 0)"), { r: 0, g: 0, b: 0, a: 0 });
  assert.deepEqual(parseCssColor("rgb(10 20 30 / 0.5)"), { r: 10, g: 20, b: 30, a: 0.5 });
  const srgb = parseCssColor("color(srgb 1 0.5 0 / 0.25)")!;
  assert.deepEqual([srgb.r, srgb.g, srgb.b, srgb.a], [255, 127.5, 0, 0.25]);
  const white = parseCssColor("oklab(1 0 0)")!;
  assert.ok([white.r, white.g, white.b].every((channel) => Math.abs(channel - 255) < 0.5));
  const black = parseCssColor("oklch(0 0 0)")!;
  assert.ok([black.r, black.g, black.b].every((channel) => Math.abs(channel) < 0.5));
  // oklab of sRGB #1f1f1f is L = 0.2393 (neutral): the parser must land on 31.
  const ink = parseCssColor("oklab(0.2393 0 0 / 0.88)")!;
  assert.ok(Math.abs(ink.r - 31) <= 1 && Math.abs(ink.g - 31) <= 1 && Math.abs(ink.b - 31) <= 1);
  assert.equal(ink.a, 0.88);
  assert.equal(parseCssColor("color-mix(in srgb, red 50%, blue)"), null);
  assert.equal(parseCssColor("#ffffff"), null);
});

test("DRV V1: colours are IGUAL within 2 per channel and 0.01 alpha", () => {
  assert.equal(classifyMetric(color("rgb(199, 199, 199)"), "rgb(201, 197, 199)", 1920).status, "IGUAL");
  assert.equal(classifyMetric(color("rgb(199, 199, 199)"), "rgb(202, 199, 199)", 1920).status, "DIFERENTE");
  assert.equal(classifyMetric(color("rgb(199, 199, 199)"), "rgb(202, 199, 199)", 1920).delta, 3);
  assert.equal(classifyMetric(color("rgba(0, 0, 0, 0)"), "rgb(248, 251, 252)", 1920).status, "DIFERENTE");
  assert.equal(classifyMetric(color("rgb(255, 255, 255)"), "oklab(1 0 0)", 1920).status, "IGUAL");
});

test("DRV V1: an unparseable colour reading is an instrument error", () => {
  const result = classifyMetric(color("rgb(0, 0, 0)"), "color-mix(in srgb, red, blue)", 1920);
  assert.ok(result.instrumentError);
});

test("DRV V1: formulas follow the reference §II.4 and §VI.3 intervals", () => {
  const main: DriveMetric = { ...px(0, 1), kind: "formula", formula: "viewport-313", minViewportWidth: 1000 };
  delete (main as { expected?: unknown }).expected;
  assert.equal(expectedFor(main, 1920), 1607);
  assert.equal(expectedFor(main, 999), null);
  assert.equal(classifyMetric(main, 1665, 1920).status, "DIFERENTE");
  assert.equal(classifyMetric(main, 500, 999).status, "NO_COMPARABLE");

  const search: DriveMetric = { ...main, formula: "search-width" };
  assert.equal(expectedFor(search, 1920), 722);
  assert.equal(expectedFor(search, 1416), 722);
  assert.equal(expectedFor(search, 1366), 672);
  assert.equal(expectedFor(search, 1024), 330);
  assert.equal(expectedFor(search, 1023), 349);
});

test("DRV V1: tallies count statuses per key without a global score", () => {
  const results = [
    classifyMetric(px(64, 1), 64, 1920),
    classifyMetric(px(64, 1), 50, 1920),
    classifyMetric(px(64, 1), null, 1920),
  ];
  assert.deepEqual(tallyBy(results, "component"), {
    c: { IGUAL: 1, DIFERENTE: 1, AUSENTE: 1, NO_COMPARABLE: 0 },
  });
});
