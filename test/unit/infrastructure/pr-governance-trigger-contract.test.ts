import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { load } from "js-yaml";

// ─────────────────────────────────────────────────────────────────────────────
// PR Governance · trigger lifecycle contract.
//
// Incident #1662: GitHub Actions "Re-run failed jobs" reuses the ORIGINAL
// event payload (the `GITHUB_EVENT_PATH` snapshot taken when the run was
// first created), not a live re-fetch of the pull request. The validator
// (`scripts/governance/pr-governance-validator.mjs`) reads
// `event.pull_request.body` straight from that snapshot, so re-running a
// governance failure can never see a body edited after the run started —
// only a genuinely NEW `pull_request` event carries the current body.
//
// Before this fix, `on.pull_request` declared no `types:`, which defaults to
// `opened` + `synchronize` + `reopened` only. Editing a PR's body/checkboxes
// fires `pull_request.edited`, which was never in that set, so a corrected
// body could never trigger a fresh validation run — the PR stayed blocked on
// a stale failure until a new commit (`synchronize`) or a close/reopen
// (`reopened`) forced a new event.
//
// This contract freezes the trigger lifecycle the fix establishes: the same
// job, same permissions, same pinned actions, same validator command — the
// only semantic change is which `pull_request` activity types start a run.
// ─────────────────────────────────────────────────────────────────────────────

const WORKFLOW_PATH = ".github/workflows/pr-governance.yml";

