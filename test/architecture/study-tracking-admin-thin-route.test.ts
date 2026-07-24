import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

const repoRoot = process.cwd();
const routeFile = "server/routes/admin-study-tracking.fastify.ts";
const clinicRouteFile = "server/routes/study-tracking.fastify.ts";
const particularRouteFile =
  "server/routes/particular-study-tracking.fastify.ts";
const applicationDir = "server/features/study-tracking/application";
const applicationIndexFile = `${applicationDir}/index.ts`;
const operationsFile = `${applicationDir}/admin-study-tracking-operations.ts`;
const operationsTestFile =
  "test/unit/application/study-tracking/admin-study-tracking-operations.test.ts";
const compositionFile =
  "server/features/study-tracking/study-tracking-route-composition.ts";
const infrastructureIndexFile =
  "server/features/study-tracking/infrastructure/index.ts";
const legacyShimFile = "server/db-study-tracking.ts";

function readSource(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
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

function visit(node: ts.Node, callback: (current: ts.Node) => void): void {
  callback(node);
  node.forEachChild((child) => visit(child, callback));
}

function normalizePath(value: string): string {
  return value.replaceAll("\\", "/");
}

function resolveSpecifier(file: string, specifier: string): string {
  if (!specifier.startsWith(".")) {
    return specifier;
  }

  const resolved = normalizePath(
    relative(repoRoot, resolve(repoRoot, dirname(file), specifier)),
  );

  if (resolved.endsWith(".ts")) {
    return resolved;
  }

  const tsFile = `${resolved}.ts`;
  return existsSync(resolve(repoRoot, tsFile))
    ? tsFile
    : `${resolved}/index.ts`;
}

function importTargets(relativePath: string): string[] {
  const targets: string[] = [];

  visit(parse(relativePath), (node) => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      targets.push(
        resolveSpecifier(relativePath, node.moduleSpecifier.text),
      );
      return;
    }

    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      targets.push(
        resolveSpecifier(relativePath, node.arguments[0].text),
      );
    }
  });

  return targets;
}

function optionNames(relativePath: string, aliasName: string): string[] {
  const sourceFile = parse(relativePath);
  const alias = sourceFile.statements.find(
    (statement): statement is ts.TypeAliasDeclaration =>
      ts.isTypeAliasDeclaration(statement) &&
      statement.name.text === aliasName,
  );

  assert.ok(alias, `${relativePath}: ${aliasName}`);
  assert.ok(ts.isTypeLiteralNode(alias.type), `${relativePath}: type literal`);

  return alias.type.members
    .filter(ts.isPropertySignature)
    .map((member) => member.name.getText(sourceFile).replaceAll('"', ""))
    .sort();
}

function endpointSurface(relativePath: string): string[] {
  const endpoints: string[] = [];

  visit(parse(relativePath), (node) => {
    if (
      !ts.isCallExpression(node) ||
      !ts.isPropertyAccessExpression(node.expression) ||
      !ts.isIdentifier(node.expression.expression) ||
      node.expression.expression.text !== "app"
    ) {
      return;
    }

    const method = node.expression.name.text;
    const path = node.arguments[0];

    if (
      ["get", "post", "patch", "options"].includes(method) &&
      path &&
      ts.isStringLiteral(path)
    ) {
      endpoints.push(`${method.toUpperCase()} ${path.text}`);
    }
  });

  return endpoints.sort();
}

function handlerPropertyCalls(
  relativePath: string,
  ownerNames: ReadonlySet<string>,
): string[] {
  const calls: string[] = [];

  visit(parse(relativePath), (node) => {
    if (
      !ts.isCallExpression(node) ||
      !ts.isPropertyAccessExpression(node.expression) ||
      !ts.isIdentifier(node.expression.expression) ||
      node.expression.expression.text !== "app" ||
      !["get", "post", "patch"].includes(node.expression.name.text)
    ) {
      return;
    }

    const handler = node.arguments.at(-1);

    if (!handler) {
      return;
    }

    visit(handler, (handlerNode) => {
      if (
        !ts.isCallExpression(handlerNode) ||
        !ts.isPropertyAccessExpression(handlerNode.expression) ||
        !ts.isIdentifier(handlerNode.expression.expression) ||
        !ownerNames.has(handlerNode.expression.expression.text)
      ) {
        return;
      }

      calls.push(
        `${handlerNode.expression.expression.text}.${handlerNode.expression.name.text}`,
      );
    });
  });

  return calls.sort();
}

