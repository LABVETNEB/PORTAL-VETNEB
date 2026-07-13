import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  APPROVED_EXTERNAL_ACTIONS,
  CONTAINER_IMAGE_POLICY,
  PERMISSION_POLICY,
  POLICY_VERSION,
} from "../../../scripts/governance/workflow-security-policy.mjs";
import {
  isPinnedExternalActionReference,
  validateWorkflowSecurityDocument,
  validateWorkflowSecurityRepository,
} from "../../../scripts/governance/workflow-security-validator.mjs";
import { evaluateChangedPathImpact } from "../../../scripts/governance/quality-gate-impact-validator.mjs";

const sha = "0123456789abcdef0123456789abcdef01234567";
const digest = "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

function workflow(body: string): string {
  return `name: Fixture

on:
  pull_request:

permissions:
  contents: read

jobs:
  validate:
    runs-on: ubuntu-latest
${body}
`;
}

function validate(text: string, workflowPath = ".github/workflows/fixture.yml") {
  return validateWorkflowSecurityDocument({ workflowPath, text });
}

function validStep(reference: string): string {
  return workflow(`    steps:
      - name: Use action
        uses: ${reference}
`);
}

function assertUnsupportedFlowStyle(result: ReturnType<typeof validate>): void {
  assert.ok(
    result.failures.some(
      (failure) =>
        failure.includes("unsupported flow-style YAML") &&
        /\.github\/workflows\/fixture\.yml:\d+/.test(failure),
    ),
    `expected unsupported flow-style YAML failure with location, got: ${result.failures.join("; ")}`,
  );
}

function assertFailureIncludes(result: ReturnType<typeof validate>, expected: string): void {
  assert.ok(
    result.failures.some((failure) => failure.includes(expected)),
    `expected failure containing "${expected}", got: ${result.failures.join("; ")}`,
  );
}

test("workflow security policy exposes immutable QGA-4 contract", () => {
  assert.equal(POLICY_VERSION, "QGA-4.1");
  assert.deepEqual(
    APPROVED_EXTERNAL_ACTIONS.map((action) => action.repository).sort(),
    ["actions/checkout", "actions/setup-node", "actions/upload-artifact", "pnpm/action-setup"],
  );
  assert.deepEqual(PERMISSION_POLICY.topLevel, { contents: "read" });
  assert.equal(CONTAINER_IMAGE_POLICY.exceptions.length, 1);
  assert.equal(CONTAINER_IMAGE_POLICY.exceptions[0].image, "postgres:16");
});

test("the five real workflows pass workflow security validation", () => {
  const result = validateWorkflowSecurityRepository();

  assert.deepEqual(result.failures, []);
  assert.equal(result.workflows.length, 5);
  assert.deepEqual(
    result.workflows.map((entry) => entry.path).sort(),
    [
      ".github/workflows/app-version-force-update.yml",
      ".github/workflows/backend-ci.yml",
      ".github/workflows/frontend-ci.yml",
      ".github/workflows/pr-governance.yml",
      ".github/workflows/visual-regression-manual.yml",
    ],
  );
});

test("the five real workflows declare explicit contents read permissions", () => {
  const result = validateWorkflowSecurityRepository();

  for (const permission of result.permissions) {
    assert.equal(permission.entries.contents.value, "read", permission.workflow);
    assert.equal(Object.keys(permission.entries).length, 1, permission.workflow);
  }
});

test("app-version force update workflow passes without external actions", () => {
  const text = readFileSync(resolve(process.cwd(), ".github/workflows/app-version-force-update.yml"), "utf8");
  const result = validate(text, ".github/workflows/app-version-force-update.yml");

  assert.deepEqual(result.failures, []);
  assert.equal(result.externalActions.length, 0);
  assert.equal(result.containerImages.length, 0);
});

test("visual regression manual workflow passes with pinned actions", () => {
  const text = readFileSync(resolve(process.cwd(), ".github/workflows/visual-regression-manual.yml"), "utf8");
  const result = validate(text, ".github/workflows/visual-regression-manual.yml");

  assert.deepEqual(result.failures, []);
  assert.equal(result.externalActions.length, 4);
  assert.ok(result.externalActions.every((action) => /@[0-9a-f]{40}$/.test(action.reference)));
});

