import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  evaluateWorkflowSecurity,
  renderWorkflowSecuritySummary,
} from "../../../scripts/governance/workflow-security-validator.mjs";
import { REQUIRED_SOURCE_PATHS } from "../../../scripts/governance/quality-gate-impact-policy.mjs";
import {
  evaluateChangedPathImpact,
  validateImpactPolicy,
} from "../../../scripts/governance/quality-gate-impact-validator.mjs";
import { classifyPath } from "../../../scripts/governance/pr-governance-validator.mjs";

const checkoutSha = "9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0";
const setupNodeSha = "820762786026740c76f36085b0efc47a31fe5020";
const uploadArtifactSha = "043fb46d1a93c77aae656e7c1c64a875d1fc6a0a";
const pnpmSha = "0ebf47130e4866e96fce0953f49152a61190b271";

function writeWorkflowFixture(t: test.TestContext, workflowName: string, source: string): string {
  const rootDir = mkdtempSync(join(tmpdir(), "vetneb-workflow-security-"));
  const workflowDir = join(rootDir, ".github", "workflows");
  mkdirSync(workflowDir, { recursive: true });
  writeFileSync(join(workflowDir, workflowName), source, "utf8");
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));
  return rootDir;
}

function evaluateFixture(t: test.TestContext, source: string, workflowName = "fixture.yml") {
  const rootDir = writeWorkflowFixture(t, workflowName, source);
  return evaluateWorkflowSecurity({ rootDir });
}

function safeWorkflow(stepUses = `actions/checkout@${checkoutSha}`): string {
  return `name: Fixture
on:
  pull_request:
permissions:
  contents: read
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: ${stepUses}
`;
}

function safeWorkflowWithExtra(extra: string): string {
  return `name: Fixture
on:
  pull_request:
permissions:
  contents: read
jobs:
  validate:
    runs-on: ubuntu-latest
${extra}
`;
}

function assertPasses(report: ReturnType<typeof evaluateWorkflowSecurity>): void {
  assert.equal(report.passed, true, JSON.stringify(report.failures, null, 2));
  assert.deepEqual(report.failures, []);
}

function assertFailsWith(
  report: ReturnType<typeof evaluateWorkflowSecurity>,
  path: string,
  causeIncludes: string,
): void {
  assert.equal(report.passed, false, "report must fail");
  assert.ok(
    report.failures.some((failure) => failure.path === path && failure.cause.includes(causeIncludes)),
    JSON.stringify(report.failures, null, 2),
  );
  for (const failure of report.failures) {
    assert.ok(failure.workflow, "failure must include workflow");
    assert.ok(failure.path, "failure must include semantic path");
    assert.ok(failure.cause, "failure must include exact cause");
  }
}

test("parser-backed validator accepts the six real workflows", () => {
  const report = evaluateWorkflowSecurity();

  assertPasses(report);
  assert.deepEqual(
    report.workflows.map((entry) => entry.workflow).sort(),
    [
      ".github/workflows/app-version-force-update.yml",
      ".github/workflows/backend-ci.yml",
      ".github/workflows/frontend-ci.yml",
      ".github/workflows/pr-governance.yml",
      ".github/workflows/qga-governance.yml",
      ".github/workflows/visual-regression-manual.yml",
    ],
  );
  assert.equal(report.policyVersion, "QGA-4.2");
  assert.equal(report.exceptionsUsed.length, 1);
  assert.equal(report.exceptionsUsed[0].path, "jobs.validate-backend.services.postgres.image");
});

test("current pinned actions are approved and use lowercase SHA refs", () => {
  const report = evaluateWorkflowSecurity();

  assertPasses(report);
  assert.ok(report.externalActions.length > 0);
  for (const action of report.externalActions) {
    assert.match(action.ref, /^[0-9a-f]{40}$/);
    assert.ok(
      [
        "actions/checkout",
        "actions/create-github-app-token",
        "actions/setup-node",
        "actions/upload-artifact",
        "pnpm/action-setup",
      ].includes(action.repository),
      action.repository,
    );
  }
});

