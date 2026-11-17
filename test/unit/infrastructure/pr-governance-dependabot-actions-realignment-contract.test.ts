import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  DEPENDABOT_ACTIONS_CONTRACT_TESTS,
  evaluateArchitectureDecisionContract,
  evaluateDependabotActionsRealignment,
  evaluateDependabotAutomationContract,
} from "../../../scripts/governance/pr-governance-validator.mjs";

const OLD_SHA = "a".repeat(40);
const NEW_SHA = "b".repeat(40);
const OTHER_SHA = "c".repeat(40);
const CHECKOUT_SHA = "d".repeat(40);
const WORKFLOW = ".github/workflows/backend-ci.yml";
const OTHER_WORKFLOW = ".github/workflows/frontend-ci.yml";
const TOOLCHAIN_TEST = DEPENDABOT_ACTIONS_CONTRACT_TESTS[0];
const POLICY_TEST = DEPENDABOT_ACTIONS_CONTRACT_TESTS[3];

function workflowText(sha: string, label = "v6.1.0"): string {
  return [
    "name: Backend CI",
    "permissions:",
    "  contents: read",
    "jobs:",
    "  build:",
    "    steps:",
    `      - uses: actions/checkout@${CHECKOUT_SHA} # v7`,
    `      - name: Setup pnpm`,
    `        uses: pnpm/action-setup@${sha} # ${label}`,
    "",
  ].join("\n");
}

