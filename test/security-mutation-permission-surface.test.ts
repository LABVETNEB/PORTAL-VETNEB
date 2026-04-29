import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type SensitiveMutationRoute = {
  file: string;
  method: "post" | "patch" | "delete";
  path: string;
  permissionGuard: string;
  protectedCalls: readonly string[];
};

const SENSITIVE_MUTATION_ROUTES: readonly SensitiveMutationRoute[] = [
  {
    file: "server/routes/reports.fastify.ts",
    method: "post",
    path: "/upload",
    permissionGuard: "auth.canUploadReports",
    protectedCalls: [
      "runReportUpload",
      "deps.uploadReport",
      "deps.upsertReport",
      "deps.updateStudyTrackingCase",
    ],
  },
  {
    file: "server/routes/reports-status.fastify.ts",
    method: "patch",
    path: "/:reportId/status",
    permissionGuard: "requireReportStatusWritePermission",
    protectedCalls: ["deps.updateReportStatus", "deps.writeAuditLog"],
  },
  {
    file: "server/routes/report-access-tokens.fastify.ts",
    method: "post",
    path: "/",
    permissionGuard: "requireReportAccessTokenManagementPermission",
    protectedCalls: ["deps.createReportAccessToken", "deps.writeAuditLog"],
  },
  {
    file: "server/routes/report-access-tokens.fastify.ts",
    method: "patch",
    path: "/:tokenId/revoke",
    permissionGuard: "requireReportAccessTokenManagementPermission",
    protectedCalls: ["deps.revokeReportAccessToken", "deps.writeAuditLog"],
  },
  {
    file: "server/routes/particular-tokens.fastify.ts",
    method: "post",
    path: "/",
    permissionGuard: "requireParticularTokenManagementPermission",
    protectedCalls: ["deps.createParticularToken"],
  },
  {
    file: "server/routes/particular-tokens.fastify.ts",
    method: "patch",
    path: "/:tokenId/report",
    permissionGuard: "requireParticularTokenManagementPermission",
    protectedCalls: ["deps.updateParticularTokenReport"],
  },
  {
    file: "server/routes/study-tracking.fastify.ts",
    method: "post",
    path: "/",
    permissionGuard: "requireStudyTrackingManagementPermission",
    protectedCalls: [
      "deps.createStudyTrackingCase",
      "deps.updateParticularTokenReport",
      "deps.createStudyTrackingNotification",
      "deps.updateStudyTrackingCase",
    ],
  },
  {
    file: "server/routes/clinic-public-profile.fastify.ts",
    method: "patch",
    path: "/",
    permissionGuard: "requireClinicManagementPermission",
    protectedCalls: [
      "deps.patchClinicPublicProfile",
      "deps.syncClinicPublicSearch",
    ],
  },
  {
    file: "server/routes/clinic-public-profile.fastify.ts",
    method: "post",
    path: "/avatar",
    permissionGuard: "requireClinicManagementPermission",
    protectedCalls: [
      "runAvatarUpload",
      "deps.uploadClinicAvatar",
      "deps.patchClinicPublicProfile",
      "deps.syncClinicPublicSearch",
      "deps.deleteStorageObject",
    ],
  },
  {
    file: "server/routes/clinic-public-profile.fastify.ts",
    method: "delete",
    path: "/avatar",
    permissionGuard: "requireClinicManagementPermission",
    protectedCalls: [
      "deps.removeClinicPublicAvatar",
      "deps.syncClinicPublicSearch",
      "deps.deleteStorageObject",
    ],
  },
];

