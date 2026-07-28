import assert from "node:assert/strict";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import {
  dirname,
  relative,
  resolve,
} from "node:path";
import test from "node:test";
import ts from "typescript";

const repoRoot = process.cwd();
const featuresRoot = "server/features";
const guardFile =
  "test/architecture/backend-modularization-m45-feature-dependency-guard.test.ts";
const m44GuardFile =
  "test/architecture/backend-modularization-m44-legacy-imports-sweep.test.ts";
const closeoutFile =
  "docs/implementation/m45-backend-feature-dependency-guard-closeout.md";
const programAuditFile =
  "docs/audit/backend-enterprise-modularization-program-audit.md";

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

const expectedMatrix: Record<string, string[]> = {
  clinics: ["public-professionals"],
  logistics: [],
  "particular-access": ["reports", "study-tracking"],
  pricing: [],
  "public-professionals": [],
  "report-access": ["reports"],
  reports: ["particular-access", "study-tracking"],
  "study-tracking": [],
  "users-roles": ["clinics"],
};

const expectedCrossFeatureReferenceKeys = [
  "clinics->public-professionals|dynamic|runtime|server/features/clinics/clinic-public-profile-command-service.ts|server/features/public-professionals/index.ts",
  "clinics->public-professionals|dynamic|runtime|server/features/clinics/clinic-public-profile-query-service.ts|server/features/public-professionals/index.ts",
  "clinics->public-professionals|static|type|server/features/clinics/clinic-public-profile-command-service.ts|server/features/public-professionals/index.ts",
  "particular-access->reports|dynamic|runtime|server/features/particular-access/particular-access-route-composition.ts|server/features/reports/index.ts",
  "particular-access->reports|dynamic|runtime|server/features/particular-access/particular-access-route-composition.ts|server/features/reports/index.ts",
  "particular-access->reports|static|runtime|server/features/particular-access/particular-token.ts|server/features/reports/index.ts",
  "particular-access->study-tracking|static|runtime|server/features/particular-access/application/admin-particular-access-operations.ts|server/features/study-tracking/index.ts",
  "particular-access->study-tracking|static|runtime|server/features/particular-access/application/clinic-particular-access-operations.ts|server/features/study-tracking/index.ts",
  "particular-access->study-tracking|static|runtime|server/features/particular-access/particular-access-route-composition.ts|server/features/study-tracking/index.ts",
  "particular-access->study-tracking|static|type|server/features/particular-access/application/ports/particular-access-ports.ts|server/features/study-tracking/index.ts",
  "report-access->reports|static|runtime|server/features/report-access/report-access-token.ts|server/features/reports/index.ts",
  "reports->particular-access|dynamic|runtime|server/features/reports/composition/report-route-composition.ts|server/features/particular-access/index.ts",
  "reports->study-tracking|dynamic|runtime|server/features/reports/composition/report-route-composition.ts|server/features/study-tracking/index.ts",
  "reports->study-tracking|static|runtime|server/features/reports/composition/report-route-composition.ts|server/features/study-tracking/index.ts",
  "users-roles->clinics|dynamic|runtime|server/features/users-roles/admin-users-roles-route-composition.ts|server/features/clinics/index.ts",
  "users-roles->clinics|static|type|server/features/users-roles/admin-users-roles-route-composition.ts|server/features/clinics/index.ts",
].sort();

type ImportKind =
  | "static"
  | "reexport"
  | "import-equals"
  | "import-type"
  | "dynamic"
  | "require";

type ImportSite = {
  specifier: string;
  kind: ImportKind;
  isTypeOnly: boolean;
};

type ResolvedReference = ImportSite & {
  sourceFile: string;
  targetFile: string;
  sourceFeature: string | null;
  targetFeature: string | null;
};

type GraphCensus = {
  features: string[];
  sourceFileCount: number;
  crossFeatureReferences: ResolvedReference[];
  crossFeatureInternalImports: string[];
  libToFeatureImports: string[];
  unresolvedRelativeImports: string[];
  inwardRouteOrMiddlewareImports: string[];
};

