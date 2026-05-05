import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const workflowPath = resolve(
  process.cwd(),
  ".github",
  "workflows",
  "frontend-ci.yml",
);

function readWorkflow(): string {
  return readFileSync(workflowPath, "utf8").replace(/\r\n/g, "\n");
}

function assertContains(source: string, expected: string): void {
  assert.ok(
    source.includes(expected),
    `frontend-ci.yml debe contener: ${expected}`,
  );
}

function assertOrdered(source: string, expectedItems: readonly string[]): void {
  let lastIndex = -1;

  for (const item of expectedItems) {
    const index = source.indexOf(item);

    assert.notEqual(index, -1, `frontend-ci.yml debe contener: ${item}`);
    assert.ok(
      index > lastIndex,
      `frontend-ci.yml debe mantener el orden esperado para: ${item}`,
    );

    lastIndex = index;
  }
}

test("Frontend CI dispara en push y pull_request para rutas de frontend", () => {
  const source = readWorkflow();

  assertContains(source, "on:");
  assertContains(source, "push:");
  assertContains(source, "pull_request:");
  assertContains(source, "branches:");
  assertContains(source, "  contents: read");

  for (const pathPattern of [
    "      - 'frontend/**'",
    "      - 'pnpm-lock.yaml'",
    "      - 'pnpm-workspace.yaml'",
    "      - 'package.json'",
    "      - '.github/workflows/frontend-ci.yml'",
  ]) {
    assertContains(source, pathPattern);
  }
});

test("Frontend CI define toolchain y cache de pnpm esperados", () => {
  const source = readWorkflow();

  assertContains(source, "uses: pnpm/action-setup@v6");
  assertContains(source, "uses: actions/setup-node@v6");
  assertContains(source, "node-version: 24");
  assertContains(source, "cache: pnpm");
  assertContains(source, "cache-dependency-path: pnpm-lock.yaml");
  assertContains(source, "run: pnpm install --frozen-lockfile");
});

test("Frontend CI ejecuta gates obligatorios en orden", () => {
  const source = readWorkflow();

  assertOrdered(source, [
    "      - name: Install dependencies\n        run: pnpm install --frozen-lockfile",
    "      - name: Lint frontend\n        run: pnpm --dir frontend lint",
    "      - name: Typecheck frontend\n        run: pnpm --dir frontend typecheck",
    "      - name: Build frontend\n        run: pnpm --dir frontend build",
    "      - name: Install Playwright browsers\n        run: pnpm --dir frontend exec playwright install --with-deps chromium",
    "      - name: Run frontend E2E smoke tests\n        run: pnpm --dir frontend e2e",
  ]);
});

test("Frontend CI sube reporte de Playwright solo en fallo", () => {
  const source = readWorkflow();

  assertContains(source, "      - name: Upload Playwright report");
  assertContains(source, "        if: failure()");
  assertContains(source, "        uses: actions/upload-artifact@v4");
  assertContains(source, "          name: frontend-playwright-report");
  assertContains(source, "          path: frontend/playwright-report/");
  assertContains(source, "          if-no-files-found: ignore");
});