test("approved external action pinned to full SHA passes", () => {
  const result = validate(validStep(`actions/checkout@${sha}`));

  assert.deepEqual(result.failures, []);
  assert.equal(isPinnedExternalActionReference(`actions/checkout@${sha}`), true);
});

test("arbitrary job indentation with pinned action passes", () => {
  const result = validate(`name: Arbitrary
on:
  pull_request:
permissions:
  contents: read
jobs:
    validate:
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@${sha}
`);

  assert.deepEqual(result.failures, []);
});

test("jobs with one-space indentation and safe content pass", () => {
  const result = validate(`name: One space
on:
  pull_request:
permissions:
  contents: read
jobs:
 validate:
   runs-on: ubuntu-latest
   steps:
    - run: echo ok
`);

  assert.deepEqual(result.failures, []);
});

test("two sibling jobs with four-space indentation pass", () => {
  const result = validate(`name: Siblings
on:
  pull_request:
permissions:
  contents: read
jobs:
    validate:
        runs-on: ubuntu-latest
        steps:
          - run: echo ok
    audit:
        runs-on: ubuntu-latest
        steps:
          - run: echo ok
`);

  assert.deepEqual(result.failures, []);
});

test("quoted approved external action pinned to full SHA passes", () => {
  const result = validate(workflow(`    steps:
      - "uses": actions/checkout@${sha}
`));

  assert.deepEqual(result.failures, []);
});

test("single-quoted approved external action pinned to full SHA passes", () => {
  const result = validate(workflow(`    steps:
      - 'uses': actions/setup-node@${sha}
`));

  assert.deepEqual(result.failures, []);
});

test("approved reusable workflow pinned to full SHA passes", () => {
  const result = validate(validStep(`actions/checkout/.github/workflows/reusable.yml@${sha}`));

  assert.deepEqual(result.failures, []);
  assert.equal(isPinnedExternalActionReference(`actions/checkout/.github/workflows/reusable.yml@${sha}`), true);
});

test("local action below .github/actions passes", () => {
  const result = validate(validStep("./.github/actions/local-check"));

  assert.deepEqual(result.failures, []);
  assert.equal(result.localActions.length, 1);
});

test("postgres major image passes only through the exact exception", () => {
  const result = validate(
    `name: Backend
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
    ".github/workflows/backend-ci.yml",
  );

  assert.deepEqual(result.failures, []);
  assert.equal(result.exceptionsUsed.length, 1);
});

test("quoted postgres service image passes through the exact exception", () => {
  const result = validate(
    `name: Backend
on:
  pull_request:
"permissions":
  "contents": read
"jobs":
  "validate-backend":
    runs-on: ubuntu-latest
    "services":
      "postgres":
        "image": postgres:16
    steps:
      - run: echo ok
`,
    ".github/workflows/backend-ci.yml",
  );

  assert.deepEqual(result.failures, []);
  assert.equal(result.exceptionsUsed.length, 1);
});

test("postgres exception passes with arbitrary service indentation", () => {
  const result = validate(
    `name: Backend
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
    ".github/workflows/backend-ci.yml",
  );

  assert.deepEqual(result.failures, []);
  assert.equal(result.exceptionsUsed.length, 1);
});

test("quoted job and service names pass with arbitrary indentation", () => {
  const result = validate(
    `name: Backend
on:
  pull_request:
permissions:
  contents: read
jobs:
    "validate-backend":
        runs-on: ubuntu-latest
        services:
             "postgres":
                    image: postgres:16
        steps:
          - uses: actions/checkout@${sha}
`,
    ".github/workflows/backend-ci.yml",
  );

  assert.deepEqual(result.failures, []);
  assert.equal(result.exceptionsUsed.length, 1);
});

test("comments and blank lines between arbitrary jobs do not reset child indentation", () => {
  const result = validate(`name: Comments
on:
  pull_request:
permissions:
  contents: read
jobs:
    validate:
        runs-on: ubuntu-latest
        steps:
          - run: echo ok

    # Sibling job intentionally separated by a comment.
    audit:
        runs-on: ubuntu-latest
        steps:
          - run: echo ok
`);

  assert.deepEqual(result.failures, []);
});