function digest(relativePath: string): string {
  return createHash("sha256")
    .update(readFileSync(resolve(repoRoot, relativePath)))
    .digest("hex");
}

test("M32b conserva exactamente Options y endpoint registry admin", () => {
  assert.deepEqual(
    optionNames(routeFile, "AdminStudyTrackingNativeRoutesOptions"),
    [
      "createDate",
      "createStudyTrackingCase",
      "createStudyTrackingNotification",
      "deleteAdminSession",
      "getAdminSessionByToken",
      "getAdminUserById",
      "getClinicById",
      "getClinicScopedStudyTrackingCase",
      "getParticularTokenById",
      "getReportById",
      "getStudyTrackingCaseById",
      "hashSessionToken",
      "listStudyTrackingCases",
      "listStudyTrackingNotifications",
      "markAllStudyTrackingNotificationsRead",
      "markStudyTrackingNotificationRead",
      "now",
      "sendSpecialStainRequiredEmail",
      "updateAdminSessionLastAccess",
      "updateParticularTokenReport",
      "updateStudyTrackingCase",
      "writeAuditLog",
    ],
  );
  assert.deepEqual(endpointSurface(routeFile), [
    "GET /",
    "GET /:trackingCaseId",
    "GET /notifications",
    "OPTIONS /",
    "OPTIONS /:trackingCaseId",
    "OPTIONS /notifications",
    "OPTIONS /notifications/:notificationId/read",
    "OPTIONS /notifications/read-all",
    "PATCH /:trackingCaseId",
    "PATCH /notifications/:notificationId/read",
    "PATCH /notifications/read-all",
    "POST /",
  ]);
});

test("M32b handlers delegan sólo en operaciones application admin", () => {
  assert.deepEqual(
    handlerPropertyCalls(routeFile, new Set(["adminOperations"])),
    [
      "adminOperations.acknowledgeAdminStudyTrackingNotification",
      "adminOperations.acknowledgeAllAdminStudyTrackingNotifications",
      "adminOperations.createAdminStudyTrackingCase",
      "adminOperations.listAdminStudyTrackingCases",
      "adminOperations.listAdminStudyTrackingNotifications",
      "adminOperations.resolveAdminStudyTrackingCase",
      "adminOperations.resolveAdminStudyTrackingCase",
      "adminOperations.updateAdminStudyTrackingCase",
    ].sort(),
  );
  assert.deepEqual(
    handlerPropertyCalls(routeFile, new Set(["deps", "nativeDeps"])),
    [],
  );
});

test("M32b route consume application por barrel y composición canónica sin shim", () => {
  const targets = importTargets(routeFile);
  const applicationTargets = targets.filter((target) =>
    target.startsWith(`${applicationDir}/`),
  );

  assert.deepEqual(applicationTargets, [applicationIndexFile]);
  assert.ok(targets.includes(compositionFile));
  assert.equal(targets.includes(legacyShimFile), false);
  assert.equal(targets.includes(infrastructureIndexFile), false);
  assert.equal(
    targets.some((target) =>
      target.startsWith("server/features/study-tracking/infrastructure/"),
    ),
    false,
  );
});

