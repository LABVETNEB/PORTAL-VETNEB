import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { extname, resolve } from "node:path";
import test from "node:test";
import { readSourceFile as read, listSourceFiles } from "../../../helpers/tracked-source-files.ts";

// R-09 cleanup guard: AdminMobileSessionsModule and AdminMobileUsersModule
// were reduced to pure `return null` compat shims by PR-SRV-1/PR-SRV-2 once
// AdminSessionsReadOnlyCard/AdminUsersRolesReadOnlyCard collapsed desktop and
// mobile into one server-adaptive runtime. This test pins their removal so
// neither the dead files nor a runtime import of them can silently reappear.

const ADMIN_ROOT = "frontend/src/app/dashboard/admin";
const CODE_EXTENSIONS = new Set([".ts", ".tsx"]);

const REMOVED_FILES = [
  `${ADMIN_ROOT}/AdminMobileSessionsModule.tsx`,
  `${ADMIN_ROOT}/AdminMobileUsersModule.tsx`,
];

const REMOVED_SYMBOLS = ["AdminMobileSessionsModule", "AdminMobileUsersModule"];

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

test("admin mobile compat shims stay deleted", () => {
  const surviving = REMOVED_FILES.filter((file) => existsSync(resolve(process.cwd(), file)));

  assert.deepEqual(
    surviving,
    [],
    `Compat shim files must stay deleted: ${surviving.join(", ")}`,
  );
});

test("admin runtime never reintroduces imports of the removed compat shims", () => {
  const files = collectFiles(ADMIN_ROOT).filter(isAdminCodeFile);

  const violations = files.flatMap((file) => {
    const source = read(file);
    return REMOVED_SYMBOLS.filter((symbol) => source.includes(symbol)).map(
      (symbol) => `${file} references ${symbol}`,
    );
  });

  assert.deepEqual(
    violations,
    [],
    `Removed compat shims must not be referenced from Admin runtime: ${violations.join(", ")}`,
  );
});