test("digest-pinned container image passes", () => {
  const result = validate(workflow(`    container:
      image: node@${digest}
    steps:
      - run: echo ok
`));

  assert.deepEqual(result.failures, []);
});

test("inline comments after pinned SHA do not break parsing", () => {
  const result = validate(validStep(`actions/setup-node@${sha} # v6`));

  assert.deepEqual(result.failures, []);
});

test("uses inside a run block is ignored", () => {
  const result = validate(workflow(`    steps:
      - name: Script
        run: |
          uses: actions/checkout@v7
`));

  assert.deepEqual(result.failures, []);
  assert.equal(result.externalActions.length, 0);
});

test("permissions inside a run block is ignored", () => {
  const result = validate(workflow(`    steps:
      - name: Script
        run: |
          permissions: write-all
`));

  assert.deepEqual(result.failures, []);
});

test("quoted watched fields inside a run block are ignored", () => {
  const result = validate(workflow(`    steps:
      - name: Script
        run: |
          "uses": actions/checkout@v7
          "permissions": write-all
`));

  assert.deepEqual(result.failures, []);
});

test("CRLF and LF workflows validate equivalently", () => {
  const lf = validStep(`actions/checkout@${sha}`);
  const crlf = lf.replace(/\n/g, "\r\n");

  assert.deepEqual(validate(lf).failures, []);
  assert.deepEqual(validate(crlf).failures, []);
});

test("workflow without permissions fails", () => {
  const result = validate(`name: Missing
on:
  pull_request:
jobs:
  validate:
    runs-on: ubuntu-latest
`);

  assert.ok(result.failures.includes("Workflow security requires explicit top-level permissions: .github/workflows/fixture.yml"));
});

test("write-all scalar permissions fail", () => {
  const result = validate("name: Bad\non: pull_request\npermissions: write-all\njobs:\n  validate:\n    runs-on: ubuntu-latest\n");

  assert.ok(result.failures.some((failure) => failure.includes('forbids scalar permissions value "write-all"')));
});

test("quoted write-all scalar permissions fail", () => {
  const result = validate(`name: Bad
on:
  pull_request:
"permissions": write-all
jobs:
  validate:
    runs-on: ubuntu-latest
`);

  assertFailureIncludes(result, 'forbids scalar permissions value "write-all"');
});

test("read-all scalar permissions fail", () => {
  const result = validate("name: Bad\non: pull_request\npermissions: read-all\njobs:\n  validate:\n    runs-on: ubuntu-latest\n");

  assert.ok(result.failures.some((failure) => failure.includes('forbids scalar permissions value "read-all"')));
});

test("empty permissions fail", () => {
  const result = validate("name: Bad\non: pull_request\npermissions: {}\njobs:\n  validate:\n    runs-on: ubuntu-latest\n");

  assertUnsupportedFlowStyle(result);
});

test("contents write fails", () => {
  const result = validate("name: Bad\non: pull_request\npermissions:\n  contents: write\njobs:\n  validate:\n    runs-on: ubuntu-latest\n");

  assert.ok(result.failures.some((failure) => failure.includes("forbids top-level permission contents: write")));
});

test("bare permissions entry with space before colon passes", () => {
  const result = validate(`name: Spaced
on:
  pull_request:
permissions:
  contents : read
jobs:
  validate:
    runs-on: ubuntu-latest
`);

  assert.deepEqual(result.failures, []);
});

test("write permissions for actions, pull requests and id-token fail", () => {
  const result = validate("name: Bad\non: pull_request\npermissions:\n  contents: read\n  actions: write\n  pull-requests: write\n  id-token: write\njobs:\n  validate:\n    runs-on: ubuntu-latest\n");

  assert.ok(result.failures.some((failure) => failure.includes("forbids top-level permission actions: write")));
  assert.ok(result.failures.some((failure) => failure.includes("forbids top-level permission pull-requests: write")));
  assert.ok(result.failures.some((failure) => failure.includes("forbids top-level permission id-token: write")));
});

test("job-level permissions fail", () => {
  const result = validate(workflow(`    permissions:
      contents: read
    steps:
      - run: echo ok
`));

  assert.ok(result.failures.some((failure) => failure.includes("forbids unauthorized job-level permissions")));
});

