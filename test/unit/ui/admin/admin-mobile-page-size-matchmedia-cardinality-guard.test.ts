import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { extname, resolve } from "node:path";
import test from "node:test";
import { readSourceFile as read, listSourceFiles } from "../../../helpers/tracked-source-files.ts";

// R-08 cleanup guard: MOBILE_PAGE_SIZE and matchMedia-as-cardinality were
// removed module-by-module across PR-SRV-1/PR-SRV-2 (Sessions, Roles,
// Clinics, Reports, Tokens, Audit, FailedLogin Alerts). This test pins that
// state so neither source of truth can silently reappear in Admin runtime.

const ADMIN_ROOT = "frontend/src/app/dashboard/admin";
const MAINTENANCE_MODULE = `${ADMIN_ROOT}/AdminMobileMaintenanceModule.tsx`;
const CODE_EXTENSIONS = new Set([".ts", ".tsx"]);

// These three modules keep a real `window.matchMedia` call, but only to gate
// which lazy mobile chunk loads (schema health / maintenance / pricing
// panels) — never to decide row count, limit, offset, or pagination. They
// are explicitly out of scope for the cardinality migration (see
// docs/audit/final-global-vetneb-50-60-pr-roadmap.md R-08).
//
// Pre-C05 mobile space adds the workspace controller: its matchMedia only
// decides the navigation REGIME (below 768px the retired admin hub lands on a
// module); it never reads or sets row count, limit, offset or pagination.
const NON_CARDINAL_MATCHMEDIA_ALLOWLIST = new Set([
  `${ADMIN_ROOT}/AdminMobileHealthModule.tsx`,
  MAINTENANCE_MODULE,
  `${ADMIN_ROOT}/AdminMobilePricingModule.tsx`,
]);

test("the controller owns no matchMedia and no cardinality", () => {
  // The mobile-regime hub gate left with the desktop/tablet space pass: the
  // hub is retired at every width, so the controller queries no media at all.
  const source = read(`${ADMIN_ROOT}/AdminDashboardWorkspaceController.tsx`);
  assert.equal(source.includes("matchMedia"), false, "no regime query survives");
  assert.equal(/limit|offset|rowsPerPage|pageSize|capacity/i.test(source), false,
    "the controller owns no cardinality");
});

function collectFiles(relativeRoot: string): string[] {
  const absoluteRoot = resolve(process.cwd(), relativeRoot);
  if (!existsSync(absoluteRoot)) {
    return [];
  }

  return listSourceFiles(absoluteRoot).map((file) => `${relativeRoot}/${file}`);
}

function isAdminCodeFile(file: string): boolean {
  return (
    CODE_EXTENSIONS.has(extname(file).toLowerCase()) &&
    !/\.(test|spec)\.[cm]?[jt]sx?$/i.test(file)
  );
}

test("admin runtime never reintroduces MOBILE_PAGE_SIZE as a source of truth", () => {
  const files = collectFiles(ADMIN_ROOT).filter(isAdminCodeFile);
  const violations = files.filter((file) => read(file).includes("MOBILE_PAGE_SIZE"));

  assert.deepEqual(
    violations,
    [],
    `MOBILE_PAGE_SIZE must not reappear in Admin runtime: ${violations.join(", ")}`,
  );
});

test("admin runtime never reintroduces matchMedia as a cardinality source outside the documented lazy-load allowlist", () => {
  const files = collectFiles(ADMIN_ROOT).filter(isAdminCodeFile);
  const matchMediaFiles = files.filter((file) => read(file).includes("matchMedia"));
  const violations = matchMediaFiles.filter((file) => !NON_CARDINAL_MATCHMEDIA_ALLOWLIST.has(file));

  assert.deepEqual(
    violations,
    [],
    `matchMedia must not decide cardinality outside the lazy-load allowlist: ${violations.join(", ")}`,
  );
});

test("non-cardinal matchMedia allowlist only contains files that still exist and use matchMedia", () => {
  const stale = Array.from(NON_CARDINAL_MATCHMEDIA_ALLOWLIST).filter((file) => {
    if (!existsSync(resolve(process.cwd(), file))) {
      return true;
    }
    return !read(file).includes("matchMedia");
  });

  assert.deepEqual(
    stale,
    [],
    `Allowlist entries must exist and still use matchMedia (remove stale entries): ${stale.join(", ")}`,
  );
});

test("maintenance dry-run resets the adaptive pager before publishing a fresh snapshot", () => {
  const source = read(MAINTENANCE_MODULE);
  const fetchIndex = source.indexOf(
    "const nextSnapshot = await getAdminMaintenancePurgeDryRun();",
  );
  const resetIndex = source.indexOf("pagedCandidates.setPage(0);");
  const publishIndex = source.indexOf("setSnapshot(nextSnapshot);");

  assert.ok(fetchIndex >= 0, "the successful dry-run must name the fresh snapshot");
  assert.ok(
    resetIndex > fetchIndex,
    "the adaptive pager must reset after the fresh snapshot resolves",
  );
  assert.ok(
    publishIndex > resetIndex,
    "the first-page cursor must be queued before the fresh snapshot is published",
  );
  assert.doesNotMatch(
    source,
    /useEffect\(\(\) => \{\s*pagedCandidates\.setPage\(0\);[\s\S]*?\}, \[snapshot\]\);/,
    "a passive snapshot effect must not reintroduce an intermediate stale cursor render",
  );
});
