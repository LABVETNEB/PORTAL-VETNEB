const deepFreeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
};

const packageCommand = ({ id, packageScope, script, command }) => ({
  id,
  type: "package-script",
  packageScope,
  script,
  command,
});

const directCommand = ({ id, command, reason }) => ({
  id,
  type: "direct",
  command,
  reason,
});

export const POLICY_VERSION = "QGA-2.1";

export const README_MARKERS = deepFreeze({
  start: "<!-- quality-gate-taxonomy:start -->",
  end: "<!-- quality-gate-taxonomy:end -->",
});

export const QUALITY_GATES = deepFreeze([
  {
    id: "pr-governance",
    name: "PR Governance",
    workflow: "PR Governance",
    check: "validate-pr-governance",
    execution: "required",
    required: true,
    owner: "CI owner",
    commands: [
      directCommand({
        id: "pr-governance-validator",
        command: "node scripts/governance/pr-governance-validator.mjs",
        reason: "This repository script is the existing required PR governance entrypoint.",
      }),
    ],
    responsibility:
      "Required branch-protection context that validates PR metadata, scope, diff integrity, sensitive-file policy, Markdown hygiene, secrets and quality impact routing.",
  },
  {
    id: "backend-ci",
    name: "Backend CI",
    workflow: "Backend CI",
    check: "validate-backend",
    execution: "conditional, non-required",
    required: false,
    owner: "Backend owner",
    commands: [
      packageCommand({
        id: "backend-typecheck",
        packageScope: "root",
        script: "typecheck",
        command: "pnpm typecheck",
      }),
      packageCommand({
        id: "backend-test-typecheck",
        packageScope: "root",
        script: "typecheck:test",
        command: "pnpm typecheck:test",
      }),
      packageCommand({
        id: "backend-tests",
        packageScope: "root",
        script: "test",
        command: "pnpm test",
      }),
      packageCommand({
        id: "backend-build",
        packageScope: "root",
        script: "build",
        command: "pnpm build",
      }),
    ],
    responsibility:
      "Conditional backend validation for runtime, schema, script and test changes. This workflow is observable but is not the required merge context.",
  },
  {
    id: "frontend-ci",
    name: "Frontend CI",
    workflow: "Frontend CI",
    check: "validate-frontend",
    execution: "conditional, non-required",
    required: false,
    owner: "Frontend / QA owner",
    commands: [
      packageCommand({
        id: "frontend-lint",
        packageScope: "frontend",
        script: "lint",
        command: "pnpm --dir frontend lint",
      }),
      packageCommand({
        id: "frontend-typecheck",
        packageScope: "frontend",
        script: "typecheck",
        command: "pnpm --dir frontend typecheck",
      }),
      packageCommand({
        id: "frontend-build",
        packageScope: "frontend",
        script: "build",
        command: "pnpm --dir frontend build",
      }),
      packageCommand({
        id: "public-surface-audit",
        packageScope: "root",
        script: "security:public-surface",
        command: "pnpm security:public-surface",
      }),
      packageCommand({
        id: "frontend-e2e-smoke",
        packageScope: "frontend",
        script: "e2e:smoke",
        command: "pnpm --dir frontend e2e:smoke",
      }),
      packageCommand({
        id: "frontend-e2e-admin-mobile",
        packageScope: "frontend",
        script: "e2e:admin-mobile",
        command: "pnpm --dir frontend e2e:admin-mobile",
      }),
      packageCommand({
        id: "frontend-e2e-visual-contract",
        packageScope: "frontend",
        script: "e2e:visual-contract",
        command: "pnpm --dir frontend e2e:visual-contract",
      }),
      packageCommand({
        id: "frontend-e2e-public-clinic",
        packageScope: "frontend",
        script: "e2e:public-clinic",
        command: "pnpm --dir frontend e2e:public-clinic",
      }),
    ],
    responsibility:
      "Conditional frontend validation for UI, public-surface, build and Playwright layers. This workflow is observable but is not the required merge context.",
  },
  {
    id: "manual-review",
    name: "Manual review",
    workflow: null,
    check: null,
    execution: "governance fallback",
    required: false,
    owner: "Engineering governance",
    commands: [],
    responsibility:
      "Human governance fallback for documentation, repository policy and configuration changes that need owner judgment in addition to automated routing.",
  },
]);

