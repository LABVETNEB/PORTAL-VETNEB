import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  IMPACT_RULES,
  QUALITY_GATES,
  README_MARKERS,
  TEST_TAXONOMY,
} from "../../../scripts/governance/quality-gate-impact-policy.mjs";
import type { QualityGateCommand } from "../../../scripts/governance/quality-gate-impact-policy.mjs";
import { classifyPath } from "../../../scripts/governance/pr-governance-validator.mjs";
import {
  evaluateChangedPathImpact,
  renderTestTaxonomyProjection,
  validateCommandReferences,
  validateImpactPolicy,
  validateReadmeTaxonomyProjection,
  validateRulePrecedence,
} from "../../../scripts/governance/quality-gate-impact-validator.mjs";

const rootPackageJsonText = readFileSync(resolve(process.cwd(), "package.json"), "utf8");
const frontendPackageJsonText = readFileSync(resolve(process.cwd(), "frontend/package.json"), "utf8");
const readmeText = readFileSync(resolve(process.cwd(), "test/README.md"), "utf8");

function ids(values: Array<{ id: string }>): string[] {
  return values.map((value) => value.id);
}

function packageScriptCommand(
  packageScope: "root" | "frontend",
  script: string,
  command: string,
): QualityGateCommand {
  return {
    id: `${packageScope}-${script}`,
    type: "package-script",
    packageScope,
    script,
    command,
  };
}

function invalidPackageScriptCommand(packageScope: string, script: string, command: string): QualityGateCommand {
  return {
    id: `${packageScope}-${script}`,
    type: "package-script",
    packageScope,
    script,
    command,
  } as QualityGateCommand;
}

test("quality gate policy keeps unique IDs and valid references", () => {
  const gateIds = QUALITY_GATES.map((gate) => gate.id);
  const ruleIds = IMPACT_RULES.map((rule) => rule.id);
  const suiteIds = TEST_TAXONOMY.map((suite) => suite.id);
  const validation = validateImpactPolicy();

  assert.equal(new Set(gateIds).size, gateIds.length);
  assert.equal(new Set(ruleIds).size, ruleIds.length);
  assert.equal(new Set(suiteIds).size, suiteIds.length);
  assert.deepEqual(validation.failures, []);
});

test("quality gate rules are non-empty and reference existing gates", () => {
  const gateIds = new Set(QUALITY_GATES.map((gate) => gate.id));

  for (const rule of IMPACT_RULES) {
    assert.ok(rule.id);
    assert.ok(rule.matcher.type);
    assert.ok(rule.gates.length > 0, `${rule.id} must reference at least one gate`);
    for (const gateId of rule.gates) assert.ok(gateIds.has(gateId), `${rule.id} -> ${gateId}`);
  }
});

test("quality gate taxonomy suites reference existing gates and commands", () => {
  const gateIds = new Set(QUALITY_GATES.map((gate) => gate.id));

  for (const suite of TEST_TAXONOMY) {
    assert.ok(gateIds.has(suite.gate), `${suite.id} references ${suite.gate}`);
    assert.ok(suite.commands.length > 0, `${suite.id} must keep commands`);
  }
});

test("impact rule precedence resolves specific routes before general routes", () => {
  assert.deepEqual(
    validateRulePrecedence({
      specificPath: "test/README.md",
      generalPath: "test/unit/example.test.ts",
      expectedSpecificRuleId: "test-readme-taxonomy",
      expectedGeneralRuleId: "node-tests",
    }).failures,
    [],
  );
  assert.deepEqual(
    validateRulePrecedence({
      specificPath: ".github/workflows/backend-ci.yml",
      generalPath: ".github/CODEOWNERS",
      expectedSpecificRuleId: "backend-ci-workflow",
      expectedGeneralRuleId: "github-config",
    }).failures,
    [],
  );
  assert.deepEqual(
    validateRulePrecedence({
      specificPath: ".github/workflows/frontend-ci.yml",
      generalPath: ".github/workflows/custom-ci.yml",
      expectedSpecificRuleId: "frontend-ci-workflow",
      expectedGeneralRuleId: "github-workflows",
    }).failures,
    [],
  );
});

