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

type ExecutableUse = {
  line: number;
  repository: string;
  ref: string;
  reference: string;
};

function readWorkflow(): string {
  return readFileSync(workflowPath, "utf8").replace(/\r\n/g, "\n");
}

function assertContains(source: string, expected: string): void {
  assert.ok(
    source.includes(expected),
    `frontend-ci.yml debe contener: ${expected}`,
  );
}

function executableUses(source: string): ExecutableUse[] {
  const uses: ExecutableUse[] = [];
  let blockScalarIndent: number | null = null;

  source.split("\n").forEach((line, index) => {
    const indent = line.match(/^ */)?.[0].length ?? 0;
    if (blockScalarIndent !== null) {
      if (indent > blockScalarIndent) return;
      blockScalarIndent = null;
    }

    const pair = line.match(/^\s*(?:-\s*)?([A-Za-z0-9_.-]+):(?:\s*(.*))?$/);
    if (pair && /^(?:\||>)(?:[-+])?$/.test((pair[2] ?? "").trim())) {
      blockScalarIndent = indent;
    }

    const match = line.match(/^\s*(?:-\s*)?uses:\s*([^#\s]+)/);
    if (!match) return;

    const reference = match[1];
    const atIndex = reference.lastIndexOf("@");
    assert.notEqual(atIndex, -1, `frontend-ci.yml executable uses must include @: ${reference}`);

    uses.push({
      line: index + 1,
      repository: reference.slice(0, atIndex),
      ref: reference.slice(atIndex + 1),
      reference,
    });
  });

  return uses;
}

function assertExecutableUsesPinned(source: string, expectedRepositories: readonly string[]): void {
  const uses = executableUses(source);

  assert.deepEqual(
    uses.map((entry) => entry.repository),
    expectedRepositories,
  );

  for (const entry of uses) {
    assert.match(entry.ref, /^[0-9a-f]{40}$/, `frontend-ci.yml mutable executable ref at line ${entry.line}: ${entry.reference}`);
  }
}

function assertNoLegacyMutableActionTags(source: string): void {
  for (const legacyReference of [
    "actions/checkout@v7",
    "actions/setup-node@v6",
    "pnpm/action-setup@v4",
    "actions/upload-artifact@v7",
  ]) {
    assert.ok(!source.includes(legacyReference), `frontend-ci.yml conserva referencia mutable legacy: ${legacyReference}`);
  }
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
  assertExecutableUsesPinned(source, [
    "actions/checkout",
    "pnpm/action-setup",
    "actions/setup-node",
    "actions/upload-artifact",
  ]);
  assertNoLegacyMutableActionTags(source);
  assertContains(source, "version: 10.8.1");
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
    "      - name: Run frontend E2E layered tests\n        run: |\n          set +e\n\n          pnpm --dir frontend e2e:smoke\n          smoke_status=$?\n\n          pnpm --dir frontend e2e:admin-mobile\n          admin_mobile_status=$?\n\n          pnpm --dir frontend e2e:visual-contract\n          visual_contract_status=$?\n\n          pnpm --dir frontend e2e:public-clinic\n          public_clinic_status=$?\n\n          if [ \"$smoke_status\" -ne 0 ] || [ \"$admin_mobile_status\" -ne 0 ] || [ \"$visual_contract_status\" -ne 0 ] || [ \"$public_clinic_status\" -ne 0 ]; then\n            exit 1\n          fi",
  ]);
});

test("Frontend CI sube reporte de Playwright solo en fallo", () => {
  const source = readWorkflow();

  assertContains(source, "      - name: Upload Playwright report");
  assertContains(source, "        if: failure()");
  assert.ok(
    executableUses(source).some(
      (entry) => entry.repository === "actions/upload-artifact" && /^[0-9a-f]{40}$/.test(entry.ref),
    ),
    "frontend-ci.yml debe subir artifact con referencia ejecutable pinneada",
  );
  assertContains(source, "          name: frontend-playwright-report");
  assertContains(source, "          path: frontend/playwright-report/");
  assertContains(source, "          if-no-files-found: ignore");
});

test("Frontend CI executable uses parser rejects mutable refs", () => {
  for (const reference of ["actions/setup-node@v6", "actions/setup-node@main"]) {
    assert.throws(
      () => assertExecutableUsesPinned(`steps:\n  - uses: ${reference}\n`, ["actions/setup-node"]),
      /mutable executable ref/,
    );
  }
});
