import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

const repoRoot = process.cwd();
const clinicRoute = "server/routes/study-tracking.fastify.ts";
const particularRoute =
  "server/routes/particular-study-tracking.fastify.ts";

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
    .map((member) => {
      assert.ok(member.name, `${relativePath}: option property name`);
      return member.name.getText(sourceFile).replaceAll('"', "");
    })
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

test("M32 conserva exactamente Options y endpoints públicos de clinic y particular", () => {
  assert.deepEqual(
    optionNames(clinicRoute, "StudyTrackingNativeRoutesOptions"),
    [
      "createDate",
      "createStudyTrackingCase",
      "createStudyTrackingNotification",
      "deleteActiveSession",
      "getActiveSessionByToken",
      "getClinicById",
      "getClinicScopedReportById",
      "getClinicScopedStudyTrackingCase",
      "getClinicUserById",
      "getParticularTokenById",
      "getReportById",
      "hashSessionToken",
      "listStudyTrackingCases",
      "listStudyTrackingNotifications",
      "markAllStudyTrackingNotificationsReadScoped",
      "markStudyTrackingNotificationReadScoped",
      "now",
      "sendSpecialStainRequiredEmail",
      "updateParticularTokenReport",
      "updateSessionLastAccess",
      "updateStudyTrackingCase",
      "writeAuditLog",
    ],
  );
  assert.deepEqual(
    optionNames(
      particularRoute,
      "ParticularStudyTrackingNativeRoutesOptions",
    ),
    [
      "deleteParticularSession",
      "getParticularSessionByToken",
      "getParticularStudyTrackingCase",
      "getParticularTokenById",
      "hashSessionToken",
      "listStudyTrackingNotifications",
      "markAllStudyTrackingNotificationsReadScoped",
      "markStudyTrackingNotificationReadScoped",
      "now",
      "updateParticularSessionLastAccess",
    ],
  );
  assert.deepEqual(endpointSurface(clinicRoute), [
    "GET /",
    "GET /:trackingCaseId",
    "GET /notifications",
    "OPTIONS /",
    "OPTIONS /:trackingCaseId",
    "OPTIONS /notifications",
    "OPTIONS /notifications/:notificationId/read",
    "OPTIONS /notifications/read-all",
    "PATCH /notifications/:notificationId/read",
    "PATCH /notifications/read-all",
    "POST /",
  ]);
  assert.deepEqual(endpointSurface(particularRoute), [
    "GET /me",
    "GET /notifications",
    "OPTIONS /me",
    "OPTIONS /notifications",
    "OPTIONS /notifications/:notificationId/read",
    "OPTIONS /notifications/read-all",
    "PATCH /notifications/:notificationId/read",
    "PATCH /notifications/read-all",
  ]);
});

test("M32 routes delegan sólo en operaciones application de alto nivel", () => {
  assert.deepEqual(
    handlerPropertyCalls(clinicRoute, new Set(["clinicOperations"])),
    [
      "clinicOperations.acknowledgeAllClinicStudyTrackingNotifications",
      "clinicOperations.acknowledgeClinicStudyTrackingNotification",
      "clinicOperations.createClinicStudyTrackingCase",
      "clinicOperations.getClinicStudyTrackingCase",
      "clinicOperations.listClinicStudyTrackingCases",
      "clinicOperations.listClinicStudyTrackingNotifications",
    ],
  );
  assert.deepEqual(
    handlerPropertyCalls(particularRoute, new Set(["operations"])),
    [
      "operations.acknowledgeAllParticularStudyTrackingNotifications",
      "operations.acknowledgeParticularStudyTrackingNotification",
      "operations.getParticularStudyTrackingForToken",
      "operations.listParticularStudyTrackingNotifications",
    ],
  );
  assert.deepEqual(
    handlerPropertyCalls(clinicRoute, new Set(["deps", "nativeDeps"])),
    [],
  );
  assert.deepEqual(
    handlerPropertyCalls(particularRoute, new Set(["deps", "nativeDeps"])),
    [],
  );
});

test("M32 routes no importan shim ni infrastructure y particular resuelve lazy por plugin", () => {
  for (const route of [clinicRoute, particularRoute]) {
    const source = readSource(route);

    assert.equal(source.includes("db-study-tracking"), false, route);
    assert.equal(
      source.includes("study-tracking/infrastructure"),
      false,
      route,
    );
    assert.match(source, /study-tracking-route-composition\.ts/);
  }

  const particularSource = readSource(particularRoute);
  assert.match(
    particularSource,
    /let runtimePromise:[\s\S]*runtimePromise \?\?= resolveParticularStudyTrackingRuntime\(options\)/,
  );
  assert.equal(
    parse(particularRoute).statements.some(
      (statement) =>
        ts.isVariableStatement(statement) &&
        (statement.declarationList.flags & ts.NodeFlags.Let) !== 0,
    ),
    false,
  );
});

test("M44 preserva rutas M32 y realinea sólo el specifier Particular Access", () => {
  assert.equal(
    createHash("sha256")
      .update(readFileSync(resolve(repoRoot, clinicRoute)))
      .digest("hex"),
    "95cacc008578974e9884f10bb1fa8edc750b34bbea18d3ead4f4f26eec95e105",
  );
  assert.equal(
    createHash("sha256")
      .update(readFileSync(resolve(repoRoot, particularRoute)))
      .digest("hex"),
    "24c6fa65a94def117e8e155ef1d14672409ac42ed2452e62667763b79ce5cc72",
  );
});
