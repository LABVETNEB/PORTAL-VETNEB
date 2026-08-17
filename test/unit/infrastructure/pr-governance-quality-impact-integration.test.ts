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
const OLD_GIT_MAX_BUFFER_BYTES = 1024 * 1024;
const LARGE_DIFF_TARGET_BYTES = OLD_GIT_MAX_BUFFER_BYTES + 256 * 1024;

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

function largeSafeScript(): string {
  const line = `// safe governance buffer fixture ${"x".repeat(96)}\n`;
  return line.repeat(Math.ceil(LARGE_DIFF_TARGET_BYTES / Buffer.byteLength(line)));
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

function runValidator(
  root: string,
  eventPath: string,
  summaryPath: string,
  environment: NodeJS.ProcessEnv = process.env,
) {
  return spawnSync(process.execPath, ["scripts/governance/pr-governance-validator.mjs"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...environment,
      GITHUB_EVENT_NAME: "pull_request",
      GITHUB_EVENT_PATH: eventPath,
      GITHUB_STEP_SUMMARY: summaryPath,
    },
  });
}

function environmentWithoutExecutableSearchPath(): NodeJS.ProcessEnv {
  const environment = { ...process.env };
  for (const key of Object.keys(environment)) {
    if (key.toLowerCase() === "path") delete environment[key];
  }
  environment.PATH = "";
  return environment;
}

function withTempRepository(assertion: (repo: { root: string; baseSha: string }) => void): void {
  const repo = setupTempRepository();
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
    assert.match(summary, /governance-scripts/);
  });
});

test("PR governance accepts a deterministic diff larger than the former Git buffer", () => {
  withTempRepository(({ root, baseSha }) => {
    const content = largeSafeScript();
    assert.ok(Buffer.byteLength(content) > OLD_GIT_MAX_BUFFER_BYTES);

    const headSha = commitFile(root, "scripts/governance/large-diff-fixture.mjs", content);
    const { eventPath, summaryPath } = writeEvent(root, baseSha, headSha, scriptsToolingBody());
    const result = runValidator(root, eventPath, summaryPath);

    assert.equal(result.error, undefined);
    assert.doesNotMatch(result.stderr, /ENOBUFS/);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /PR Governance passed\./);
  });
});

test("PR governance detects a synthetic secret after the former Git buffer boundary", () => {
  withTempRepository(({ root, baseSha }) => {
    const safePrefix = largeSafeScript();
    const syntheticSecret = ["ghp", "_", "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8"].join("");
    assert.ok(Buffer.byteLength(safePrefix) > OLD_GIT_MAX_BUFFER_BYTES);

    const content = `${safePrefix}export const syntheticCredential = "${syntheticSecret}";\n`;
    const headSha = commitFile(root, "scripts/governance/large-secret-fixture.mjs", content);
    const { eventPath, summaryPath } = writeEvent(root, baseSha, headSha, scriptsToolingBody());
    const result = runValidator(root, eventPath, summaryPath);

    assert.equal(result.error, undefined);
    assert.doesNotMatch(result.stderr, /ENOBUFS/);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /PR Governance secret scan/);
    assert.match(result.stderr, /GitHub token/);
    assert.doesNotMatch(result.stderr, new RegExp(syntheticSecret));
    assert.doesNotMatch(result.stdout, new RegExp(syntheticSecret));
  });
});

test("PR governance fails closed when the pull request head object is unavailable", () => {
  withTempRepository(({ root, baseSha }) => {
    const unavailableHeadSha = "f".repeat(40);
    const { eventPath, summaryPath } = writeEvent(
      root,
      baseSha,
      unavailableHeadSha,
      scriptsToolingBody(),
    );
    const result = runValidator(root, eventPath, summaryPath);

    assert.equal(result.error, undefined);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Head SHA f{12} is unavailable\./);
    assert.doesNotMatch(result.stdout, /PR Governance passed\./);
  });
});

test("PR governance propagates Git spawn errors and remains fail-closed", () => {
  withTempRepository(({ root, baseSha }) => {
    const headSha = commitFile(root, "scripts/governance/example.mjs", "export const fixture = true;\n");
    const { eventPath, summaryPath } = writeEvent(root, baseSha, headSha, scriptsToolingBody());
    const result = runValidator(
      root,
      eventPath,
      summaryPath,
      environmentWithoutExecutableSearchPath(),
    );

    assert.equal(result.error, undefined);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /spawnSync git/);
    assert.match(result.stderr, /ENOENT/);
    assert.doesNotMatch(result.stdout, /PR Governance passed\./);
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