test("impact routing classifies representative paths", () => {
  const expectations = new Map([
    ["server/routes/clinics.ts", "server-runtime"],
    ["frontend/src/app/page.tsx", "frontend-runtime"],
    ["test/unit/example.test.ts", "node-tests"],
    ["frontend/e2e/admin-mobile.spec.ts", "frontend-e2e"],
    ["test/README.md", "test-readme-taxonomy"],
    ["drizzle/schema.ts", "database-migrations"],
    ["scripts/governance/example.mjs", "governance-scripts"],
    [".github/workflows/backend-ci.yml", "backend-ci-workflow"],
    [".github/workflows/frontend-ci.yml", "frontend-ci-workflow"],
    [".github/workflows/pr-governance.yml", "pr-governance-workflow"],
    [".github/CODEOWNERS", "github-config"],
    [".gitignore", "repo-config-gitignore"],
    [".gitattributes", "repo-config-gitattributes"],
    [".npmrc", "repo-config-npmrc"],
    [".pnpmrc", "repo-config-pnpmrc"],
    [".cursorignore", "repo-config-cursorignore"],
    [".vscode/settings.json", "repo-config-vscode"],
    ["docs/governance/example.md", "docs"],
    ["package.json", "root-package"],
    ["frontend/package.json", "frontend-package"],
    ["pnpm-lock.yaml", "pnpm-lockfile"],
    ["pnpm-workspace.yaml", "pnpm-workspace"],
    ["drizzle.config.ts", "drizzle-config"],
    ["AGENTS.md", "agents-protocol"],
    ["tsconfig.json", "root-tsconfig"],
    ["README.md", "root-markdown"],
  ]);

  const entries = [...expectations.keys()].map((path) => ({
    status: "M",
    path,
    display: path,
  }));
  const result = evaluateChangedPathImpact({ entries });

  assert.deepEqual(result.failures, []);
  for (const routed of result.changedPaths) {
    assert.equal(routed.rule?.id, expectations.get(routed.path), routed.path);
    assert.ok(routed.gates.length > 0, `${routed.path} must have gates`);
  }
});

test("PR governance classifyPath maps cursorignore to repository configuration", () => {
  assert.equal(classifyPath(".cursorignore"), "repository configuration");
});

test("repository configuration routes use governance and manual review gates", () => {
  const entries = [
    ".gitignore",
    ".gitattributes",
    ".npmrc",
    ".pnpmrc",
    ".cursorignore",
    ".vscode/settings.json",
  ].map((path) => ({
    status: "M",
    path,
    display: path,
  }));

  const result = evaluateChangedPathImpact({ entries });

  assert.deepEqual(result.failures, []);
  for (const routed of result.changedPaths) {
    assert.ok(ids(routed.gates).includes("pr-governance"), routed.path);
    assert.ok(ids(routed.gates).includes("manual-review"), routed.path);
    assert.ok(routed.impacts.includes("repository-configuration"), routed.path);
  }
});

test("frontend workflow exact route includes frontend CI and normative frontend suites", () => {
  const result = evaluateChangedPathImpact({
    entries: [
      {
        status: "M",
        path: ".github/workflows/frontend-ci.yml",
        display: ".github/workflows/frontend-ci.yml",
      },
    ],
  });
  const routed = result.changedPaths[0];
  const gateIds = ids(routed.gates);
  const suiteIds = ids(routed.suites);
  const frontendSuiteIds = TEST_TAXONOMY.filter((suite) => suite.gate === "frontend-ci").map((suite) => suite.id);

  assert.deepEqual(result.failures, []);
  assert.equal(routed.rule?.id, "frontend-ci-workflow");
  assert.ok(gateIds.includes("pr-governance"));
  assert.ok(gateIds.includes("backend-ci"));
  assert.ok(gateIds.includes("frontend-ci"));
  assert.ok(gateIds.includes("manual-review"));
  for (const suiteId of frontendSuiteIds) assert.ok(suiteIds.includes(suiteId), suiteId);
});

