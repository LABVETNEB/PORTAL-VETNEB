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

  require(/^import \{ useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent \} from "react";$/m.test(hook), "hook imports react only");
  require([...hook.matchAll(/^import /gm)].length === 1, "hook has a single import (presentation-pure)");
  // PR #1888 P1: the boundary is the React tree (pointer events cross portals), so
  // a dialog the panel portals to document.body stays inside; a DOM containment
  // test or a capture-phase listener judges the press before React marks it.
  require(hook.includes("insidePresses.current.add(event.nativeEvent);"), "the owner marks presses inside its React tree");
  require(hook.includes("if (!insidePresses.current.has(event)) close();"), "only an unmarked press dismisses");
  require(hook.includes('window.addEventListener("pointerdown", closeOnOutsidePress);'), "the press is judged on window after React dispatch");
  require(hook.includes('window.removeEventListener("pointerdown", closeOnOutsidePress);'), "light dismiss is removed");
  require(!/\.contains\(|addEventListener\("pointerdown",[^)]*true\)|setTimeout|stopPropagation/.test(hook), "no DOM containment, capture phase, timer or event suppression");
  require(hook.includes("window.dispatchEvent(new CustomEvent<string>(MOBILE_OVERLAY_OPEN_EVENT, { detail: overlayId }));"), "opening announces itself");
  require(hook.includes("if ((event as CustomEvent<string>).detail !== overlayId) close();"), "another overlay opening closes this one");
  require(hook.includes('const MOBILE_OVERLAY_REGIME = "(max-width: 767px)";'), "the phone regime is the B09 boundary");
  require(hook.includes("if (!regime.matches) close();"), "leaving the phone regime closes the overlay");
  require(hook.includes('regime.removeEventListener("change", closeOutsideRegime);'), "the regime listener is removed");
  require(!/focus\(/.test(hook), "the shared policy never moves focus");

  require(nav.includes('import { useMobileOverlayDismissal } from "./useMobileOverlayDismissal";'), "mobile nav consumes the policy");
  require(/const markOverflowPress = useMobileOverlayDismissal\(\s*OVERFLOW_ID,\s*overflowOpen,\s*closeOverflow,\s*\);/.test(nav), "overflow consumes the policy");
  require(/const dismissOverflow = useCallback\(\(\) => \{\s*setOverflowOpen\(false\);\s*overflowTriggerRef\.current\?\.focus\(\{ preventScroll: true \}\);\s*\}, \[\]\);/.test(nav), "overflow returns focus to Más");
  require(/onClose=\{dismissOverflow\}/.test(nav), "Escape and Cerrar go through the focus-returning close");
  require(/ref=\{overflowTriggerRef\}\s*onPointerDown=\{onOverflowPointerDown\}\s*type="button"\s*aria-label="Más"/.test(nav), "Más marks its presses");
  require(/onPointerDown=\{onPanelPointerDown\}\s*id=\{OVERFLOW_ID\}/.test(nav), "the sheet marks its presses");
  require(nav.includes("onOverflowPointerDown={markOverflowPress}") && nav.includes("onPanelPointerDown={markOverflowPress}"), "trigger and sheet share one marker");
  require(/setOverflowOpen\(false\);\s*return surface === "admin"/.test(nav), "a destination closes without stealing focus");

  require(kebab.includes('import { useMobileOverlayDismissal } from "./useMobileOverlayDismissal";'), "kebab consumes the policy");
  require(kebab.includes("const markInsidePress = useMobileOverlayDismissal(menuId, isOpen, close);"), "kebab consumes the policy");
  require(/if \(event\.key !== "Escape"\) return;\s*setIsOpen\(false\);\s*triggerRef\.current\?\.focus\(\{ preventScroll: true \}\);/.test(kebab), "kebab Escape returns focus");
  require(/<button\s*ref=\{triggerRef\}\s*onPointerDown=\{markInsidePress\}/.test(kebab), "the kebab trigger marks its presses");
  require(/<section\s*onPointerDown=\{markInsidePress\}\s*id=\{menuId\}/.test(kebab), "the kebab menu marks its presses, portaled Notificaciones included");
  require(/<section[\s\S]*<DashboardNotificationsBell surface=\{surface\} mobileNoScroll \/>[\s\S]*<\/section>/.test(kebab), "Notificaciones stays inside the marked menu");

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
    ["hook", 'window.addEventListener("pointerdown", closeOnOutsidePress);', 'document.addEventListener("pointerdown", closeOnOutsidePress, true);'],
    ["hook", "if (!insidePresses.current.has(event)) close();", "close();"],
    ["hook", "insidePresses.current.add(event.nativeEvent);", ""],
    ["hook", "if ((event as CustomEvent<string>).detail !== overlayId) close();", ""],
    ["hook", '"(max-width: 767px)"', '"(max-width: 1279px)"'],
    ["hook", "if (!regime.matches) close();", ""],
    ["hook", 'import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";', 'import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";\nimport { apiFetch } from "@/lib/api";'],
    ["mobileNav", "onClose={dismissOverflow}", "onClose={closeOverflow}"],
    ["mobileNav", "    overflowTriggerRef.current?.focus({ preventScroll: true });\n", ""],
    ["mobileNav", "            onPointerDown={onOverflowPointerDown}\n", ""],
    ["mobileNav", "      onPointerDown={onPanelPointerDown}\n", ""],
    ["kebab", "        onPointerDown={markInsidePress}\n        type=", "        type="],
    ["kebab", "          onPointerDown={markInsidePress}\n          id={menuId}", "          id={menuId}"],
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

// ── C23b PR1 · D-A ──────────────────────────────────────────────────────────
// Rutas and Visitas fold their card header into one 40px row from md up through
// the B11 token (the B11 class is hidden inside the clinic module workspace).
// Every new class is md-scoped so the five phone records stay untouched; the
// page-scope note stays painted and "Mostrando…" stays for assistive tech.
const D_A_PAGES = {
  rutas: "frontend/src/app/dashboard/logistica/rutas/page.tsx",
  visitas: "frontend/src/app/dashboard/logistica/visitas/page.tsx",
} as const;
const D_A_HEADER_CLASS =
  "shrink-0 md:h-[var(--dash-workspace-header-h)] md:flex-row md:items-center md:justify-between md:gap-3 md:space-y-0 md:px-4 md:py-0";

function dAViolations(source: string): string[] {
  const violations: string[] = [];
  const require = (ok: boolean, message: string) => {
    if (!ok) violations.push(message);
  };
  const header = /<CardHeader className="([^"]*)">/.exec(source)?.[1] ?? "";
  require(header === D_A_HEADER_CLASS, "the card header is the D-A 40px row");
  require(header.split(" ").slice(1).every((token) => token.startsWith("md:")), "every header class added by D-A is md-scoped");
  require(source.includes('<CardTitle className="text-base md:shrink-0">'), "the title keeps its count and only gains md shrink");
  require(/className="text-sm text-muted-foreground md:sr-only"\s*data-dashboard-chrome-secondary="true"\s*>\s*Mostrando/.test(source), "Mostrando stays for assistive tech from md");
  require(/<p className="text-xs text-muted-foreground md:min-w-0 md:line-clamp-2">Conteos calculados sobre la página visible, no sobre el total general de /.test(source), "the page-scope note stays painted, wrapping instead of truncating");
  require(!/<p [^>]*(?:sr-only|title=)[^>]*>Conteos calculados/.test(source), "the page-scope note is never hidden or moved to a tooltip");
  require(!source.includes("dashboard-workspace-header"), "the B11 class is not used here (hidden by the clinic reclaim rule)");
  require(source.includes("<ModuleMetricRun"), "the B14 full-route run stays");
  return violations;
}

