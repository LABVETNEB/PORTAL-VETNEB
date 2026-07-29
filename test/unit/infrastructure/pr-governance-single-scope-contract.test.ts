import test from "node:test";
import assert from "node:assert/strict";

import {
  classifyPath,
  derivePrimaryCategories,
  evaluateDependabotAutomationContract,
  evaluateScopeContract,
  isTrustedDependabotPullRequest,
} from "../../../scripts/governance/pr-governance-validator.mjs";

function prBody(scopeLines: string[], extraSections = ""): string {
  return `## Summary
- Contract fixture

## Scope
${scopeLines.join("\n")}

${extraSections}
## Validation
- Contract validation

## Rollback
- Revert fixture
`;
}

test("classifyPath maps repository paths to governed categories", () => {
  assert.equal(classifyPath("server/routes/example.ts"), "backend");
  assert.equal(classifyPath("frontend/src/example.tsx"), "frontend");
  assert.equal(classifyPath("test/unit/example.test.ts"), "tests");
  assert.equal(classifyPath(".github/workflows/pr-governance.yml"), "workflows/CI");
  assert.equal(classifyPath("scripts/governance/pr-governance-validator.mjs"), "workflows/CI");
  assert.equal(classifyPath("scripts/governance/pr-governance-validator.d.mts"), "workflows/CI");
  assert.equal(classifyPath("scripts/governance/quality-gate-impact-policy.mjs"), "workflows/CI");
  assert.equal(classifyPath("scripts/governance/workflow-security-policy.mjs"), "workflows/CI");
  assert.equal(classifyPath("drizzle/0001_example.sql"), "database/migrations");
  assert.equal(classifyPath("docs/example.md"), "documentation");
  assert.equal(classifyPath("pnpm-lock.yaml"), "dependencies/lockfiles");
  assert.equal(classifyPath("scripts/governance/check.mjs"), "scripts/tooling");
  assert.equal(classifyPath(".github/PULL_REQUEST_TEMPLATE.md"), "documentation");
  assert.equal(classifyPath("unclassified/example.bin"), "other");
});

test("derivePrimaryCategories treats docs and tests as supporting one core domain", () => {
  assert.deepEqual(
    derivePrimaryCategories(["backend", "documentation", "tests"]),
    ["backend"],
  );
  assert.deepEqual(
    derivePrimaryCategories(["documentation", "tests"]),
    ["tests"],
  );
  assert.deepEqual(derivePrimaryCategories(["documentation"]), ["documentation"]);
});

test("single backend scope passes with supporting docs and tests", () => {
  const result = evaluateScopeContract({
    body: prBody(["- [x] backend runtime"]),
    categories: ["backend", "documentation", "tests"],
  });

  assert.deepEqual(result.failures, []);
  assert.deepEqual(result.primary, ["backend"]);
  assert.deepEqual(result.selected, ["backend"]);
});

test("PR governance runtime and declarations remain one workflow scope", () => {
  const categories = [
    ".github/PULL_REQUEST_TEMPLATE.md",
    "scripts/governance/pr-governance-validator.d.mts",
    "scripts/governance/pr-governance-validator.mjs",
    "test/unit/infrastructure/pr-governance-architecture-decision-contract.test.ts",
    "test/unit/infrastructure/pr-governance-secret-patterns-contract.test.ts",
  ].map(classifyPath);
  const result = evaluateScopeContract({
    body: prBody(["- [x] workflows/ci"]),
    categories,
  });

  assert.deepEqual(categories, [
    "documentation",
    "workflows/CI",
    "workflows/CI",
    "tests",
    "tests",
  ]);
  assert.deepEqual(result.failures, []);
  assert.deepEqual(result.primary, ["workflows/CI"]);
  assert.deepEqual(result.selected, ["workflows/CI"]);
});

test("mixed backend and frontend scope fails without exception", () => {
  const result = evaluateScopeContract({
    body: prBody(["- [x] backend runtime", "- [x] frontend runtime"]),
    categories: ["backend", "frontend", "tests", "documentation"],
  });

  assert.ok(result.failures.some((failure) => failure.includes("Multiple primary scopes")));
  assert.ok(result.failures.some((failure) => failure.includes("Exactly one scope checkbox")));
});

test("mixed scope passes only with exact declaration and substantive justification", () => {
  const result = evaluateScopeContract({
    body: prBody(
      [
        "- [x] workflows/ci",
        "- [x] scripts/tooling",
        "- [x] repository configuration",
        "- [x] mixed-scope exception (requires justification)",
      ],
      `## Mixed-Scope Justification
The workflow launcher, versioned validator script, and pull request template form one atomic governance boundary. Splitting them would temporarily leave the required check without a compatible contract and would make rollback unsafe.

`,
    ),
    categories: [
      "workflows/CI",
      "scripts/tooling",
      "repository configuration",
      "tests",
      "documentation",
    ],
  });

  assert.deepEqual(result.failures, []);
  assert.equal(result.exceptionChecked, true);
});

