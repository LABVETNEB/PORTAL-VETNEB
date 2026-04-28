import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const workflowPath = resolve(
  process.cwd(),
  ".github",
  "workflows",
  "backend-ci.yml",
);

function readWorkflow(): string {
  return readFileSync(workflowPath, "utf8").replace(/\r\n/g, "\n");
}

function assertContains(source: string, expected: string): void {
  assert.ok(
    source.includes(expected),
    `backend-ci.yml debe contener: ${expected}`,
  );
}

function assertOrdered(source: string, expectedItems: readonly string[]): void {
  let lastIndex = -1;

  for (const item of expectedItems) {
    const index = source.indexOf(item);

    assert.notEqual(index, -1, `backend-ci.yml debe contener: ${item}`);
    assert.ok(
      index > lastIndex,
      `backend-ci.yml debe mantener el orden esperado para: ${item}`,
    );

    lastIndex = index;
  }
}

test("Backend CI cubre los prefijos de ramas usados por el flujo de PRs", () => {
  const source = readWorkflow();

  assertContains(source, "pull_request:");
  assertContains(source, "push:");

  for (const branchPattern of [
    "main",
    "chore/**",
    "feat/**",
    "fix/**",
    "refactor/**",
    "ci/**",
    "test/**",
    "codex/**",
  ]) {
    assertContains(source, `      - ${branchPattern}`);
  }
});

test("Backend CI mantiene Postgres efímero y migraciones antes de validaciones", () => {
  const source = readWorkflow();

  assertContains(source, "postgres:");
  assertContains(source, "image: postgres:16");
  assertContains(source, "POSTGRES_DB: portal_vetneb_ci");
  assertContains(
    source,
    "DATABASE_URL: postgresql://postgres:postgres@localhost:5432/portal_vetneb_ci",
  );
  assertContains(
    source,
    "SUPABASE_DB_URL: postgresql://postgres:postgres@localhost:5432/portal_vetneb_ci",
  );

  assertOrdered(source, [
    "      - name: Install dependencies\n        run: pnpm install --frozen-lockfile",
    "      - name: Run database migrations\n        run: pnpm db:migrate",
    "      - name: Typecheck\n        run: pnpm typecheck",
  ]);
});

test("Backend CI ejecuta todos los gates obligatorios en orden", () => {
  const source = readWorkflow();

  assertOrdered(source, [
    "      - name: Run database migrations\n        run: pnpm db:migrate",
    "      - name: Typecheck\n        run: pnpm typecheck",
    "      - name: Typecheck tests\n        run: pnpm typecheck:test",
    "      - name: Test\n        run: pnpm test",
    "      - name: Build\n        run: pnpm build",
  ]);
});