test("C23b PR1 · Rutas and Visitas carry the md-scoped D-A header", () => {
  for (const [name, path] of Object.entries(D_A_PAGES)) {
    assert.deepEqual(dAViolations(readSourceFile(path)), [], name);
  }
});

test("C23b PR1 · the D-A guard rejects each regression", () => {
  const mutations: ReadonlyArray<readonly [string, string]> = Object.freeze([
    ["md:py-0", "py-0"],
    ["md:h-[var(--dash-workspace-header-h)]", "h-[var(--dash-workspace-header-h)]"],
    ['className="text-sm text-muted-foreground md:sr-only"', 'className="text-sm text-muted-foreground"'],
    ["md:min-w-0 md:line-clamp-2", "md:min-w-0 md:truncate"],
    ["md:min-w-0 md:line-clamp-2", "md:sr-only"],
    ['<CardHeader className="shrink-0 ', '<CardHeader className="dashboard-workspace-header shrink-0 '],
    ['<CardTitle className="text-base md:shrink-0">', '<CardTitle className="text-base">'],
  ]);
  for (const path of Object.values(D_A_PAGES)) {
    const sources = { page: readSourceFile(path) };
    for (const [anchor, replacement] of mutations) {
      assert.ok(sources.page.includes(anchor), `anchor present: ${path} ${anchor}`);
      const mutated = sources.page.replace(anchor, () => replacement);
      assert.notDeepEqual(dAViolations(mutated), [], `mutation must be rejected: ${path} ${anchor}`);
    }
  }
});

