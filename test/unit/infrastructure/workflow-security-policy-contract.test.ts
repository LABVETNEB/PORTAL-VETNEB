import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
  ".github/workflows/qga-governance.yml",
  ".github/workflows/visual-regression-manual.yml",
] as const;

const pinnedActionReferences = new Map<string, readonly string[]>([
  [".github/workflows/app-version-force-update.yml", []],
  [
    ".github/workflows/backend-ci.yml",
    [
      "actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0",
      "pnpm/action-setup@0ebf47130e4866e96fce0953f49152a61190b271",
      "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020",
    ],
  ],
  [
    ".github/workflows/frontend-ci.yml",
    [
      "actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0",
      "pnpm/action-setup@0ebf47130e4866e96fce0953f49152a61190b271",
      "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020",
      "actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a",
    ],
  ],
  [
    ".github/workflows/pr-governance.yml",
    [
      "actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0",
      "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020",
    ],
  ],
  [
    ".github/workflows/qga-governance.yml",
    [
      "actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0",
      "actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0",
      "pnpm/action-setup@0ebf47130e4866e96fce0953f49152a61190b271",
      "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020",
      "actions/create-github-app-token@bcd2ba49218906704ab6c1aa796996da409d3eb1",
    ],
  ],
  [
    ".github/workflows/visual-regression-manual.yml",
    [
      "actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0",
      "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020",
      "actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a",
      "actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a",
    ],
  ],
]);

const mutableActionReferences = [
  "uses: actions/checkout@v7",
  "uses: actions/create-github-app-token@v3",
  "uses: actions/setup-node@v7",
  "uses: actions/upload-artifact@v7",
  "uses: pnpm/action-setup@v6",
] as const;

const canonicalWorkflowDigests = new Map<string, string>([
  [".github/workflows/app-version-force-update.yml", "25c69fb58364b709395f0ee920560845a83941eeb86efdd759a69af5f880d701"],
  [".github/workflows/backend-ci.yml", "f40ad6d2859e9ba594c83126f9ba1e87e0a1f031193396bb98feea2f0e40f882"],
  [".github/workflows/frontend-ci.yml", "5e7293bc535ace53903ed8364a9c0defb102b0dce6b8a1d999a8434231c12290"],
  [".github/workflows/pr-governance.yml", "11a3f1b9a0afa6e935709deac50d38bccea2ca074599b6f272e05ca380ddff80"],
  [".github/workflows/qga-governance.yml", "89abf7907ed702b5f7de82f3b0f0cc174e8cdf2e990f9dd0f61cea49a65de2ee"],
  [".github/workflows/visual-regression-manual.yml", "3344160f3c37da9067ba744ca317a27168799839157c95301e8ac3905754faf0"],
]);

function readWorkflow(workflowPath: string): string {
  return readFileSync(resolve(process.cwd(), workflowPath), "utf8").replace(/\r\n/g, "\n");
}

function workflowDigest(source: string): string {
  return createHash("sha256").update(source, "utf8").digest("hex");
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
  assert.equal(POLICY_VERSION, "QGA-4.2");
  assert.deepEqual(
    APPROVED_EXTERNAL_ACTIONS.map((action) => action.repository).sort(),
    [
      "actions/checkout",
      "actions/create-github-app-token",
      "actions/setup-node",
      "actions/upload-artifact",
      "pnpm/action-setup",
    ],
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

test("repository tracks exactly the six canonical workflow files", () => {
  const actualWorkflowPaths = readdirSync(resolve(process.cwd(), ".github/workflows"))
    .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
    .map((name) => `.github/workflows/${name}`)
    .sort();

  assert.deepEqual(actualWorkflowPaths, [...canonicalWorkflowPaths].sort());
});

test("canonical workflow security state is frozen until parser-backed enforcement", () => {
  assert.deepEqual([...canonicalWorkflowDigests.keys()].sort(), [...canonicalWorkflowPaths].sort());

  for (const workflowPath of canonicalWorkflowPaths) {
    const expectedDigest = canonicalWorkflowDigests.get(workflowPath);
    assert.ok(expectedDigest, `${workflowPath} must have a reviewed SHA-256 digest`);
    assert.match(expectedDigest, /^[0-9a-f]{64}$/, `${workflowPath} must have a reviewed SHA-256 digest`);

    const actualDigest = workflowDigest(readWorkflow(workflowPath));
    assert.equal(
      actualDigest,
      expectedDigest,
      `${workflowPath} changed; update the reviewed canonical digest only after explicit workflow-security review`,
    );
  }
});

test("workflow digest changes when bootstrap-denied workflow content is added", () => {
  const baseline = `name: Fixture
on:
  pull_request:
permissions:
  contents: read
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - run: echo ok
`;

  assert.notEqual(
    workflowDigest(baseline),
    workflowDigest(`${baseline}      - uses: some/action@main\n`),
  );
  assert.notEqual(
    workflowDigest(baseline),
    workflowDigest(`${baseline}    permissions: write-all\n`),
  );
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

test("quality impact protects the declarative workflow security policy and parser-backed validator", () => {
  assert.ok(REQUIRED_SOURCE_PATHS.includes("scripts/governance/workflow-security-policy.mjs"));
  assert.ok(REQUIRED_SOURCE_PATHS.includes("scripts/governance/workflow-security-validator.mjs"));

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