test("quoted job-level permissions fail", () => {
  const result = validate(workflow(`    "permissions":
      contents: read
    steps:
      - run: echo ok
`));

  assertFailureIncludes(result, "forbids unauthorized job-level permissions");
});

test("arbitrary job indentation rejects job-level permissions", () => {
  const result = validate(`name: Bad
on:
  pull_request:
permissions:
  contents: read
jobs:
    validate:
        permissions: write-all
        steps:
          - run: echo ok
`);

  assertFailureIncludes(result, "forbids unauthorized job-level permissions");
});

test("second arbitrary job sibling rejects job-level permissions", () => {
  const result = validate(`name: Bad sibling
on:
  pull_request:
permissions:
  contents: read
jobs:
    validate:
        runs-on: ubuntu-latest
        steps:
          - run: echo ok
    audit:
        permissions: write-all
        steps:
          - run: echo ok
`);

  assertFailureIncludes(result, "forbids unauthorized job-level permissions");
});

test("bare job-level permissions with space before colon fail", () => {
  const result = validate(workflow(`    permissions : write-all
    steps:
      - run: echo ok
`));

  assertFailureIncludes(result, "forbids unauthorized job-level permissions");
});

test("mutable action tag fails", () => {
  const result = validate(validStep("actions/checkout@v7"));

  assert.ok(result.failures.some((failure) => failure.includes("must be pinned to a full commit SHA")));
});

test("bare mutable action with space before colon fails", () => {
  const result = validate(workflow(`    steps:
      - uses : actions/checkout@v7
`));

  assertFailureIncludes(result, "must be pinned to a full commit SHA");
});

test("arbitrary job indentation rejects mutable action references", () => {
  const result = validate(`name: Bad action
on:
  pull_request:
permissions:
  contents: read
jobs:
      validate:
            steps:
              - uses: actions/checkout@v7
`);

  assertFailureIncludes(result, "must be pinned to a full commit SHA");
});

test("quoted mutable action tag fails", () => {
  const result = validate(workflow(`    steps:
      - "uses": actions/checkout@v7
`));

  assertFailureIncludes(result, "must be pinned to a full commit SHA");
});

test("mutable action branch fails", () => {
  const result = validate(validStep("actions/setup-node@main"));

  assert.ok(result.failures.some((failure) => failure.includes("must be pinned to a full commit SHA")));
});

test("single-quoted mutable action branch fails", () => {
  const result = validate(workflow(`    steps:
      - 'uses': actions/setup-node@main
`));

  assertFailureIncludes(result, "must be pinned to a full commit SHA");
});

test("short SHA action ref fails", () => {
  const result = validate(validStep("actions/checkout@1234567"));

  assert.ok(result.failures.some((failure) => failure.includes("must be pinned to a full commit SHA")));
});

test("dynamic action ref expression fails", () => {
  const result = validate(validStep("actions/checkout@${{ inputs.ref }}"));

  assert.ok(result.failures.some((failure) => failure.includes("must be pinned to a full commit SHA")));
});

test("external action outside allowlist fails", () => {
  const result = validate(validStep(`docker/login-action@${sha}`));

  assert.ok(result.failures.some((failure) => failure.includes("Workflow action repository is not approved: docker/login-action")));
});

test("local action escaping .github/actions fails", () => {
  const result = validate(validStep("./scripts/action"));

  assert.ok(result.failures.some((failure) => failure.includes("Workflow local action escapes .github/actions")));
});

test("container image without tag fails", () => {
  const result = validate(workflow(`    container:
      image: node
    steps:
      - run: echo ok
`));

  assert.ok(result.failures.some((failure) => failure.includes("neither digest-pinned nor explicitly excepted")));
});

test("latest container image fails", () => {
  const result = validate(workflow(`    container:
      image: node:latest
    steps:
      - run: echo ok
`));

  assert.ok(result.failures.some((failure) => failure.includes("uses forbidden latest tag")));
});

test("quoted container latest image fails", () => {
  const result = validate(workflow(`    "container":
      "image": node:latest
    steps:
      - run: echo ok
`));

  assertFailureIncludes(result, "uses forbidden latest tag");
});

test("quoted service latest image fails", () => {
  const result = validate(workflow(`    "services":
      "postgres":
        "image": postgres:latest
    steps:
      - run: echo ok
`));

  assertFailureIncludes(result, "uses forbidden latest tag");
});