test("top-level contents read permissions pass", (t) => {
  const report = evaluateFixture(t, safeWorkflow());

  assertPasses(report);
  assert.deepEqual(report.permissions[0].permissions, { contents: "read" });
});

test("postgres 16 uses exactly the declared service exception", (t) => {
  const report = evaluateFixture(
    t,
    `name: Backend CI
on:
  pull_request:
permissions:
  contents: read
jobs:
  validate-backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
    steps:
      - run: echo ok
`,
    "backend-ci.yml",
  );

  assertPasses(report);
  assert.equal(report.containerImages.length, 1);
  assert.equal(report.containerImages[0].allowedBy, "exception");
  assert.equal(report.exceptionsUsed.length, 1);
});

test("quoted YAML keys are parsed and validated semantically", (t) => {
  const report = evaluateFixture(
    t,
    `"name": Fixture
"on":
  "pull_request":
"permissions":
  "contents": read
"jobs":
  "validate":
    "runs-on": ubuntu-latest
    "steps":
      - "uses": "actions/checkout@${checkoutSha}"
`,
  );

  assertPasses(report);
});

test("flow-style safe workflow passes", (t) => {
  const report = evaluateFixture(
    t,
    `name: Fixture
on: { pull_request: null }
permissions: { contents: read }
jobs: { validate: { runs-on: ubuntu-latest, steps: [ { uses: actions/checkout@${checkoutSha} } ] } }
`,
  );

  assertPasses(report);
});

test("unused anchor without alias passes", (t) => {
  const report = evaluateFixture(
    t,
    `name: Fixture
on:
  pull_request:
permissions:
  contents: read
env:
  SAFE_TEXT: &safeText echo ok
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@${checkoutSha}
      - run: echo ok
`,
  );

  assertPasses(report);
});

test("scalar alias is rejected", (t) => {
  const report = evaluateFixture(
    t,
    `name: Fixture
on:
  pull_request:
permissions:
  contents: read
env:
  SAFE_TEXT: &safeText echo ok
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@${checkoutSha}
      - run: *safeText
`,
  );

  assertFailsWith(report, "$", "YAML aliases are not allowed");
});

