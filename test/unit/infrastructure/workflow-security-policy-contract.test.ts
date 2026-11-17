import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";

import {
  APPROVED_EXTERNAL_ACTIONS,
  CONTAINER_IMAGE_POLICY,
  PERMISSION_POLICY,
  POLICY_VERSION,
} from "../../../scripts/governance/workflow-security-policy.mjs";
import { REQUIRED_SOURCE_PATHS } from "../../../scripts/governance/quality-gate-impact-policy.mjs";
import { evaluateChangedPathImpact } from "../../../scripts/governance/quality-gate-impact-validator.mjs";
import { readSourceFile as readWorkflow } from "../../helpers/tracked-source-files.ts";

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
      "pnpm/action-setup@73e46992e05b19abd31f2f3c20e0e7370d762115",
      "actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1",
      "actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9",
    ],
  ],
  [
    ".github/workflows/e2e-completeness.yml",
    [
      "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
      "pnpm/action-setup@73e46992e05b19abd31f2f3c20e0e7370d762115",
      "actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1",
      "actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9",
    ],
  ],
  [
    ".github/workflows/frontend-ci.yml",
    [
      "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
      "pnpm/action-setup@73e46992e05b19abd31f2f3c20e0e7370d762115",
      "actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1",
      "actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9",
      "actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9",
    ],
  ],
  [
    ".github/workflows/pr-governance.yml",
    [
      "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
      "actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1",
    ],
  ],
  [
    ".github/workflows/qga-governance.yml",
    [
      "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
      "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
      "pnpm/action-setup@73e46992e05b19abd31f2f3c20e0e7370d762115",
      "actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1",
      "actions/create-github-app-token@64ab729a6294000f5aa4a4bc0b73d1f32bc45510",
    ],
  ],
  [
    ".github/workflows/visual-regression-manual.yml",
    [
      "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
      "actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1",
      "actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9",
      "actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9",
      "actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9",
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
  [".github/workflows/backend-ci.yml", "8b164a86a82a5661dc5fa6de6e35a255881afe836e2490de23cbf88fa6178d04"],
  [".github/workflows/e2e-completeness.yml", "0d1713619d3ac59dd8f686a7ce66a702326116ebb0e903fe1bbf977a4e7d97d1"],
  [".github/workflows/frontend-ci.yml", "102a97a4fefa6942766907b73608165d2071b2ce418b29cdb833ccc682f82e33"],
  [".github/workflows/pr-governance.yml", "461c358ea8e6db8393f77ec3f68401083e58b24352a4fb211d1e937bff6a7531"],
  [".github/workflows/qga-governance.yml", "418f1e3b2788f0e17f0c6380c258b66b03d95e57cbfbf101bcd2fd0e4cc5da75"],
  [".github/workflows/visual-regression-manual.yml", "ea13acfeb13786cb52109288fe4807116dc0982ff9dc104ee3694f6c5c4010a6"],
]);

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

test("backend workflow keeps the exact PostgreSQL 16 service exception", () => {
  const source = readWorkflow(".github/workflows/backend-ci.yml");

  assertContains(source, "      postgres:\n        image: postgres:16", ".github/workflows/backend-ci.yml");
  assert.equal(CONTAINER_IMAGE_POLICY.exceptions.length, 1);
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