test("M32b route conserva transporte y no coordina negocio inline", () => {
  const source = readSource(routeFile);

  for (const required of [
    "enforceTrustedOrigin",
    "authenticateFastifyAdmin",
    "adminCreateStudyTrackingSchema.safeParse",
    "updateStudyTrackingSchema.safeParse",
    "createAuditRequestLike",
    "serializeStudyTrackingCase",
    "serializeStudyTrackingNotification",
    "createAdminStudyTrackingOperations",
  ]) {
    assert.ok(source.includes(required), required);
  }

  for (const forbidden of [
    "applyEstimatedDeliveryRules",
    "applyStageTimestampDefaults",
    "shouldCreateSpecialStainNotification",
    "notifySpecialStainByEmail",
    "getStudyTrackingStageLabel",
    "await deps.createStudyTrackingCase",
    "await deps.updateStudyTrackingCase",
    "await deps.createStudyTrackingNotification",
    "await deps.writeAuditLog",
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});

test("M32b preserva resolución PATCH antes del Zod y precedencia body/query", () => {
  const source = readSource(routeFile);
  const patchStart = source.indexOf(
    'app.patch<{\n    Params: {\n      trackingCaseId: string;',
  );
  const patchSource = source.slice(patchStart);
  const markers = [
    "if (!enforceTrustedOrigin(request, reply, allowedOrigins))",
    "const admin = await authenticateAdminUser(request, reply, deps, now)",
    "const trackingCaseId = parseEntityId(request.params.trackingCaseId)",
    "parseEntityId(body.clinicId) ?? parseEntityId(request.query.clinicId)",
    "await adminOperations.resolveAdminStudyTrackingCase({",
    "if (!current)",
    "const parsed = updateStudyTrackingSchema.safeParse(body)",
    "await adminOperations.updateAdminStudyTrackingCase({",
  ];
  let cursor = -1;

  for (const marker of markers) {
    const index = patchSource.indexOf(marker, cursor + 1);
    assert.notEqual(index, -1, marker);
    assert.ok(index > cursor, marker);
    cursor = index;
  }
});

test("M32b operación, puerto y test tienen consumidor real", () => {
  const routeSource = readSource(routeFile);
  const indexSource = readSource(applicationIndexFile);
  const operationSource = readSource(operationsFile);
  const unitSource = readSource(operationsTestFile);

  assert.match(routeSource, /createAdminStudyTrackingOperations\s*\(/);
  assert.match(
    indexSource,
    /from "\.\/admin-study-tracking-operations\.ts"/,
  );
  assert.match(
    indexSource,
    /AdminStudyTrackingReferenceRepository/,
  );
  assert.match(
    operationSource,
    /AdminStudyTrackingReferenceRepository/,
  );
  assert.match(unitSource, /createAdminStudyTrackingOperations/);
  assert.match(unitSource, /admin update con tinción \+ stage/);
});

test("M32b composición admin selecciona sólo el barrel de infrastructure", () => {
  const source = readSource(compositionFile);
  const targets = importTargets(compositionFile);
  const blockStart = source.indexOf(
    "export async function loadAdminStudyTrackingPersistence()",
  );
  const block = source.slice(blockStart);

  assert.deepEqual([...new Set(targets)], [infrastructureIndexFile]);
  assert.match(block, /repository\.createStudyTrackingCase/);
  assert.match(block, /repository\.updateStudyTrackingCase/);
  assert.match(block, /repository\.getClinicScopedStudyTrackingCase/);
  assert.match(block, /repository\.getStudyTrackingCaseById/);
  assert.match(block, /repository\.listStudyTrackingCases/);
  assert.match(block, /repository\.createStudyTrackingNotification/);
  assert.match(block, /repository\.listStudyTrackingNotifications/);
  assert.match(block, /repository\.markStudyTrackingNotificationRead/);
  assert.match(block, /repository\.markAllStudyTrackingNotificationsRead/);
  assert.equal(/\b(?:select|insert|update|delete)\s*\(/.test(source), false);
  assert.equal(source.includes("drizzle-orm"), false);
});

test("M32b deja rutas clínica y particular byte-identical", () => {
  assert.equal(
    digest(clinicRouteFile),
    "2ce07bd8abb818b39bc2369095f71e19b5b1bd2a1dcba38f7848acaf349507b1",
  );
  assert.equal(
    digest(particularRouteFile),
    "ed7d3f4a949af488a9dab5a9a89ccc9e89d19399ddde7230a25a3189a32591fb",
  );
});

test("M33 existe sin iniciar M34 ni modificar los contextos de acceso M32b", () => {
  assert.equal(
    existsSync(resolve(repoRoot, "server/features/particular-access")),
    true,
  );
  assert.equal(
    existsSync(resolve(repoRoot, "server/features/report-access")),
    false,
  );
});