test("mapping alias is rejected", (t) => {
  const report = evaluateFixture(
    t,
    `name: Fixture
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
  );

  assertFailsWith(report, "$", "YAML aliases are not allowed");
});

test("sequence alias is rejected", (t) => {
  const report = evaluateFixture(
    t,
    `name: Fixture
on:
  pull_request:
permissions:
  contents: read
x-steps: &safeSteps
  - uses: actions/checkout@${checkoutSha}
jobs:
  validate:
    runs-on: ubuntu-latest
    steps: *safeSteps
`,
  );

  assertFailsWith(report, "$", "YAML aliases are not allowed");
});

test("merge alias is rejected", (t) => {
  const report = evaluateFixture(
    t,
    `name: Fixture
on:
  pull_request:
permissions:
  contents: read
x-defaults: &defaults
  runs-on: ubuntu-latest
jobs:
  validate:
    <<: *defaults
    steps:
      - uses: actions/checkout@${checkoutSha}
`,
  );

  assertFailsWith(report, "$", "YAML aliases are not allowed");
});

test("block scalars with YAML-like text do not create false positives", (t) => {
  const report = evaluateFixture(
    t,
    `name: Fixture
on:
  pull_request:
permissions:
  contents: read
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@${checkoutSha}
      - run: |
          uses: actions/checkout@main
          permissions: write-all
          image: redis:latest
`,
  );

  assertPasses(report);
});

test("local action under .github/actions passes", (t) => {
  const report = evaluateFixture(t, safeWorkflow("./.github/actions/build"));

  assertPasses(report);
  assert.deepEqual(report.localActions[0], {
    workflow: ".github/workflows/fixture.yml",
    path: "jobs.validate.steps[0].uses",
    reference: "./.github/actions/build",
    normalizedPath: ".github/actions/build",
  });
});

test("additional mutable uses reference fails", (t) => {
  const report = evaluateFixture(
    t,
    `name: Fixture
on:
  pull_request:
permissions:
  contents: read
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@${checkoutSha}
      - uses: actions/checkout@main
`,
  );

  assertFailsWith(report, "jobs.validate.steps[1].uses", "not a tag, branch or expression");
});

test("non-allowlisted action fails", (t) => {
  const report = evaluateFixture(t, safeWorkflow(`untrusted/action@${checkoutSha}`));

  assertFailsWith(report, "jobs.validate.steps[0].uses", "repository is not approved");
});

test("short SHA action ref fails", (t) => {
  const report = evaluateFixture(t, safeWorkflow("actions/checkout@123abc"));

  assertFailsWith(report, "jobs.validate.steps[0].uses", "short SHA");
});

test("branch main action ref fails", (t) => {
  const report = evaluateFixture(t, safeWorkflow("actions/checkout@main"));

  assertFailsWith(report, "jobs.validate.steps[0].uses", "not a tag, branch or expression");
});

test("tag v7 action ref fails", (t) => {
  const report = evaluateFixture(t, safeWorkflow("actions/checkout@v7"));

  assertFailsWith(report, "jobs.validate.steps[0].uses", "not a tag, branch or expression");
});

test("quoted mutable uses ref fails after YAML parsing", (t) => {
  const report = evaluateFixture(t, safeWorkflow('"actions/checkout@v7"'));

  assertFailsWith(report, "jobs.validate.steps[0].uses", "not a tag, branch or expression");
});

test("mutable reusable workflow reference fails", (t) => {
  const report = evaluateFixture(
    t,
    `name: Fixture
on:
  pull_request:
permissions:
  contents: read
jobs:
  validate:
    uses: actions/checkout/.github/workflows/reusable.yml@main
`,
  );

  assertFailsWith(report, "jobs.validate.uses", "not a tag, branch or expression");
});

test("job-level permissions fail", (t) => {
  const report = evaluateFixture(
    t,
    safeWorkflowWithExtra(`    permissions:
      contents: read
    steps:
      - run: echo ok
`),
  );

  assertFailsWith(report, "jobs.validate.permissions", "Job-level permissions are not allowed");
});

test("top-level write-all permissions fail", (t) => {
  const report = evaluateFixture(
    t,
    `name: Fixture
on:
  pull_request:
permissions: write-all
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - run: echo ok
`,
  );

  assertFailsWith(report, "permissions", "cannot be write-all");
});

test("top-level read-all permissions fail", (t) => {
  const report = evaluateFixture(
    t,
    `name: Fixture
on:
  pull_request:
permissions: read-all
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - run: echo ok
`,
  );

  assertFailsWith(report, "permissions", "cannot be read-all");
});

test("additional top-level permission key fails", (t) => {
  const report = evaluateFixture(
    t,
    `name: Fixture
on:
  pull_request:
permissions:
  contents: read
  actions: read
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - run: echo ok
`,
  );

  assertFailsWith(report, "permissions.actions", "not allowed");
});

test("job container latest fails", (t) => {
  const report = evaluateFixture(
    t,
    safeWorkflowWithExtra(`    container: node:latest
    steps:
      - run: echo ok
`),
  );

  assertFailsWith(report, "jobs.validate.container", "latest tag is not allowed");
});

test("service latest fails", (t) => {
  const report = evaluateFixture(
    t,
    safeWorkflowWithExtra(`    services:
      redis:
        image: redis:latest
    steps:
      - run: echo ok
`),
  );

  assertFailsWith(report, "jobs.validate.services.redis.image", "latest tag is not allowed");
});

test("postgres exception fails in another workflow", (t) => {
  const report = evaluateFixture(
    t,
    safeWorkflowWithExtra(`    services:
      postgres:
        image: postgres:16
    steps:
      - run: echo ok
`),
  );

  assertFailsWith(report, "jobs.validate.services.postgres.image", "pinned by sha256 digest");
});

test("postgres exception fails in another job", (t) => {
  const report = evaluateFixture(
    t,
    `name: Backend CI
on:
  pull_request:
permissions:
  contents: read
jobs:
  other:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
    steps:
      - run: echo ok
`,
    "backend-ci.yml",
  );

  assertFailsWith(report, "jobs.other.services.postgres.image", "pinned by sha256 digest");
});

test("postgres exception fails with another service name", (t) => {
  const report = evaluateFixture(
    t,
    `name: Backend CI
on:
  pull_request:
permissions:
  contents: read
jobs:
  validate-backend:
    runs-on: ubuntu-latest
    services:
      database:
        image: postgres:16
    steps:
      - run: echo ok
`,
    "backend-ci.yml",
  );

  assertFailsWith(report, "jobs.validate-backend.services.database.image", "pinned by sha256 digest");
});

test("multiple YAML documents fail", (t) => {
  const report = evaluateFixture(t, `${safeWorkflow()}---
name: Other
`);

  assertFailsWith(report, "$", "Multiple YAML documents");
});

test("invalid YAML fails", (t) => {
  const report = evaluateFixture(t, "name: [\n");

  assertFailsWith(report, "$", "YAML parse error");
});

test("empty workflow document fails", (t) => {
  const report = evaluateFixture(t, "# comment only\n");

  assertFailsWith(report, "$", "must not be empty");
});

test("root sequence fails", (t) => {
  const report = evaluateFixture(
    t,
    `- name: Fixture
- jobs: []
`,
  );

  assertFailsWith(report, "$", "root must be a mapping");
});

test("local action outside .github/actions fails", (t) => {
  const report = evaluateFixture(t, safeWorkflow("./scripts/build-action"));

  assertFailsWith(report, "jobs.validate.steps[0].uses", "inside .github/actions");
});

test("local action path traversal fails", (t) => {
  const report = evaluateFixture(t, safeWorkflow("./.github/actions/../workflows/bad"));

  assertFailsWith(report, "jobs.validate.steps[0].uses", "path traversal");
});

test("collection aliases report workflow semantic path and deterministic cause", (t) => {
  const report = evaluateFixture(
    t,
    `name: Fixture
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
  );

  assertFailsWith(report, "$", "YAML aliases are not allowed");
  assert.equal(report.failures[0].workflow, ".github/workflows/fixture.yml");
  assert.equal(report.failures[0].path, "$");
});

