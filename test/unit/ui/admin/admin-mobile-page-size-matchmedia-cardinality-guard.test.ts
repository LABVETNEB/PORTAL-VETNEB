import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, resolve } from "node:path";
import test from "node:test";

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
const NON_CARDINAL_MATCHMEDIA_ALLOWLIST = new Set([
  `${ADMIN_ROOT}/AdminMobileHealthModule.tsx`,
  MAINTENANCE_MODULE,
  `${ADMIN_ROOT}/AdminMobilePricingModule.tsx`,
]);

function collectFiles(relativeRoot: string): string[] {
  const absoluteRoot = resolve(process.cwd(), relativeRoot);
  if (!existsSync(absoluteRoot)) {
    return [];
  }

  const files: string[] = [];
  const workspacePrefix = resolve(process.cwd(), "").replace(/\\/g, "/") + "/";

  function walk(currentPath: string): void {
    for (const entry of readdirSync(currentPath)) {
      const fullPath = `${currentPath}/${entry}`;
      const info = statSync(fullPath);
      if (info.isDirectory()) {
        walk(fullPath);
        continue;
      }
      files.push(fullPath.replace(/\\/g, "/").replace(workspacePrefix, ""));
    }
  }

  walk(absoluteRoot.replace(/\\/g, "/"));
  return files;
}

function isAdminCodeFile(file: string): boolean {
  return (
    CODE_EXTENSIONS.has(extname(file).toLowerCase()) &&
    !/\.(test|spec)\.[cm]?[jt]sx?$/i.test(file)
  );
}

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");
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
