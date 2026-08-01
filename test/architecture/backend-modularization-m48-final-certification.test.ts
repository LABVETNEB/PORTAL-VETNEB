import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

import "./backend-modularization-m44-legacy-imports-sweep.test.ts";
import "./backend-modularization-m45-feature-dependency-guard.test.ts";
import "./backend-modularization-m46-http-lib-reclassification.test.ts";

const repoRoot = process.cwd();
const certificationPath =
  "docs/implementation/m48-backend-modularization-final-certification.md";
const programAuditPath =
  "docs/audit/backend-enterprise-modularization-program-audit.md";
const sharedLibInventoryPath =
  "docs/architecture/shared-lib-boundary-inventory.md";
const guardPath =
  "test/architecture/backend-modularization-m48-final-certification.test.ts";

const delegatedGuards = [
  "test/architecture/backend-modularization-m44-legacy-imports-sweep.test.ts",
  "test/architecture/backend-modularization-m45-feature-dependency-guard.test.ts",
  "test/architecture/backend-modularization-m46-http-lib-reclassification.test.ts",
] as const;

const expectedFeatures = [
  "clinics",
  "logistics",
  "particular-access",
  "pricing",
  "public-professionals",
  "report-access",
  "reports",
  "study-tracking",
  "users-roles",
] as const;

const expectedPublicBarrels = [
  "server/features/clinics/index.ts",
  "server/features/particular-access/index.ts",
  "server/features/public-professionals/index.ts",
  "server/features/report-access/index.ts",
  "server/features/reports/index.ts",
  "server/features/study-tracking/index.ts",
] as const;

const retiredCriticalPaths = [
  "server/utils/async-handler.ts",
  "server/middlewares/error-handler.ts",
  "server/db-logistics.ts",
  "server/db-pricing.ts",
  "server/lib/public-pricing-cache.ts",
  "server/db-public-professionals.ts",
  "server/lib/public-professionals-rate-limit.ts",
  "server/lib/professional-bank-eligibility.ts",
  "server/db-admin-clinics.ts",
  "server/lib/study-tracking.ts",
  "server/lib/token-study-tracking.ts",
  "server/db-particular.ts",
  "server/db-study-tracking.ts",
  "server/db-report-workflow.ts",
  "server/lib/report-workflow-communication.ts",
  "server/lib/report-status.ts",
  "server/lib/report-study-types.ts",
  "server/lib/reports.ts",
  "server/db-admin-users-roles.ts",
  "server/lib/particular-token.ts",
  "server/lib/report-access-token.ts",
  ["server/lib", "api-request-id.ts"].join("/"),
  ["server/lib", "api-response-security.ts"].join("/"),
  ["server/lib", "sensitive-response-cache.ts"].join("/"),
] as const;

const m47KeepPaths = [
  "server/lib/env.ts",
  "server/lib/logger.ts",
  "server/lib/http-runtime.ts",
  "server/lib/runtime-timing.ts",
  "server/lib/rate-limit-store.ts",
] as const;

const expectedAreaCensus = {
  "server/features": { files: 149, loc: 16_980 },
  "server/routes": { files: 35, loc: 22_943 },
  "server/lib": { files: 28, loc: 4_628 },
  "server/middlewares": { files: 7, loc: 947 },
  "server root": { files: 9, loc: 2_371 },
  other: { files: 0, loc: 0 },
} as const;

const expectedFeatureCensus = {
  clinics: { label: "Clinics", files: 10, loc: 2_638 },
  logistics: { label: "Logistics", files: 46, loc: 4_238 },
  "particular-access": {
    label: "Particular Access",
    files: 12,
    loc: 1_088,
  },
  pricing: { label: "Pricing", files: 4, loc: 489 },
  "public-professionals": {
    label: "Public Professionals",
    files: 8,
    loc: 1_150,
  },
  "report-access": { label: "Report Access", files: 12, loc: 723 },
  reports: { label: "Reports", files: 27, loc: 3_076 },
  "study-tracking": {
    label: "Study Tracking",
    files: 21,
    loc: 2_904,
  },
  "users-roles": { label: "Users/Roles", files: 9, loc: 674 },
} as const;

function read(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function countPhysicalLines(source: string): number {
  const normalized = source.replaceAll("\r\n", "\n");

  if (normalized.length === 0) {
    return 0;
  }

  const segments = normalized.split("\n");

  return normalized.endsWith("\n")
    ? segments.length - 1
    : segments.length;
}

function listTypeScriptFiles(relativeDirectory: string): string[] {
  return readdirSync(resolve(repoRoot, relativeDirectory), {
    withFileTypes: true,
  })
    .flatMap((entry) => {
      const relativePath = `${relativeDirectory}/${entry.name}`;

      if (entry.isDirectory()) {
        return listTypeScriptFiles(relativePath);
      }

      return entry.isFile() &&
        relativePath.endsWith(".ts") &&
        !relativePath.endsWith(".d.ts")
        ? [relativePath]
        : [];
    })
    .sort();
}

function listRootTypeScriptFiles(relativeDirectory: string): string[] {
  return readdirSync(resolve(repoRoot, relativeDirectory), {
    withFileTypes: true,
  })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith(".ts") &&
        !entry.name.endsWith(".d.ts"),
    )
    .map((entry) => `${relativeDirectory}/${entry.name}`)
    .sort();
}

