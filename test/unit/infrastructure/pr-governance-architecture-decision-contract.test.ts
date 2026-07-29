import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateArchitectureDecisionContract,
  evaluateScopeContract,
  requiresArchitectureDecision,
} from "../../../scripts/governance/pr-governance-validator.mjs";
import type {
  GovernanceChangedFileEntry,
} from "../../../scripts/governance/pr-governance-validator.mjs";

const repoRoot = process.cwd();
const existingAdr = "docs/architecture/rls-tenant-isolation-adr.md";

function entry(
  status: string,
  path: string,
  extra: Partial<GovernanceChangedFileEntry> = {},
): GovernanceChangedFileEntry {
  return { status, path, display: path, ...extra };
}

function architectureSection({
  adr = false,
  notApplicable = false,
  reference = "",
  justification = "",
  comment = "",
}: {
  adr?: boolean;
  notApplicable?: boolean;
  reference?: string;
  justification?: string;
  comment?: string;
} = {}): string {
  return `## Architecture Decision
${comment}
- [${adr ? "x" : " "}] ADR/RFC linked
- [${notApplicable ? "x" : " "}] Not applicable

- Reference: ${reference}
- Justification: ${justification}
`;
}

function evaluate(
  body: string,
  entries: GovernanceChangedFileEntry[],
  trustedDependabot = false,
) {
  return evaluateArchitectureDecisionContract({
    body,
    entries,
    rootDir: repoRoot,
    trustedDependabot,
  });
}

test("a modified deep server file does not trigger the gate", () => {
  assert.equal(
    requiresArchitectureDecision([
      entry("M", "server/routes/admin/example.ts"),
    ]),
    false,
  );
});

test("a new file below server triggers the gate", () => {
  assert.equal(
    requiresArchitectureDecision([
      entry("A", "server/routes/admin/example.ts"),
    ]),
    true,
  );
});

test("a deleted file below server triggers the gate", () => {
  assert.equal(
    requiresArchitectureDecision([
      entry("D", "server/routes/admin/example.ts"),
    ]),
    true,
  );
});

test("renames and copies below server trigger the gate", () => {
  for (const status of ["R100", "C100"]) {
    assert.equal(
      requiresArchitectureDecision([
        entry(status, "server/routes/new-name.ts", {
          oldPath: "server/routes/old-name.ts",
          newPath: "server/routes/new-name.ts",
        }),
      ]),
      true,
    );
  }
});

test("a modified root server TypeScript file triggers the gate", () => {
  assert.equal(
    requiresArchitectureDecision([entry("M", "server/index.ts")]),
    true,
  );
});

test("a drizzle change always triggers the gate", () => {
  assert.equal(
    requiresArchitectureDecision([entry("M", "drizzle/schema.ts")]),
    true,
  );
});

test("a workflow change always triggers the gate", () => {
  assert.equal(
    requiresArchitectureDecision([
      entry("M", ".github/workflows/backend-ci.yml"),
    ]),
    true,
  );
});

test("a non-architectural diff does not trigger the gate", () => {
  assert.equal(
    requiresArchitectureDecision([
      entry("M", "docs/implementation/example.md"),
      entry("M", "test/unit/example.test.ts"),
    ]),
    false,
  );
});

test("a missing Architecture Decision section fails when triggered", () => {
  const result = evaluate("", [entry("M", "server/index.ts")]);

  assert.equal(result.status, "FAIL");
  assert.match(result.failures.join(" "), /Missing required/);
});

test("selecting both Architecture Decision options fails", () => {
  const result = evaluate(
    architectureSection({
      adr: true,
      notApplicable: true,
      reference: `[RLS ADR](${existingAdr})`,
    }),
    [entry("M", "server/index.ts")],
  );

  assert.equal(result.status, "FAIL");
  assert.match(result.failures.join(" "), /exactly one option/);
});

test("selecting neither Architecture Decision option fails", () => {
  const result = evaluate(
    architectureSection(),
    [entry("M", "server/index.ts")],
  );

  assert.equal(result.status, "FAIL");
  assert.match(result.failures.join(" "), /exactly one option/);
});

test("a relative link to an existing ADR passes", () => {
  const result = evaluate(
    architectureSection({
      adr: true,
      reference: `[RLS tenant isolation ADR](${existingAdr})`,
    }),
    [entry("M", "server/index.ts")],
  );

  assert.equal(result.status, "PASS");
  assert.deepEqual(result.failures, []);
});

test("a link to a missing ADR fails", () => {
  const result = evaluate(
    architectureSection({
      adr: true,
      reference: "[Missing ADR](docs/architecture/missing-adr.md)",
    }),
    [entry("M", "server/index.ts")],
  );

  assert.equal(result.status, "FAIL");
  assert.match(result.failures.join(" "), /existing file/);
});

test("a reference that leaves the repository fails", () => {
  const result = evaluate(
    architectureSection({
      adr: true,
      reference: "[Escaping ADR](../../outside-adr.md)",
    }),
    [entry("M", "server/index.ts")],
  );

  assert.equal(result.status, "FAIL");
  assert.match(result.failures.join(" "), /leave the repository/);
});

test("an external ADR URL fails", () => {
  const result = evaluate(
    architectureSection({
      adr: true,
      reference: "[External ADR](https://external.invalid/decision-adr.md)",
    }),
    [entry("M", "server/index.ts")],
  );

  assert.equal(result.status, "FAIL");
  assert.match(result.failures.join(" "), /repository-relative/);
});

test("a substantive Not applicable justification passes", () => {
  const result = evaluate(
    architectureSection({
      notApplicable: true,
      justification:
        "This update preserves every existing architectural boundary and data model; it only refreshes an implementation detail without changing composition or governed workflow behavior.",
    }),
    [entry("M", "server/index.ts")],
  );

  assert.equal(result.status, "PASS");
  assert.deepEqual(result.failures, []);
});

test("short, placeholder, or commented Not applicable justifications fail", () => {
  const invalidJustifications = [
    "No architecture impact.",
    "TODO: provide the architecture reasoning later.",
    "<!-- Explain why this change is not architectural. -->",
  ];

  for (const justification of invalidJustifications) {
    const result = evaluate(
      architectureSection({
        notApplicable: true,
        justification,
      }),
      [entry("M", "server/index.ts")],
    );

    assert.equal(result.status, "FAIL");
    assert.match(result.failures.join(" "), /substantive justification/);
  }
});

test("trusted Dependabot workflow-only updates are automatically N/A", () => {
  const result = evaluate(
    "",
    [
      entry("M", ".github/workflows/backend-ci.yml"),
      entry("M", ".github/workflows/frontend-ci.yml"),
    ],
    true,
  );

  assert.equal(result.status, "N/A");
  assert.deepEqual(result.failures, []);
  assert.match(
    result.details.join(" "),
    /N\/A — trusted dependency automation/,
  );
});

test("Architecture Decision evaluation preserves the existing scope contract", () => {
  const body = `## Summary
Governance contract fixture.

## Scope
- [x] backend runtime

${architectureSection({
  adr: true,
  reference: `[RLS tenant isolation ADR](${existingAdr})`,
})}

## Validation
Contract tests.

## Rollback
Revert fixture.
`;

  const scope = evaluateScopeContract({
    body,
    categories: ["backend", "tests", "documentation"],
  });
  const architecture = evaluate(body, [entry("M", "server/index.ts")]);

  assert.deepEqual(scope.failures, []);
  assert.equal(architecture.status, "PASS");
});
