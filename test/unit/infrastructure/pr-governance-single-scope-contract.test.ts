import test from "node:test";
import assert from "node:assert/strict";

import {
  classifyPath,
  derivePrimaryCategories,
  evaluateScopeContract,
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
