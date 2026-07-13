import test from "node:test";
import assert from "node:assert/strict";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();

function copyRepoFile(relativePath: string, targetRoot: string): void {
  const target = join(targetRoot, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(resolve(repoRoot, relativePath), target);
}

function runGit(cwd: string, args: string[]): string {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  assert.equal(
    result.status,
    0,
    `git ${args.join(" ")} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
  return result.stdout.trim();
}

function setupTempRepository(): { root: string; baseSha: string } {
  const root = mkdtempSync(join(tmpdir(), "vetneb-qga-pr-"));

  for (const relativePath of [
    "package.json",
    "frontend/package.json",
    "test/README.md",
  ]) {
    copyRepoFile(relativePath, root);
  }

  for (const workflowName of readdirSync(resolve(repoRoot, ".github/workflows"))) {
    if (!workflowName.endsWith(".yml") && !workflowName.endsWith(".yaml")) continue;
    copyRepoFile(`.github/workflows/${workflowName}`, root);
  }

  runGit(root, ["init"]);
  runGit(root, ["config", "user.email", "qga@example.com"]);
  runGit(root, ["config", "user.name", "QGA Test"]);
  runGit(root, ["checkout", "-b", "main"]);
  runGit(root, ["add", "."]);
  runGit(root, ["commit", "-m", "base"]);

  return { root, baseSha: runGit(root, ["rev-parse", "HEAD"]) };
}

function setupBootstrapCompatibilityRepository(): { root: string; baseSha: string } {
  const root = mkdtempSync(join(tmpdir(), "vetneb-qga-bootstrap-"));

  for (const relativePath of [
    "package.json",
    "frontend/package.json",
    "test/README.md",
    "scripts/governance/pr-governance-validator.mjs",
    "scripts/governance/quality-gate-impact-policy.mjs",
    "scripts/governance/quality-gate-impact-validator.mjs",
  ]) {
    copyRepoFile(relativePath, root);
  }

  runGit(root, ["init"]);
  runGit(root, ["config", "user.email", "qga@example.com"]);
  runGit(root, ["config", "user.name", "QGA Test"]);
  runGit(root, ["checkout", "-b", "main"]);
  runGit(root, ["add", "."]);
  runGit(root, ["commit", "-m", "base"]);

  return { root, baseSha: runGit(root, ["rev-parse", "HEAD"]) };
}

function commitFile(root: string, relativePath: string, content: string): string {
  const target = join(root, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content, "utf8");
  runGit(root, ["add", relativePath]);
  runGit(root, ["commit", "-m", `change ${relativePath}`]);
  return runGit(root, ["rev-parse", "HEAD"]);
}

function writeEvent(root: string, baseSha: string, headSha: string, body: string): { eventPath: string; summaryPath: string } {
  const eventPath = join(root, "event.json");
  const summaryPath = join(root, "summary.md");
  writeFileSync(
    eventPath,
    JSON.stringify({
      pull_request: {
        base: { sha: baseSha },
        head: { sha: headSha },
        body,
      },
    }),
    "utf8",
  );
  writeFileSync(summaryPath, "", "utf8");
  return { eventPath, summaryPath };
}

function scriptsToolingBody(): string {
  return `## Summary
Quality impact integration fixture.

## Scope
- [ ] Backend runtime
- [ ] Frontend runtime
- [ ] Tests
- [ ] Workflows/CI
- [ ] Migrations/Schema
- [ ] Docs
- [ ] Dependencies
- [x] Scripts/Tooling
- [ ] Repository configuration
- [ ] Other
- [ ] Mixed-Scope exception

## Validation
- Integration fixture.

## Rollback
Revert fixture.
`;
}

function repositoryConfigurationBody(): string {
  return `## Summary
Repository configuration routing fixture.

## Scope
- [ ] Backend runtime
- [ ] Frontend runtime
- [ ] Tests
- [ ] Workflows/CI
- [ ] Migrations/Schema
- [ ] Docs
- [ ] Dependencies
- [ ] Scripts/Tooling
- [x] Repository configuration
- [ ] Other
- [ ] Mixed-Scope exception

## Validation
- Integration fixture.

## Rollback
Revert fixture.
`;
}

function workflowsCiBody(): string {
  return `## Summary
Workflow governance routing fixture.

## Scope
- [ ] Backend runtime
- [ ] Frontend runtime
- [ ] Tests
- [x] Workflows/CI
- [ ] Migrations/Schema
- [ ] Docs
- [ ] Dependencies
- [ ] Scripts/Tooling
- [ ] Repository configuration
- [ ] Other
- [ ] Mixed-Scope exception

## Validation
- Integration fixture.

## Rollback
Revert fixture.
`;
}

function otherScopeBody(): string {
  return `## Summary
Quality impact failure fixture.

## Scope
- [ ] Backend runtime
- [ ] Frontend runtime
- [ ] Tests
- [ ] Workflows/CI
- [ ] Migrations/Schema
- [ ] Docs
- [ ] Dependencies
- [ ] Scripts/Tooling
- [ ] Repository configuration
- [x] Other
- [ ] Mixed-Scope exception

## Other Scope Detail
This fixture deliberately exercises an unclassified root asset to prove that quality impact routing fails closed.

## Validation
- Integration fixture.

## Rollback
Revert fixture.
`;
}

function runValidator(root: string, eventPath: string, summaryPath: string, eventName = "pull_request") {
  return spawnSync("node", [resolve(repoRoot, "scripts/governance/pr-governance-validator.mjs")], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      GITHUB_EVENT_NAME: eventName,
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_STEP_SUMMARY: summaryPath,
    },
  });
}

function runLocalValidator(root: string, eventPath: string, summaryPath: string, eventName = "pull_request") {
  return spawnSync("node", ["scripts/governance/pr-governance-validator.mjs"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      GITHUB_EVENT_NAME: eventName,
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_STEP_SUMMARY: summaryPath,
    },
  });
}

function withTempRepository(assertion: (repo: { root: string; baseSha: string }) => void): void {
  const repo = setupTempRepository();
  try {
    assertion(repo);
  } finally {
    rmSync(repo.root, { recursive: true, force: true });
  }
}

function withBootstrapCompatibilityRepository(assertion: (repo: { root: string; baseSha: string }) => void): void {
  const repo = setupBootstrapCompatibilityRepository();
  try {
    assertion(repo);
  } finally {
    rmSync(repo.root, { recursive: true, force: true });
  }
}

test("PR governance invokes quality impact control and passes a valid scripts diff", () => {
  withTempRepository(({ root, baseSha }) => {
    const headSha = commitFile(root, "scripts/governance/example.mjs", "export const fixture = true;\n");
    const { eventPath, summaryPath } = writeEvent(root, baseSha, headSha, scriptsToolingBody());
    const result = runValidator(root, eventPath, summaryPath);
    const summary = readFileSync(summaryPath, "utf8");

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Quality gate impact PASS\./);
    assert.match(result.stdout, /PR Governance passed\./);
    assert.match(summary, /## Quality gate impact/);
    assert.match(summary, /## Workflow security/);
    assert.match(summary, /\| workflow security \| `N\/A` \| Bootstrap pull_request compatibility path/);
    assert.match(
      summary,
      /Workflow security N\/A\.\nBootstrap pull_request compatibility path; parser-backed enforcement becomes mandatory after the pull_request_target workflow is merged\./,
    );
    assert.match(summary, /governance-scripts/);
  });
});

test("PR governance legacy pull_request runs without workflow-security validator or js-yaml", () => {
  withBootstrapCompatibilityRepository(({ root, baseSha }) => {
    assert.equal(existsSync(join(root, "scripts/governance/workflow-security-validator.mjs")), false);
    assert.equal(existsSync(join(root, "node_modules/js-yaml")), false);

    const headSha = commitFile(root, "scripts/governance/example.mjs", "export const fixture = true;\n");
    const { eventPath, summaryPath } = writeEvent(root, baseSha, headSha, scriptsToolingBody());
    const result = runLocalValidator(root, eventPath, summaryPath);
    const summary = readFileSync(summaryPath, "utf8");

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Quality gate impact PASS\./);
    assert.match(result.stdout, /PR Governance passed\./);
    assert.match(summary, /\| workflow security \| `N\/A` \| Bootstrap pull_request compatibility path/);
    assert.match(summary, /Workflow security N\/A\./);
  });
});

test("PR governance validator has no static workflow security import", () => {
  const source = readFileSync(resolve(repoRoot, "scripts/governance/pr-governance-validator.mjs"), "utf8");

  assert.doesNotMatch(
    source,
    /import\s+(?:[\s\S]*?\s+from\s+)?["']\.\/workflow-security-validator\.mjs["']/,
  );
  assert.match(source, /import\("\.\/workflow-security-validator\.mjs"\)/);
});

test("PR governance treats pull_request_target as a pull request governance event", () => {
  withTempRepository(({ root, baseSha }) => {
    const headSha = commitFile(root, "scripts/governance/example.mjs", "export const fixture = true;\n");
    const { eventPath, summaryPath } = writeEvent(root, baseSha, headSha, scriptsToolingBody());
    const result = runValidator(root, eventPath, summaryPath, "pull_request_target");
    const summary = readFileSync(summaryPath, "utf8");

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /PR Governance passed\./);
    assert.match(summary, /\| event \| `pull_request_target` \|/);
    assert.match(summary, /Required PR body sections are present/);
    assert.doesNotMatch(summary, /\| workflow security \| `N\/A` \|/);
    assert.match(summary, /\| workflow security \| `PASS` \|/);
    assert.match(summary, /Workflow security validator PASS\./);
  });
});

test("PR governance keeps workflow_dispatch diagnostic execution working", () => {
  withTempRepository(({ root, baseSha }) => {
    const headSha = commitFile(root, "scripts/governance/example.mjs", "export const fixture = true;\n");
    const { eventPath, summaryPath } = writeEvent(root, baseSha, headSha, scriptsToolingBody());
    const result = runValidator(root, eventPath, summaryPath, "workflow_dispatch");
    const summary = readFileSync(summaryPath, "utf8");

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Quality gate impact PASS\./);
    assert.match(result.stdout, /PR Governance passed\./);
    assert.match(summary, /\| event \| `workflow_dispatch` \|/);
    assert.match(summary, /Skipped for workflow_dispatch/);
    assert.doesNotMatch(summary, /\| workflow security \| `N\/A` \|/);
    assert.match(summary, /\| workflow security \| `PASS` \|/);
    assert.match(summary, /Workflow security validator PASS\./);
  });
});

test("PR governance invokes quality impact control and passes a valid repository config diff", () => {
  withTempRepository(({ root, baseSha }) => {
    const headSha = commitFile(root, ".gitignore", "node_modules/\n");
    const { eventPath, summaryPath } = writeEvent(root, baseSha, headSha, repositoryConfigurationBody());
    const result = runValidator(root, eventPath, summaryPath);
    const summary = readFileSync(summaryPath, "utf8");

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Quality gate impact PASS\./);
    assert.match(result.stdout, /PR Governance passed\./);
    assert.match(summary, /repo-config-gitignore/);
  });
});

const unsafeWorkflowFixtures = [
  {
    name: "action with a mutable tag",
    source: `name: Candidate
on:
  pull_request:
permissions:
  contents: read
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
`,
    expected: /not a tag, branch or expression/,
  },
  {
    name: "write permissions",
    source: `name: Candidate
on:
  pull_request:
permissions: write-all
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - run: echo ok
`,
    expected: /Top-level permissions cannot be write-all/,
  },
  {
    name: "unsafe image",
    source: `name: Candidate
on:
  pull_request:
permissions:
  contents: read
jobs:
  validate:
    runs-on: ubuntu-latest
    container: node:latest
    steps:
      - run: echo ok
`,
    expected: /latest tag is not allowed/,
  },
  {
    name: "YAML alias",
    source: `name: Candidate
on:
  pull_request:
permissions:
  contents: read
x-step: &safeStep
  run: echo ok
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - *safeStep
`,
    expected: /YAML aliases are not allowed/,
  },
] as const;

for (const fixture of unsafeWorkflowFixtures) {
  test(`PR governance fails when candidate workflow contains ${fixture.name}`, () => {
    withTempRepository(({ root, baseSha }) => {
      const headSha = commitFile(root, ".github/workflows/app-version-force-update.yml", fixture.source);
      const { eventPath, summaryPath } = writeEvent(root, baseSha, headSha, workflowsCiBody());
      const result = runValidator(root, eventPath, summaryPath, "pull_request_target");
      const summary = readFileSync(summaryPath, "utf8");

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /PR Governance workflow security/);
      assert.match(result.stderr, fixture.expected);
      assert.match(summary, /Workflow security validator FAIL\./);
      assert.match(summary, fixture.expected);
    });
  });
}

test("PR governance adds quality impact failures to the general failure path", () => {
  withTempRepository(({ root, baseSha }) => {
    const headSha = commitFile(root, "unclassified-root-asset.bin", "fixture\n");
    const { eventPath, summaryPath } = writeEvent(root, baseSha, headSha, otherScopeBody());
    const result = runValidator(root, eventPath, summaryPath);
    const summary = readFileSync(summaryPath, "utf8");

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /PR Governance quality gate impact/);
    assert.match(result.stderr, /Quality gate impact policy has no route for changed path: unclassified-root-asset\.bin/);
    assert.match(summary, /quality gate impact/);
    assert.match(summary, /`FAIL`/);
  });
});

test("PR governance keeps preexisting metadata validation failures active", () => {
  withTempRepository(({ root, baseSha }) => {
    const headSha = commitFile(root, "scripts/governance/example.mjs", "export const fixture = true;\n");
    const missingSummaryBody = scriptsToolingBody().replace(/## Summary[\s\S]*?\n\n## Scope/, "## Scope");
    const { eventPath, summaryPath } = writeEvent(root, baseSha, headSha, missingSummaryBody);
    const result = runValidator(root, eventPath, summaryPath);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /PR Governance metadata/);
    assert.match(result.stderr, /Missing required section\(s\): Summary/);
  });
});