// ── C23b PR2 · vE ───────────────────────────────────────────────────────────
// Logística (full route) from md up: the command-center header is one 40px row
// through the B11 token and the operational note moves below the two lists by
// visual order only (no focusable inside it, DOM and tab order unchanged). The
// note stays painted with all its text and the B14 run; phones are untouched.
const V_E_HUB = "frontend/src/app/dashboard/logistica/LogisticsCommandCenter.tsx";
const V_E_HEADER_CLASS =
  "flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-vetneb-line/70 px-3 py-1.5 md:h-[var(--dash-workspace-header-h)] md:flex-nowrap md:py-0";

function vEViolations(source: string): string[] {
  const violations: string[] = [];
  const require = (ok: boolean, message: string) => {
    if (!ok) violations.push(message);
  };
  const code = stripComments(source);
  require(code.includes(`<div className="${V_E_HEADER_CLASS}">`), "the command-center header is the md-scoped 40px row");
  require(/<section\s+className="surface-note-info shrink-0 md:order-last"\s+aria-labelledby="logistics-operational-priority"/.test(code), "the note moves below the lists from md up, by visual order only");
  require(!/surface-note-info[^"]*(?:sr-only|hidden)/.test(code), "the note is never hidden");
  require(code.indexOf('className="surface-note-info') < code.indexOf("<LogisticsRecentListCanvas"), "the note keeps its DOM position before the lists");
  require(code.includes("Estado operativo logística") && code.includes("Priorice visitas activas y planes en curso para sostener continuidad operativa."), "the note keeps its text");
  require(!/<[a-z][a-z0-9]*\b[^>]*\stitle=/.test(code), "no native tooltip carries information");
  require(code.includes('<ModuleMetricRun\n            surfaceId="clinic-logistica-full"'), "the B14 run stays inside the note");
  require(!code.includes("dashboard-workspace-header"), "the B11 class is not used here (hidden by the clinic reclaim rule)");
  return violations;
}

test("C23b PR2 · Logística full route carries the md-scoped vE layout", () => {
  assert.deepEqual(vEViolations(readSourceFile(V_E_HUB)), []);
});

test("C23b PR2 · the vE guard rejects each regression", () => {
  const sources = { hub: readSourceFile(V_E_HUB) };
  const mutations: ReadonlyArray<readonly [string, string]> = Object.freeze([
    [" md:h-[var(--dash-workspace-header-h)]", ""],
    ["md:flex-nowrap md:py-0", "md:py-0"],
    ["px-3 py-1.5 md:h-", "px-3 py-0 md:h-"],
    ["surface-note-info shrink-0 md:order-last", "surface-note-info shrink-0 order-last"],
    ["surface-note-info shrink-0 md:order-last", "surface-note-info shrink-0 md:order-last md:sr-only"],
    ["surface-note-info shrink-0 md:order-last", "surface-note-info shrink-0"],
    ['className="mt-1 text-sm font-medium text-vetneb-navy"', 'className="mt-1 text-sm font-medium text-vetneb-navy" title="Priorice"'],
  ]);
  for (const [anchor, replacement] of mutations) {
    assert.ok(sources.hub.includes(anchor), `anchor present: ${anchor}`);
    const mutated = sources.hub.replace(anchor, () => replacement);
    assert.notDeepEqual(vEViolations(mutated), [], `mutation must be rejected: ${anchor}`);
  }
});

// ── C23b PR3 · B1 + B4 ──────────────────────────────────────────────────────
// Informes (full route) from md up: the card header is one 40px row through the
// B11 token (description kept for assistive tech, metric run inline), the
// summary strip leaves the flow because the pager already carries its range,
// total and page (it stays readable to assistive tech), and the populated list
// header is one row at the C01 collection-header height. `CollectionHeader` is a
// <thead>, so only its token reaches this div list. Phones are untouched.
const B1B4_PATHS = {
  page: "frontend/src/app/dashboard/informes/page.tsx",
  list: "frontend/src/app/dashboard/informes/InformesReportsList.tsx",
} as const;
type B1B4Sources = Record<keyof typeof B1B4_PATHS, string>;
const B1_HEADER_CLASS =
  "shrink-0 border-b border-vetneb-line/70 md:h-[var(--dash-workspace-header-h)] md:justify-center md:space-y-0 md:px-4 md:py-0";
const B1_STRIP_CLASS = "hidden gap-2 text-sm sm:grid sm:grid-cols-4 md:sr-only";
const B4_HEADER_CLASS =
  "flex shrink-0 items-start justify-between gap-2 border-b border-vetneb-line/70 px-4 py-2.5 md:h-[var(--dash-collection-header-h)] md:items-center md:py-0";

function b1b4Violations(sources: B1B4Sources): string[] {
  const violations: string[] = [];
  const require = (ok: boolean, message: string) => {
    if (!ok) violations.push(message);
  };
  const page = stripComments(sources.page);
  const list = stripComments(sources.list);
  const header = /<CardHeader className="([^"]*)">/.exec(page)?.[1] ?? "";
  require(header === B1_HEADER_CLASS, "B1: the card header is the md-scoped 40px row");
  require(header.split(" ").slice(3).every((token) => token.startsWith("md:")), "B1: every header class it adds is md-scoped");
  require(page.includes('<div className="min-w-0 md:flex md:items-baseline md:gap-3">'), "B1: title, description and run share one row from md");
  require(/className="mt-1 text-sm text-muted-foreground md:sr-only"\s*data-dashboard-chrome-secondary="true"\s*>\s*Seleccione un informe de la lista para abrir el detalle operativo\./.test(page), "B1: the description stays for assistive tech");
  require(/<ModuleMetricRun\s+surfaceId="clinic-informes-full"\s+className="mt-1 text-xs text-muted-foreground md:mt-0"/.test(page), "B1: the B14 run stays, inline from md");
  require(list.includes(`<div className="${B1_STRIP_CLASS}">`), "B1: the summary strip leaves the flow from md without leaving the accessibility tree");
  for (const label of ["Total", "Mostrando", "Página", "Filtros"]) {
    require(list.includes(`<p className="text-xs text-muted-foreground">${label}</p>`), `B1: the strip keeps ${label}`);
  }
  require(/rangeLabel=\{totalCount > 0 \? `\$\{pageStart\}–\$\{pageEnd\} de \$\{totalCount\}` : undefined\}/.test(list), "B1: the pager keeps the range and total");
  require(list.includes(`<div className="${B4_HEADER_CLASS}">`), "B4: the populated list header is the md-scoped 36px row");
  require(list.includes('<h2 id="reports-list-heading" className="dashboard-section-heading md:shrink-0">'), "B4: the heading keeps its id and level");
  require(/className="dashboard-section-description truncate md:mt-0 md:min-w-0"\s*title=/.test(list), "B4: the hint stays painted on the same row");
  require(!/dashboard-section-description[^"]*(?:sr-only|hidden)/.test(list), "B4: the hint is never hidden");
  require(!list.includes("<CollectionHeader"), "B4: no <thead> is forced into the div list");
  require(!page.includes("dashboard-workspace-header") && !list.includes("dashboard-workspace-header"), "the B11 class is not used here (hidden by the clinic reclaim rule)");
  return violations;
}

const readB1B4 = (): B1B4Sources => ({ page: readSourceFile(B1B4_PATHS.page), list: readSourceFile(B1B4_PATHS.list) });

test("C23b PR3 · Informes full route carries the md-scoped B1 + B4 chrome", () => {
  assert.deepEqual(b1b4Violations(readB1B4()), []);
});

test("C23b PR3 · the B1 + B4 guard rejects each regression", () => {
  const sources = readB1B4();
  const mutations: ReadonlyArray<readonly [keyof B1B4Sources, string, string]> = Object.freeze([
    ["page", " md:h-[var(--dash-workspace-header-h)]", ""],
    ["page", "md:justify-center md:space-y-0 md:px-4 md:py-0", "justify-center space-y-0 px-4 py-0"],
    ["page", "text-muted-foreground md:sr-only", "text-muted-foreground md:hidden"],
    ["page", 'className="mt-1 text-xs text-muted-foreground md:mt-0"', 'className="mt-1 text-xs text-muted-foreground"'],
    ["list", "sm:grid-cols-4 md:sr-only", "sm:grid-cols-4 md:hidden"],
    ["list", "sm:grid-cols-4 md:sr-only", "sm:grid-cols-4"],
    ["list", "rangeLabel={totalCount > 0 ?", "data-range={totalCount > 0 ?"],
    ["list", " md:h-[var(--dash-collection-header-h)]", ""],
    ["list", "truncate md:mt-0 md:min-w-0", "truncate md:mt-0 md:min-w-0 md:sr-only"],
    ["list", 'className="dashboard-section-heading md:shrink-0"', 'className="dashboard-section-heading md:sr-only"'],
  ]);
  for (const [key, anchor, replacement] of mutations) {
    assert.ok(sources[key].includes(anchor), `anchor present: ${key} ${anchor}`);
    const mutated = sources[key].replace(anchor, () => replacement);
    assert.notDeepEqual(b1b4Violations({ ...sources, [key]: mutated }), [], `mutation must be rejected: ${key} ${anchor}`);
  }
});

// ── C23b PR4 · B2 variante B ────────────────────────────────────────────────
// Informes (full route) from lg up: the four-column FilterBar received five grid
// items because the «Más filtros» trigger stayed next to the inline fields, so
// Filtrar/Limpiar wrapped to a second row. The trigger is lg-hidden (the dialog
// keeps serving below lg) and each label puts its visible text to the left of
// its control. Only lg-scoped classes: below 1024 nothing changes, and the GET
// form, its names, submit and Limpiar are the same nodes as before.
// PR #1896 P1: crossing 1024 with the dialog open left Radix returning focus to
// the hidden trigger, and crossing back stranded focus in the hidden inline
// group. The Informes-only disclosure subscribes to the regime, closes the
// dialog and hands focus to the control that replaces each one.
const B2_PATHS = {
  page: "frontend/src/app/dashboard/informes/page.tsx",
  disclosure: "frontend/src/app/dashboard/informes/InformesFilterDisclosure.tsx",
  filterBar: "frontend/src/components/dashboard/FilterBar.tsx",
} as const;
type B2Sources = Record<keyof typeof B2_PATHS, string>;
const B2_FILTER_BAR_CLASS =
  "shrink-0 lg:grid-cols-[1.4fr_0.8fr_1fr_auto] lg:[&_label]:grid-cols-[auto_minmax(0,1fr)] lg:[&_label]:items-center lg:[&_label]:gap-x-1.5";
const B2_TRIGGER_CLASS = "h-9 justify-center px-2 text-xs lg:hidden";

function b2Violations(sources: B2Sources): string[] {
  const violations: string[] = [];
  const require = (ok: boolean, message: string) => {
    if (!ok) violations.push(message);
  };
  const page = stripComments(sources.page);
  const disclosure = stripComments(sources.disclosure);
  const filterBar = stripComments(sources.filterBar);
  const bar = /<FilterBar\s+method="get"\s+role="search"\s+aria-label="Filtros compactos de informes"\s+density="module-card"\s+className="([^"]*)"\s*>/.exec(page)?.[1] ?? "";
  require(bar === B2_FILTER_BAR_CLASS, "the FilterBar keeps its GET search form and gains only the inline-label classes");
  require(bar.split(" ").slice(1).every((token) => token.startsWith("lg:")), "every FilterBar class is lg-scoped");
  require(/<InformesFilterDisclosure\s+title="Filtros de informes"[\s\S]*?trigger=\{\s*<Button\s+type="button"\s+size="sm"\s+variant=\{hasActiveFilters \? "default" : "outline"\}\s+className="([^"]*)"\s*>\s*Más filtros\s*<\/Button>/.exec(page)?.[1] === B2_TRIGGER_CLASS, "the «Más filtros» trigger is hidden from lg only");
  require(/<form method="get" className="grid gap-3">\s*<input type="hidden" name="query" defaultValue=\{query\} \/>/.test(page), "the dialog keeps its own GET form below lg");
  require(!page.includes("<ModuleDialog") && page.includes('import { InformesFilterDisclosure } from "./InformesFilterDisclosure";'), "the page reaches the dialog only through the Informes disclosure");
  const inline = page.slice(page.indexOf("inline={"), page.indexOf('<form method="get"'));
  const order = ['name="status"', 'name="studyType"', 'type="submit"', "Limpiar"].map((anchor) => inline.indexOf(anchor));
  require(page.indexOf('name="query"') < page.indexOf("<InformesFilterDisclosure") && order.every((at, index) => at > 0 && (index === 0 || at > order[index - 1])), "desktop order is Buscar → Estado → Tipo → Filtrar → Limpiar");
  for (const name of ["status", "studyType"]) {
    require([...page.matchAll(new RegExp(`name="${name}"`, "g"))].length === 2, `${name} stays in the dialog and inline`);
  }
  require([...page.matchAll(/<PublicRouteControl\s+href="\/dashboard\/informes"\s+replace/g)].length === 2, "both Limpiar controls keep the replace navigation");
  require(!page.includes("labelHidden"), "the filter labels stay visible");
  require(!/\[&_label\]:(?:sr-only|hidden)/.test(page), "the labels are never hidden by the FilterBar");
  require(/<span className=\{cn\(labelHidden && "sr-only"\)\}>\{label\}<\/span>\s*\{children\}/.test(filterBar), "FilterField keeps label text before its control (the two inline grid columns)");

  require(disclosure.startsWith('"use client";'), "the disclosure is the minimal client boundary");
  require(disclosure.includes('const INLINE_FILTERS_REGIME = "(min-width: 1024px)";'), "the regime is the Tailwind lg boundary");
  require(/<ModuleDialog\s+open=\{open\}\s+onOpenChange=\{setOpen\}/.test(disclosure), "the dialog is controlled by the disclosure");
  require(disclosure.includes('<div ref={inlineRef} className="hidden lg:contents" onBlur={onInlineBlur}>'), "the inline fields stay the lg grid items and watch their own blur");
  require(disclosure.includes('regime.addEventListener("change", onRegimeChange);') && disclosure.includes('regime.removeEventListener("change", onRegimeChange);'), "the regime is a reactive subscription");
  require(/if \(regime\.matches\) \{\s*if \(!open\) return;\s*setFocusInline\(true\);\s*setOpen\(false\);/.test(disclosure), "crossing to lg closes an open dialog and claims the inline focus");
  require(/if \(open \|\| !focusInline\) return;\s*setFocusInline\(false\);\s*inlineRef\.current\?\.querySelector<HTMLElement>\(FOCUSABLE\)\?\.focus\(/.test(disclosure), "after the close commits, focus lands on the first inline control");
  require(/const trigger = inlineRef\.current\?\.previousElementSibling;\s*if \(trigger instanceof HTMLButtonElement\) trigger\.focus\(/.test(disclosure), "the trigger handoff only targets the dialog trigger");
  require(disclosure.includes("if (group.contains(document.activeElement)) focusTrigger();"), "a regime change below lg hands inline focus to the visible trigger");
  require(disclosure.includes("if (event.relatedTarget === null && !window.matchMedia(INLINE_FILTERS_REGIME).matches) focusTrigger();"), "a focus-fixup blur below lg also hands focus to the trigger");
  require(!/setTimeout|setInterval|requestAnimationFrame|tabIndex|sr-only/.test(disclosure), "no timer, polling, focusable hidden node or CSS trick");
  return violations;
}

const readB2 = (): B2Sources => ({
  page: readSourceFile(B2_PATHS.page),
  disclosure: readSourceFile(B2_PATHS.disclosure),
  filterBar: readSourceFile(B2_PATHS.filterBar),
});

test("C23b PR4 · Informes full route carries the lg-scoped B2 inline filters", () => {
  assert.deepEqual(b2Violations(readB2()), []);
});

test("C23b PR4 · the B2 guard rejects each regression", () => {
  const sources = readB2();
  const mutations: ReadonlyArray<readonly [keyof B2Sources, string, string]> = Object.freeze([
    ["page", "px-2 text-xs lg:hidden", "px-2 text-xs"],
    ["page", "px-2 text-xs lg:hidden", "px-2 text-xs hidden"],
    ["page", " lg:[&_label]:grid-cols-[auto_minmax(0,1fr)]", ""],
    ["page", "lg:[&_label]:grid-cols-[auto_minmax(0,1fr)]", "md:[&_label]:grid-cols-[auto_minmax(0,1fr)]"],
    ["page", " lg:[&_label]:items-center", ""],
    ["page", "lg:grid-cols-[1.4fr_0.8fr_1fr_auto]", "lg:grid-cols-5"],
    ["page", "lg:[&_label]:gap-x-1.5", "lg:[&_label]:gap-x-1.5 lg:[&_label]:sr-only"],
    ["page", '<FilterBar\n            method="get"', '<FilterBar\n            method="post"'],
    ["page", '<FilterField label="Estado" density="module-card">', '<FilterField label="Estado" density="module-card" labelHidden>'],
    ["filterBar", '<span className={cn(labelHidden && "sr-only")}>{label}</span>', '<span className="sr-only">{label}</span>'],
    ["disclosure", '<div ref={inlineRef} className="hidden lg:contents" onBlur={onInlineBlur}>', '<div ref={inlineRef} className="hidden" onBlur={onInlineBlur}>'],
    ["disclosure", " onBlur={onInlineBlur}>", ">"],
    ["disclosure", "      if (group.contains(document.activeElement)) focusTrigger();\n", ""],
    ["disclosure", "event.relatedTarget === null && !window", "!window"],
    ["disclosure", '"(min-width: 1024px)"', '"(min-width: 768px)"'],
    ["disclosure", "        setFocusInline(true);\n        setOpen(false);\n", "        setFocusInline(true);\n"],
    ["disclosure", "    inlineRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true });\n", ""],
    ["disclosure", "    if (trigger instanceof HTMLButtonElement) trigger.focus({ preventScroll: true });\n", ""],
    ["disclosure", "        open={open}\n        onOpenChange={setOpen}\n", ""],
    ["disclosure", "    setFocusInline(false);\n", "    setTimeout(() => setFocusInline(false));\n"],
  ]);
  for (const [key, anchor, replacement] of mutations) {
    assert.ok(sources[key].includes(anchor), `anchor present: ${key} ${anchor}`);
    const mutated = sources[key].replace(anchor, () => replacement);
    assert.notDeepEqual(b2Violations({ ...sources, [key]: mutated }), [], `mutation must be rejected: ${key} ${anchor}`);
  }
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
});
const C23B_WIDE_LEDGER: Readonly<Record<string, number>> = Object.freeze({});
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
