import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  assertClean7aDependencyCleanupScope,
  isClean7aAllowedDependencyChange,
  isClean7aAllowedDependencyFile,
} from "./helpers/clean7a-dependency-cleanup-scope.ts";
import { isReportForeignAccessBackendFile } from "./helpers/report-foreign-access-scope.ts";

const GLOBALS_CSS_PATH = "frontend/src/app/globals.css";
const DASHBOARD_MODULE_HUB_PATH =
  "frontend/src/components/dashboard/DashboardModuleHub.tsx";
const DASHBOARD_MODULE_WORKSPACE_PATH =
  "frontend/src/components/dashboard/DashboardModuleWorkspace.tsx";
const DASHBOARD_SHELL_ROUTER_PATH =
  "frontend/src/components/dashboard/DashboardShellRouter.tsx";
const PUBLIC_SEO_SCOPE_EXCEPTION = "frontend/src/lib/seo.ts";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

// ── Motion tokens in globals.css ────────────────────────────────────────────

test("PR-1 globals.css defines --motion-fast token", () => {
  const source = read(GLOBALS_CSS_PATH);
  assert.ok(
    source.includes("--motion-fast: 120ms;"),
    "globals.css must define --motion-fast: 120ms",
  );
});

test("PR-1 globals.css defines --motion-base token", () => {
  const source = read(GLOBALS_CSS_PATH);
  assert.ok(
    source.includes("--motion-base: 180ms;"),
    "globals.css must define --motion-base: 180ms",
  );
});

test("PR-1 globals.css defines --motion-slow token", () => {
  const source = read(GLOBALS_CSS_PATH);
  assert.ok(
    source.includes("--motion-slow: 280ms;"),
    "globals.css must define --motion-slow: 280ms",
  );
});

test("PR-1 globals.css defines --ease-out-soft token", () => {
  const source = read(GLOBALS_CSS_PATH);
  assert.ok(
    source.includes("--ease-out-soft: cubic-bezier(0.16, 1, 0.3, 1);"),
    "globals.css must define --ease-out-soft easing",
  );
});

// ── Interaction utility classes in globals.css ───────────────────────────────

test("PR-1 globals.css defines .dashboard-card-interactive with motion tokens", () => {
  const source = read(GLOBALS_CSS_PATH);
  assert.ok(
    source.includes(".dashboard-card-interactive {"),
    "globals.css must define .dashboard-card-interactive",
  );
  assert.ok(
    source.includes("transition-duration: var(--motion-base);"),
    ".dashboard-card-interactive must use --motion-base token",
  );
  assert.ok(
    source.includes("transition-timing-function: var(--ease-out-soft);"),
    ".dashboard-card-interactive must use --ease-out-soft token",
  );
});

test("PR-1 globals.css defines .dashboard-card-interactive active press state", () => {
  const source = read(GLOBALS_CSS_PATH);
  assert.ok(
    source.includes(".dashboard-card-interactive:active {"),
    ".dashboard-card-interactive must define :active state",
  );
  assert.ok(
    source.includes("transform: scale(0.99);"),
    ".dashboard-card-interactive:active must use scale(0.99) press state",
  );
});

test("PR-1 globals.css defines .dashboard-btn-interactive with motion tokens", () => {
  const source = read(GLOBALS_CSS_PATH);
  assert.ok(
    source.includes(".dashboard-btn-interactive {"),
    "globals.css must define .dashboard-btn-interactive",
  );
  assert.ok(
    source.includes("transition-duration: var(--motion-fast);"),
    ".dashboard-btn-interactive must use --motion-fast token",
  );
});

test("PR-1 globals.css defines .dashboard-btn-interactive active press state", () => {
  const source = read(GLOBALS_CSS_PATH);
  assert.ok(
    source.includes(".dashboard-btn-interactive:active {"),
    ".dashboard-btn-interactive must define :active state",
  );
  assert.ok(
    source.includes("transform: scale(0.98);"),
    ".dashboard-btn-interactive:active must use scale(0.98) press state",
  );
});

test("PR-1 globals.css defines .dashboard-row-interactive for future list rows", () => {
  const source = read(GLOBALS_CSS_PATH);
  assert.ok(
    source.includes(".dashboard-row-interactive {"),
    "globals.css must define .dashboard-row-interactive",
  );
});

