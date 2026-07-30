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
  ".github/workflows/e2e-completeness.yml",
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
      "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
      "pnpm/action-setup@0ebf47130e4866e96fce0953f49152a61190b271",
      "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020",
    ],
  ],
  [
    ".github/workflows/e2e-completeness.yml",
    [
      "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
      "pnpm/action-setup@0ebf47130e4866e96fce0953f49152a61190b271",
      "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020",
      "actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a",
    ],
  ],
  [
    ".github/workflows/frontend-ci.yml",
    [
      "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
      "pnpm/action-setup@0ebf47130e4866e96fce0953f49152a61190b271",
      "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020",
      "actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a",
    ],
  ],
  [
    ".github/workflows/pr-governance.yml",
    [
      "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
      "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020",
    ],
  ],
  [
    ".github/workflows/qga-governance.yml",
    [
      "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
      "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
      "pnpm/action-setup@0ebf47130e4866e96fce0953f49152a61190b271",
      "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020",
      "actions/create-github-app-token@bcd2ba49218906704ab6c1aa796996da409d3eb1",
    ],
  ],
  [
    ".github/workflows/visual-regression-manual.yml",
    [
      "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
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
  [".github/workflows/backend-ci.yml", "e696873b397ae05da365e436c9e150bef7a98517cdce545a9a9549252b1037b3"],
  [".github/workflows/e2e-completeness.yml", "3ecc24d620b47bd71c53c3371d04a62de0a616439c84236d2135afd16f0d17a7"],
  [".github/workflows/frontend-ci.yml", "4be3b3303e74152a053d26d739fce5b0fea4cade7e54c1bb86d5c0ba248fe4eb"],
  [".github/workflows/pr-governance.yml", "4e0bf177a8581c9dd655f1ca6aa1510a823cdd976c885c4ba50b41129e4157d7"],
  [".github/workflows/qga-governance.yml", "88ed322d67eda6fbec0a7ed0fa106625a43263a4d6998d6eceb24aeee389b393"],
  [".github/workflows/visual-regression-manual.yml", "86784fe26f1f15e2ae6fb60ee8c26ef050f311bcebab72a2e1732739e035fee9"],
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

test("repository tracks exactly the seven canonical workflow files", () => {
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