test("mixed-scope exception fails when a detected primary scope is omitted", () => {
  const result = evaluateScopeContract({
    body: prBody(
      [
        "- [x] backend runtime",
        "- [x] mixed-scope exception (requires justification)",
      ],
      `## Mixed-Scope Justification
The fixture deliberately contains enough text to test exact category matching while omitting the frontend declaration from the selected checkboxes.

`,
    ),
    categories: ["backend", "frontend"],
  });

  assert.ok(result.failures.some((failure) => failure.includes("match detected primary scopes exactly")));
});

test("template mixed-scope guidance comment is not accepted as justification", () => {
  const result = evaluateScopeContract({
    body: prBody(
      [
        "- [x] backend runtime",
        "- [x] frontend runtime",
        "- [x] mixed-scope exception (requires justification)",
      ],
      `## Mixed-Scope Justification
<!-- Required only when the mixed-scope exception is checked. Explain why the domains cannot be delivered safely as independent PRs, the coupling boundary, and the rollback boundary. Delete this comment and write the justification. -->

`,
    ),
    categories: ["backend", "frontend"],
  });

  assert.ok(
    result.failures.some((failure) =>
      failure.includes("substantive ## Mixed-Scope Justification"),
    ),
  );
});

test("declared single scope must match detected scope", () => {
  const result = evaluateScopeContract({
    body: prBody(["- [x] frontend runtime"]),
    categories: ["backend", "documentation"],
  });

  assert.ok(result.failures.some((failure) => failure.includes("does not match detected scope")));
});

test("docs-only scope passes", () => {
  const result = evaluateScopeContract({
    body: prBody(["- [x] docs"]),
    categories: ["documentation"],
  });

  assert.deepEqual(result.failures, []);
});

test("other category requires explicit detail", () => {
  const withoutDetail = evaluateScopeContract({
    body: prBody(["- [x] other"]),
    categories: ["other"],
  });
  assert.ok(withoutDetail.failures.some((failure) => failure.includes("Other Scope Detail")));

  const withDetail = evaluateScopeContract({
    body: prBody(
      ["- [x] other"],
      `## Other Scope Detail
The fixture represents a repository path that has no standard runtime, workflow, data, documentation, dependency, test, tooling, or configuration category.

`,
    ),
    categories: ["other"],
  });
  assert.deepEqual(withDetail.failures, []);
});

test("template other-scope guidance comment is not accepted as detail", () => {
  const result = evaluateScopeContract({
    body: prBody(
      ["- [x] other"],
      `## Other Scope Detail
<!-- Required only when other is selected. Identify the paths and explain why no standard scope applies. Delete this comment and write the detail. -->

`,
    ),
    categories: ["other"],
  });

  assert.ok(result.failures.some((failure) => failure.includes("Other Scope Detail")));
});

function trustedDependabotEvent(): any {
  return {
    pull_request: {
      user: {
        login: "dependabot[bot]",
      },
      head: {
        ref: "dependabot/npm_and_yarn/react-dom-19.2.8",
        repo: {
          full_name: "LABVETNEB/PORTAL-VETNEB",
        },
      },
      base: {
        ref: "main",
        repo: {
          full_name: "LABVETNEB/PORTAL-VETNEB",
        },
      },
    },
  };
}

test("trusted Dependabot pull request identity requires bot author, branch and same repository", () => {
  const trusted = trustedDependabotEvent();

  assert.equal(
    isTrustedDependabotPullRequest(trusted),
    true,
  );

  const humanSpoof = structuredClone(trusted);
  humanSpoof.pull_request.user.login = "human-maintainer";

  assert.equal(
    isTrustedDependabotPullRequest(humanSpoof),
    false,
  );

  const branchSpoof = structuredClone(trusted);
  branchSpoof.pull_request.head.ref = "feature/dependabot-lookalike";

  assert.equal(
    isTrustedDependabotPullRequest(branchSpoof),
    false,
  );

  const forkSpoof = structuredClone(trusted);
  forkSpoof.pull_request.head.repo.full_name =
    "untrusted-fork/PORTAL-VETNEB";

  assert.equal(
    isTrustedDependabotPullRequest(forkSpoof),
    false,
  );
});