test("PR-1 globals.css defines .dashboard-disabled-state", () => {
  const source = read(GLOBALS_CSS_PATH);
  assert.ok(
    source.includes(".dashboard-disabled-state {"),
    "globals.css must define .dashboard-disabled-state",
  );
  assert.ok(
    source.includes("cursor: not-allowed;"),
    ".dashboard-disabled-state must set cursor: not-allowed",
  );
});

// ── Reduced-motion override for interaction classes ──────────────────────────

test("PR-1 globals.css reduced-motion overrides dashboard-card-interactive transition", () => {
  const source = read(GLOBALS_CSS_PATH);
  const rmIndex = source.lastIndexOf("@media (prefers-reduced-motion: reduce)");
  assert.ok(rmIndex >= 0, "globals.css must have at least one prefers-reduced-motion block");

  const rmSection = source.slice(rmIndex);
  assert.ok(
    rmSection.includes(".dashboard-card-interactive,"),
    "reduced-motion block must include .dashboard-card-interactive",
  );
  assert.ok(
    rmSection.includes(".dashboard-btn-interactive,"),
    "reduced-motion block must include .dashboard-btn-interactive",
  );
  assert.ok(
    rmSection.includes(".dashboard-row-interactive {"),
    "reduced-motion block must include .dashboard-row-interactive",
  );
});

test("PR-1 globals.css reduced-motion removes active transform from interaction classes", () => {
  const source = read(GLOBALS_CSS_PATH);
  const rmIndex = source.lastIndexOf("@media (prefers-reduced-motion: reduce)");
  const rmSection = source.slice(rmIndex);
  assert.ok(
    rmSection.includes(".dashboard-card-interactive:active,"),
    "reduced-motion must override .dashboard-card-interactive:active transform",
  );
  assert.ok(
    rmSection.includes(".dashboard-btn-interactive:active {"),
    "reduced-motion must override .dashboard-btn-interactive:active transform",
  );
  assert.ok(
    rmSection.includes("transform: none;"),
    "reduced-motion active states must set transform: none",
  );
});

test("PR-1 globals.css interaction-foundation section is delimited by comments", () => {
  const source = read(GLOBALS_CSS_PATH);
  assert.ok(
    source.includes("/* dashboard-interaction-foundation:start */"),
    "globals.css must have dashboard-interaction-foundation:start comment",
  );
  assert.ok(
    source.includes("/* dashboard-interaction-foundation:end */"),
    "globals.css must have dashboard-interaction-foundation:end comment",
  );
});

// ── Component application ────────────────────────────────────────────────────

test("PR-1 DashboardModuleHub applies dashboard-card-interactive to hub cards", () => {
  const source = read(DASHBOARD_MODULE_HUB_PATH);
  assert.ok(
    source.includes("dashboard-card-interactive"),
    "DashboardModuleHub must use dashboard-card-interactive class on module cards",
  );
});

test("PR-1 DashboardModuleHub does not use hardcoded duration-200 on hub cards", () => {
  const source = read(DASHBOARD_MODULE_HUB_PATH);
  assert.equal(
    source.includes('"transition-[border-color,box-shadow] duration-200"'),
    false,
    "DashboardModuleHub must not use hardcoded duration-200; use dashboard-card-interactive instead",
  );
});

test("PR-1 DashboardModuleHub keeps data-dashboard-module-hub and data-dashboard-module-card attributes", () => {
  const source = read(DASHBOARD_MODULE_HUB_PATH);
  assert.ok(
    source.includes('data-dashboard-module-hub="true"'),
    "DashboardModuleHub must keep data-dashboard-module-hub attribute",
  );
  assert.ok(
    source.includes("data-dashboard-module-card={card.moduleId}"),
    "DashboardModuleHub must keep data-dashboard-module-card attribute",
  );
});

test("PR-1 DashboardModuleHub keeps focus-visible ring for keyboard navigation", () => {
  const source = read(DASHBOARD_MODULE_HUB_PATH);
  assert.ok(
    source.includes("focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2"),
    "DashboardModuleHub must keep explicit focus-visible ring classes",
  );
});