function digest(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function toolchainText(sha: string, label = "v6.1.0"): string {
  return [
    'import test from "node:test";',
    `assertContains(workflow, "uses: pnpm/action-setup@${sha} # ${label}");`,
    'assertContains(workflow, "version: 11.13.1");',
    "",
  ].join("\n");
}

function policyText(sha: string, workflowDigest: string, extra = ""): string {
  return [
    `  "pnpm/action-setup@${sha}",`,
    `  [".github/workflows/backend-ci.yml", "${workflowDigest}"],`,
    `  [".github/workflows/frontend-ci.yml", "${"e".repeat(64)}"],`,
    extra,
    "",
  ].join("\n");
}

interface Scenario {
  files: Map<string, { base: string; head: string }>;
  entries: Array<{ status: string; path: string; display?: string }>;
}

function scenario(): Scenario {
  const baseWorkflow = workflowText(OLD_SHA);
  const headWorkflow = workflowText(NEW_SHA, "v6.1.1");
  return {
    files: new Map([
      [WORKFLOW, { base: baseWorkflow, head: headWorkflow }],
      [
        TOOLCHAIN_TEST,
        { base: toolchainText(OLD_SHA), head: toolchainText(NEW_SHA, "v6.1.1") },
      ],
      [
        POLICY_TEST,
        {
          base: policyText(OLD_SHA, digest(baseWorkflow)),
          head: policyText(NEW_SHA, digest(headWorkflow)),
        },
      ],
    ]),
    entries: [
      { status: "M", path: WORKFLOW },
      { status: "M", path: TOOLCHAIN_TEST },
      { status: "M", path: POLICY_TEST },
    ],
  };
}

function dependabotEvent(overrides: Record<string, unknown> = {}): any {
  return structuredClone({
    pull_request: {
      user: { login: "dependabot[bot]" },
      head: {
        ref: "dependabot/github_actions/github-actions-low-risk-abc",
        repo: { full_name: "LABVETNEB/PORTAL-VETNEB" },
      },
      base: { ref: "main", repo: { full_name: "LABVETNEB/PORTAL-VETNEB" } },
      ...overrides,
    },
  });
}

function run(
  data: Scenario,
  event: any = dependabotEvent(),
): { failures: string[]; details: string[]; realigned?: boolean } {
  return evaluateDependabotAutomationContract({
    event,
    entries: data.entries,
    baseSha: "BASE",
    headSha: "HEAD",
    readBlob: (revision: string, path: string) => {
      const file = data.files.get(path);
      if (!file) return null;
      return revision === "BASE" ? file.base : file.head;
    },
  });
}

function mutateHead(data: Scenario, path: string, mutate: (text: string) => string): void {
  const file = data.files.get(path)!;
  file.head = mutate(file.head);
}

function assertRejected(result: { failures: string[]; realigned?: boolean }, fragment?: string): void {
  assert.ok(result.failures.length > 0, "expected failures");
  assert.notEqual(result.realigned, true);
  if (fragment) {
    assert.ok(
      result.failures.some((failure) => failure.includes(fragment)),
      `expected a failure containing "${fragment}" in: ${result.failures.join(" | ")}`,
    );
  }
}

test("allows the exact contract tests only as a verified action reference realignment", () => {
  const result = run(scenario());
  assert.deepEqual(result.failures, []);
  assert.equal(result.realigned, true);
});

test("the contract test allowlist is the exact four reviewed files", () => {
  assert.deepEqual([...DEPENDABOT_ACTIONS_CONTRACT_TESTS].sort(), [
    "test/architecture/toolchain-contract.test.ts",
    "test/unit/infrastructure/frontend-ci-workflow.test.ts",
    "test/unit/infrastructure/supply-chain-governance-contract.test.ts",
    "test/unit/infrastructure/workflow-security-policy-contract.test.ts",
  ]);
});

test("rejects arbitrary changes inside an allowed contract test", () => {
  const data = scenario();
  mutateHead(data, TOOLCHAIN_TEST, (text) =>
    text.replace('"version: 11.13.1"', '"version: 99.0.0"'),
  );
  assertRejected(run(data), "not limited to expected action references");
});

test("rejects modified assertions that are unrelated to the action", () => {
  const data = scenario();
  mutateHead(data, TOOLCHAIN_TEST, (text) => text.replace("assertContains(workflow,", "assert.ok(workflow,"));
  assertRejected(run(data));
});

test("rejects lines added to or removed from an allowed contract test", () => {
  const added = scenario();
  mutateHead(added, TOOLCHAIN_TEST, (text) => `${text}assert.ok(true);\n`);
  assertRejected(run(added), "line count changed");

  const removed = scenario();
  mutateHead(removed, POLICY_TEST, (text) => text.replace(/^.*pnpm\/action-setup.*\n/m, ""));
  assertRejected(run(removed), "line count changed");
});

test("rejects a forged digest", () => {
  const data = scenario();
  mutateHead(data, POLICY_TEST, (text) =>
    text.replace(digest(data.files.get(WORKFLOW)!.head), "f".repeat(64)),
  );
  assertRejected(run(data), "does not match the real workflow content");
});

test("rejects a digest change for a workflow this pull request does not modify", () => {
  const data = scenario();
  mutateHead(data, POLICY_TEST, (text) => text.replace("e".repeat(64), "f".repeat(64)));
  assertRejected(run(data), "does not modify");
});

test("rejects a test reference that does not match the verified workflow update", () => {
  const data = scenario();
  mutateHead(data, TOOLCHAIN_TEST, (text) => text.replace(NEW_SHA, OTHER_SHA));
  assertRejected(run(data), "does not match a verified workflow reference update");
});

test("rejects a test reference that swaps the action identity", () => {
  const data = scenario();
  mutateHead(data, TOOLCHAIN_TEST, (text) =>
    text.replace("pnpm/action-setup@", "evil/action-setup@"),
  );
  assertRejected(run(data));
});

test("rejects a label-only change on an unchanged reference", () => {
  const data = scenario();
  const file = data.files.get(TOOLCHAIN_TEST)!;
  file.base = toolchainText(NEW_SHA, "v6.1.0");
  file.head = toolchainText(NEW_SHA, "v9.9.9");
  assertRejected(run(data));
});

test("rejects incomplete SHAs and floating references in workflows", () => {
  const short = scenario();
  mutateHead(short, WORKFLOW, (text) => text.replace(NEW_SHA, "b".repeat(39)));
  assertRejected(run(short), "full-SHA pinned");

  for (const floating of ["v6", "main", "6.1.1"]) {
    const data = scenario();
    mutateHead(data, WORKFLOW, (text) => text.replace(`@${NEW_SHA}`, `@${floating}`));
    assertRejected(run(data), "full-SHA pinned");
  }
});

test("rejects uppercase or non-hex 40-character references", () => {
  const data = scenario();
  mutateHead(data, WORKFLOW, (text) => text.replace(NEW_SHA, "B".repeat(40)));
  assertRejected(run(data), "full-SHA pinned");
});

test("rejects new GitHub Actions permissions", () => {
  const data = scenario();
  mutateHead(data, WORKFLOW, (text) => text.replace("contents: read", "contents: write"));
  assertRejected(run(data), "full-SHA pinned");

  const extra = scenario();
  mutateHead(extra, WORKFLOW, (text) => text.replace("permissions:", "permissions:\n  id-token: write"));
  assertRejected(run(extra), "line count changed");
});

test("rejects trigger and job changes alongside a reference update", () => {
  const trigger = scenario();
  mutateHead(trigger, WORKFLOW, (text) => text.replace("name: Backend CI", "name: Backend CI\non: pull_request_target"));
  assertRejected(run(trigger));

  const job = scenario();
  mutateHead(job, WORKFLOW, (text) => text.replace("  build:", "  deploy:"));
  assertRejected(run(job), "full-SHA pinned");
});

test("rejects an action outside the approved allowlist", () => {
  const data = scenario();
  const base = workflowText(OLD_SHA).replace("pnpm/action-setup", "unknown/tool");
  const head = workflowText(NEW_SHA, "v6.1.1").replace("pnpm/action-setup", "unknown/tool");
  data.files.set(WORKFLOW, { base, head });
  assertRejected(run(data), "approved external action allowlist");
});

test("rejects a workflow change that updates no reference", () => {
  const data = scenario();
  const same = workflowText(OLD_SHA);
  data.files.set(WORKFLOW, { base: same, head: `${same.replace("name: Backend CI", "name: Backend CI!")}` });
  assertRejected(run(data));
});

test("rejects contract tests that are not in the allowlist", () => {
  const data = scenario();
  const foreign = "test/unit/infrastructure/other-contract.test.ts";
  data.files.set(foreign, { base: toolchainText(OLD_SHA), head: toolchainText(NEW_SHA) });
  data.entries.push({ status: "M", path: foreign });
  assertRejected(run(data), "not a workflow or an allowed contract test");
});

test("rejects added, deleted and renamed files", () => {
  for (const status of ["A", "D", "R100", "C100"]) {
    const data = scenario();
    data.entries[1] = { status, path: TOOLCHAIN_TEST, display: TOOLCHAIN_TEST };
    assertRejected(run(data), "additions, deletions, renames and copies");
  }
});

test("rejects runtime files mixed with a realignment", () => {
  const data = scenario();
  data.entries.push({ status: "M", path: "server/index.ts" });
  assertRejected(run(data));
});

test("requires at least one modified workflow", () => {
  const data = scenario();
  data.entries = [{ status: "M", path: TOOLCHAIN_TEST }];
  assertRejected(run(data), "at least one modified workflow");
});

test("fails closed when contents cannot be read", () => {
  const data = scenario();
  const result = evaluateDependabotAutomationContract({
    event: dependabotEvent(),
    entries: data.entries,
  });
  assertRejected(result, "readable base and head file contents");

  const missing = scenario();
  missing.files.delete(TOOLCHAIN_TEST);
  assertRejected(run(missing), "unavailable");
});

test("rejects the exception outside a github_actions Dependabot branch", () => {
  const npm = dependabotEvent();
  npm.pull_request.head.ref = "dependabot/npm_and_yarn/frontend/foo-1.0.0";
  assertRejected(run(scenario(), npm), "github_actions");
});

test("rejects authors and branches that imitate Dependabot", () => {
  const author = dependabotEvent();
  author.pull_request.user.login = "dependabot-lookalike[bot]";
  assertRejected(run(scenario(), author));

  const human = dependabotEvent();
  human.pull_request.user.login = "maintainer";
  assertRejected(run(scenario(), human));

  const branch = dependabotEvent();
  branch.pull_request.head.ref = "feature/dependabot/github_actions/x";
  assertRejected(run(scenario(), branch));
});

test("rejects pull requests from forks", () => {
  const fork = dependabotEvent();
  fork.pull_request.head.repo.full_name = "someone/PORTAL-VETNEB";
  assertRejected(run(scenario(), fork));

  const noRepo = dependabotEvent();
  delete noRepo.pull_request.head.repo;
  assertRejected(run(scenario(), noRepo));
});

test("rejects policy modifications presented as a realignment", () => {
  const data = scenario();
  mutateHead(data, POLICY_TEST, (text) =>
    text.replace(`  "pnpm/action-setup@${NEW_SHA}",`, `  "pnpm/action-setup@${NEW_SHA}", "evil/action@${OTHER_SHA}",`),
  );
  assertRejected(run(data));

  const widen = scenario();
  mutateHead(widen, POLICY_TEST, (text) => `${text.trimEnd()}\n  // allow all\n`);
  assertRejected(run(widen));
});

test("still rejects test changes with no workflow reference link", () => {
  const data = scenario();
  data.entries = data.entries.filter((entry) => entry.path !== WORKFLOW);
  assertRejected(run(data));
});

test("the realignment never relaxes the existing unsupported-path rule", () => {
  const data = scenario();
  data.entries.push({ status: "M", path: "scripts/governance/pr-governance-validator.mjs" });
  const result = run(data);
  assertRejected(result);
  assert.ok(result.failures.some((failure) => failure.includes("Unsupported change")));
});

test("realignment evaluator reports details for a verified update", () => {
  const data = scenario();
  const result = evaluateDependabotActionsRealignment({
    event: dependabotEvent(),
    entries: data.entries,
    baseSha: "BASE",
    headSha: "HEAD",
    readBlob: (revision: string, path: string) =>
      revision === "BASE" ? data.files.get(path)?.base ?? null : data.files.get(path)?.head ?? null,
  });
  assert.deepEqual(result.failures, []);
  assert.match(result.details.join(" "), /Verified 1 action reference update/);
});

test("Architecture Decision is N/A only for a verified realignment", () => {
  const data = scenario();
  const base = {
    body: "",
    entries: data.entries,
    rootDir: process.cwd(),
    trustedDependabot: true,
  };
  const verified = evaluateArchitectureDecisionContract({ ...base, verifiedActionsRealignment: true });
  assert.equal(verified.status, "N/A");
  assert.deepEqual(verified.failures, []);

  const unverified = evaluateArchitectureDecisionContract({ ...base, verifiedActionsRealignment: false });
  assert.equal(unverified.status, "FAIL");

  const untrusted = evaluateArchitectureDecisionContract({
    ...base,
    trustedDependabot: false,
    verifiedActionsRealignment: true,
  });
  assert.equal(untrusted.status, "FAIL");

  const mixed = evaluateArchitectureDecisionContract({
    ...base,
    entries: [...data.entries, { status: "M", path: "server/index.ts" }],
    verifiedActionsRealignment: true,
  });
  assert.equal(mixed.status, "FAIL");

  const unrelated = evaluateArchitectureDecisionContract({
    ...base,
    entries: [{ status: "M", path: OTHER_WORKFLOW }, { status: "A", path: TOOLCHAIN_TEST }],
    verifiedActionsRealignment: true,
  });
  assert.equal(unrelated.status, "FAIL");
});
