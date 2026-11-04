import assert from "node:assert/strict";
import test from "node:test";

import { readSourceFile as read } from "../helpers/tracked-source-files.ts";

const MENU = "frontend/src/features/dashboard/presentation/surfaces/ActionMenu.tsx";
const TOOLTIP = "frontend/src/components/dashboard/DashboardTooltip.tsx";
const RAIL = "frontend/src/components/dashboard/NavigationRail.tsx";
const CATALOG = "frontend/e2e/suites/catalog.ts";
const PROBE = "frontend/e2e/regression/evidence/dashboard-drv-v7-overlay-fidelity-probe.spec.ts";

const menuClass = () => {
  const match = /const MENU_SURFACE_CLASS =([\s\S]*?);\n/.exec(read(MENU));
  assert.ok(match, "MENU_SURFACE_CLASS is declared");
  return [...match[1].matchAll(/"([^"]*)"/g)].map((part) => part[1]).join("");
};

test("V7 · the menu surface carries the Drive radius, white surface and three-layer shadow", () => {
  const surface = menuClass();
  for (const literal of [
    "rounded-[4px]",
    "min-w-[200px] max-w-[calc(100vw-1rem)]",
    "[:root:not([data-theme=dark-gray])_&]:bg-white",
    // A raw property: `shadow-[...]` would add Tailwind's four transparent ring layers to the computed value.
    "[:root:not([data-theme=dark-gray])_&]:[box-shadow:0_2px_4px_-1px_rgba(0,0,0,.2),0_4px_5px_0_rgba(0,0,0,.14),0_1px_10px_0_rgba(0,0,0,.12)]",
    "py-2",
    "outline-transparent",
  ]) {
    assert.ok(surface.includes(literal), literal);
  }
  assert.equal(surface.includes("rounded-lg"), false, "the 8 px radius is for filter popovers, not menus");
});

test("V7 · the dark palette is untouched and the menu does not depend on the app shell tree", () => {
  const surface = menuClass();
  assert.ok(surface.includes("bg-popover"), "dark keeps bg-popover");
  assert.ok(surface.includes("shadow-[var(--clinical-shadow-md)]"), "dark keeps the clinical shadow");
  for (const path of [MENU, TOOLTIP]) {
    assert.equal(read(path).includes("dashboard-app-shell"), false, `${path} styles must not need an ancestor it may not have`);
  }
});

test("V7 · menu items keep 32 px from md and the 48 px touch target below it", () => {
  const source = read(MENU);
  assert.ok(source.includes("flex h-12 md:h-8 w-full items-center gap-2 px-3"));
  assert.ok(source.includes("text-[0.8125rem] font-normal leading-5"));
});

test("V7 · the tooltip is the Drive recipe, accessible, ref-free and without motion", () => {
  const source = read(TOOLTIP);
  for (const literal of [
    'role="tooltip"',
    "bg-[#303030]",
    "text-[#f2f2f2]",
    "text-xs font-normal leading-4 tracking-[0.1px]",
    "rounded-[4px]",
    "px-2 py-1",
    "[box-shadow:none]",
    "transition-none",
    '"aria-describedby": open ? id : undefined',
    'event.key === "Escape"',
    'matches(":focus-visible")',
    'event.pointerType === "touch"',
    "onPointerEnter={() => setPending(null)}",
  ]) {
    assert.ok(source.includes(literal), literal);
  }
  assert.equal(/@radix-ui/.test(source), false, "PublicRouteControl owns its ref: no asChild slot");
  assert.equal(/\bref=\{(?!surface)/.test(source), false, "the trigger bag never carries a ref");
  assert.equal(/animate-|duration-|transition-(?!none)/.test(source), false, "no motion to suppress");
});

test("V7 · the rail shows its tooltip once: no native title, same accessible name and navigation", () => {
  const source = read(RAIL);
  assert.equal(source.includes("title="), false);
  assert.ok(source.includes("<DashboardTooltip key={item.moduleId} label={item.label}>"));
  assert.ok(source.includes("aria-label={item.label}"));
  assert.ok(source.includes("{...tooltip}"));
  assert.ok(source.includes("requestAdminModuleActivate(item.moduleId)"));
  assert.ok(source.includes("requestClinicModuleActivate(item.moduleId)"));
});

test("V7 · panels and dialogs are not menus: notifications, kebab and filter chips stay as they are", () => {
  for (const path of [
    "frontend/src/components/dashboard/DashboardNotificationsBell.tsx",
    "frontend/src/components/dashboard/DashboardMobileKebabMenu.tsx",
  ]) {
    const source = read(path);
    assert.equal(/ActionMenu|DashboardTooltip|MENU_SURFACE_CLASS/.test(source), false, path);
  }
  const overflow = read("frontend/src/features/dashboard/presentation/filters/FilterOverflow.tsx");
  assert.equal(/rounded-\[8px\]|h-10|DashboardTooltip/.test(overflow), false, "no filter popover is invented");
  const chips = read("frontend/src/features/dashboard/presentation/filters/FilterChip.tsx");
  assert.equal(/ActionMenu|aria-haspopup/.test(chips), false, "applied chips do not become menu triggers (RM-07/C12)");
});

test("V7 · the overlay probe is catalogued as an evidence generator on the V1 classifier", () => {
  assert.ok(read(CATALOG).includes('"e2e/regression/evidence/dashboard-drv-v7-overlay-fidelity-probe.spec.ts"'));
  const probe = read(PROBE);
  assert.ok(probe.includes('from "../../helpers/drive-fidelity"'));
  assert.ok(probe.includes("classifyMetric"));
  assert.ok(probe.includes("drive-ui-reference.v7-overlays.json"));
});