test("PR-1 DashboardModuleWorkspace Volver button applies dashboard-btn-interactive", () => {
  const source = read(DASHBOARD_MODULE_WORKSPACE_PATH);
  assert.ok(
    source.includes("dashboard-btn-interactive"),
    "DashboardModuleWorkspace Volver button must use dashboard-btn-interactive class",
  );
});

test("PR-1 DashboardModuleWorkspace keeps focus-visible ring on Volver button", () => {
  const source = read(DASHBOARD_MODULE_WORKSPACE_PATH);
  assert.ok(
    source.includes("focus-visible:ring-2 focus-visible:ring-ring/85 focus-visible:ring-offset-2"),
    "DashboardModuleWorkspace Volver button must keep focus-visible ring",
  );
});

test("PR-1 DashboardModuleWorkspace keeps data-dashboard-module-workspace attribute", () => {
  const source = read(DASHBOARD_MODULE_WORKSPACE_PATH);
  assert.ok(
    source.includes("data-dashboard-module-workspace={moduleId}"),
    "DashboardModuleWorkspace must keep data-dashboard-module-workspace attribute",
  );
});

// ── No global scroll introduced ──────────────────────────────────────────────

test("PR-1 DashboardShellRouter keeps h-dvh overflow-hidden preventing global scroll", () => {
  const source = read(DASHBOARD_SHELL_ROUTER_PATH);
  assert.ok(
    source.includes("h-dvh overflow-hidden"),
    "DashboardShellRouter must keep h-dvh overflow-hidden to prevent global scroll",
  );
});

// ── No AdminSectionTabs as navigation ───────────────────────────────────────

test("PR-1 dashboard shell router does not use AdminSectionTabs as navigation", () => {
  const source = read(DASHBOARD_SHELL_ROUTER_PATH);
  assert.equal(
    source.includes('import { AdminSectionTabs }'),
    false,
    "DashboardShellRouter must not import AdminSectionTabs as navigation",
  );
});

// ── No new dependencies ──────────────────────────────────────────────────────

test("PR-1 interaction foundation does not add new dependencies to package.json", () => {
  const changedFiles = execFileSync("git", ["diff", "--name-only"], {
    encoding: "utf8",
  })
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);

  const depFiles = changedFiles.filter(
    (f) =>
      f === "package.json" ||
      f === "pnpm-lock.yaml" ||
      f === "frontend/package.json" ||
      f === "frontend/pnpm-lock.yaml",
  );

  assertClean7aDependencyCleanupScope();
  assert.deepEqual(
    depFiles.filter((file) => !isClean7aAllowedDependencyFile(file)),
    [],
    `PR-1 must not add new dependencies; modified dep files: ${depFiles.join(", ")}`,
  );
});

// ── Scope guard ──────────────────────────────────────────────────────────────

test("PR-1 interaction foundation stays within allowed file scope", () => {
  const changedFiles = execFileSync("git", ["diff", "--name-only"], {
    encoding: "utf8",
  })
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);

  const blockedPrefixes = [
    "server/",
    "drizzle/",
    "shared/",
    "frontend/src/app/api/",
    "frontend/src/middleware",
    "frontend/src/app/histopatologia-veterinaria/",
  ];

  const blockedExactFiles = [
    "package.json",
    "pnpm-lock.yaml",
    "frontend/package.json",
    "frontend/pnpm-lock.yaml",
    "frontend/next-env.d.ts",
    "frontend/tsconfig.json",
    "frontend/src/app/layout.tsx",
    "frontend/src/lib/auth.ts",
    "frontend/src/lib/seo.ts",
    "frontend/src/middleware.ts",
  ];

  for (const file of changedFiles) {
    if (isClean7aAllowedDependencyChange(file)) continue;
    if (isReportForeignAccessBackendFile(file)) continue;
    if (file === "server/routes/contact.fastify.ts") continue;
    // Exact shared public SEO exception: this PR intentionally updates
    // OpenGraph/Twitter metadata without changing dashboard behavior.
    if (file === PUBLIC_SEO_SCOPE_EXCEPTION) continue;
    assert.equal(
      blockedPrefixes.some((prefix) => file.startsWith(prefix)),
      false,
      `PR-1 must not touch blocked prefix: ${file}`,
    );
    assert.equal(
      blockedExactFiles.includes(file),
      false,
      `PR-1 must not modify blocked file: ${file}`,
    );
  }
});
