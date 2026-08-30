import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { load: loadYaml } = require("js-yaml") as {
  load: (source: string) => unknown;
};

type WorkflowStep = {
  name?: string;
  run?: string;
  if?: unknown;
  "continue-on-error"?: unknown;
};

type WorkflowJob = {
  name?: string;
  needs?: string | string[];
  steps?: WorkflowStep[];
};

type Workflow = {
  jobs: Record<string, WorkflowJob>;
};

const workflowPath = resolve(
  process.cwd(),
  ".github",
  "workflows",
  "backend-ci.yml",
);

function readWorkflow(): string {
  return readFileSync(workflowPath, "utf8").replace(/\r\n/g, "\n");
}

function runGit(repository: string, args: readonly string[]): string {
  return execFileSync("git", [...args], {
    cwd: repository,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function initializeFixtureRepository(repository: string): void {
  runGit(repository, ["init", "-b", "main"]);

  const disabledHooksPath = resolve(repository, ".git", "disabled-hooks");
  mkdirSync(disabledHooksPath, { recursive: true });

  runGit(repository, ["config", "--local", "commit.gpgSign", "false"]);
  runGit(repository, [
    "config",
    "--local",
    "core.hooksPath",
    ".git/disabled-hooks",
  ]);
  runGit(repository, ["config", "--local", "user.name", "VETNEB CI Test"]);
  runGit(repository, [
    "config",
    "--local",
    "user.email",
    "ci-test@invalid.local",
  ]);

  assert.equal(
    runGit(repository, ["config", "--local", "--get", "commit.gpgSign"]),
    "false",
  );
  assert.equal(
    runGit(repository, ["config", "--local", "--get", "core.hooksPath"]),
    ".git/disabled-hooks",
  );
}

function commitFile(
  repository: string,
  relativePath: string,
  content: string,
  message: string,
): string {
  const absolutePath = resolve(repository, relativePath);

  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content, "utf8");
  runGit(repository, ["add", "--", relativePath]);
  runGit(repository, ["commit", "-m", message]);

  return runGit(repository, ["rev-parse", "HEAD"]);
}

function changedFiles(
  repository: string,
  fromCommit: string,
  toCommit: string,
): string[] {
  return execFileSync(
    "git",
    [
      "diff",
      "--name-only",
      "-z",
      "--diff-filter=ACDMRTUXB",
      fromCommit,
      toCommit,
    ],
    { cwd: repository, encoding: "utf8" },
  )
    .split("\0")
    .filter(Boolean);
}

function shouldRunBackend(changedPaths: readonly string[]): boolean {
  return changedPaths.some(
    (changedPath) =>
      !changedPath.startsWith("docs/") && !changedPath.endsWith(".md"),
  );
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
    'if ! MERGE_BASE="$(git merge-base "$BASE_SHA" "$HEAD_SHA")"; then',
  );
  assertContains(
    detector,
    'if [[ ! "$MERGE_BASE" =~ ^[0-9a-f]{40}$ ]]; then',
  );
  assertContains(detector, 'git cat-file -e "${MERGE_BASE}^{commit}"');
  assertContains(
    detector,
    'git diff --name-only -z --diff-filter=ACDMRTUXB "$MERGE_BASE" "$HEAD_SHA" > "$changed_file_list"',
  );
  assertNotContains(
    detector,
    'git diff --name-only -z --diff-filter=ACDMRTUXB "$BASE_SHA" "$HEAD_SHA"',
  );
  assertNotContains(detector, "continue-on-error");
});