function readWorkflowSource(repoRelativePath: string): string {
  return readFileSync(resolve(process.cwd(), repoRelativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

type WorkflowDocument = {
  readonly on: {
    readonly pull_request?: {
      readonly branches?: readonly string[];
      readonly types?: readonly string[];
    };
    readonly workflow_dispatch?: unknown;
    readonly pull_request_target?: unknown;
  };
  readonly permissions?: Readonly<Record<string, string>>;
  readonly jobs: Readonly<
    Record<
      string,
      {
        readonly name?: string;
        readonly if?: string;
        readonly steps: ReadonlyArray<{
          readonly name?: string;
          readonly run?: string;
          readonly if?: string;
        }>;
      }
    >
  >;
};

function parseWorkflow(source: string): WorkflowDocument {
  return load(source) as WorkflowDocument;
}

const REQUIRED_TYPES = ["opened", "synchronize", "reopened", "edited"] as const;

/**
 * Every assertion the fix must satisfy, run against a parsed workflow
 * document. Shared between the real-file test and the mutation tests below so
 * the two can never police different rules.
 */
function assertTriggerContract(doc: WorkflowDocument): void {
  // 1. Still listens to pull_request.
  assert.ok(
    Object.prototype.hasOwnProperty.call(doc.on, "pull_request"),
    "PR Governance must still trigger on pull_request",
  );

  // 2. Target branch is still main.
  assert.deepEqual(
    doc.on.pull_request?.branches,
    ["main"],
    "PR Governance must still target only main",
  );

  // 3 & 4. edited is explicit, and opened/synchronize/reopened are not lost.
  const types = doc.on.pull_request?.types ?? [];
  for (const requiredType of REQUIRED_TYPES) {
    assert.ok(
      types.includes(requiredType),
      `pull_request.types must include "${requiredType}"`,
    );
  }
  assert.equal(
    new Set(types).size,
    REQUIRED_TYPES.length,
    `pull_request.types must be exactly ${JSON.stringify(REQUIRED_TYPES)}, found ${JSON.stringify(types)}`,
  );

  // 5. Job name unchanged.
  const job = doc.jobs["validate-pr-governance"];
  assert.ok(job, "the validate-pr-governance job must still exist");
  assert.equal(
    job.name,
    "validate-pr-governance",
    "the job's display name must stay validate-pr-governance",
  );

  // 6. Permissions stay minimal (contents: read only).
  assert.deepEqual(
    doc.permissions,
    { contents: "read" },
    "permissions must stay exactly { contents: read }",
  );

  // 7. Validator command unchanged.
  const validateStep = job.steps.find((step) =>
    step.run?.includes("pr-governance-validator.mjs"),
  );
  assert.ok(validateStep, "a step invoking pr-governance-validator.mjs must exist");
  assert.equal(
    validateStep.run?.trim(),
    "node scripts/governance/pr-governance-validator.mjs",
    "the validator invocation must stay exactly this command, no flags or env overrides",
  );

  // 8. pull_request_target never appears.
  assert.equal(
    doc.on.pull_request_target,
    undefined,
    "pull_request_target must never be used — it runs with base-branch privileges against head-branch content",
  );

  // 9. No permission scope is write.
  for (const [scope, level] of Object.entries(doc.permissions ?? {})) {
    assert.notEqual(level, "write", `permission "${scope}" must not be write`);
  }

  // 10. workflow_dispatch exists as a manual escape hatch but is not a bypass:
  // no job- or step-level `if` conditions on event name that would let a
  // workflow_dispatch run skip validation while still reporting success.
  assert.ok(
    Object.prototype.hasOwnProperty.call(doc.on, "workflow_dispatch"),
    "workflow_dispatch must remain available for manual re-validation",
  );
  assert.equal(job.if, undefined, "the job must not gate itself on event_name");
  for (const step of job.steps) {
    assert.equal(
      step.if,
      undefined,
      `step "${step.name}" must not conditionally skip based on event_name`,
    );
  }
}

test("PR Governance workflow trigger lifecycle matches the frozen contract", () => {
  const doc = parseWorkflow(readWorkflowSource(WORKFLOW_PATH));
  assertTriggerContract(doc);
});

test("the real workflow source contains no pull_request_target string anywhere", () => {
  // Belt-and-suspenders on top of the parsed check (9): a string scan catches
  // a pull_request_target added as a SIBLING key under `on`, which the parsed
  // check above would also catch, and one added inside a comment, which a
  // parser would silently ignore but a human reading the file would not.
  const source = readWorkflowSource(WORKFLOW_PATH);
  assert.ok(
    !source.includes("pull_request_target"),
    "pull_request_target must not appear anywhere in the workflow, including comments",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Mutation control — proves the contract above is fail-closed, entirely on
// in-memory string fixtures. Never mutates the tracked workflow file.
// ─────────────────────────────────────────────────────────────────────────────

const BASELINE_WORKFLOW = `name: PR Governance

on:
  pull_request:
    branches:
      - main
    types:
      - opened
      - synchronize
      - reopened
      - edited
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: pr-governance-\${{ github.workflow }}-\${{ github.event.pull_request.number || github.ref_name || github.run_id }}
  cancel-in-progress: true

jobs:
  validate-pr-governance:
    name: validate-pr-governance
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - name: Checkout repository
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7
        with:
          node-version: 24

      - name: Validate pull request governance
        run: node scripts/governance/pr-governance-validator.mjs
`;

test("M4 — the baseline fixture itself satisfies the trigger contract", () => {
  assert.doesNotThrow(() => assertTriggerContract(parseWorkflow(BASELINE_WORKFLOW)));
});

test("M1 — removing 'edited' from types fails closed", () => {
  const mutated = BASELINE_WORKFLOW.replace("      - edited\n", "");
  assert.throws(() => assertTriggerContract(parseWorkflow(mutated)), /types must include "edited"/);
});

test("M2 — widening permissions to write fails closed", () => {
  const mutated = BASELINE_WORKFLOW.replace("  contents: read", "  contents: write");
  assert.throws(
    () => assertTriggerContract(parseWorkflow(mutated)),
    /permissions must stay exactly/,
  );
});

test("M3 — switching to pull_request_target fails closed", () => {
  const mutated = BASELINE_WORKFLOW.replace("  pull_request:\n", "  pull_request_target:\n");
  assert.throws(
    () => assertTriggerContract(parseWorkflow(mutated)),
    /PR Governance must still trigger on pull_request/,
  );
});
