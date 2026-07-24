import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type SensitiveMutationRoute = {
  file: string;
  method: "post" | "patch" | "delete";
  path: string;
  authGuard: string;
  permissionGuard?: string;
  protectedCalls: readonly string[];
};

const SENSITIVE_MUTATION_ROUTES: readonly SensitiveMutationRoute[] = [
  {
    file: "server/routes/reports-status.fastify.ts",
    method: "patch",
    path: "/:reportId/status",
    authGuard: "authenticateClinicUser",
    permissionGuard: "requireReportStatusWritePermission",
    protectedCalls: ["deps.updateReportStatus", "deps.writeAuditLog"],
  },
  {
    file: "server/routes/report-access-tokens.fastify.ts",
    method: "post",
    path: "/",
    authGuard: "authenticateClinicUser",
    permissionGuard: "requireReportAccessTokenManagementPermission",
    protectedCalls: ["deps.createReportAccessToken", "deps.writeAuditLog"],
  },
  {
    file: "server/routes/report-access-tokens.fastify.ts",
    method: "patch",
    path: "/:tokenId/revoke",
    authGuard: "authenticateClinicUser",
    permissionGuard: "requireReportAccessTokenManagementPermission",
    protectedCalls: ["deps.revokeReportAccessToken", "deps.writeAuditLog"],
  },
  {
    file: "server/routes/particular-tokens.fastify.ts",
    method: "post",
    path: "/",
    authGuard: "authenticateClinicUser",
    permissionGuard: "requireParticularTokenManagementPermission",
    protectedCalls: ["deps.createParticularToken"],
  },
  {
    file: "server/routes/particular-tokens.fastify.ts",
    method: "patch",
    path: "/:tokenId/report",
    authGuard: "authenticateClinicUser",
    permissionGuard: "requireParticularTokenManagementPermission",
    protectedCalls: ["deps.updateParticularTokenReport"],
  },
  {
    file: "server/routes/study-tracking.fastify.ts",
    method: "patch",
    path: "/notifications/:notificationId/read",
    authGuard: "authenticateClinicUser",
    protectedCalls: [
      "clinicOperations.acknowledgeClinicStudyTrackingNotification",
    ],
  },
  {
    file: "server/routes/study-tracking.fastify.ts",
    method: "patch",
    path: "/notifications/read-all",
    authGuard: "authenticateClinicUser",
    protectedCalls: [
      "clinicOperations.acknowledgeAllClinicStudyTrackingNotifications",
    ],
  },
  {
    file: "server/routes/study-tracking.fastify.ts",
    method: "post",
    path: "/",
    authGuard: "authenticateClinicUser",
    permissionGuard: "requireStudyTrackingManagementPermission",
    protectedCalls: ["clinicOperations.createClinicStudyTrackingCase"],
  },
  {
    file: "server/routes/admin-study-tracking.fastify.ts",
    method: "patch",
    path: "/notifications/:notificationId/read",
    authGuard: "authenticateAdminUser",
    protectedCalls: [
      "adminOperations.acknowledgeAdminStudyTrackingNotification",
    ],
  },
  {
    file: "server/routes/admin-study-tracking.fastify.ts",
    method: "patch",
    path: "/notifications/read-all",
    authGuard: "authenticateAdminUser",
    protectedCalls: [
      "adminOperations.acknowledgeAllAdminStudyTrackingNotifications",
    ],
  },
  {
    file: "server/routes/admin-study-tracking.fastify.ts",
    method: "post",
    path: "/",
    authGuard: "authenticateAdminUser",
    protectedCalls: ["adminOperations.createAdminStudyTrackingCase"],
  },
  {
    file: "server/routes/admin-study-tracking.fastify.ts",
    method: "patch",
    path: "/:trackingCaseId",
    authGuard: "authenticateAdminUser",
    protectedCalls: ["adminOperations.updateAdminStudyTrackingCase"],
  },
  {
    file: "server/routes/particular-study-tracking.fastify.ts",
    method: "patch",
    path: "/notifications/:notificationId/read",
    authGuard: "authenticateParticularUser",
    protectedCalls: [
      "operations.acknowledgeParticularStudyTrackingNotification",
    ],
  },
  {
    file: "server/routes/particular-study-tracking.fastify.ts",
    method: "patch",
    path: "/notifications/read-all",
    authGuard: "authenticateParticularUser",
    protectedCalls: [
      "operations.acknowledgeAllParticularStudyTrackingNotifications",
    ],
  },
  {
    file: "server/routes/clinic-public-profile.fastify.ts",
    method: "patch",
    path: "/",
    authGuard: "authenticateClinicUser",
    permissionGuard: "requireClinicManagementPermission",
    protectedCalls: ["patchClinicPublicProfileCommand"],
  },
  {
    file: "server/routes/clinic-public-profile.fastify.ts",
    method: "post",
    path: "/avatar",
    authGuard: "authenticateClinicUser",
    permissionGuard: "requireClinicManagementPermission",
    protectedCalls: [
      "runAvatarUpload",
      "uploadClinicPublicAvatarCommand",
    ],
  },
  {
    file: "server/routes/clinic-public-profile.fastify.ts",
    method: "delete",
    path: "/avatar",
    authGuard: "authenticateClinicUser",
    permissionGuard: "requireClinicManagementPermission",
    protectedCalls: ["deleteClinicPublicAvatarCommand"],
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
  const routeStarts = [
    ...source.matchAll(/\bapp\.(?:get|post|patch|delete|options)(?:<|\()/g),
  ].map((match) => match.index);
  const block = routeStarts
    .map((start, index) =>
      source.slice(start, routeStarts[index + 1] ?? source.length),
    )
    .find((candidate) => routeStartRegex(route).test(candidate));

  assert.notEqual(
    block,
    undefined,
    `${route.file} debe declarar ${route.method.toUpperCase()} ${route.path}`,
  );

  return block!;
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
    assertContains(block, route.authGuard, context);

    if (route.permissionGuard) {
      assertContains(block, route.permissionGuard, context);
    }

    for (const protectedCall of route.protectedCalls) {
      assertBefore(block, "enforceTrustedOrigin", protectedCall, context);
      assertBefore(block, route.authGuard, protectedCall, context);

      if (route.permissionGuard) {
        assertBefore(block, route.permissionGuard, protectedCall, context);
      }
    }
  }
});

