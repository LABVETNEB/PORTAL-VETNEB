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

const frontendPathFilters = [
  "      - 'frontend/**'",
  "      - 'pnpm-lock.yaml'",
  "      - 'pnpm-workspace.yaml'",
  "      - 'package.json'",
  "      - '.github/workflows/frontend-ci.yml'",
] as const;

function readWorkflow(): string {
  return readFileSync(workflowPath, "utf8").replace(/\r\n/g, "\n");
}

function assertContains(source: string, expected: string): void {
  assert.ok(
    source.includes(expected),
    `frontend-ci.yml debe contener: ${expected}`,
  );
}

function assertNotContains(source: string, unexpected: string): void {
  assert.ok(!source.includes(unexpected), `frontend-ci.yml no debe contener: ${unexpected}`);
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

function getEventBlock(source: string, eventName: string): string {
  const eventHeader = `  ${eventName}:\n`;
  const eventStart = source.indexOf(eventHeader);

  assert.notEqual(
    eventStart,
    -1,
    `frontend-ci.yml debe contener el evento: ${eventName}`,
  );

  const afterEventHeader = eventStart + eventHeader.length;
  const nextEventMatch = source.slice(afterEventHeader).match(/\n  [a-z_]+:\n/);
  const nextEventIndex =
    nextEventMatch && typeof nextEventMatch.index === "number"
      ? nextEventMatch.index
      : -1;
  const eventEnd =
    nextEventIndex >= 0 ? afterEventHeader + nextEventIndex + 1 : source.length;

  return source.slice(eventStart, eventEnd);
}

function assertEventPathFilters(source: string, eventName: string): void {
  const eventBlock = getEventBlock(source, eventName);

  assertContains(eventBlock, "    branches:");
  assertContains(eventBlock, "      - main");
  assertContains(eventBlock, "    paths:");

  for (const pathPattern of frontendPathFilters) {
    assertContains(eventBlock, pathPattern);
  }
}

test("Frontend CI dispara en push y pull_request para rutas de frontend", () => {
  const source = readWorkflow();

  assertContains(source, "on:");
  assertContains(source, "push:");
  assertContains(source, "pull_request:");
  assertContains(source, "  contents: read");
  assertContains(
    source,
    "concurrency:\n  group: frontend-ci-${{ github.workflow }}-${{ github.ref }}\n  cancel-in-progress: true",
  );

  assertEventPathFilters(source, "push");
  assertEventPathFilters(source, "pull_request");
});

test("Frontend CI define toolchain y cache de pnpm esperados", () => {
  const source = readWorkflow();

  assertContains(source, "timeout-minutes: 20");
  assertContains(source, "uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0 # v7");
  assertContains(source, "uses: pnpm/action-setup@0ebf47130e4866e96fce0953f49152a61190b271 # v6.0.9");
  assertContains(source, "uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7");
  assertContains(source, "uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7");
  assertNotContains(source, "uses: actions/checkout@v7");
  assertNotContains(source, "uses: pnpm/action-setup@v6");
  assertNotContains(source, "uses: actions/setup-node@v7");
  assertNotContains(source, "uses: actions/upload-artifact@v7");
  assertContains(source, "version: 11.13.0");
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
    "      - name: Audit built public surface\n        run: pnpm security:public-surface",
    "      - name: Install Playwright browsers\n        run: pnpm --dir frontend exec playwright install --with-deps chromium",
    "      - name: Run frontend E2E layered tests\n        run: pnpm --dir frontend e2e:ci",
  ]);
});

test("Frontend CI usa una sola invocación Playwright catalogada", () => {
  const source = readWorkflow();

  assertContains(
    source,
    "      - name: Run frontend E2E layered tests\n        run: pnpm --dir frontend e2e:ci",
  );

  for (const legacyCommand of [
    "pnpm --dir frontend e2e:smoke",
    "pnpm --dir frontend e2e:admin-mobile",
    "pnpm --dir frontend e2e:visual-contract",
    "pnpm --dir frontend e2e:public-clinic",
  ]) {
    assertNotContains(source, legacyCommand);
  }
});

test("Frontend CI sube reporte de Playwright solo en fallo", () => {
  const source = readWorkflow();

  assertContains(source, "      - name: Upload Playwright report");
  assertContains(source, "        if: failure()");
  assertContains(source, "        uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7");
  assertContains(source, "          name: frontend-playwright-report");
  assertContains(source, "          path: frontend/playwright-report/");
  assertContains(source, "          if-no-files-found: ignore");
});