function readSource(file: string): string {
  return readFileSync(resolve(process.cwd(), file), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function routeStartRegex(route: Pick<SensitiveMutationRoute, "method" | "path">) {
  return new RegExp(
    `app\\.${route.method}(?:<[\\s\\S]*?>)?\\(\\s*${escapeRegex(
      JSON.stringify(route.path),
    )}`,
  );
}

function extractRouteBlock(route: SensitiveMutationRoute): string {
  const source = readSource(route.file);
  const match = routeStartRegex(route).exec(source);

  assert.notEqual(
    match,
    null,
    `${route.file} debe declarar ${route.method.toUpperCase()} ${route.path}`,
  );

  const start = match!.index;
  const afterStart = source.slice(start + match![0].length);
  const nextRouteMatch = /\n\s+app\.(?:get|post|patch|delete|options)(?:<[\s\S]*?>)?\(/.exec(
    afterStart,
  );
  const end = nextRouteMatch
    ? start + match![0].length + nextRouteMatch.index
    : source.length;

  return source.slice(start, end);
}

function assertContains(haystack: string, needle: string, context: string): void {
  assert.ok(
    haystack.includes(needle),
    `${context} debe contener: ${needle}`,
  );
}

function assertBefore(
  haystack: string,
  earlier: string,
  later: string,
  context: string,
): void {
  const earlierIndex = haystack.indexOf(earlier);
  const laterIndex = haystack.indexOf(later);

  assert.notEqual(
    earlierIndex,
    -1,
    `${context} debe contener checkpoint previo: ${earlier}`,
  );
  assert.notEqual(
    laterIndex,
    -1,
    `${context} debe contener operación protegida: ${later}`,
  );
  assert.ok(
    earlierIndex < laterIndex,
    `${context} debe ejecutar ${earlier} antes de ${later}`,
  );
}

function extractActualMutatingRoutes(file: string): string[] {
  const source = readSource(file);
  const routes: string[] = [];

  for (const match of source.matchAll(
    /app\.(post|patch|delete)(?:<[\s\S]*?>)?\(\s*"([^"]+)"/g,
  )) {
    routes.push(`${match[1].toUpperCase()} ${match[2]}`);
  }

  return routes;
}

test("mutation permission registry cubre rutas mutantes clinic-scoped sensibles", () => {
  const expectedByFile = new Map<string, string[]>();

  for (const route of SENSITIVE_MUTATION_ROUTES) {
    const key = `${route.method.toUpperCase()} ${route.path}`;
    const current = expectedByFile.get(route.file) ?? [];
    current.push(key);
    expectedByFile.set(route.file, current);
  }

  for (const [file, expectedRoutes] of expectedByFile) {
    const actualRoutes = extractActualMutatingRoutes(file);

    assert.deepEqual(
      actualRoutes,
      expectedRoutes,
      `${file} debe conservar registry explícito de rutas mutantes sensibles`,
    );
  }
});

test("rutas mutantes sensibles validan origin, sesión y permiso antes de operar", () => {
  for (const route of SENSITIVE_MUTATION_ROUTES) {
    const context = `${route.file} ${route.method.toUpperCase()} ${route.path}`;
    const block = extractRouteBlock(route);

    assertContains(block, "enforceTrustedOrigin", context);
    assertContains(block, "authenticateClinicUser", context);
    assertContains(block, route.permissionGuard, context);

    for (const protectedCall of route.protectedCalls) {
      assertBefore(block, "enforceTrustedOrigin", protectedCall, context);
      assertBefore(block, "authenticateClinicUser", protectedCall, context);
      assertBefore(block, route.permissionGuard, protectedCall, context);
    }
  }
});

test("permission helpers devuelven 403 estable antes de mutaciones sensibles", () => {
  const helpersByFile = new Map<string, string[]>();

  for (const route of SENSITIVE_MUTATION_ROUTES) {
    if (route.permissionGuard === "auth.canUploadReports") {
      continue;
    }

    const current = helpersByFile.get(route.file) ?? [];
    if (!current.includes(route.permissionGuard)) {
      current.push(route.permissionGuard);
    }

    helpersByFile.set(route.file, current);
  }

  for (const [file, helpers] of helpersByFile) {
    const source = readSource(file);

    for (const helper of helpers) {
      const marker = `function ${helper}`;
      const start = source.indexOf(marker);

      assert.notEqual(start, -1, `${file} debe declarar ${helper}`);

      const nextFunction = source.indexOf("\nfunction ", start + marker.length);
      const helperSource = source.slice(
        start,
        nextFunction === -1 ? source.length : nextFunction,
      );

      assertContains(helperSource, "reply.code(403).send", `${file} ${helper}`);
      assertContains(helperSource, "return false;", `${file} ${helper}`);
      assertContains(helperSource, "return true;", `${file} ${helper}`);
    }
  }
});

test("reports upload conserva permiso de carga antes de storage y DB", () => {
  const route = SENSITIVE_MUTATION_ROUTES.find(
    (candidate) =>
      candidate.file === "server/routes/reports.fastify.ts" &&
      candidate.method === "post" &&
      candidate.path === "/upload",
  );

  assert.ok(route);

  const block = extractRouteBlock(route);

  assertContains(block, "if (!auth.canUploadReports)", "reports upload");
  assertContains(block, "No autorizado para subir informes", "reports upload");

  for (const protectedCall of route.protectedCalls) {
    assertBefore(block, "if (!auth.canUploadReports)", protectedCall, "reports upload");
  }
});