test("frontend CI taxonomy exposes one catalog-backed Playwright command", () => {
  const frontendGate = QUALITY_GATES.find((gate) => gate.id === "frontend-ci");
  assert.ok(frontendGate);

  const e2eCommands = frontendGate.commands
    .filter((command) => command.id.startsWith("frontend-e2e-"))
    .map((command) => ({
      id: command.id,
      command: command.command,
    }));

  assert.deepEqual(e2eCommands, [
    {
      id: "frontend-e2e-ci",
      command: "pnpm --dir frontend e2e:ci",
    },
  ]);

  const e2eSuites = TEST_TAXONOMY.filter(
    (suite) =>
      suite.gate === "frontend-ci" &&
      suite.id.startsWith("frontend-e2e-"),
  );

  assert.equal(e2eSuites.length, 1);
  assert.equal(e2eSuites[0]?.id, "frontend-e2e-ci");
  assert.ok(e2eSuites[0]?.representativePaths.includes("frontend/e2e/**"));
  assert.ok(e2eSuites[0]?.representativePaths.includes("frontend/src/**"));

  assert.deepEqual(
    e2eSuites[0]?.commands.map((command) => ({
      id: command.id,
      command: command.command,
    })),
    [
      {
        id: "frontend-e2e-ci",
        command: "pnpm --dir frontend e2e:ci",
      },
    ],
  );
});

test("impact routing rejects unclassified root assets", () => {
  const result = evaluateChangedPathImpact({
    entries: [
      {
        status: "A",
        path: "unclassified-root-asset.bin",
        display: "unclassified-root-asset.bin",
      },
    ],
  });

  assert.equal(result.passed, false);
  assert.ok(
    result.failures.includes(
      "Quality gate impact policy has no route for changed path: unclassified-root-asset.bin",
    ),
  );
});

test("impact routing combines old and new paths for server to docs renames", () => {
  const result = evaluateChangedPathImpact({
    entries: [
      {
        status: "R100",
        path: "docs/foo.md",
        oldPath: "server/routes/foo.ts",
        newPath: "docs/foo.md",
        display: "server/routes/foo.ts -> docs/foo.md",
      },
    ],
  });
  const routed = result.changedPaths[0];

  assert.deepEqual(result.failures, []);
  assert.equal(routed.oldPath, "server/routes/foo.ts");
  assert.equal(routed.newPath, "docs/foo.md");
  assert.deepEqual(ids(routed.rules), ["server-runtime", "docs"]);
  assert.ok(routed.impacts.includes("backend-runtime"));
  assert.ok(routed.impacts.includes("documentation"));
  assert.ok(ids(routed.gates).includes("backend-ci"));
  assert.ok(ids(routed.gates).includes("manual-review"));
});

test("impact routing combines old and new paths for docs to frontend renames", () => {
  const result = evaluateChangedPathImpact({
    entries: [
      {
        status: "R100",
        path: "frontend/src/app/page.tsx",
        oldPath: "docs/foo.md",
        newPath: "frontend/src/app/page.tsx",
        display: "docs/foo.md -> frontend/src/app/page.tsx",
      },
    ],
  });
  const routed = result.changedPaths[0];

  assert.deepEqual(result.failures, []);
  assert.deepEqual(ids(routed.rules), ["docs", "frontend-runtime"]);
  assert.ok(routed.impacts.includes("documentation"));
  assert.ok(routed.impacts.includes("frontend-runtime"));
  assert.ok(ids(routed.gates).includes("frontend-ci"));
  assert.ok(ids(routed.gates).includes("manual-review"));
});

test("impact routing deduplicates gates and suites for same-domain renames", () => {
  const result = evaluateChangedPathImpact({
    entries: [
      {
        status: "R100",
        path: "server/routes/bar.ts",
        oldPath: "server/routes/foo.ts",
        newPath: "server/routes/bar.ts",
        display: "server/routes/foo.ts -> server/routes/bar.ts",
      },
    ],
  });
  const routed = result.changedPaths[0];
  const gateIds = ids(routed.gates);
  const suiteIds = ids(routed.suites);

  assert.deepEqual(result.failures, []);
  assert.deepEqual(ids(routed.rules), ["server-runtime"]);
  assert.deepEqual(gateIds, [...new Set(gateIds)]);
  assert.deepEqual(suiteIds, [...new Set(suiteIds)]);
  assert.deepEqual(routed.impacts, [...new Set(routed.impacts)]);
});

test("impact routing blocks deletion of required sources", () => {
  const result = evaluateChangedPathImpact({
    entries: [
      {
        status: "D",
        path: "test/README.md",
        display: "test/README.md",
      },
    ],
  });

  assert.equal(result.passed, false);
  assert.ok(
    result.failures.includes("Quality gate impact policy cannot delete required source: test/README.md"),
  );
});

test("package script references pass for current root and frontend packages", () => {
  const result = validateCommandReferences({
    rootPackageJsonText,
    frontendPackageJsonText,
  });

  assert.deepEqual(result.failures, []);
});