function normalizePath(value: string): string {
  return value.replaceAll("\\", "/");
}

function readSource(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function walkTsFiles(relativeDirectory: string): string[] {
  const absoluteDirectory = resolve(repoRoot, relativeDirectory);

  if (!existsSync(absoluteDirectory)) {
    return [];
  }

  return readdirSync(absoluteDirectory, {
    withFileTypes: true,
  })
    .flatMap((entry) => {
      const relativePath = `${relativeDirectory}/${entry.name}`;

      if (entry.isDirectory()) {
        return walkTsFiles(relativePath);
      }

      if (
        entry.isFile() &&
        entry.name.endsWith(".ts") &&
        !entry.name.endsWith(".d.ts")
      ) {
        return [relativePath];
      }

      return [];
    })
    .sort();
}

function parse(relativePath: string): ts.SourceFile {
  return ts.createSourceFile(
    relativePath,
    readSource(relativePath),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
}

function featureForPath(relativePath: string): string | null {
  const match = normalizePath(relativePath).match(
    /^server\/features\/([^/]+)\//,
  );

  return match?.[1] ?? null;
}

function importDeclarationIsTypeOnly(
  declaration: ts.ImportDeclaration,
): boolean {
  const clause = declaration.importClause;

  if (clause === undefined) {
    return false;
  }

  if (clause.isTypeOnly) {
    return true;
  }

  if (clause.name !== undefined) {
    return false;
  }

  const bindings = clause.namedBindings;

  if (
    bindings === undefined ||
    ts.isNamespaceImport(bindings)
  ) {
    return false;
  }

  return (
    bindings.elements.length > 0 &&
    bindings.elements.every((element) => element.isTypeOnly)
  );
}

function exportDeclarationIsTypeOnly(
  declaration: ts.ExportDeclaration,
): boolean {
  if (declaration.isTypeOnly) {
    return true;
  }

  const exportClause = declaration.exportClause;

  return (
    exportClause !== undefined &&
    ts.isNamedExports(exportClause) &&
    exportClause.elements.length > 0 &&
    exportClause.elements.every((element) => element.isTypeOnly)
  );
}

function listImportSitesFromSourceFile(
  sourceFile: ts.SourceFile,
): ImportSite[] {
  const sites: ImportSite[] = [];

  function addSite(
    specifier: string,
    kind: ImportKind,
    isTypeOnly: boolean,
  ): void {
    sites.push({
      specifier,
      kind,
      isTypeOnly,
    });
  }

  function visit(node: ts.Node): void {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      addSite(
        node.moduleSpecifier.text,
        "static",
        importDeclarationIsTypeOnly(node),
      );
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      addSite(
        node.moduleSpecifier.text,
        "reexport",
        exportDeclarationIsTypeOnly(node),
      );
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      node.moduleReference.expression !== undefined &&
      ts.isStringLiteralLike(node.moduleReference.expression)
    ) {
      addSite(
        node.moduleReference.expression.text,
        "import-equals",
        node.isTypeOnly,
      );
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteralLike(node.argument.literal)
    ) {
      addSite(
        node.argument.literal.text,
        "import-type",
        true,
      );
    } else if (
      ts.isCallExpression(node) &&
      node.arguments.length === 1 &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        addSite(
          node.arguments[0].text,
          "dynamic",
          false,
        );
      } else if (
        ts.isIdentifier(node.expression) &&
        node.expression.text === "require"
      ) {
        addSite(
          node.arguments[0].text,
          "require",
          false,
        );
      }
    }

    node.forEachChild(visit);
  }

  visit(sourceFile);

  return sites;
}

function listImportSites(relativePath: string): ImportSite[] {
  return listImportSitesFromSourceFile(parse(relativePath));
}

