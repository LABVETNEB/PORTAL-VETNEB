import test from "node:test";
import assert from "node:assert/strict";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
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
  const root = mkdtempSync(join(tmpdir(), "vetneb-qga-workflow-security-"));

  for (const relativePath of [
    "package.json",
    "frontend/package.json",
    "test/README.md",
    "scripts/governance/pr-governance-validator.mjs",
    "scripts/governance/quality-gate-impact-policy.mjs",
    "scripts/governance/quality-gate-impact-validator.mjs",
    "scripts/governance/workflow-security-policy.mjs",
    "scripts/governance/workflow-security-validator.mjs",
    ".github/workflows/app-version-force-update.yml",
    ".github/workflows/backend-ci.yml",
    ".github/workflows/frontend-ci.yml",
    ".github/workflows/pr-governance.yml",
    ".github/workflows/visual-regression-manual.yml",
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

function workflowScopeBody(): string {
  return `## Summary
Workflow security integration fixture.

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

function runValidator(root: string, eventPath: string, summaryPath: string) {
  return spawnSync("node", ["scripts/governance/pr-governance-validator.mjs"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      GITHUB_EVENT_NAME: "pull_request",
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

test("PR governance workflow security positive fixture passes", () => {
  withTempRepository(({ root, baseSha }) => {
    const workflowPath = ".github/workflows/pr-governance.yml";
    const workflow = readFileSync(join(root, workflowPath), "utf8");
    const headSha = commitFile(root, workflowPath, `${workflow}\n# workflow security integration fixture\n`);
    const { eventPath, summaryPath } = writeEvent(root, baseSha, headSha, workflowScopeBody());
    const result = runValidator(root, eventPath, summaryPath);
    const summary = readFileSync(summaryPath, "utf8");

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Workflow security PASS\./);
    assert.match(result.stdout, /Quality gate impact PASS\./);
    assert.match(result.stdout, /PR Governance passed\./);
    assert.match(summary, /## Workflow security/);
    assert.match(summary, /\| result \| `PASS` \|/);
  });
});

test("PR governance accepts QGA-4 workflow security enforcement sources as workflow scope", () => {
  withTempRepository(({ root, baseSha }) => {
    const workflowPath = ".github/workflows/pr-governance.yml";
    const workflow = readFileSync(join(root, workflowPath), "utf8");
    writeFileSync(join(root, workflowPath), `${workflow}\n# workflow security integration fixture\n`, "utf8");

    const validatorPath = "scripts/governance/workflow-security-validator.mjs";
    const validator = readFileSync(join(root, validatorPath), "utf8");
    writeFileSync(join(root, validatorPath), `${validator}\n// workflow security integration fixture\n`, "utf8");

    runGit(root, ["add", workflowPath, validatorPath]);
    runGit(root, ["commit", "-m", "change workflow security enforcement"]);
    const headSha = runGit(root, ["rev-parse", "HEAD"]);
    const { eventPath, summaryPath } = writeEvent(root, baseSha, headSha, workflowScopeBody());
    const result = runValidator(root, eventPath, summaryPath);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Workflow security PASS\./);
    assert.match(result.stdout, /PR Governance passed\./);
  });
});

test("PR governance workflow security rejects write-all permissions", () => {
  withTempRepository(({ root, baseSha }) => {
    const workflowPath = ".github/workflows/pr-governance.yml";
    const workflow = readFileSync(join(root, workflowPath), "utf8").replace(
      /permissions:\n  contents: read/,
      "permissions: write-all",
    );
    const headSha = commitFile(root, workflowPath, workflow);
    const { eventPath, summaryPath } = writeEvent(root, baseSha, headSha, workflowScopeBody());
    const result = runValidator(root, eventPath, summaryPath);
    const summary = readFileSync(summaryPath, "utf8");

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /PR Governance workflow security/);
    assert.match(result.stderr, /permissions value "write-all"/);
    assert.match(summary, /workflow security/);
    assert.match(summary, /`FAIL`/);
  });
});

test("PR governance workflow security rejects mutable action refs", () => {
  withTempRepository(({ root, baseSha }) => {
    const workflowPath = ".github/workflows/pr-governance.yml";
    const workflow = readFileSync(join(root, workflowPath), "utf8").replace(
      /actions\/checkout@[0-9a-f]{40} # v7/,
      "actions/checkout@v7",
    );
    const headSha = commitFile(root, workflowPath, workflow);
    const { eventPath, summaryPath } = writeEvent(root, baseSha, headSha, workflowScopeBody());
    const result = runValidator(root, eventPath, summaryPath);
    const summary = readFileSync(summaryPath, "utf8");

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /PR Governance workflow security/);
    assert.match(result.stderr, /must be pinned to a full commit SHA/);
    assert.match(summary, /workflow security/);
    assert.match(summary, /`FAIL`/);
  });
});
