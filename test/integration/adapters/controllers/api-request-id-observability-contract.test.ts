import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const repoRoot = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));

const { ENV } = await import("../../../../server/lib/env.ts");
const { createFastifyApp } = await import("../../../../server/fastify-app.ts");
const { API_REQUEST_ID_HEADER_KEY } = await import(
  "../../../../server/lib/http/api-request-id.ts"
);
const { clearPublicPricingCache } = await import(
  "../../../../server/features/pricing/infrastructure/public-pricing-cache.ts"
);
const {
  assertApiErrorLogRequestId,
  assertBodyDoesNotIncludeRequestId,
  assertBodyRequestIdMatchesHeader,
  assertRequestIdHeader,
  parseJsonObject,
  serializeConsoleCalls,
} = await import("../../../helpers/api-request-id-contract.ts");

function readSource(relativePath: string) {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

function listImportSpecifiers(source: string) {
  return Array.from(
    source.matchAll(
      /\bfrom\s+["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    ),
    (match) => match[1] ?? match[2] ?? "",
  );
}

function buildAdminSystemHealthRouteStubs() {
  return {
    deleteAdminSession: async () => {},
    getAdminSessionByToken: async (tokenHash: string) =>
      tokenHash === "hash:admin-session-token"
        ? {
            id: 10,
            adminUserId: 1,
            expiresAt: new Date("2099-01-01T00:00:00.000Z"),
            lastAccess: new Date("2026-06-03T00:00:00.000Z"),
          }
        : null,
    getAdminUserById: async (adminUserId: number) =>
      adminUserId === 1
        ? {
            id: 1,
            username: "VETNEB",
          }
        : null,
    updateAdminSessionLastAccess: async () => {},
    hashSessionToken: (token: string) => `hash:${token}`,
    getSystemHealthSnapshot: async () => ({
      statusCode: 200,
      payload: {
        success: true,
        status: "ok",
        checks: {
          database: "up",
          storage: "up",
        },
      },
    }),
    getBackendVersion: () => "2.1.0-test",
    now: () => Date.parse("2026-06-03T00:00:00.000Z"),
  };
}

function buildContractAppOptions() {
  return {
    getNativeHealthCheckResponse: async () => ({
      statusCode: 200,
      payload: {
        success: true,
        status: "ok",
      },
    }),
    adminSystemHealthRoutes: buildAdminSystemHealthRouteStubs(),
    publicPricingRoutes: {
      listPublicPricingItems: async () => [
        {
          id: 1,
          category: "Histopatologia",
          studyName: "Biopsia",
          priceLabel: "Consultar",
          displayOrder: 1,
        },
      ],
    },
  };
}

test(
  "API request id observability contracts cubren header body log y limites de superficie",
  async () => {
    clearPublicPricingCache();

    const app = await createFastifyApp(buildContractAppOptions());
    const originalConsoleError = console.error;
    const consoleErrorCalls: unknown[][] = [];

    console.error = (...args: unknown[]) => {
      consoleErrorCalls.push(args);
    };

    try {
      const throwInternalError = async () => {
        throw new Error("detalle interno sensible");
      };
      const allowedOrigin = ENV.corsOrigins[0] ?? "http://localhost:3000";

      app.get("/api/__contract/internal-error", throwInternalError);
      app.post("/api/__contract/internal-error", throwInternalError);
      app.get("/__contract/internal-error", throwInternalError);

      const publicApiSuccess = await app.inject({
        method: "GET",
        url: "/api/public/pricing",
      });
      const adminApiSuccess = await app.inject({
        method: "GET",
        url: "/api/admin/system/health",
        headers: {
          cookie: `${ENV.adminCookieName}=admin-session-token`,
        },
      });
      const apiHealthSuccess = await app.inject({
        method: "GET",
        url: "/api/health",
      });

      assert.equal(publicApiSuccess.statusCode, 200);
      assert.equal(adminApiSuccess.statusCode, 200);
      assert.equal(apiHealthSuccess.statusCode, 200);

      for (const { label, response } of [
        { label: "publicApiSuccess", response: publicApiSuccess },
        { label: "adminApiSuccess", response: adminApiSuccess },
        { label: "apiHealthSuccess", response: apiHealthSuccess },
      ]) {
        assertRequestIdHeader(response, label);
        assertBodyDoesNotIncludeRequestId(response, label);
      }

      assert.equal(parseJsonObject(publicApiSuccess, "publicApiSuccess").success, true);
      assert.equal(parseJsonObject(adminApiSuccess, "adminApiSuccess").success, true);
      assert.equal(
        consoleErrorCalls.length,
        0,
        "respuestas API exitosas no deben agregar logs de error",
      );

      const apiNotFound = await app.inject({
        method: "GET",
        url: "/api/__contract/no-existe",
      });
      const adminMissingAuth = await app.inject({
        method: "GET",
        url: "/api/admin/system/health",
      });

      assert.equal(apiNotFound.statusCode, 404);
      const { body: apiNotFoundBody, requestId: apiNotFoundRequestId } =
        assertBodyRequestIdMatchesHeader(apiNotFound, "apiNotFound");
      assert.deepEqual(apiNotFoundBody, {
        success: false,
        error: "Ruta no encontrada",
        path: "/api/__contract/no-existe",
        requestId: apiNotFoundRequestId,
      });

      assert.equal(adminMissingAuth.statusCode, 401);
      const { body: adminMissingAuthBody, requestId: adminMissingAuthRequestId } =
        assertBodyRequestIdMatchesHeader(adminMissingAuth, "adminMissingAuth");
      assert.deepEqual(adminMissingAuthBody, {
        success: false,
        error: "Admin no autenticado",
        requestId: adminMissingAuthRequestId,
      });

      const genericError = await app.inject({
        method: "POST",
        url: "/api/__contract/internal-error",
        headers: {
          authorization: "Bearer secret-authorization-token",
          cookie: `${ENV.cookieName}=secret-cookie-token`,
          origin: allowedOrigin,
        },
        payload: {
          password: "secret-request-password",
          token: "secret-request-token",
          secret: "secret-request-secret",
        },
      });

      assert.equal(genericError.statusCode, 500);
      const { body: genericBody, requestId: genericRequestId } =
        assertBodyRequestIdMatchesHeader(genericError, "genericError");
      assert.deepEqual(genericBody, {
        success: false,
        error: "Error interno del servidor",
        path: "/api/__contract/internal-error",
        requestId: genericRequestId,
      });
      assert.doesNotMatch(genericError.body, /detalle interno sensible/);
      const genericLogPayload = assertApiErrorLogRequestId(
        consoleErrorCalls,
        0,
        genericRequestId,
        "genericError",
      );
      assert.equal(genericLogPayload.method, "POST");
      assert.equal(genericLogPayload.path, "/api/__contract/internal-error");
      assert.equal(genericLogPayload.status, 500);

      const validIncomingRequestId = "client-req_123.abc:456";
      const validIncomingError = await app.inject({
        method: "GET",
        url: "/api/__contract/internal-error",
        headers: {
          [API_REQUEST_ID_HEADER_KEY]: validIncomingRequestId,
        },
      });
      const { body: validIncomingBody, requestId: validIncomingHeaderId } =
        assertBodyRequestIdMatchesHeader(
          validIncomingError,
          "validIncomingError",
        );

      assert.equal(validIncomingHeaderId, validIncomingRequestId);
      assert.equal(validIncomingBody.requestId, validIncomingRequestId);
      assertApiErrorLogRequestId(
        consoleErrorCalls,
        1,
        validIncomingRequestId,
        "validIncomingError",
      );

      const invalidIncomingRequestId =
        "bad id;Authorization=Bearer secret-dangerous-token";
      const invalidIncomingError = await app.inject({
        method: "GET",
        url: "/api/__contract/internal-error",
        headers: {
          [API_REQUEST_ID_HEADER_KEY]: invalidIncomingRequestId,
        },
      });
      const { body: invalidIncomingBody, requestId: invalidIncomingHeaderId } =
        assertBodyRequestIdMatchesHeader(
          invalidIncomingError,
          "invalidIncomingError",
        );

      assert.notEqual(invalidIncomingHeaderId, invalidIncomingRequestId);
      assert.equal(invalidIncomingBody.requestId, invalidIncomingHeaderId);
      assertApiErrorLogRequestId(
        consoleErrorCalls,
        2,
        invalidIncomingHeaderId,
        "invalidIncomingError",
      );

      const nonApiRoot = await app.inject({
        method: "GET",
        url: "/",
      });
      const nonApiError = await app.inject({
        method: "GET",
        url: "/__contract/internal-error",
      });

      assert.equal(nonApiRoot.statusCode, 200);
      assert.equal(nonApiRoot.headers["x-request-id"], undefined);
      assertBodyDoesNotIncludeRequestId(nonApiRoot, "nonApiRoot");

      assert.equal(nonApiError.statusCode, 500);
      assert.equal(nonApiError.headers["x-request-id"], undefined);
      assert.deepEqual(JSON.parse(nonApiError.body), {
        success: false,
        error: "Error interno del servidor",
        path: "/__contract/internal-error",
      });
      assert.equal(
        (consoleErrorCalls[3]?.[1] as Record<string, unknown> | undefined)
          ?.requestId,
        undefined,
      );

      const serializedConsoleCalls = serializeConsoleCalls(consoleErrorCalls);
      const lowerSerializedConsoleCalls = serializedConsoleCalls.toLowerCase();

      for (const forbiddenValue of [
        "secret-authorization-token",
        "secret-cookie-token",
        "secret-request-token",
        "secret-request-password",
        "secret-request-secret",
        "secret-dangerous-token",
        invalidIncomingRequestId,
      ]) {
        assert.equal(serializedConsoleCalls.includes(forbiddenValue), false);
      }

      for (const forbiddenName of [
        "authorization",
        "cookie",
        "password",
        "token",
        "secret",
      ]) {
        assert.equal(lowerSerializedConsoleCalls.includes(forbiddenName), false);
      }
    } finally {
      console.error = originalConsoleError;
      await app.close();
      clearPublicPricingCache();
    }
  },
);

test("API request id observability no introduce dependencia frontend/UI", () => {
  const importSpecifiers = [
    ...listImportSpecifiers(readSource("server/lib/http/api-request-id.ts")),
    ...listImportSpecifiers(readSource("server/fastify-app.ts")),
  ];
  const forbiddenImports = importSpecifiers.filter((specifier) =>
    specifier === "next" ||
    specifier.startsWith("next/") ||
    specifier === "react" ||
    specifier.startsWith("react/") ||
    specifier.startsWith("@/") ||
    specifier.includes("frontend") ||
    specifier.includes("components") ||
    specifier.includes("client")
  );

  assert.deepEqual(forbiddenImports, []);
});