test("bare container image with space before colon fails", () => {
  const result = validate(workflow(`    container:
      image : node:latest
    steps:
      - run: echo ok
`));

  assertFailureIncludes(result, "uses forbidden latest tag");
});

test("arbitrary job indentation rejects latest container image", () => {
  const result = validate(`name: Bad container
on:
  pull_request:
permissions:
  contents: read
jobs:
   validate:
      container:
         image: node:latest
      steps:
        - run: echo ok
`);

  assertFailureIncludes(result, "uses forbidden latest tag");
});

test("arbitrary service indentation rejects latest service image", () => {
  const result = validate(`name: Bad service
on:
  pull_request:
permissions:
  contents: read
jobs:
    validate:
        services:
             database:
                    image: postgres:latest
        steps:
          - run: echo ok
`);

  assertFailureIncludes(result, "uses forbidden latest tag");
});

test("mutable container image without exception fails", () => {
  const result = validate(workflow(`    container:
      image: node:24
    steps:
      - run: echo ok
`));

  assert.ok(result.failures.some((failure) => failure.includes("neither digest-pinned nor explicitly excepted")));
});

test("postgres exception fails in another workflow", () => {
  const result = validate(workflow(`    services:
      postgres:
        image: postgres:16
    steps:
      - run: echo ok
`));

  assert.ok(result.failures.some((failure) => failure.includes("neither digest-pinned nor explicitly excepted")));
});

test("postgres exception fails in another job", () => {
  const result = validate(
    `name: Backend
on:
  pull_request:
permissions:
  contents: read
jobs:
  other-job:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
`,
    ".github/workflows/backend-ci.yml",
  );

  assert.ok(result.failures.some((failure) => failure.includes("neither digest-pinned nor explicitly excepted")));
});

test("tab indentation fails", () => {
  const result = validate("name: Bad\non: pull_request\npermissions:\n\tcontents: read\njobs:\n  validate:\n    runs-on: ubuntu-latest\n");

  assert.ok(result.failures.some((failure) => failure.includes("forbids tab indentation")));
});

test("inconsistent jobs child indentation fails closed with location", () => {
  const result = validate(`name: Bad indent
on:
  pull_request:
permissions:
  contents: read
jobs:
    validate:
        runs-on: ubuntu-latest
  audit:
      steps:
        - run: echo ok
`);

  assertFailureIncludes(result, "inconsistent or ambiguous jobs child indentation");
  assert.ok(
    result.failures.some((failure) => /\.github\/workflows\/fixture\.yml:\d+/.test(failure)),
    `expected workflow location, got: ${result.failures.join("; ")}`,
  );
});

test("inconsistent services child indentation fails closed with location", () => {
  const result = validate(`name: Bad service indent
on:
  pull_request:
permissions:
  contents: read
jobs:
    validate:
        services:
             database:
                    image: postgres:16
          cache:
             image: redis:latest
        steps:
          - run: echo ok
`);

  assertFailureIncludes(result, "inconsistent or ambiguous services child indentation");
  assert.ok(
    result.failures.some((failure) => /\.github\/workflows\/fixture\.yml:\d+/.test(failure)),
    `expected workflow location, got: ${result.failures.join("; ")}`,
  );
});

test("top-level section after jobs does not inherit job context", () => {
  const result = validate(`name: Top level reset
on:
  pull_request:
jobs:
    validate:
        steps:
          - run: echo ok
env:
  fixture:
    permissions: write-all
permissions:
  contents: read
`);

  assert.deepEqual(result.failures, []);
});

test("ambiguous watched field fails closed", () => {
  const result = validate(workflow(`    steps:
      - name: Empty action
        uses:
`));

  assert.ok(result.failures.some((failure) => failure.includes("must be pinned to a full commit SHA")));
});

test("steps inline flow-style with mutable uses fails closed", () => {
  const result = validate(workflow(`    steps: [{ uses: actions/checkout@v7 }]
`));

  assertUnsupportedFlowStyle(result);
});

test("quoted steps inline flow-style with mutable uses fails closed", () => {
  const result = validate(workflow(`    "steps": [{ "uses": actions/checkout@v7 }]
`));

  assertUnsupportedFlowStyle(result);
});

