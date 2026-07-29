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

function getTopLevelBlock(
  source: string,
  header: string,
  nextHeaderPattern: RegExp,
): string {
  const start = source.indexOf(header);

  assert.notEqual(
    start,
    -1,
    `frontend-ci.yml debe contener: ${header.trim()}`,
  );

  const afterHeader = start + header.length;
  const nextMatch = source.slice(afterHeader).match(nextHeaderPattern);
  const nextIndex =
    nextMatch && typeof nextMatch.index === "number" ? nextMatch.index : -1;
  const end = nextIndex >= 0 ? afterHeader + nextIndex + 1 : source.length;

  return source.slice(start, end);
}

function getEventBlock(source: string, eventName: string): string {
  return getTopLevelBlock(
    source,
    `  ${eventName}:\n`,
    /\n  [a-z_]+:\n/,
  );
}

function getJobBlock(source: string, jobName: string): string {
  return getTopLevelBlock(
    source,
    `  ${jobName}:\n`,
    /\n  [a-z0-9-]+:\n/,
  );
}

test("Frontend CI dispara todo pull request a main y preserva filtros de push", () => {
  const source = readWorkflow();
  const push = getEventBlock(source, "push");
  const pullRequest = getEventBlock(source, "pull_request");

  assertContains(source, "on:");
  assertContains(source, "  contents: read");
  assertContains(
    source,
    "concurrency:\n  group: frontend-ci-${{ github.workflow }}-${{ github.ref }}\n  cancel-in-progress: true",
  );

  assertContains(push, "    branches:\n      - main");
  assertContains(push, "    paths:");
  for (const pathPattern of frontendPathFilters) {
    assertContains(push, pathPattern);
  }

  assertContains(pullRequest, "    branches:\n      - main");
  assertNotContains(pullRequest, "paths:");
  for (const pathPattern of frontendPathFilters) {
    assertNotContains(pullRequest, pathPattern);
  }
});

test("Frontend CI detecta impacto con rango PR seguro, push pesado y fallo cerrado", () => {
  const detector = getJobBlock(readWorkflow(), "detect-frontend-impact");

  assertContains(
    detector,
    "outputs:\n      should_run: ${{ steps.detect.outputs.should_run }}",
  );
  assertContains(
    detector,
    "uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7\n        with:\n          fetch-depth: 0",
  );
  assertContains(detector, "EVENT_NAME: ${{ github.event_name }}");
  assertContains(detector, "BASE_SHA: ${{ github.event.pull_request.base.sha }}");
  assertContains(detector, "HEAD_SHA: ${{ github.event.pull_request.head.sha }}");
  assertContains(
    detector,
    'if [[ "$EVENT_NAME" == "push" ]]; then\n            echo "should_run=true" >> "$GITHUB_OUTPUT"',
  );
  assertContains(detector, 'if [[ "$EVENT_NAME" != "pull_request" ]]');
  assertContains(detector, 'if [[ ! "$BASE_SHA" =~ ^[0-9a-f]{40}$ || ! "$HEAD_SHA" =~ ^[0-9a-f]{40}$ ]]');
  assertContains(detector, 'git cat-file -e "${BASE_SHA}^{commit}"');
  assertContains(detector, 'git cat-file -e "${HEAD_SHA}^{commit}"');
  assertContains(
    detector,
    'git diff --name-only -z --diff-filter=ACDMRTUXB "$BASE_SHA" "$HEAD_SHA" > "$changed_file_list"',
  );
  assertNotContains(detector, "continue-on-error");
});

test("Frontend CI usa exactamente las cinco rutas vigentes para solicitar heavy", () => {
  const detector = getJobBlock(readWorkflow(), "detect-frontend-impact");

  assertContains(
    detector,
    `          should_run=false
          while IFS= read -r -d '' changed_path; do
            case "$changed_path" in
              frontend/*|pnpm-lock.yaml|pnpm-workspace.yaml|package.json|.github/workflows/frontend-ci.yml)
                should_run=true
                break
                ;;
            esac
          done < "$changed_file_list"

          echo "should_run=$should_run" >> "$GITHUB_OUTPUT"`,
  );
  assertNotContains(detector, ".github/workflows/backend-ci.yml)");
});

test("Frontend CI condiciona el job pesado al output del detector", () => {
  const heavy = getJobBlock(readWorkflow(), "validate-frontend");

  assertContains(heavy, "name: frontend-heavy-validation");
  assertContains(heavy, "needs: detect-frontend-impact");
  assertContains(
    heavy,
    "if: ${{ needs.detect-frontend-impact.outputs.should_run == 'true' }}",
  );
});

test("Frontend CI define toolchain y cache de pnpm esperados", () => {
  const source = readWorkflow();
  const heavy = getJobBlock(source, "validate-frontend");

  assertContains(heavy, "timeout-minutes: 20");
  assertContains(source, "uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7");
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
  const heavy = getJobBlock(readWorkflow(), "validate-frontend");

  assertOrdered(heavy, [
    "      - name: Install dependencies\n        run: pnpm install --frozen-lockfile",
    "      - name: Lint frontend\n        run: pnpm --dir frontend lint",
    "      - name: Typecheck frontend\n        run: pnpm --dir frontend typecheck",
    "      - name: Build frontend\n        run: pnpm --dir frontend build\n        env:\n          NEXT_PUBLIC_API_URL: http://127.0.0.1:3107\n          VETNEB_E2E_ALLOW_LOCAL_API: \"1\"\n          VETNEB_E2E_DISABLE_EXTERNAL_EMBEDS: \"1\"",
    "      - name: Audit built public surface\n        run: pnpm security:public-surface",
    "      - name: Install Playwright browsers\n        run: pnpm --dir frontend exec playwright install --with-deps chromium",
    "      - name: Run frontend E2E layered tests\n        run: pnpm --dir frontend e2e:ci\n        env:\n          VETNEB_E2E_PRODUCTION_RUNNER: \"1\"",
  ]);
});

