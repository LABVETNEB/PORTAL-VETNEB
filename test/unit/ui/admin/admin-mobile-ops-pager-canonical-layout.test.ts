import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const OPS_PAGER_PATH =
  "frontend/src/app/dashboard/admin/AdminMobileOpsPager.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("admin mobile ops pager matches the canonical Tokens pager layout", () => {
  const source = read(OPS_PAGER_PATH);

  // Canonical Tokens mobile pager is centered, not split (justify-between).
  assert.ok(source.includes("justify-center"), "pager must be centered");
  assert.equal(
    source.includes("justify-between"),
    false,
    "pager must not use justify-between",
  );

  // Text controls "Anterior" / "Pág. X" / "Siguiente" instead of icon chevrons.
  assert.ok(source.includes("Pág."), "pager must render the Pág. label");
  assert.equal(
    source.includes("ChevronLeft"),
    false,
    "pager must not import/use chevron icons",
  );
  assert.equal(
    source.includes("ChevronRight"),
    false,
    "pager must not import/use chevron icons",
  );
});

test("admin mobile ops pager uses >=36px touch targets", () => {
  const source = read(OPS_PAGER_PATH);

  assert.ok(source.includes("h-9"), "pager buttons must be h-9 (36px)");
  assert.equal(
    source.includes("h-7 w-7"),
    false,
    "pager buttons must not be 28px icon buttons",
  );
});

test("admin mobile ops pager preserves the no-scroll nav contract", () => {
  const source = read(OPS_PAGER_PATH);

  assert.ok(source.includes('data-admin-mobile-ops-pager="true"'));
  assert.ok(source.includes("aria-label={ariaLabel}"));
  assert.ok(source.includes("min-h-10"));
  assert.equal(source.includes("overflow-auto"), false);
  assert.equal(source.includes("overflow-scroll"), false);
});