function census(paths: readonly string[]): { files: number; loc: number } {
  return {
    files: paths.length,
    loc: paths.reduce(
      (total, relativePath) =>
        total + countPhysicalLines(readFileSync(resolve(repoRoot, relativePath), "utf8")),
      0,
    ),
  };
}

function markdownTableRow(
  section: string,
  label: string,
): { files: number; loc: number } {
  const row = section
    .split("\n")
    .map((line) =>
      line
        .split("|")
        .slice(1, -1)
        .map((cell) =>
          cell.trim().replaceAll("`", "").replaceAll("**", ""),
        ),
    )
    .find(([firstCell]) => firstCell === label);

  assert.ok(row, `missing documented row: ${label}`);
  assert.match(row[1], /^\d+$/);
  assert.match(row[2], /^\d{1,3}(?:\.\d{3})*$/);

  return {
    files: Number(row[1]),
    loc: Number(row[2].replaceAll(".", "")),
  };
}

function markdownSection(source: string, heading: string): string {
  const start = source.indexOf(heading);
  assert.notEqual(start, -1, heading);
  const remainder = source.slice(start + heading.length);
  const nextHeading = remainder.search(/^##\s+/m);

  return nextHeading === -1 ? remainder : remainder.slice(0, nextHeading);
}

function parse(relativePath: string): ts.SourceFile {
  return ts.createSourceFile(
    relativePath,
    read(relativePath),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
}

function isStringLiteralImport(
  statement: ts.Statement,
): statement is ts.ImportDeclaration & {
  moduleSpecifier: ts.StringLiteral;
} {
  return (
    ts.isImportDeclaration(statement) &&
    ts.isStringLiteral(statement.moduleSpecifier)
  );
}

test("M48 cuenta líneas físicas sin inflar archivos terminados en newline", () => {
  assert.deepEqual(
    ["", "a", "a\n", "a\nb", "a\nb\n", "\n"].map(countPhysicalLines),
    [0, 1, 1, 2, 2, 1],
  );
  assert.equal(countPhysicalLines("a\r\nb\r\n"), 2);
});

test("M48 congela el censo LOC global y de las nueve features", () => {
  const areaPaths = {
    "server/features": listTypeScriptFiles("server/features"),
    "server/routes": listTypeScriptFiles("server/routes"),
    "server/lib": listTypeScriptFiles("server/lib"),
    "server/middlewares": listTypeScriptFiles("server/middlewares"),
    "server root": listRootTypeScriptFiles("server"),
  };
  const categorizedPaths = new Set(Object.values(areaPaths).flat());
  const otherPaths = listTypeScriptFiles("server").filter(
    (relativePath) => !categorizedPaths.has(relativePath),
  );
  const actualAreaCensus = {
    ...Object.fromEntries(
      Object.entries(areaPaths).map(([area, paths]) => [area, census(paths)]),
    ),
    other: census(otherPaths),
  };

  assert.deepEqual(actualAreaCensus, expectedAreaCensus);
  assert.equal(
    Object.values(actualAreaCensus).reduce(
      (total, area) => total + area.loc,
      0,
    ),
    47_869,
  );
  assert.equal(
    Object.values(actualAreaCensus).reduce(
      (total, area) => total + area.files,
      0,
    ),
    228,
  );

  const actualFeatureCensus = Object.fromEntries(
    expectedFeatures.map((feature) => [
      feature,
      census(listTypeScriptFiles(`server/features/${feature}`)),
    ]),
  );
  assert.deepEqual(
    actualFeatureCensus,
    Object.fromEntries(
      Object.entries(expectedFeatureCensus).map(
        ([feature, { files, loc }]) => [feature, { files, loc }],
      ),
    ),
  );
  assert.equal(
    Object.values(actualFeatureCensus).reduce(
      (total, feature) => total + feature.loc,
      0,
    ),
    actualAreaCensus["server/features"].loc,
  );
});

test("M48 mantiene el censo LOC documentado igual al árbol computado", () => {
  const certification = read(certificationPath);
  const areaSection = markdownSection(
    certification,
    "## Censo final del backend",
  );
  const featureSection = markdownSection(
    certification,
    "## 8. Inventario y topología por feature",
  );

  for (const [label, expected] of [
    ["server/features", expectedAreaCensus["server/features"]],
    ["server/routes", expectedAreaCensus["server/routes"]],
    ["server/lib", expectedAreaCensus["server/lib"]],
    ["server/middlewares", expectedAreaCensus["server/middlewares"]],
    ["raíz/entrypoints server/*.ts", expectedAreaCensus["server root"]],
    ["otros", expectedAreaCensus.other],
    ["Total server", { files: 228, loc: 47_869 }],
  ] as const) {
    assert.deepEqual(markdownTableRow(areaSection, label), expected, label);
  }

  for (const { label, files, loc } of Object.values(expectedFeatureCensus)) {
    assert.deepEqual(
      markdownTableRow(featureSection, label),
      { files, loc },
      label,
    );
  }
});

test("M48 compone los guards ejecutables M44, M45 y M46 sin duplicarlos", () => {
  const guard = parse(guardPath);
  const importedGuards = guard.statements
    .filter(isStringLiteralImport)
    .map((statement) => statement.moduleSpecifier.text)
    .filter((specifier) => specifier.includes("backend-modularization-m4"))
    .sort();

  assert.deepEqual(importedGuards, [
    "./backend-modularization-m44-legacy-imports-sweep.test.ts",
    "./backend-modularization-m45-feature-dependency-guard.test.ts",
    "./backend-modularization-m46-http-lib-reclassification.test.ts",
  ]);

  for (const delegatedGuard of delegatedGuards) {
    assert.equal(existsSync(resolve(repoRoot, delegatedGuard)), true);
  }
});

test("M48 congela el inventario proporcional y sus barrels públicos reales", () => {
  const features = readdirSync(resolve(repoRoot, "server/features"), {
    withFileTypes: true,
  })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  assert.deepEqual(features, expectedFeatures);

  const actualPublicBarrels = expectedFeatures
    .map((feature) => `server/features/${feature}/index.ts`)
    .filter((path) => existsSync(resolve(repoRoot, path)));
  assert.deepEqual(actualPublicBarrels, expectedPublicBarrels);
});

test("M48 mantiene ausentes los paths legacy críticos y los shims temporales", () => {
  for (const retiredPath of retiredCriticalPaths) {
    assert.equal(existsSync(resolve(repoRoot, retiredPath)), false, retiredPath);
  }
});

test("M48 conserva las cinco decisiones KEEP de M47 y no crea lib/infra", () => {
  for (const keepPath of m47KeepPaths) {
    assert.equal(existsSync(resolve(repoRoot, keepPath)), true, keepPath);
  }
  assert.equal(existsSync(resolve(repoRoot, "server/lib/infra")), false);
});

test("M48 materializa certificación, matriz, evidencia y rollback documental", () => {
  assert.equal(
    existsSync(resolve(repoRoot, certificationPath)),
    true,
    certificationPath,
  );

  const certification = read(certificationPath);
  for (const marker of [
    "# M48 — Backend modularization final certification",
    "## Matriz final de milestones",
    "## Censo final del backend",
    "## Grafo full/runtime y SCC",
    "## M47 — NO-GO reproducido",
    "0 `MOVE`",
    "5 `KEEP`",
    "0 `DELETE`",
    "C5 — `NOT_RUN`",
    "## Revisión de seguridad acumulada",
    "## Validaciones finales",
    "## Rollback documental",
    "Veredicto final: **CERTIFIED_WITH_RESIDUAL_RISKS**",
  ]) {
    assert.ok(certification.includes(marker), marker);
  }
});

test("M48 actualiza sólo el estado vigente y preserva la historia M45/M46", () => {
  const audit = read(programAuditPath);
  const inventory = read(sharedLibInventoryPath);
  const m45Closeout = read(
    "docs/implementation/m45-backend-feature-dependency-guard-closeout.md",
  );
  const m46Closeout = read(
    "docs/implementation/m46-http-lib-reclassification-closeout.md",
  );

  for (const marker of [
    "M44 — MERGED",
    "M45 — MERGED",
    "M46 — MERGED",
    "M47 — NO-GO",
    "M48 — completado",
    "C5 — NOT_RUN",
    "Fase K — cerrada",
    "Programa — cerrado",
    "m48-backend-modularization-final-certification.md",
    "CERTIFIED_WITH_RESIDUAL_RISKS",
  ]) {
    assert.ok(audit.includes(marker), marker);
  }

  for (const marker of [
    "Inventario final M48",
    "M47 — NO-GO",
    "5 KEEP",
    "server/lib/infra",
    "M48 — completado",
  ]) {
    assert.ok(inventory.includes(marker), marker);
  }

  assert.ok(m45Closeout.includes("M48 — NOT_RUN"));
  assert.ok(m46Closeout.includes("M48 — NOT_RUN"));
});

test("el guard M48 es determinista y no consulta Git, red ni procesos", () => {
  const source = read(guardPath);
  const parsed = parse(guardPath);
  const forbiddenImports = parsed.statements
    .filter(isStringLiteralImport)
    .map((statement) => statement.moduleSpecifier.text)
    .filter((specifier) =>
      [
        "node:child_process",
        "node:http",
        "node:https",
        "node:net",
        "node:dns",
      ].includes(specifier),
    );

  assert.deepEqual(forbiddenImports, []);
  assert.doesNotMatch(source, /\bgit\s+(?:status|branch|log|show|worktree)\b/);
  assert.doesNotMatch(source, /\bgh\s+(?:pr|api|run)\b/);
  assert.doesNotMatch(source, /\bnew Date\s*\(/);
  assert.doesNotMatch(source, /\bDate\.now\s*\(/);
});