test("package script validation fails for missing root script", () => {
  const result = validateCommandReferences({
    rootPackageJsonText,
    frontendPackageJsonText,
    commands: [packageScriptCommand("root", "taxonomy-required", "pnpm taxonomy-required")],
  });

  assert.deepEqual(result.failures, [
    "Quality gate taxonomy references missing root script: taxonomy-required",
  ]);
});

test("package script validation fails for missing frontend script", () => {
  const result = validateCommandReferences({
    rootPackageJsonText,
    frontendPackageJsonText,
    commands: [
      packageScriptCommand(
        "frontend",
        "e2e:taxonomy-required",
        "pnpm --dir frontend e2e:taxonomy-required",
      ),
    ],
  });

  assert.deepEqual(result.failures, [
    "Quality gate taxonomy references missing frontend script: e2e:taxonomy-required",
  ]);
});

test("package script validation fails for invalid package scope", () => {
  const result = validateCommandReferences({
    rootPackageJsonText,
    frontendPackageJsonText,
    commands: [invalidPackageScriptCommand("workspace", "test", "pnpm --dir workspace test")],
  });

  assert.deepEqual(result.failures, [
    "Quality gate taxonomy references invalid package scope: workspace",
  ]);
});

test("test README contains the canonical generated taxonomy", () => {
  const result = validateReadmeTaxonomyProjection({ readmeText });

  assert.deepEqual(result.failures, []);
});

test("test README taxonomy drift is rejected", () => {
  const drifted = readmeText.replace("Backend production bundle check.", "Backend bundle drift.");
  const result = validateReadmeTaxonomyProjection({ readmeText: drifted });

  assert.deepEqual(result.failures, [
    "test/README.md quality gate taxonomy is out of sync with the executable policy.",
  ]);
});

test("invented taxonomy commands fail script validation", () => {
  const result = validateCommandReferences({
    rootPackageJsonText,
    frontendPackageJsonText,
    commands: [
      packageScriptCommand(
        "frontend",
        "e2e:taxonomy-required",
        "pnpm --dir frontend e2e:taxonomy-required",
      ),
    ],
  });

  assert.equal(result.passed, false);
  assert.ok(result.failures[0].includes("missing frontend script"));
});

test("test README taxonomy start marker is required", () => {
  const result = validateReadmeTaxonomyProjection({
    readmeText: readmeText.replace(README_MARKERS.start, ""),
  });

  assert.ok(result.failures.includes("test/README.md quality gate taxonomy start marker is missing."));
});

test("test README taxonomy end marker is required", () => {
  const result = validateReadmeTaxonomyProjection({
    readmeText: readmeText.replace(README_MARKERS.end, ""),
  });

  assert.ok(result.failures.includes("test/README.md quality gate taxonomy end marker is missing."));
});

test("test README taxonomy duplicate markers are rejected", () => {
  const result = validateReadmeTaxonomyProjection({
    readmeText: readmeText.replace(README_MARKERS.start, `${README_MARKERS.start}\n${README_MARKERS.start}`),
  });

  assert.ok(result.failures.includes("test/README.md quality gate taxonomy start marker is duplicated."));
});

test("test README taxonomy inverted markers are rejected", () => {
  const projection = renderTestTaxonomyProjection().trimEnd();
  const inverted = `${README_MARKERS.end}\n${projection}\n${README_MARKERS.start}\n`;
  const result = validateReadmeTaxonomyProjection({ readmeText: inverted });

  assert.deepEqual(result.failures, [
    "test/README.md quality gate taxonomy markers are in an invalid order.",
  ]);
});

test("test README taxonomy accepts CRLF and LF as equivalent", () => {
  const crlf = readmeText.replace(/\n/g, "\r\n");
  const result = validateReadmeTaxonomyProjection({ readmeText: crlf });

  assert.deepEqual(result.failures, []);
});

test("test README taxonomy normalizes trailing spaces inside the generated block", () => {
  const withTrailingSpaces = readmeText
    .split("\n")
    .map((line) => {
      if (
        line === README_MARKERS.start ||
        line === README_MARKERS.end ||
        line.startsWith("_Generated") ||
        line.startsWith("|")
      ) {
        return `${line}   `;
      }
      return line;
    })
    .join("\n");
  const result = validateReadmeTaxonomyProjection({ readmeText: withTrailingSpaces });

  assert.deepEqual(result.failures, []);
});
