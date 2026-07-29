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

function assertNotContains(source: string, unexpected: string): void {
  assert.ok(
    !source.includes(unexpected),
    `backend-ci.yml no debe contener: ${unexpected}`,
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

function getTopLevelBlock(
  source: string,
  header: string,
  nextHeaderPattern: RegExp,
): string {
  const start = source.indexOf(header);

  assert.notEqual(start, -1, `backend-ci.yml debe contener: ${header.trim()}`);

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

test("Backend CI dispara para todo pull request a main y conserva los pushes", () => {
  const source = readWorkflow();
  const pullRequest = getEventBlock(source, "pull_request");
  const push = getEventBlock(source, "push");

  assertContains(pullRequest, "    branches:\n      - main");
  assertNotContains(pullRequest, "paths:");
  assertNotContains(pullRequest, "paths-ignore:");

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
    assertContains(push, `      - ${branchPattern}`);
  }
});

test("Backend CI detecta impacto con rango PR seguro, push pesado y fallo cerrado", () => {
  const detector = getJobBlock(readWorkflow(), "detect-backend-impact");

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

test("Backend CI omite docs y Markdown pero solicita heavy para cualquier otro archivo", () => {
  const detector = getJobBlock(readWorkflow(), "detect-backend-impact");

  assertContains(
    detector,
    `          should_run=false
          while IFS= read -r -d '' changed_path; do
            case "$changed_path" in
              docs/*|*.md)
                ;;
              *)
                should_run=true
                break
                ;;
            esac
          done < "$changed_file_list"

          echo "should_run=$should_run" >> "$GITHUB_OUTPUT"`,
  );
});

test("Backend CI mantiene Postgres efímero y migraciones antes de validaciones", () => {
  const source = readWorkflow();
  const heavy = getJobBlock(source, "validate-backend");

  assertContains(heavy, "name: backend-heavy-validation");
  assertContains(heavy, "needs: detect-backend-impact");
  assertContains(
    heavy,
    "if: ${{ needs.detect-backend-impact.outputs.should_run == 'true' }}",
  );
  assertContains(heavy, "postgres:");
  assertContains(heavy, "image: postgres:16");
  assertContains(heavy, "POSTGRES_DB: portal_vetneb_ci");
  assertContains(
    heavy,
    "DATABASE_URL: postgresql://postgres:postgres@localhost:5432/portal_vetneb_ci",
  );
  assertContains(
    heavy,
    "SUPABASE_DB_URL: postgresql://postgres:postgres@localhost:5432/portal_vetneb_ci",
  );
  assert.equal(source.match(/\n      postgres:\n/g)?.length, 1);
  assertNotContains(getJobBlock(source, "detect-backend-impact"), "postgres:");
  assertNotContains(getJobBlock(source, "backend-check"), "postgres:");
});

test("Backend CI ejecuta todos los gates obligatorios en orden", () => {
  const heavy = getJobBlock(readWorkflow(), "validate-backend");

  assertOrdered(heavy, [
    "      - name: Install dependencies\n        run: pnpm install --frozen-lockfile",
    "      - name: Dependency security audit\n        run: |\n          pnpm audit --prod\n          pnpm audit",
    "      - name: Run database migrations\n        run: pnpm db:migrate",
    "      - name: Typecheck\n        run: pnpm typecheck",
    "      - name: Typecheck tests\n        run: pnpm typecheck:test",
    "      - name: Test\n        run: pnpm test",
    "      - name: Build\n        run: pnpm build",
  ]);
});

test("Backend CI publica un check final siempre presente con propagación estricta", () => {
  const finalCheck = getJobBlock(readWorkflow(), "backend-check");

  assertContains(finalCheck, "name: validate-backend");
  assertContains(
    finalCheck,
    "needs:\n      - detect-backend-impact\n      - validate-backend",
  );
  assertContains(finalCheck, "if: ${{ always() }}");
  assertContains(
    finalCheck,
    "DETECTOR_RESULT: ${{ needs.detect-backend-impact.result }}",
  );
  assertContains(
    finalCheck,
    "SHOULD_RUN: ${{ needs.detect-backend-impact.outputs.should_run }}",
  );
  assertContains(
    finalCheck,
    "HEAVY_RESULT: ${{ needs.validate-backend.result }}",
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
  assertContains(finalCheck, "Unexpected backend validation state:");
  assert.equal(finalCheck.match(/exit 0/g)?.length, 2);
  assert.equal(finalCheck.match(/exit 1/g)?.length, 2);
  assertNotContains(finalCheck, '"$HEAVY_RESULT" == "failure"');
  assertNotContains(finalCheck, '"$HEAVY_RESULT" == "cancelled"');
  assertNotContains(finalCheck, "continue-on-error");
});