test("list item flow-style with mutable uses fails closed", () => {
  const result = validate(workflow(`    steps:
      - { uses: actions/checkout@v7 }
`));

  assertUnsupportedFlowStyle(result);
});

test("permissions flow-style fails closed", () => {
  const result = validate(`name: Bad
on:
  pull_request:
permissions: { contents: read }
jobs:
  validate:
    runs-on: ubuntu-latest
`);

  assertUnsupportedFlowStyle(result);
});

test("container flow-style fails closed", () => {
  const result = validate(workflow(`    container: { image: node:latest }
    steps:
      - run: echo ok
`));

  assertUnsupportedFlowStyle(result);
});

test("services flow-style fails closed", () => {
  const result = validate(workflow(`    services: { postgres: { image: postgres:latest } }
    steps:
      - run: echo ok
`));

  assertUnsupportedFlowStyle(result);
});

test("run scalar with brackets passes", () => {
  const result = validate(workflow(`    steps:
      - run: echo "[fixture]"
`));

  assert.deepEqual(result.failures, []);
});

test("GitHub expression scalar with braces passes", () => {
  const result = validate(workflow(`    steps:
      - if: \${{ github.event_name == 'pull_request' }}
        run: echo ok
`));

  assert.deepEqual(result.failures, []);
});

test("quoted scalar with braces passes", () => {
  const result = validate(workflow(`    steps:
      - name: "value {inside quoted scalar}"
        run: echo ok
`));

  assert.deepEqual(result.failures, []);
});

test("quoted scalars that look like watched fields pass", () => {
  const result = validate(workflow(`    steps:
      - name: "uses: actions/checkout@v7"
        run: echo '"permissions": write-all'
`));

  assert.deepEqual(result.failures, []);
});

test("quoted job name passes", () => {
  const result = validate(`name: Quoted job
on:
  pull_request:
permissions:
  contents: read
jobs:
  "validate":
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@${sha}
`);

  assert.deepEqual(result.failures, []);
});

test("malformed quoted key fails closed with workflow location", () => {
  const result = validate(workflow(`    steps:
      - "uses: actions/checkout@v7
`));

  assertFailureIncludes(result, "malformed quoted key");
  assert.ok(
    result.failures.some((failure) => /\.github\/workflows\/fixture\.yml:\d+/.test(failure)),
    `expected workflow location, got: ${result.failures.join("; ")}`,
  );
});

test("quoted key trailing garbage fails closed", () => {
  const result = validate(workflow(`    steps:
      - "uses" garbage: actions/checkout@v7
`));

  assertFailureIncludes(result, "malformed quoted key");
});

test("unsupported double-quoted key escape fails closed", () => {
  const result = validate(workflow(`    steps:
      - "u\\qses": actions/checkout@${sha}
`));

  assertFailureIncludes(result, "unsupported double-quoted key escape");
});

test("flow-looking text inside literal block scalar passes", () => {
  const result = validate(workflow(`    steps:
      - run: |
          steps: [{ uses: actions/checkout@v7 }]
          permissions: { contents: write }
`));

  assert.deepEqual(result.failures, []);
});

test("flow-looking text inside folded block scalar passes", () => {
  const result = validate(workflow(`    steps:
      - run: >
          steps: [{ uses: actions/checkout@v7 }]
          container: { image: node:latest }
`));

  assert.deepEqual(result.failures, []);
});

test("deleting workflow security required sources is blocked by quality impact", () => {
  const result = evaluateChangedPathImpact({
    entries: [
      {
        status: "D",
        path: "scripts/governance/workflow-security-policy.mjs",
        display: "scripts/governance/workflow-security-policy.mjs",
      },
      {
        status: "D",
        path: "scripts/governance/workflow-security-validator.mjs",
        display: "scripts/governance/workflow-security-validator.mjs",
      },
    ],
  });

  assert.ok(
    result.failures.includes(
      "Quality gate impact policy cannot delete required source: scripts/governance/workflow-security-policy.mjs",
    ),
  );
  assert.ok(
    result.failures.includes(
      "Quality gate impact policy cannot delete required source: scripts/governance/workflow-security-validator.mjs",
    ),
  );
});