test("trusted Dependabot npm update infers frontend and dependency scopes", () => {
  const result = evaluateDependabotAutomationContract({
    event: trustedDependabotEvent(),
    entries: [
      {
        status: "M",
        path: "frontend/package.json",
        display: "frontend/package.json",
      },
      {
        status: "M",
        path: "pnpm-lock.yaml",
        display: "pnpm-lock.yaml",
      },
    ],
  });

  assert.deepEqual(result.failures, []);
  assert.deepEqual(
    result.primary,
    ["frontend", "dependencies/lockfiles"],
  );
});

test("trusted Dependabot GitHub Actions update accepts workflow-only modifications", () => {
  const event = trustedDependabotEvent();
  event.pull_request.head.ref =
    "dependabot/github_actions/actions/checkout-7.0.1";

  const result = evaluateDependabotAutomationContract({
    event,
    entries: [
      {
        status: "M",
        path: ".github/workflows/backend-ci.yml",
        display: ".github/workflows/backend-ci.yml",
      },
      {
        status: "M",
        path: ".github/workflows/frontend-ci.yml",
        display: ".github/workflows/frontend-ci.yml",
      },
    ],
  });

  assert.deepEqual(result.failures, []);
  assert.deepEqual(result.primary, ["workflows/CI"]);
});

test("trusted Dependabot metadata inference rejects runtime source changes", () => {
  const result = evaluateDependabotAutomationContract({
    event: trustedDependabotEvent(),
    entries: [
      {
        status: "M",
        path: "server/index.ts",
        display: "server/index.ts",
      },
    ],
  });

  assert.ok(
    result.failures.some((failure) =>
      failure.includes("Unsupported change"),
    ),
  );
});

test("trusted Dependabot metadata inference rejects additions, deletions and renames", () => {
  for (const status of ["A", "D", "R100"]) {
    const result = evaluateDependabotAutomationContract({
      event: trustedDependabotEvent(),
      entries: [
        {
          status,
          path: "frontend/package.json",
          display: `${status} frontend/package.json`,
        },
      ],
    });

    assert.ok(
      result.failures.some((failure) =>
        failure.includes("Unsupported change"),
      ),
    );
  }
});

test("trusted Dependabot identity rejects a pull request without a head repository", () => {
  const missingHeadRepo = structuredClone(trustedDependabotEvent());
  delete missingHeadRepo.pull_request.head.repo;

  assert.equal(
    isTrustedDependabotPullRequest(missingHeadRepo),
    false,
  );

  const result = evaluateDependabotAutomationContract({
    event: missingHeadRepo,
    entries: [
      {
        status: "M",
        path: "package.json",
        display: "package.json",
      },
    ],
  });

  assert.ok(
    result.failures.some((failure) =>
      failure.includes("same-repository pull request"),
    ),
  );
  assert.deepEqual(result.primary, []);
});

test("trusted Dependabot root manifest plus root lockfile infers dependency scope", () => {
  const result = evaluateDependabotAutomationContract({
    event: trustedDependabotEvent(),
    entries: [
      {
        status: "M",
        path: "package.json",
        display: "package.json",
      },
      {
        status: "M",
        path: "pnpm-lock.yaml",
        display: "pnpm-lock.yaml",
      },
    ],
  });

  assert.deepEqual(result.failures, []);
  assert.deepEqual(result.primary, ["dependencies/lockfiles"]);
});

test("trusted Dependabot GitHub Actions update accepts .yaml workflow extension", () => {
  const event = trustedDependabotEvent();
  event.pull_request.head.ref =
    "dependabot/github_actions/actions/setup-node-5.0.0";

  const result = evaluateDependabotAutomationContract({
    event,
    entries: [
      {
        status: "M",
        path: ".github/workflows/release.yaml",
        display: ".github/workflows/release.yaml",
      },
    ],
  });

  assert.deepEqual(result.failures, []);
  assert.deepEqual(result.primary, ["workflows/CI"]);
});

test("trusted Dependabot metadata inference rejects frontend source changes", () => {
  const result = evaluateDependabotAutomationContract({
    event: trustedDependabotEvent(),
    entries: [
      {
        status: "M",
        path: "frontend/src/app/page.tsx",
        display: "frontend/src/app/page.tsx",
      },
    ],
  });

  assert.ok(
    result.failures.some((failure) =>
      failure.includes("Unsupported change"),
    ),
  );
});

test("trusted Dependabot metadata inference rejects documentation changes", () => {
  const result = evaluateDependabotAutomationContract({
    event: trustedDependabotEvent(),
    entries: [
      {
        status: "M",
        path: "docs/implementation/example.md",
        display: "docs/implementation/example.md",
      },
    ],
  });

  assert.ok(
    result.failures.some((failure) =>
      failure.includes("Unsupported change"),
    ),
  );
});
