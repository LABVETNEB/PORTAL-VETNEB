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

const repoRoot = resolve(fileURLToPath(new URL("../", import.meta.url)));

const { ENV } = await import("../server/lib/env.ts");
const { createFastifyApp } = await import("../server/fastify-app.ts");
const { clearPublicPricingCache } = await import(
  "../server/lib/public-pricing-cache.ts"
);
const { assertBodyRequestIdMatchesHeader } = await import(
  "./helpers/api-request-id-contract.ts"
);

type ContractResponse = {
  statusCode: number;
  headers: Record<string, string | string[] | number | undefined>;
  body: string;
};

const sensitiveHeaderValues = {
  authorization: "Bearer content-type-contract-authorization-value",
  cookie:
    "app_session_id=content-type-contract-clinic-cookie; admin_session_id=content-type-contract-admin-cookie",
};

const sensitivePayload = {
  token: "content-type-contract-body-token",
  password: "content-type-contract-body-password",
  secret: "content-type-contract-body-secret",
  api_key: "content-type-contract-body-api-key",
  SUPABASE_SERVICE_ROLE_KEY: "content-type-contract-body-supabase-key",
};

const sensitiveQuery =
  "token=content-type-contract-query-token" +
  "&password=content-type-contract-query-password" +
  "&secret=content-type-contract-query-secret" +
  "&api_key=content-type-contract-query-api-key";

const forbiddenErrorBodyMarkers = [
  "Authorization",
  "Cookie",
  "Bearer",
  "token",
  "password",
  "secret",
  "api_key",
  "SUPABASE_",
  ...Object.values(sensitiveHeaderValues),
  ...Object.values(sensitivePayload),
  ...sensitiveQuery.split("&").flatMap((part) => {
    const [name, value] = part.split("=");

    return [name, value];
  }),
];

function buildErrorWithStack(message: string, statusCode?: number) {
  const error = new Error(message) as Error & { statusCode?: number };

  if (statusCode) {
    error.statusCode = statusCode;
  }

  error.stack = [
    `Error: ${message}`,
    "    at sensitiveStackFrame (C:\\portal-vetneb\\server\\secret.ts:10:20)",
    "    at hiddenApiImplementation (C:\\portal-vetneb\\server\\secret.ts:30:40)",
  ].join("\n");

  return error;
}

function assertJsonContentType(response: ContractResponse, label: string) {
  const contentType = response.headers["content-type"];

  assert.equal(
    typeof contentType,
    "string",
    `${label} debe incluir Content-Type`,
  );
  assert.match(
    String(contentType).toLowerCase(),
    /application\/json/,
    `${label} debe responder Content-Type application/json`,
  );
}

function assertApiJsonErrorContract(response: ContractResponse, label: string) {
  assertJsonContentType(response, label);

  const { body, requestId } = assertBodyRequestIdMatchesHeader(response, label);

  assertNoStackTraceDisclosure(body, response.body, label);
  assertJsonErrorBodyDoesNotExposeSecrets(response.body, label);

  return { body, requestId };
}

function assertNoStackTraceDisclosure(
  body: Record<string, unknown>,
  rawBody: string,
  label: string,
) {
  assert.equal("stack" in body, false, `${label} no debe incluir stack`);
  assert.equal("stackTrace" in body, false, `${label} no debe incluir stackTrace`);
  assert.equal("trace" in body, false, `${label} no debe incluir trace`);

  assert.doesNotMatch(rawBody, /sensitiveStackFrame/);
  assert.doesNotMatch(rawBody, /hiddenApiImplementation/);
  assert.doesNotMatch(rawBody, /secret\.ts:\d+:\d+/);
}

function assertJsonErrorBodyDoesNotExposeSecrets(rawBody: string, label: string) {
  const normalizedBody = rawBody.toLowerCase();

  for (const marker of forbiddenErrorBodyMarkers) {
    assert.equal(
      normalizedBody.includes(marker.toLowerCase()),
      false,
      `${label} no debe incluir ${marker}`,
    );
  }
}

function buildAdminSystemHealthRouteStubs() {
  return {
    deleteAdminSession: async () => {},
    getAdminSessionByToken: async () => null,
    getAdminUserById: async () => null,
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
      listPublicPricingItems: async () => {
        throw buildErrorWithStack("public pricing internal secret");
      },
    },
  };
}

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