test("sha256-pinned job container passes", (t) => {
  const report = evaluateFixture(
    t,
    safeWorkflowWithExtra(`    container:
      image: node@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
    steps:
      - run: echo ok
`),
  );

  assertPasses(report);
  assert.equal(report.containerImages[0].allowedBy, "sha256-digest");
});

test("workflow security validator is classified as workflows CI and required source", () => {
  assert.equal(classifyPath("scripts/governance/workflow-security-validator.mjs"), "workflows/CI");
  assert.equal(classifyPath("scripts/governance/workflow-security-validator.d.mts"), "workflows/CI");
  assert.ok(REQUIRED_SOURCE_PATHS.includes("scripts/governance/workflow-security-validator.mjs"));
  assert.deepEqual(validateImpactPolicy().failures, []);

  const result = evaluateChangedPathImpact({
    entries: [
      {
        status: "D",
        path: "scripts/governance/workflow-security-validator.mjs",
        display: "scripts/governance/workflow-security-validator.mjs",
      },
    ],
  });

  assert.ok(
    result.failures.includes(
      "Quality gate impact policy cannot delete required source: scripts/governance/workflow-security-validator.mjs",
    ),
  );
});

test("human summary stays deterministic and includes exact failure causes", (t) => {
  const report = evaluateFixture(t, safeWorkflow("actions/checkout@v7"));
  const summary = renderWorkflowSecuritySummary(report);

  assert.match(summary, /^Workflow security validator FAIL\./);
  assert.match(summary, /Policy version: QGA-4\.2\./);
  assert.match(summary, /jobs\.validate\.steps\[0\]\.uses/);
  assert.match(summary, /not a tag, branch or expression/);
});

test("fixture constants cover all currently approved action repositories", () => {
  assert.match(checkoutSha, /^[0-9a-f]{40}$/);
  assert.match(setupNodeSha, /^[0-9a-f]{40}$/);
  assert.match(uploadArtifactSha, /^[0-9a-f]{40}$/);
  assert.match(pnpmSha, /^[0-9a-f]{40}$/);
});