test("Frontend CI compila el bundle E2E con la URL pública del fixture", () => {
  const source = getJobBlock(readWorkflow(), "validate-frontend");

  assertContains(
    source,
    "      - name: Build frontend\n        run: pnpm --dir frontend build\n        env:\n          NEXT_PUBLIC_API_URL: http://127.0.0.1:3107\n          VETNEB_E2E_ALLOW_LOCAL_API: \"1\"\n          VETNEB_E2E_DISABLE_EXTERNAL_EMBEDS: \"1\"",
  );

  assertOrdered(source, [
    "      - name: Build frontend\n        run: pnpm --dir frontend build\n        env:\n          NEXT_PUBLIC_API_URL: http://127.0.0.1:3107\n          VETNEB_E2E_ALLOW_LOCAL_API: \"1\"\n          VETNEB_E2E_DISABLE_EXTERNAL_EMBEDS: \"1\"",
    "      - name: Audit built public surface\n        run: pnpm security:public-surface",
    "      - name: Install Playwright browsers\n        run: pnpm --dir frontend exec playwright install --with-deps chromium",
    "      - name: Run frontend E2E layered tests\n        run: pnpm --dir frontend e2e:ci\n        env:\n          VETNEB_E2E_PRODUCTION_RUNNER: \"1\"",
  ]);
});

test("Frontend CI usa una sola invocación Playwright catalogada", () => {
  const source = readWorkflow();
  const heavy = getJobBlock(source, "validate-frontend");

  assertContains(
    heavy,
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

test("Frontend CI activa el runner productivo únicamente en el step e2e:ci (P1 PR #1495)", () => {
  const source = readWorkflow();
  const heavy = getJobBlock(source, "validate-frontend");

  // Other workflows (e.g. visual-regression-manual.yml) run Playwright with
  // CI=true but never `pnpm --dir frontend build`; VETNEB_E2E_PRODUCTION_RUNNER
  // must stay scoped to this single step, never promoted to job/workflow env.
  const occurrences = source.match(/VETNEB_E2E_PRODUCTION_RUNNER/g);
  assert.equal(
    occurrences?.length,
    1,
    "VETNEB_E2E_PRODUCTION_RUNNER must appear exactly once in frontend-ci.yml",
  );

  assertContains(
    heavy,
    "      - name: Run frontend E2E layered tests\n        run: pnpm --dir frontend e2e:ci\n        env:\n          VETNEB_E2E_PRODUCTION_RUNNER: \"1\"",
  );
});

test("Frontend CI sube reporte de Playwright solo en fallo", () => {
  const source = getJobBlock(readWorkflow(), "validate-frontend");

  assertContains(source, "      - name: Upload Playwright report");
  assertContains(source, "        if: failure()");
  assertContains(source, "        uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7");
  assertContains(source, "          name: frontend-playwright-report");
  assertContains(source, "          path: frontend/playwright-report/");
  assertContains(source, "          if-no-files-found: ignore");
});

test("Frontend CI publica un check final siempre presente con propagación estricta", () => {
  const finalCheck = getJobBlock(readWorkflow(), "frontend-check");

  assertContains(finalCheck, "name: validate-frontend");
  assertContains(
    finalCheck,
    "needs:\n      - detect-frontend-impact\n      - validate-frontend",
  );
  assertContains(finalCheck, "if: ${{ always() }}");
  assertContains(
    finalCheck,
    "DETECTOR_RESULT: ${{ needs.detect-frontend-impact.result }}",
  );
  assertContains(
    finalCheck,
    "SHOULD_RUN: ${{ needs.detect-frontend-impact.outputs.should_run }}",
  );
  assertContains(
    finalCheck,
    "HEAVY_RESULT: ${{ needs.validate-frontend.result }}",
  );
  assertContains(
    finalCheck,
    'if [[ "$DETECTOR_RESULT" != "success" ]]; then',
  );
  assertContains(
    finalCheck,
    'if [[ "$SHOULD_RUN" == "false" && "$HEAVY_RESULT" == "skipped" ]]; then',
  );
  assertContains(
    finalCheck,
    'if [[ "$SHOULD_RUN" == "true" && "$HEAVY_RESULT" == "success" ]]; then',
  );
  assertContains(finalCheck, "Unexpected frontend validation state:");
  assert.equal(finalCheck.match(/exit 0/g)?.length, 2);
  assert.equal(finalCheck.match(/exit 1/g)?.length, 2);
  assertNotContains(finalCheck, '"$HEAVY_RESULT" == "failure"');
  assertNotContains(finalCheck, '"$HEAVY_RESULT" == "cancelled"');
  assertNotContains(finalCheck, "continue-on-error");
});