export const TEST_TAXONOMY = deepFreeze([
  {
    id: "backend-typecheck",
    purpose: "TypeScript contract for backend runtime and shared test-facing types.",
    representativePaths: ["server/**", "test/**/*.test.ts", "tsconfig.json"],
    gate: "backend-ci",
    commands: [
      packageCommand({
        id: "backend-typecheck",
        packageScope: "root",
        script: "typecheck",
        command: "pnpm typecheck",
      }),
    ],
    packageScope: "root",
    requirement: "mandatory",
  },
  {
    id: "backend-test-typecheck",
    purpose: "TypeScript contract for the Node test suite.",
    representativePaths: ["test/**/*.test.ts", "test/tsconfig.json"],
    gate: "backend-ci",
    commands: [
      packageCommand({
        id: "backend-test-typecheck",
        packageScope: "root",
        script: "typecheck:test",
        command: "pnpm typecheck:test",
      }),
    ],
    packageScope: "root",
    requirement: "mandatory",
  },
  {
    id: "backend-tests",
    purpose: "Recursive Node test suite for backend, architecture, security, contracts and static frontend source contracts.",
    representativePaths: ["test/**/*.test.ts"],
    gate: "backend-ci",
    commands: [
      packageCommand({
        id: "backend-tests",
        packageScope: "root",
        script: "test",
        command: "pnpm test",
      }),
    ],
    packageScope: "root",
    requirement: "mandatory",
  },
  {
    id: "backend-build",
    purpose: "Backend production bundle check.",
    representativePaths: ["server/**", "package.json"],
    gate: "backend-ci",
    commands: [
      packageCommand({
        id: "backend-build",
        packageScope: "root",
        script: "build",
        command: "pnpm build",
      }),
    ],
    packageScope: "root",
    requirement: "mandatory",
  },
  {
    id: "frontend-lint",
    purpose: "ESLint contract for the Next.js frontend workspace.",
    representativePaths: ["frontend/**"],
    gate: "frontend-ci",
    commands: [
      packageCommand({
        id: "frontend-lint",
        packageScope: "frontend",
        script: "lint",
        command: "pnpm --dir frontend lint",
      }),
    ],
    packageScope: "frontend",
    requirement: "conditional",
  },
  {
    id: "frontend-typecheck",
    purpose: "TypeScript contract for the Next.js frontend workspace.",
    representativePaths: ["frontend/**"],
    gate: "frontend-ci",
    commands: [
      packageCommand({
        id: "frontend-typecheck",
        packageScope: "frontend",
        script: "typecheck",
        command: "pnpm --dir frontend typecheck",
      }),
    ],
    packageScope: "frontend",
    requirement: "conditional",
  },
  {
    id: "frontend-build",
    purpose: "Next.js production build contract.",
    representativePaths: ["frontend/**", "frontend/package.json"],
    gate: "frontend-ci",
    commands: [
      packageCommand({
        id: "frontend-build",
        packageScope: "frontend",
        script: "build",
        command: "pnpm --dir frontend build",
      }),
    ],
    packageScope: "frontend",
    requirement: "conditional",
  },
  {
    id: "public-surface-audit",
    purpose: "Audit of the built public surface for unintended devtools exposure.",
    representativePaths: ["frontend/**", "scripts/security/**"],
    gate: "frontend-ci",
    commands: [
      packageCommand({
        id: "public-surface-audit",
        packageScope: "root",
        script: "security:public-surface",
        command: "pnpm security:public-surface",
      }),
    ],
    packageScope: "root",
    requirement: "conditional",
  },
  {
    id: "frontend-e2e-smoke",
    purpose: "Fast Playwright smoke for auth, public routes, hydration, theme and dashboard foundation.",
    representativePaths: ["frontend/e2e/**", "frontend/src/**"],
    gate: "frontend-ci",
    commands: [
      packageCommand({
        id: "frontend-e2e-smoke",
        packageScope: "frontend",
        script: "e2e:smoke",
        command: "pnpm --dir frontend e2e:smoke",
      }),
    ],
    packageScope: "frontend",
    requirement: "conditional",
  },
  {
    id: "frontend-e2e-admin-mobile",
    purpose: "Playwright mobile admin app-shell and module operability contracts.",
    representativePaths: ["frontend/e2e/admin-*.spec.ts", "frontend/e2e/dashboard-*.spec.ts"],
    gate: "frontend-ci",
    commands: [
      packageCommand({
        id: "frontend-e2e-admin-mobile",
        packageScope: "frontend",
        script: "e2e:admin-mobile",
        command: "pnpm --dir frontend e2e:admin-mobile",
      }),
    ],
    packageScope: "frontend",
    requirement: "conditional",
  },
  {
    id: "frontend-e2e-visual-contract",
    purpose: "Playwright visual and layout contracts for dashboard shells and responsive behavior.",
    representativePaths: ["frontend/e2e/dashboard-*.spec.ts"],
    gate: "frontend-ci",
    commands: [
      packageCommand({
        id: "frontend-e2e-visual-contract",
        packageScope: "frontend",
        script: "e2e:visual-contract",
        command: "pnpm --dir frontend e2e:visual-contract",
      }),
    ],
    packageScope: "frontend",
    requirement: "conditional",
  },
  {
    id: "frontend-e2e-public-clinic",
    purpose: "Playwright public and clinic-facing route contracts.",
    representativePaths: ["frontend/e2e/public-*.spec.ts", "frontend/e2e/dashboard-clinic-*.spec.ts"],
    gate: "frontend-ci",
    commands: [
      packageCommand({
        id: "frontend-e2e-public-clinic",
        packageScope: "frontend",
        script: "e2e:public-clinic",
        command: "pnpm --dir frontend e2e:public-clinic",
      }),
    ],
    packageScope: "frontend",
    requirement: "conditional",
  },
]);

