import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  APPROVED_EXTERNAL_ACTIONS,
  CONTAINER_IMAGE_POLICY,
  PERMISSION_POLICY,
  POLICY_VERSION,
} from "../../../scripts/governance/workflow-security-policy.mjs";
import { REQUIRED_SOURCE_PATHS } from "../../../scripts/governance/quality-gate-impact-policy.mjs";
import { evaluateChangedPathImpact } from "../../../scripts/governance/quality-gate-impact-validator.mjs";

const canonicalWorkflowPaths = [
  ".github/workflows/app-version-force-update.yml",
  ".github/workflows/backend-ci.yml",
  ".github/workflows/frontend-ci.yml",
  ".github/workflows/pr-governance.yml",
  ".github/workflows/visual-regression-manual.yml",
] as const;

const pinnedActionReferences = new Map<string, readonly string[]>([
  [".github/workflows/app-version-force-update.yml", []],
  [
    ".github/workflows/backend-ci.yml",
    [
      "actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0",
      "pnpm/action-setup@b906affcce14559ad1aafd4ab0e942779e9f58b1",
      "actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e",
    ],
  ],
  [
    ".github/workflows/frontend-ci.yml",
    [
      "actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0",
      "pnpm/action-setup@b906affcce14559ad1aafd4ab0e942779e9f58b1",
      "actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e",
      "actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a",
    ],
  ],
  [
    ".github/workflows/pr-governance.yml",
    [
      "actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0",
      "actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e",
    ],
  ],
  [
    ".github/workflows/visual-regression-manual.yml",
    [
      "actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0",
      "actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e",
      "actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a",
      "actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a",
    ],
  ],
]);

const mutableActionReferences = [
  "uses: actions/checkout@v7",
  "uses: actions/setup-node@v6",
  "uses: actions/upload-artifact@v7",
  "uses: pnpm/action-setup@v4",
] as const;

function readWorkflow(workflowPath: string): string {
  return readFileSync(resolve(process.cwd(), workflowPath), "utf8").replace(/\r\n/g, "\n");
}

function assertContains(source: string, expected: string, file: string): void {
  assert.ok(source.includes(expected), `${file} must contain: ${expected}`);
}

function assertNotContains(source: string, unexpected: string, file: string): void {
  assert.ok(!source.includes(unexpected), `${file} must not contain: ${unexpected}`);
}

function repositoryFromActionReference(reference: string): string {
  const atIndex = reference.lastIndexOf("@");
  assert.notEqual(atIndex, -1, `action reference must include @: ${reference}`);
  return reference.slice(0, atIndex);
}

test("workflow security policy exposes immutable QGA-4 declarative contract", () => {
  assert.equal(POLICY_VERSION, "QGA-4.1");
  assert.deepEqual(
    APPROVED_EXTERNAL_ACTIONS.map((action) => action.repository).sort(),
    ["actions/checkout", "actions/setup-node", "actions/upload-artifact", "pnpm/action-setup"],
  );
  assert.deepEqual(PERMISSION_POLICY.topLevel, { contents: "read" });
  assert.deepEqual(PERMISSION_POLICY.jobLevelExceptions, []);
  assert.deepEqual(CONTAINER_IMAGE_POLICY.exceptions, [
    {
      workflow: ".github/workflows/backend-ci.yml",
      job: "validate-backend",
      service: "postgres",
      image: "postgres:16",
      owner: "Backend owner",
      reason:
        "The current CI service uses the supported PostgreSQL 16 major line. Digest pinning requires a separately governed image-refresh workflow.",
      reviewBy: "2026-10-01",
    },
  ]);
});

test("repository tracks exactly the five canonical workflow files", () => {
  const actualWorkflowPaths = readdirSync(resolve(process.cwd(), ".github/workflows"))
    .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
    .map((name) => `.github/workflows/${name}`)
    .sort();

  assert.deepEqual(actualWorkflowPaths, [...canonicalWorkflowPaths].sort());
});

test("canonical workflows declare top-level contents read permissions", () => {
  for (const workflowPath of canonicalWorkflowPaths) {
    assertContains(readWorkflow(workflowPath), "permissions:\n  contents: read", workflowPath);
  }
});

test("canonical workflows pin only allowlisted external action references", () => {
  const allowedRepositories = new Set(APPROVED_EXTERNAL_ACTIONS.map((action) => action.repository));

  for (const workflowPath of canonicalWorkflowPaths) {
    const source = readWorkflow(workflowPath);
    const expectedReferences = pinnedActionReferences.get(workflowPath) ?? [];

    for (const reference of expectedReferences) {
      assertContains(source, `uses: ${reference}`, workflowPath);
      assert.ok(allowedRepositories.has(repositoryFromActionReference(reference)), reference);
    }

    for (const mutableReference of mutableActionReferences) {
      assertNotContains(source, mutableReference, workflowPath);
    }
  }
});

test("backend workflow keeps the exact postgres 16 service exception", () => {
  const source = readWorkflow(".github/workflows/backend-ci.yml");

  assertContains(source, "      postgres:\n        image: postgres:16", ".github/workflows/backend-ci.yml");
  assert.equal(CONTAINER_IMAGE_POLICY.exceptions[0].workflow, ".github/workflows/backend-ci.yml");
  assert.equal(CONTAINER_IMAGE_POLICY.exceptions[0].job, "validate-backend");
  assert.equal(CONTAINER_IMAGE_POLICY.exceptions[0].service, "postgres");
  assert.equal(CONTAINER_IMAGE_POLICY.exceptions[0].image, "postgres:16");
});

test("quality impact protects the declarative workflow security policy only", () => {
  assert.ok(REQUIRED_SOURCE_PATHS.includes("scripts/governance/workflow-security-policy.mjs"));
  assert.equal(REQUIRED_SOURCE_PATHS.includes("scripts/governance/workflow-security-validator.mjs"), false);

  const result = evaluateChangedPathImpact({
    entries: [
      {
        status: "D",
        path: "scripts/governance/workflow-security-policy.mjs",
        display: "scripts/governance/workflow-security-policy.mjs",
      },
    ],
  });

  assert.ok(
    result.failures.includes(
      "Quality gate impact policy cannot delete required source: scripts/governance/workflow-security-policy.mjs",
    ),
  );
});