test(
  "API error responses mantienen Content-Type JSON parseable con requestId seguro",
  async () => {
    clearPublicPricingCache();

    const app = await createFastifyApp(buildContractAppOptions());
    const originalConsoleError = console.error;

    console.error = () => {};

    try {
      app.get("/api/__contract/content-type/internal-error", async () => {
        throw buildErrorWithStack("detalle interno sensible");
      });

      app.get("/api/__contract/content-type/bad-request", async () => {
        throw buildErrorWithStack("Payload invalido", 400);
      });

      app.post("/api/__contract/content-type/trusted-origin", async () => {
        throw buildErrorWithStack("blocked route must not run");
      });

      const internalError = await app.inject({
        method: "GET",
        url: `/api/__contract/content-type/internal-error?${sensitiveQuery}`,
        headers: sensitiveHeaderValues,
      });

      assert.equal(internalError.statusCode, 500);
      const { body: internalBody, requestId: internalRequestId } =
        assertApiJsonErrorContract(internalError, "internalError");
      assert.deepEqual(internalBody, {
        success: false,
        error: "Error interno del servidor",
        path: "/api/__contract/content-type/internal-error",
        requestId: internalRequestId,
      });

      const notFound = await app.inject({
        method: "GET",
        url: `/api/__contract/content-type/no-existe?${sensitiveQuery}`,
        headers: sensitiveHeaderValues,
      });

      assert.equal(notFound.statusCode, 404);
      const { body: notFoundBody, requestId: notFoundRequestId } =
        assertApiJsonErrorContract(notFound, "notFound");
      assert.deepEqual(notFoundBody, {
        success: false,
        error: "Ruta no encontrada",
        path: "/api/__contract/content-type/no-existe",
        requestId: notFoundRequestId,
      });

      const badRequest = await app.inject({
        method: "GET",
        url: `/api/__contract/content-type/bad-request?${sensitiveQuery}`,
        headers: sensitiveHeaderValues,
      });

      assert.equal(badRequest.statusCode, 400);
      const { body: badRequestBody, requestId: badRequestId } =
        assertApiJsonErrorContract(badRequest, "badRequest");
      assert.deepEqual(badRequestBody, {
        success: false,
        error: "Payload invalido",
        details: "Payload invalido",
        path: "/api/__contract/content-type/bad-request",
        requestId: badRequestId,
      });

      const trustedOriginRejected = await app.inject({
        method: "POST",
        url: `/api/__contract/content-type/trusted-origin?${sensitiveQuery}`,
        headers: {
          ...sensitiveHeaderValues,
          origin: "https://evil.example.com",
          "content-type": "application/json",
        },
        payload: sensitivePayload,
      });

      assert.equal(trustedOriginRejected.statusCode, 403);
      const {
        body: trustedOriginRejectedBody,
        requestId: trustedOriginRejectedRequestId,
      } = assertApiJsonErrorContract(
        trustedOriginRejected,
        "trustedOriginRejected",
      );
      assert.deepEqual(trustedOriginRejectedBody, {
        success: false,
        error: "Origen no permitido",
        requestId: trustedOriginRejectedRequestId,
      });

      const protectedAdmin = await app.inject({
        method: "GET",
        url: "/api/admin/system/health",
      });

      assert.equal(protectedAdmin.statusCode, 401);
      const { body: protectedAdminBody, requestId: protectedAdminRequestId } =
        assertApiJsonErrorContract(protectedAdmin, "protectedAdmin");
      assert.deepEqual(protectedAdminBody, {
        success: false,
        error: "Admin no autenticado",
        requestId: protectedAdminRequestId,
      });

      const publicApi = await app.inject({
        method: "GET",
        url: "/api/public/pricing",
        headers: sensitiveHeaderValues,
      });

      assert.equal(publicApi.statusCode, 500);
      const { body: publicApiBody, requestId: publicApiRequestId } =
        assertApiJsonErrorContract(publicApi, "publicApi");
      assert.deepEqual(publicApiBody, {
        success: false,
        error: "Error interno del servidor",
        requestId: publicApiRequestId,
      });
    } finally {
      console.error = originalConsoleError;
      await app.close();
      clearPublicPricingCache();
    }
  },
);

test("API error content-type contract no introduce dependencia frontend/UI", () => {
  const importSpecifiers = [
    ...listImportSpecifiers(readSource("server/fastify-app.ts")),
    ...listImportSpecifiers(readSource("server/lib/api-request-id.ts")),
    ...listImportSpecifiers(
      readSource("test/api-error-content-type-contract.test.ts"),
    ),
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