const BACKEND_SUITE_IDS = TEST_TAXONOMY.filter((suite) => suite.gate === "backend-ci").map((suite) => suite.id);
const FRONTEND_SUITE_IDS = TEST_TAXONOMY.filter((suite) => suite.gate === "frontend-ci").map((suite) => suite.id);

export const IMPACT_RULES = deepFreeze([
  {
    id: "test-readme-taxonomy",
    matcher: { type: "exact", path: "test/README.md" },
    impacts: ["test-taxonomy", "quality-gate-documentation"],
    gates: ["pr-governance", "backend-ci", "frontend-ci", "manual-review"],
    suiteIds: TEST_TAXONOMY.map((suite) => suite.id),
    description: "Canonical test taxonomy documentation must stay synchronized with executable policy.",
  },
  {
    id: "frontend-e2e",
    matcher: { type: "prefix", path: "frontend/e2e/" },
    impacts: ["frontend-e2e", "browser-behavior"],
    gates: ["pr-governance", "frontend-ci"],
    suiteIds: [
      "frontend-e2e-smoke",
      "frontend-e2e-admin-mobile",
      "frontend-e2e-visual-contract",
      "frontend-e2e-public-clinic",
    ],
    description: "Playwright tests and fixtures affect frontend browser validation.",
  },
  {
    id: "frontend-ci-workflow",
    matcher: { type: "exact", path: ".github/workflows/frontend-ci.yml" },
    impacts: ["workflow-policy", "ci-routing", "frontend-ci-routing"],
    gates: ["pr-governance", "backend-ci", "frontend-ci", "manual-review"],
    suiteIds: ["backend-tests", ...FRONTEND_SUITE_IDS],
    description: "Frontend CI workflow changes affect frontend validation routing and required governance summaries.",
  },
  {
    id: "backend-ci-workflow",
    matcher: { type: "exact", path: ".github/workflows/backend-ci.yml" },
    impacts: ["workflow-policy", "ci-routing", "backend-ci-routing"],
    gates: ["pr-governance", "backend-ci", "manual-review"],
    suiteIds: BACKEND_SUITE_IDS,
    description: "Backend CI workflow changes affect backend validation routing and required governance summaries.",
  },
  {
    id: "pr-governance-workflow",
    matcher: { type: "exact", path: ".github/workflows/pr-governance.yml" },
    impacts: ["workflow-policy", "required-pr-governance"],
    gates: ["pr-governance", "manual-review"],
    suiteIds: [],
    description: "Required PR governance workflow changes require governance validation and owner review.",
  },
  {
    id: "github-workflows",
    matcher: { type: "prefix", path: ".github/workflows/" },
    impacts: ["workflow-policy", "ci-routing"],
    gates: ["pr-governance", "backend-ci", "manual-review"],
    suiteIds: ["backend-tests"],
    description: "Workflow changes affect CI routing and required-check architecture.",
  },
  {
    id: "repo-config-gitignore",
    matcher: { type: "exact", path: ".gitignore" },
    impacts: ["repository-configuration"],
    gates: ["pr-governance", "manual-review"],
    suiteIds: [],
    description: "Git ignore rules affect repository configuration and require governance review.",
  },
  {
    id: "repo-config-gitattributes",
    matcher: { type: "exact", path: ".gitattributes" },
    impacts: ["repository-configuration"],
    gates: ["pr-governance", "manual-review"],
    suiteIds: [],
    description: "Git attributes affect repository configuration and require governance review.",
  },
  {
    id: "repo-config-npmrc",
    matcher: { type: "exact", path: ".npmrc" },
    impacts: ["repository-configuration", "package-tooling"],
    gates: ["pr-governance", "manual-review"],
    suiteIds: [],
    description: "Root npm configuration affects package tooling policy and requires governance review.",
  },
  {
    id: "repo-config-pnpmrc",
    matcher: { type: "exact", path: ".pnpmrc" },
    impacts: ["repository-configuration", "package-tooling"],
    gates: ["pr-governance", "manual-review"],
    suiteIds: [],
    description: "Root pnpm configuration affects package tooling policy and requires governance review.",
  },
  {
    id: "repo-config-cursorignore",
    matcher: { type: "exact", path: ".cursorignore" },
    impacts: ["repository-configuration", "agent-tooling"],
    gates: ["pr-governance", "manual-review"],
    suiteIds: [],
    description: "Cursor ignore rules affect repository agent configuration and require governance review.",
  },
  {
    id: "repo-config-vscode",
    matcher: { type: "prefix", path: ".vscode/" },
    impacts: ["repository-configuration", "editor-tooling"],
    gates: ["pr-governance", "manual-review"],
    suiteIds: [],
    description: "VS Code workspace settings affect repository editor configuration and require governance review.",
  },
  {
    id: "root-package",
    matcher: { type: "exact", path: "package.json" },
    impacts: ["root-package-scripts", "backend-toolchain", "frontend-public-surface"],
    gates: ["pr-governance", "backend-ci", "frontend-ci", "manual-review"],
    suiteIds: [
      "backend-typecheck",
      "backend-test-typecheck",
      "backend-tests",
      "backend-build",
      "public-surface-audit",
    ],
    description: "Root package changes can affect backend scripts, tooling and public-surface audit.",
  },
  {
    id: "frontend-package",
    matcher: { type: "exact", path: "frontend/package.json" },
    impacts: ["frontend-package-scripts", "frontend-toolchain"],
    gates: ["pr-governance", "backend-ci", "frontend-ci", "manual-review"],
    suiteIds: [
      "frontend-lint",
      "frontend-typecheck",
      "frontend-build",
      "frontend-e2e-smoke",
      "frontend-e2e-admin-mobile",
      "frontend-e2e-visual-contract",
      "frontend-e2e-public-clinic",
    ],
    description: "Frontend package changes can affect lint, typecheck, build and Playwright scripts.",
  },
  {
    id: "pnpm-lockfile",
    matcher: { type: "exact", path: "pnpm-lock.yaml" },
    impacts: ["dependency-lockfile", "supply-chain"],
    gates: ["pr-governance", "backend-ci", "frontend-ci", "manual-review"],
    suiteIds: ["backend-tests", "frontend-build", "public-surface-audit"],
    description: "Lockfile changes can affect all package-backed validation gates.",
  },
  {
    id: "pnpm-workspace",
    matcher: { type: "exact", path: "pnpm-workspace.yaml" },
    impacts: ["workspace-topology", "toolchain"],
    gates: ["pr-governance", "backend-ci", "frontend-ci", "manual-review"],
    suiteIds: ["backend-tests", "frontend-build"],
    description: "Workspace topology changes affect root and frontend package resolution.",
  },
  {
    id: "drizzle-config",
    matcher: { type: "exact", path: "drizzle.config.ts" },
    impacts: ["database-config", "migration-tooling"],
    gates: ["pr-governance", "backend-ci", "manual-review"],
    suiteIds: ["backend-typecheck", "backend-tests"],
    description: "Drizzle configuration affects schema and migration validation.",
  },
  {
    id: "agents-protocol",
    matcher: { type: "exact", path: "AGENTS.md" },
    impacts: ["repository-governance", "agent-protocol"],
    gates: ["pr-governance", "manual-review"],
    suiteIds: [],
    description: "Agent protocol changes require governance review and PR metadata enforcement.",
  },
  {
    id: "root-tsconfig",
    matcher: { type: "exact", path: "tsconfig.json" },
    impacts: ["typescript-toolchain"],
    gates: ["pr-governance", "backend-ci", "manual-review"],
    suiteIds: ["backend-typecheck", "backend-test-typecheck"],
    description: "Root TypeScript config affects backend and test typechecking.",
  },
  {
    id: "server-runtime",
    matcher: { type: "prefix", path: "server/" },
    impacts: ["backend-runtime"],
    gates: ["pr-governance", "backend-ci"],
    suiteIds: ["backend-typecheck", "backend-test-typecheck", "backend-tests", "backend-build"],
    description: "Backend runtime changes require backend validation.",
  },
  {
    id: "frontend-runtime",
    matcher: { type: "prefix", path: "frontend/" },
    impacts: ["frontend-runtime"],
    gates: ["pr-governance", "frontend-ci"],
    suiteIds: [
      "frontend-lint",
      "frontend-typecheck",
      "frontend-build",
      "public-surface-audit",
      "frontend-e2e-smoke",
    ],
    description: "Frontend runtime changes require frontend lint, typecheck, build and public-surface validation.",
  },
  {
    id: "node-tests",
    matcher: { type: "prefix", path: "test/" },
    impacts: ["node-test-suite", "test-taxonomy"],
    gates: ["pr-governance", "backend-ci"],
    suiteIds: ["backend-test-typecheck", "backend-tests"],
    description: "Node test changes affect recursive test execution and test typechecking.",
  },
  {
    id: "database-migrations",
    matcher: { type: "prefix", path: "drizzle/" },
    impacts: ["database-schema", "migrations"],
    gates: ["pr-governance", "backend-ci", "manual-review"],
    suiteIds: ["backend-typecheck", "backend-tests", "backend-build"],
    description: "Database schema or migration changes require backend and data review.",
  },
  {
    id: "governance-scripts",
    matcher: { type: "prefix", path: "scripts/" },
    impacts: ["governance-tooling", "repository-scripts"],
    gates: ["pr-governance", "backend-ci", "manual-review"],
    suiteIds: ["backend-test-typecheck", "backend-tests"],
    description: "Script changes affect local or CI governance tooling.",
  },
  {
    id: "github-config",
    matcher: { type: "prefix", path: ".github/" },
    impacts: ["repository-configuration", "pr-governance"],
    gates: ["pr-governance", "manual-review"],
    suiteIds: [],
    description: "GitHub configuration changes require governance validation and review.",
  },
  {
    id: "docs",
    matcher: { type: "prefix", path: "docs/" },
    impacts: ["documentation", "governance-documentation"],
    gates: ["pr-governance", "manual-review"],
    suiteIds: [],
    description: "Documentation changes require PR governance, Markdown hygiene and owner review when normative.",
  },
  {
    id: "root-markdown",
    matcher: { type: "root-markdown" },
    impacts: ["root-documentation"],
    gates: ["pr-governance", "manual-review"],
    suiteIds: [],
    description: "Root Markdown changes affect repository-level documentation.",
  },
]);

export const REQUIRED_SOURCE_PATHS = deepFreeze([
  "scripts/governance/pr-governance-validator.mjs",
  "scripts/governance/quality-gate-impact-policy.mjs",
  "scripts/governance/quality-gate-impact-validator.mjs",
  "scripts/governance/workflow-security-policy.mjs",
  "test/README.md",
  "package.json",
  "frontend/package.json",
]);

export const DIRECT_COMMAND_ALLOWLIST = deepFreeze([
  {
    command: "node scripts/governance/pr-governance-validator.mjs",
    reason: "Existing required PR governance entrypoint.",
  },
]);