function resolveRelativeSpecifier(
  sourceFile: string,
  specifier: string,
): string | null {
  if (!specifier.startsWith(".")) {
    return null;
  }

  const absoluteTarget = resolve(
    repoRoot,
    dirname(sourceFile),
    specifier,
  );
  const repositoryRelativeTarget = normalizePath(
    relative(repoRoot, absoluteTarget),
  );

  const candidates = new Set<string>([
    repositoryRelativeTarget,
    `${repositoryRelativeTarget}.ts`,
    `${repositoryRelativeTarget}/index.ts`,
  ]);

  if (repositoryRelativeTarget.endsWith(".js")) {
    candidates.add(
      `${repositoryRelativeTarget.slice(0, -3)}.ts`,
    );
  }

  if (repositoryRelativeTarget.endsWith(".mjs")) {
    candidates.add(
      `${repositoryRelativeTarget.slice(0, -4)}.ts`,
    );
  }

  for (const candidate of candidates) {
    const absoluteCandidate = resolve(repoRoot, candidate);

    if (
      existsSync(absoluteCandidate) &&
      statSync(absoluteCandidate).isFile()
    ) {
      return candidate;
    }
  }

  return null;
}

function collectGraphCensus(): GraphCensus {
  const files = walkTsFiles(featuresRoot);
  const features = [
    ...new Set(
      files
        .map(featureForPath)
        .filter((feature): feature is string => feature !== null),
    ),
  ].sort();

  const crossFeatureReferences: ResolvedReference[] = [];
  const libToFeatureImports: string[] = [];
  const unresolvedRelativeImports: string[] = [];
  const inwardRouteOrMiddlewareImports: string[] = [];

  for (const sourceFile of files) {
    const sourceFeature = featureForPath(sourceFile);

    for (const site of listImportSites(sourceFile)) {
      if (!site.specifier.startsWith(".")) {
        continue;
      }

      const targetFile = resolveRelativeSpecifier(
        sourceFile,
        site.specifier,
      );

      if (targetFile === null) {
        unresolvedRelativeImports.push(
          `${sourceFile} -> ${site.specifier}`,
        );
        continue;
      }

      const targetFeature = featureForPath(targetFile);
      const reference: ResolvedReference = {
        ...site,
        sourceFile,
        targetFile,
        sourceFeature,
        targetFeature,
      };

      if (
        targetFile.startsWith("server/routes/") ||
        targetFile.startsWith("server/middlewares/")
      ) {
        inwardRouteOrMiddlewareImports.push(
          `${sourceFile} -> ${targetFile}`,
        );
      }

      if (
        sourceFeature !== null &&
        targetFeature !== null &&
        sourceFeature !== targetFeature
      ) {
        crossFeatureReferences.push(reference);
      }
    }
  }

  for (const sourceFile of walkTsFiles("server/lib")) {
    for (const site of listImportSites(sourceFile)) {
      const targetFile = site.specifier.startsWith(".")
        ? resolveRelativeSpecifier(sourceFile, site.specifier)
        : normalizePath(site.specifier).startsWith("server/features/")
          ? normalizePath(site.specifier)
          : null;

      if (targetFile?.startsWith("server/features/")) {
        libToFeatureImports.push(
          [
            sourceFile,
            site.kind,
            site.isTypeOnly ? "type" : "runtime",
            site.specifier,
            targetFile,
          ].join("|"),
        );
      }
    }
  }

  return {
    features,
    sourceFileCount: files.length,
    crossFeatureReferences,
    crossFeatureInternalImports: crossFeatureReferences
      .filter(
        (reference) =>
          reference.targetFeature !== null &&
          reference.targetFile !==
            `server/features/${reference.targetFeature}/index.ts`,
      )
      .map(referenceKey)
      .sort(),
    libToFeatureImports: libToFeatureImports.sort(),
    unresolvedRelativeImports:
      unresolvedRelativeImports.sort(),
    inwardRouteOrMiddlewareImports:
      inwardRouteOrMiddlewareImports.sort(),
  };
}

function referenceKey(reference: ResolvedReference): string {
  assert.notEqual(reference.sourceFeature, null);
  assert.notEqual(reference.targetFeature, null);

  return [
    `${reference.sourceFeature}->${reference.targetFeature}`,
    reference.kind,
    reference.isTypeOnly ? "type" : "runtime",
    reference.sourceFile,
    reference.targetFile,
  ].join("|");
}