test("permission helpers devuelven 403 estable antes de mutaciones sensibles", () => {
  const helpersByFile = new Map<string, string[]>();

  for (const route of SENSITIVE_MUTATION_ROUTES) {
    if (!route.permissionGuard || route.permissionGuard === "auth.canUploadReports") {
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

      const isClinicStudyTrackingHelper =
        file === "server/routes/study-tracking.fastify.ts" &&
        helper === "requireStudyTrackingManagementPermission";

      if (isClinicStudyTrackingHelper) {
        assertContains(
          helperSource,
          'error: "Solo administración puede crear seguimientos"',
          `${file} ${helper}`,
        );
      } else {
        assertContains(helperSource, "return true;", `${file} ${helper}`);
      }
    }
  }
});

test("reports clinic read-only no declara rutas mutantes ni storage upload", () => {
  const source = readSource("server/routes/reports.fastify.ts");

  assert.deepEqual(
    extractActualMutatingRoutes("server/routes/reports.fastify.ts"),
    [],
    "reports clinic debe quedar limitado a rutas read-only",
  );

  for (const forbiddenMarker of [
    "app.post(\"/upload\"",
    "runReportUpload",
    "auth.canUploadReports",
    "deps.uploadReport",
    "deps.upsertReport",
    "deps.updateStudyTrackingCase",
  ]) {
    assert.equal(
      source.includes(forbiddenMarker),
      false,
      `reports clinic read-only no debe contener marker: ${forbiddenMarker}`,
    );
  }
});

test("clinic permissions expose logistics role gates", () => {
  const source = readSource("server/lib/permissions.ts");

  for (const marker of [
    "canViewLogistics: boolean",
    "canManageLogisticsFieldVisits: boolean",
    "canManageLogisticsRoutePlans: boolean",
    "canManageLogisticsRouteEvents: boolean",
    "canViewLogisticsSla: boolean",
    "canManageLogisticsFieldVisits: true",
    "canManageLogisticsRoutePlans: true",
    "canManageLogisticsRouteEvents: true",
    "canManageLogisticsFieldVisits: false",
    "canManageLogisticsRoutePlans: false",
    "canManageLogisticsRouteEvents: false",
  ]) {
    assertContains(source, marker, "server/lib/permissions.ts");
  }
});
