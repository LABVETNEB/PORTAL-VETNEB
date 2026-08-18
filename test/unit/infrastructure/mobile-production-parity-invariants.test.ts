import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function assertIncludes(source: string, expected: string, context: string): void {
  assert.ok(
    source.includes(expected),
    `${context}: missing invariant marker -> ${expected}`,
  );
}

function assertNotIncludes(
  source: string,
  forbidden: string,
  context: string,
): void {
  assert.ok(
    !source.includes(forbidden),
    `${context}: forbidden marker detected -> ${forbidden}`,
  );
}

test("manifest invariants: orientation allows landscape on tablet (must not be portrait-primary)", () => {
  const manifestFile = "frontend/src/app/manifest.ts";
  const source = read(manifestFile);

  assertNotIncludes(
    source,
    '"portrait-primary"',
    manifestFile,
  );
  assertIncludes(
    source,
    'orientation: "any"',
    manifestFile,
  );
});

test("upload modal invariants: dialog overlay must support scroll on mobile viewports", () => {
  const modalFile = "frontend/src/components/dashboard/UploadReportModal.tsx";
  const source = read(modalFile);

  assertIncludes(
    source,
    "overflow-y-auto",
    `${modalFile}: modal overlay must be overflow-y-auto for small screens`,
  );
  assertIncludes(
    source,
    "items-start",
    `${modalFile}: modal overlay must use items-start to allow top-anchored scroll on mobile`,
  );
  assertIncludes(
    source,
    "sm:items-center",
    `${modalFile}: modal overlay must restore items-center on sm+ viewports`,
  );
  assertIncludes(
    source,
    "my-auto",
    `${modalFile}: modal dialog must use my-auto to center vertically when content fits`,
  );
  assertNotIncludes(
    source,
    '"fixed inset-0 z-[9999] flex items-center justify-center',
    `${modalFile}: old non-scrollable overlay pattern must not be present`,
  );
});