function createAdjacency(
  features: readonly string[],
  references: readonly ResolvedReference[],
  includeTypeOnly: boolean,
): Map<string, Set<string>> {
  const adjacency = new Map(
    features.map((feature) => [
      feature,
      new Set<string>(),
    ]),
  );

  for (const reference of references) {
    if (!includeTypeOnly && reference.isTypeOnly) {
      continue;
    }

    if (
      reference.sourceFeature === null ||
      reference.targetFeature === null
    ) {
      continue;
    }

    adjacency
      .get(reference.sourceFeature)
      ?.add(reference.targetFeature);
  }

  return adjacency;
}

function matrixFromAdjacency(
  features: readonly string[],
  adjacency: ReadonlyMap<string, ReadonlySet<string>>,
): Record<string, string[]> {
  return Object.fromEntries(
    features.map((feature) => [
      feature,
      [...(adjacency.get(feature) ?? new Set())].sort(),
    ]),
  );
}

function stronglyConnectedComponents(
  features: readonly string[],
  adjacency: ReadonlyMap<string, ReadonlySet<string>>,
): string[][] {
  let nextIndex = 0;

  const stack: string[] = [];
  const onStack = new Set<string>();
  const indices = new Map<string, number>();
  const lowLinks = new Map<string, number>();
  const components: string[][] = [];

  function visit(feature: string): void {
    indices.set(feature, nextIndex);
    lowLinks.set(feature, nextIndex);
    nextIndex += 1;

    stack.push(feature);
    onStack.add(feature);

    for (const target of adjacency.get(feature) ?? []) {
      if (!indices.has(target)) {
        visit(target);

        lowLinks.set(
          feature,
          Math.min(
            lowLinks.get(feature) as number,
            lowLinks.get(target) as number,
          ),
        );
      } else if (onStack.has(target)) {
        lowLinks.set(
          feature,
          Math.min(
            lowLinks.get(feature) as number,
            indices.get(target) as number,
          ),
        );
      }
    }

    if (lowLinks.get(feature) !== indices.get(feature)) {
      return;
    }

    const component: string[] = [];

    while (stack.length > 0) {
      const current = stack.pop() as string;

      onStack.delete(current);
      component.push(current);

      if (current === feature) {
        break;
      }
    }

    components.push(component.sort());
  }

  for (const feature of features) {
    if (!indices.has(feature)) {
      visit(feature);
    }
  }

  return components;
}

function cyclicComponentKeys(
  features: readonly string[],
  adjacency: ReadonlyMap<string, ReadonlySet<string>>,
): string[] {
  return stronglyConnectedComponents(
    features,
    adjacency,
  )
    .filter((component) => {
      if (component.length > 1) {
        return true;
      }

      const feature = component[0];

      return adjacency.get(feature)?.has(feature) === true;
    })
    .map((component) => component.join("|"))
    .sort();
}

const census = collectGraphCensus();
const allAdjacency = createAdjacency(
  census.features,
  census.crossFeatureReferences,
  true,
);
const runtimeAdjacency = createAdjacency(
  census.features,
  census.crossFeatureReferences,
  false,
);

test("M45 auto-descubre el inventario canónico de features", () => {
  assert.deepEqual(census.features, expectedFeatures);
  assert.equal(census.sourceFileCount, 149);
});

test("M45 resuelve todos los imports relativos de features", () => {
  assert.deepEqual(census.unresolvedRelativeImports, []);
});

test("M45 congela las 16 referencias cross-feature exactas", () => {
  assert.deepEqual(
    census.crossFeatureReferences
      .map(referenceKey)
      .sort(),
    expectedCrossFeatureReferenceKeys,
  );
});

test("M45 impide dependencias desde server/lib hacia features", () => {
  assert.deepEqual(census.libToFeatureImports, []);
});

test("M45 exige barrels públicos para toda referencia cross-feature", () => {
  assert.deepEqual(census.crossFeatureInternalImports, []);
});