test("Backend CI excluye cambios exclusivos de una base que avanzó", () => {
  const repository = mkdtempSync(join(tmpdir(), "vetneb-backend-ci-"));

  try {
    initializeFixtureRepository(repository);

    const commonCommit = commitFile(
      repository,
      "README.md",
      "common\n",
      "common commit",
    );

    runGit(repository, ["switch", "-c", "docs-only"]);
    runGit(repository, ["switch", "main"]);
    const baseSha = commitFile(
      repository,
      "server/base-only.ts",
      "export const baseOnly = true;\n",
      "advance main",
    );

    runGit(repository, ["switch", "docs-only"]);
    const docsHeadSha = commitFile(
      repository,
      "docs/pull-request.md",
      "# Pull request\n",
      "docs-only change",
    );

    const directRangeFiles = changedFiles(repository, baseSha, docsHeadSha);
    assert.ok(directRangeFiles.includes("server/base-only.ts"));

    const mergeBase = runGit(repository, [
      "merge-base",
      baseSha,
      docsHeadSha,
    ]);
    assert.equal(mergeBase, commonCommit);

    const pullRequestFiles = changedFiles(
      repository,
      mergeBase,
      docsHeadSha,
    );
    assert.deepEqual(pullRequestFiles, ["docs/pull-request.md"]);
    assert.equal(shouldRunBackend(pullRequestFiles), false);

    const backendHeadSha = commitFile(
      repository,
      "server/pull-request.ts",
      "export const pullRequestChange = true;\n",
      "backend change",
    );
    const backendFiles = changedFiles(repository, mergeBase, backendHeadSha);
    assert.equal(shouldRunBackend(backendFiles), true);
  } finally {
    rmSync(repository, { recursive: true, force: true });
  }
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
    "      - name: Lint backend\n        run: pnpm lint:backend",
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

// WBR-04b (VET-10): structural (real YAML parse, not string matching) proof
// that the lint step is inside the SAME job the required "validate-backend"
// check aggregates, that it actually invokes lint:backend, and that nothing
// makes it tolerate a failure or skip in a normal run.
const HEAVY_JOB_ID = "validate-backend";
const REQUIRED_CHECK_JOB_ID = "backend-check";
const LINT_STEP_NAME = "Lint backend";
const LINT_COMMAND = "pnpm lint:backend";

function validateLintGate(workflow: Workflow): string[] {
  const issues: string[] = [];
  const heavyJob = workflow.jobs[HEAVY_JOB_ID];
  const requiredCheckJob = workflow.jobs[REQUIRED_CHECK_JOB_ID];
  const lintStep = heavyJob?.steps?.find(
    (step) => step.name === LINT_STEP_NAME,
  );

  if (!lintStep) {
    issues.push("lint step missing from the required heavy job");
    return issues;
  }

  if (lintStep.run !== LINT_COMMAND) {
    issues.push("lint step does not run lint:backend");
  }
  if ("continue-on-error" in lintStep) {
    issues.push("lint step tolerates failure");
  }
  if ("if" in lintStep) {
    issues.push("lint step is conditionally skipped");
  }

  const requiredNeeds = requiredCheckJob?.needs;
  const needsHeavyJob = Array.isArray(requiredNeeds)
    ? requiredNeeds.includes(HEAVY_JOB_ID)
    : requiredNeeds === HEAVY_JOB_ID;

  if (!needsHeavyJob) {
    issues.push("required check job no longer depends on the heavy job");
  }

  return issues;
}

function mutateWorkflow(
  workflow: Workflow,
  apply: (candidate: Workflow) => void,
): Workflow {
  const candidate = structuredClone(workflow);
  apply(candidate);
  return candidate;
}

test("Backend CI lint step is a real, unconditional, blocking step inside the required heavy job", () => {
  const workflow = loadYaml(readWorkflow()) as Workflow;

  assert.deepEqual(validateLintGate(workflow), []);
});

test("Backend CI lint gate rejects removal, tolerance, wrong command, wrong job and conditional skip", () => {
  const workflow = loadYaml(readWorkflow()) as Workflow;

  assert.ok(
    validateLintGate(
      mutateWorkflow(workflow, (candidate) => {
        const steps = candidate.jobs[HEAVY_JOB_ID].steps!;
        candidate.jobs[HEAVY_JOB_ID].steps = steps.filter(
          (step) => step.name !== LINT_STEP_NAME,
        );
      }),
    ).includes("lint step missing from the required heavy job"),
  );

  assert.ok(
    validateLintGate(
      mutateWorkflow(workflow, (candidate) => {
        const step = candidate.jobs[HEAVY_JOB_ID].steps!.find(
          (item) => item.name === LINT_STEP_NAME,
        )!;
        step["continue-on-error"] = true;
      }),
    ).includes("lint step tolerates failure"),
  );

  assert.ok(
    validateLintGate(
      mutateWorkflow(workflow, (candidate) => {
        const step = candidate.jobs[HEAVY_JOB_ID].steps!.find(
          (item) => item.name === LINT_STEP_NAME,
        )!;
        step.run = "pnpm typecheck";
      }),
    ).includes("lint step does not run lint:backend"),
  );

  assert.ok(
    validateLintGate(
      mutateWorkflow(workflow, (candidate) => {
        const heavySteps = candidate.jobs[HEAVY_JOB_ID].steps!;
        const lintIndex = heavySteps.findIndex(
          (item) => item.name === LINT_STEP_NAME,
        );
        const [moved] = heavySteps.splice(lintIndex, 1);
        candidate.jobs["generate-sbom"].steps!.push(moved);
      }),
    ).includes("lint step missing from the required heavy job"),
  );

  assert.ok(
    validateLintGate(
      mutateWorkflow(workflow, (candidate) => {
        const step = candidate.jobs[HEAVY_JOB_ID].steps!.find(
          (item) => item.name === LINT_STEP_NAME,
        )!;
        step.if = "${{ false }}";
      }),
    ).includes("lint step is conditionally skipped"),
  );
});
