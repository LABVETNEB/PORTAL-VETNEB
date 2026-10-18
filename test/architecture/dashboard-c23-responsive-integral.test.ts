import assert from "node:assert/strict";
import test from "node:test";
import { readSourceFile } from "../helpers/tracked-source-files.ts";

// C23a guard: the two phone overlays of the shell share one dismissal policy and
// return focus; C23b ledger: the chrome budget of the roadmap (§26, §54, §62.5)
// is read from the frozen A02 baseline, never re-measured or rewritten here.

const PATHS = {
  hook: "frontend/src/components/dashboard/useMobileOverlayDismissal.ts",
  mobileNav: "frontend/src/components/dashboard/DashboardMobileNav.tsx",
  kebab: "frontend/src/components/dashboard/DashboardMobileKebabMenu.tsx",
  baseline: "frontend/e2e/fixtures/dashboard-geometry-baseline.ts",
  spec: "frontend/e2e/regression/dashboard-c23-responsive-integral.spec.ts",
  catalog: "frontend/e2e/suites/catalog.ts",
} as const;
type Sources = Record<"hook" | "mobileNav" | "kebab", string>;

const read = (): Sources => ({
  hook: readSourceFile(PATHS.hook),
  mobileNav: readSourceFile(PATHS.mobileNav),
  kebab: readSourceFile(PATHS.kebab),
});

const stripComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function c23aViolations(sources: Sources): string[] {
  const violations: string[] = [];
  const hook = stripComments(sources.hook);
  const nav = stripComments(sources.mobileNav);
  const kebab = stripComments(sources.kebab);
  const require = (ok: boolean, message: string) => {
    if (!ok) violations.push(message);
  };

  require(/^import \{ useEffect, type RefObject \} from "react";$/m.test(hook), "hook imports react only");
  require([...hook.matchAll(/^import /gm)].length === 1, "hook has a single import (presentation-pure)");
  require(hook.includes('document.addEventListener("pointerdown", closeOnOutsidePress, true);'), "light dismiss on a captured outside press");
  require(hook.includes('document.removeEventListener("pointerdown", closeOnOutsidePress, true);'), "light dismiss is removed");
  require(hook.includes("window.dispatchEvent(new CustomEvent<string>(MOBILE_OVERLAY_OPEN_EVENT, { detail: overlayId }));"), "opening announces itself");
  require(hook.includes("if ((event as CustomEvent<string>).detail !== overlayId) close();"), "another overlay opening closes this one");
  require(hook.includes('const MOBILE_OVERLAY_REGIME = "(max-width: 767px)";'), "the phone regime is the B09 boundary");
  require(hook.includes("if (!regime.matches) close();"), "leaving the phone regime closes the overlay");
  require(hook.includes('regime.removeEventListener("change", closeOutsideRegime);'), "the regime listener is removed");
  require(!/focus\(/.test(hook), "the shared policy never moves focus");

  require(nav.includes('import { useMobileOverlayDismissal } from "./useMobileOverlayDismissal";'), "mobile nav consumes the policy");
  require(/useMobileOverlayDismissal\(\s*OVERFLOW_ID,\s*overflowOpen,\s*closeOverflow,\s*overflowTriggerRef,\s*overflowPanelRef,\s*\);/.test(nav), "overflow registers trigger and panel");
  require(/const dismissOverflow = useCallback\(\(\) => \{\s*setOverflowOpen\(false\);\s*overflowTriggerRef\.current\?\.focus\(\{ preventScroll: true \}\);\s*\}, \[\]\);/.test(nav), "overflow returns focus to Más");
  require(/onClose=\{dismissOverflow\}/.test(nav), "Escape and Cerrar go through the focus-returning close");
  require(/ref=\{overflowTriggerRef\}\s*type="button"\s*aria-label="Más"/.test(nav), "Más is the registered trigger");
  require(/ref=\{panelRef\}\s*id=\{OVERFLOW_ID\}/.test(nav), "the sheet is the registered panel");
  require(/setOverflowOpen\(false\);\s*return surface === "admin"/.test(nav), "a destination closes without stealing focus");

  require(kebab.includes('import { useMobileOverlayDismissal } from "./useMobileOverlayDismissal";'), "kebab consumes the policy");
  require(kebab.includes("useMobileOverlayDismissal(menuId, isOpen, close, triggerRef, menuRef);"), "kebab registers trigger and menu");
  require(/if \(event\.key !== "Escape"\) return;\s*setIsOpen\(false\);\s*triggerRef\.current\?\.focus\(\{ preventScroll: true \}\);/.test(kebab), "kebab Escape returns focus");
  require(/<button\s*ref=\{triggerRef\}/.test(kebab) && /<section\s*ref=\{menuRef\}/.test(kebab), "kebab trigger and menu carry the refs");

  for (const [name, source] of Object.entries({ hook, nav, kebab })) {
    for (const forbidden of ["onmousedown", "ontouchstart", "next/link", "@/lib/api"]) {
      require(!source.toLowerCase().includes(forbidden.toLowerCase()), `${name} must not introduce ${forbidden}`);
    }
  }
  return violations;
}

test("C23a · the phone overlays share one dismissal policy and return focus", () => {
  assert.deepEqual(c23aViolations(read()), []);
});

test("C23a · the guard rejects each regression of the overlay contract", () => {
  const sources = read();
  const mutations: ReadonlyArray<readonly [keyof Sources, string, string]> = Object.freeze([
    ["hook", 'document.addEventListener("pointerdown", closeOnOutsidePress, true);', ""],
    ["hook", "if ((event as CustomEvent<string>).detail !== overlayId) close();", ""],
    ["hook", '"(max-width: 767px)"', '"(max-width: 1279px)"'],
    ["hook", "if (!regime.matches) close();", ""],
    ["hook", 'import { useEffect, type RefObject } from "react";', 'import { useEffect, type RefObject } from "react";\nimport { apiFetch } from "@/lib/api";'],
    ["mobileNav", "onClose={dismissOverflow}", "onClose={closeOverflow}"],
    ["mobileNav", "    overflowTriggerRef.current?.focus({ preventScroll: true });\n", ""],
    ["mobileNav", "            ref={overflowTriggerRef}\n", ""],
    ["mobileNav", "      ref={panelRef}\n", ""],
    ["kebab", "useMobileOverlayDismissal(menuId, isOpen, close, triggerRef, menuRef);", ""],
    ["kebab", "      triggerRef.current?.focus({ preventScroll: true });\n", ""],
  ]);
  for (const [key, anchor, replacement] of mutations) {
    assert.ok(sources[key].includes(anchor), `anchor present: ${key} ${anchor}`);
    const mutated = sources[key].replace(anchor, () => replacement);
    assert.notDeepEqual(c23aViolations({ ...sources, [key]: mutated }), [], `mutation must be rejected: ${key} ${anchor}`);
  }
});

test("C23a · the runtime contract walks the 13 A02 viewports and is catalogued", () => {
  const spec = readSourceFile(PATHS.spec);
  const catalog = readSourceFile(PATHS.catalog);
  assert.ok(spec.includes("for (const viewport of DASHBOARD_GEOMETRY_VIEWPORTS)"), "the matrix is the canonical one, imported");
  assert.ok(spec.includes("expect(measured.size, `${role}: distinct viewports measured`).toBe(DASHBOARD_GEOMETRY_VIEWPORTS.length);"));
  for (const escape of ["test.skip", "test.fixme", "test.fail"]) assert.equal(spec.includes(escape), false, escape);
  assert.equal(/\b(?:test|describe)\.only\b/.test(spec), false, "no focused case");
  assert.match(catalog, /entry\("e2e\/regression\/dashboard-c23-responsive-integral\.spec\.ts", "regression", "dashboard\/responsive", [^\n]*\["visual-contract"\], ci, "fixture"/);
});

// ── C23b ledger ─────────────────────────────────────────────────────────────
// §26/§54/§62.5: chrome before the first datum ≤ 32 % of the viewport between
// 768 and 1366 px and ≤ 240 px at 1920 × 1080, measured by A02 as
// `derived.chromeBeforePrimaryContentRatio` / `…Px`. These cells exceed it in
// the frozen baseline (both platforms, identical); C23a changes none of them.
// The ledger may only shrink, through C23b with its own A02/A03 authorization.
const C23B_BAND_LEDGER = Object.freeze({
  "clinic-informes::w1280x720": 0.34854,
  "clinic-informes::w768x1024": 0.33638,
  "clinic-informes-full::w1366x768": 0.61469,
  "clinic-informes-full::w1280x720": 0.55251,
  "clinic-informes-full::w1024x768": 0.61469,
  "clinic-informes-full::w834x1194": 0.36884,
  "clinic-informes-full::w768x1024": 0.42769,
  "clinic-logistica-full::w1366x768": 0.39663,
  "clinic-logistica-full::w1280x720": 0.43817,
  "clinic-logistica-full::w1024x768": 0.39663,
  "clinic-logistica-full::w768x1024": 0.33836,
  "clinic-log-rutas::w1366x768": 0.34841,
  "clinic-log-rutas::w1280x720": 0.38674,
  "clinic-log-rutas::w1024x768": 0.34841,
  "clinic-log-visitas::w1366x768": 0.34841,
  "clinic-log-visitas::w1280x720": 0.38674,
  "clinic-log-visitas::w1024x768": 0.34841,
});
const C23B_WIDE_LEDGER = Object.freeze({
  "clinic-informes-full::w1920x1080": 482.73,
  "clinic-logistica-full::w1920x1080": 315.27,
  "clinic-log-rutas::w1920x1080": 278.23,
  "clinic-log-visitas::w1920x1080": 278.23,
});
const CHROME_BAND_RATIO = 0.32;
const CHROME_WIDE_PX = 240;
const RATIO_EPSILON = 0.0001;

type BaselineRecord = {
  surfaceId: string;
  viewportSlug: string;
  viewport: { innerWidth: number };
  derived: { chromeBeforePrimaryContentPx: number | null; chromeBeforePrimaryContentRatio: number | null };
};

function baselinePlatforms(): Record<"win32" | "linux", BaselineRecord[]> {
  const lines = readSourceFile(PATHS.baseline).split("\n");
  const cut = lines.findIndex((line) => /^\s*platformRecords: \{/.test(line));
  assert.ok(cut > 0, "the baseline keeps platformRecords after the Win32 records");
  const parse = (slice: string[]) =>
    slice
      .map((line) => line.trim().replace(/,$/, ""))
      .filter((line) => line.startsWith('{"surfaceId"'))
      .map((line) => JSON.parse(line) as BaselineRecord);
  return { win32: parse(lines.slice(0, cut)), linux: parse(lines.slice(cut)) };
}

test("C23b ledger · the chrome cells over budget are exactly the declared ones on both platforms", () => {
  for (const [platform, records] of Object.entries(baselinePlatforms())) {
    assert.ok(records.length === 21 * 13, `${platform}: 21 x 13 records`);
    const band = Object.fromEntries(
      records
        .filter((record) => record.viewport.innerWidth >= 768 && record.viewport.innerWidth <= 1366)
        .filter((record) => (record.derived.chromeBeforePrimaryContentRatio ?? 1) > CHROME_BAND_RATIO)
        .map((record) => [`${record.surfaceId}::${record.viewportSlug}`, record.derived.chromeBeforePrimaryContentRatio ?? 1]),
    );
    const wide = Object.fromEntries(
      records
        .filter((record) => record.viewportSlug === "w1920x1080")
        .filter((record) => (record.derived.chromeBeforePrimaryContentPx ?? Infinity) > CHROME_WIDE_PX)
        .map((record) => [`${record.surfaceId}::${record.viewportSlug}`, record.derived.chromeBeforePrimaryContentPx ?? Infinity]),
    );
    assert.deepEqual(Object.keys(band).sort(), Object.keys(C23B_BAND_LEDGER).sort(), `${platform}: 768-1366 cells over 32 %`);
    assert.deepEqual(Object.keys(wide).sort(), Object.keys(C23B_WIDE_LEDGER).sort(), `${platform}: 1920 cells over 240 px`);
    for (const [key, ratio] of Object.entries(C23B_BAND_LEDGER)) {
      assert.ok(Math.abs(band[key] - ratio) <= RATIO_EPSILON, `${platform} ${key}: ${band[key]} vs ledger ${ratio}`);
    }
    for (const [key, px] of Object.entries(C23B_WIDE_LEDGER)) {
      assert.ok(Math.abs(wide[key] - px) <= 0.01, `${platform} ${key}: ${wide[key]} vs ledger ${px}`);
    }
  }
});