test("M45 congela la matriz de siete aristas dirigidas", () => {
  assert.deepEqual(
    matrixFromAdjacency(
      census.features,
      allAdjacency,
    ),
    expectedMatrix,
  );

  assert.deepEqual(
    matrixFromAdjacency(
      census.features,
      runtimeAdjacency,
    ),
    expectedMatrix,
  );
});

test("M45 permite solamente el SCC legacy Particular Access y Reports", () => {
  const expectedLegacyCycles = [
    "particular-access|reports",
  ];

  assert.deepEqual(
    cyclicComponentKeys(
      census.features,
      allAdjacency,
    ),
    expectedLegacyCycles,
  );

  assert.deepEqual(
    cyclicComponentKeys(
      census.features,
      runtimeAdjacency,
    ),
    expectedLegacyCycles,
  );
});

test("M45 impide dependencias desde features hacia routes o middlewares", () => {
  assert.deepEqual(
    census.inwardRouteOrMiddlewareImports,
    [],
  );
});

test("M45 detecta ImportTypeNode como dependencia exclusivamente type-only", () => {
  const fixtureSourceFile = "server/features/clinics/import-type-fixture.ts";
  const fixture = ts.createSourceFile(
    fixtureSourceFile,
    'type Report = import("../reports/index.ts").Report;\n',
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const sites = listImportSitesFromSourceFile(fixture);

  assert.deepEqual(sites, [
    {
      specifier: "../reports/index.ts",
      kind: "import-type",
      isTypeOnly: true,
    },
  ]);

  const targetFile = resolveRelativeSpecifier(
    fixtureSourceFile,
    sites[0].specifier,
  );
  assert.notEqual(targetFile, null);

  const reference: ResolvedReference = {
    ...sites[0],
    sourceFile: fixtureSourceFile,
    targetFile: targetFile as string,
    sourceFeature: "clinics",
    targetFeature: "reports",
  };
  const fixtureFeatures = ["clinics", "reports"];
  const fullFixtureAdjacency = createAdjacency(
    fixtureFeatures,
    [reference],
    true,
  );
  const runtimeFixtureAdjacency = createAdjacency(
    fixtureFeatures,
    [reference],
    false,
  );

  assert.deepEqual(
    matrixFromAdjacency(
      fixtureFeatures,
      fullFixtureAdjacency,
    ),
    {
      clinics: ["reports"],
      reports: [],
    },
  );
  assert.deepEqual(
    matrixFromAdjacency(
      fixtureFeatures,
      runtimeFixtureAdjacency,
    ),
    {
      clinics: [],
      reports: [],
    },
  );
  assert.notDeepEqual(
    [
      ...census.crossFeatureReferences,
      reference,
    ]
      .map(referenceKey)
      .sort(),
    expectedCrossFeatureReferenceKeys,
  );
});

test("M45 materializa closeout y estados de Fase K", () => {
  assert.equal(
    existsSync(resolve(repoRoot, closeoutFile)),
    true,
    closeoutFile,
  );

  const closeout = readSource(closeoutFile);
  const audit = readSource(programAuditFile);
  const m44Guard = readSource(m44GuardFile);

  for (const marker of [
    "M45 CLOSED localmente",
    "particular-access ↔ reports",
    "C5 — NOT_RUN",
    "M46 — NOT_RUN",
    "M48 — NOT_RUN",
  ]) {
    assert.ok(closeout.includes(marker), marker);
  }

  assert.ok(audit.includes("M45 — completado"));
  assert.ok(audit.includes("C5 — NOT_RUN"));
  assert.ok(audit.includes("M46 — completado"));
  assert.ok(audit.includes("M48 — NOT_RUN"));

  assert.ok(
    m44Guard.includes(
      'test("M44 conserva su closeout y reconoce el cierre M45"',
    ),
  );
});

test("el guard M45 no consulta Git, ramas ni worktrees", () => {
  const guardImports = listImportSites(guardFile)
    .map((site) => site.specifier);

  assert.equal(
    guardImports.includes("node:child_process"),
    false,
  );

  const source = readSource(guardFile);

  assert.doesNotMatch(
    source,
    /\bgit\s+(?:branch|show-ref|worktree|status|rev-parse)\b/,
  );
});
