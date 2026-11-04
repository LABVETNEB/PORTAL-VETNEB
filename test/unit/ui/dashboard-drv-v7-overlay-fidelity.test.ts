import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyMetric,
  validateDriveReference,
  type DriveReference,
} from "../../../frontend/e2e/helpers/drive-fidelity.ts";
import { readSourceFile } from "../../helpers/tracked-source-files.ts";

const V1 = JSON.parse(readSourceFile("frontend/e2e/fixtures/drive-ui-reference.v1.json")) as DriveReference;
const V7 = JSON.parse(readSourceFile("frontend/e2e/fixtures/drive-ui-reference.v7-overlays.json")) as DriveReference;
const metric = (id: string) => {
  const found = V7.metrics.find((candidate) => candidate.id === id);
  assert.ok(found, id);
  return found;
};

test("DRV V7: the overlay reference is well formed and shares the V1 schema and colour criterion", () => {
  assert.deepEqual(validateDriveReference(V7), []);
  assert.equal(V7.schema, V1.schema);
  assert.equal(V7.colorCriterion, V1.colorCriterion);
});

test("DRV V7: only OBSERVADO values are compared and no id clashes with V1", () => {
  for (const entry of V7.metrics) assert.equal(entry.evidence, "OBSERVADO", entry.id);
  const v1Ids = new Set([...V1.metrics.map((entry) => entry.id), ...V1.notComparable.map((entry) => entry.id)]);
  for (const entry of V7.metrics) assert.equal(v1Ids.has(entry.id), false, `${entry.id} clashes with V1`);
});

test("DRV V7: unresolved Drive values are NO_COMPARABLE entries, never metrics", () => {
  const ids = new Set(V7.notComparable.map((entry) => entry.id));
  for (const unresolved of ["menu.surface.minWidth", "menu.item.hover", "tooltip.delay"]) {
    assert.ok(ids.has(unresolved), unresolved);
    assert.equal(V7.metrics.some((entry) => entry.id === unresolved), false, unresolved);
  }
});

test("DRV V7: V1 semantics are intact (V1 still defers menus and tooltips)", () => {
  const deferred = new Set(V1.notComparable.map((entry) => entry.id));
  assert.ok(deferred.has("menus"));
  assert.ok(deferred.has("tooltip"));
});

test("DRV V7: the V1 classifier reads Chromium computed values of the Drive menu and tooltip", () => {
  const shadow =
    "rgba(0, 0, 0, 0.2) 0px 2px 4px -1px, rgba(0, 0, 0, 0.14) 0px 4px 5px 0px, rgba(0, 0, 0, 0.12) 0px 1px 10px 0px";
  assert.equal(classifyMetric(metric("menu.surface.boxShadow"), shadow, 1920).status, "IGUAL");
  assert.equal(classifyMetric(metric("menu.surface.boxShadow"), "rgba(0, 0, 0, 0.1) 0px 4px 12px 0px", 1920).status, "DIFERENTE");
  assert.equal(classifyMetric(metric("menu.surface.background"), "rgb(255, 255, 255)", 1366).status, "IGUAL");
  assert.equal(classifyMetric(metric("menu.surface.background"), "rgb(244, 250, 251)", 1366).status, "DIFERENTE");
  assert.equal(classifyMetric(metric("menu.item.height"), 32, 1280).status, "IGUAL");
  assert.equal(classifyMetric(metric("menu.item.height"), 48, 1280).status, "DIFERENTE");
  assert.equal(classifyMetric(metric("tooltip.background"), "rgb(48, 48, 48)", 1024).status, "IGUAL");
  assert.equal(classifyMetric(metric("tooltip.letterSpacing"), "0.1px", 1024).status, "IGUAL");
  assert.equal(classifyMetric(metric("tooltip.padding"), "4px 8px", 1024).status, "IGUAL");
  assert.equal(classifyMetric(metric("tooltip.radius"), null, 1024).status, "AUSENTE");
  assert.equal(
    classifyMetric(metric("filterPopover.radius"), { notApplicable: "no filter popover" }, 1920).status,
    "NO_COMPARABLE",
  );
});
