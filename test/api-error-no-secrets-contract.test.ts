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
const { assertBodyRequestIdMatchesHeader } = await import(
  "./helpers/api-request-id-contract.ts"
);

const sensitiveHeaderValues = {
  authorization: "Bearer contract-header-authorization-value",
  cookie:
    "app_session_id=contract-clinic-cookie-value; admin_session_id=contract-admin-cookie-value",
  "set-cookie": "refresh_session=contract-set-cookie-value",
};

const sensitivePayload = {
  token: "contract-body-token-value",
  access_token: "contract-body-access-token-value",
  refresh_token: "contract-body-refresh-token-value",
  password: "contract-body-password-value",
  secret: "contract-body-secret-value",
  session: "contract-body-session-value",
  api_key: "contract-body-api-key-value",
  SUPABASE_SERVICE_ROLE_KEY: "contract-body-supabase-value",
  GMAIL_REFRESH_TOKEN: "contract-body-gmail-value",
  SMTP_PASS: "contract-body-smtp-value",
  ADMIN_SESSION_COOKIE_NAME: "contract-body-admin-cookie-name-value",
  CLINIC_SESSION_COOKIE_NAME: "contract-body-clinic-cookie-name-value",
};

const sensitiveQuery =
  "access_token=contract-query-access-token-value" +
  "&refresh_token=contract-query-refresh-token-value" +
  "&password=contract-query-password-value" +
  "&secret=contract-query-secret-value" +
  "&session=contract-query-session-value" +
  "&api_key=contract-query-api-key-value";

const forbiddenErrorBodyMarkers = [
  "Authorization",
  "Cookie",
  "Set-Cookie",
  "Bearer",
  "token",
  "access_token",
  "refresh_token",
  "password",
  "secret",
  "session",
  "api_key",
  "SUPABASE_",
  "GMAIL_",
  "SMTP_",
  "ADMIN_SESSION_COOKIE_NAME",
  "CLINIC_SESSION_COOKIE_NAME",
  ...Object.values(sensitiveHeaderValues),
  ...Object.values(sensitivePayload),
  ...sensitiveQuery.split("&").flatMap((part) => {
    const [name, value] = part.split("=");

    return [name, value];
  }),
];

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
  "API error responses no exponen secretos ni headers sensibles en body JSON",
  async () => {
    const app = await createFastifyApp();
    const originalConsoleError = console.error;
    const allowedOrigin = ENV.corsOrigins[0] ?? "http://localhost:3000";

    console.error = () => {};

    try {
      app.post("/api/__contract/internal-error", async () => {
        throw new Error("internal message with contract-body-secret-value");
      });

      app.post("/api/__contract/bad-request", async () => {
        const error = new Error("Payload invalido") as Error & {
          statusCode: number;
        };

        error.statusCode = 400;
        throw error;
      });

      const internalError = await app.inject({
        method: "POST",
        url: `/api/__contract/internal-error?${sensitiveQuery}`,
        headers: {
          ...sensitiveHeaderValues,
          origin: allowedOrigin,
        },
        payload: sensitivePayload,
      });

      assert.equal(internalError.statusCode, 500);
      const { body: internalBody, requestId: internalRequestId } =
        assertBodyRequestIdMatchesHeader(internalError, "internalError");
      assert.deepEqual(internalBody, {
        success: false,
        error: "Error interno del servidor",
        path: "/api/__contract/internal-error",
        requestId: internalRequestId,
      });
      assertJsonErrorBodyDoesNotExposeSecrets(
        internalError.body,
        "internalError",
      );

      const badRequest = await app.inject({
        method: "POST",
        url: `/api/__contract/bad-request?${sensitiveQuery}`,
        headers: {
          ...sensitiveHeaderValues,
          origin: allowedOrigin,
        },
        payload: sensitivePayload,
      });

      assert.equal(badRequest.statusCode, 400);
      const { body: badRequestBody, requestId: badRequestId } =
        assertBodyRequestIdMatchesHeader(badRequest, "badRequest");
      assert.deepEqual(badRequestBody, {
        success: false,
        error: "Payload invalido",
        details: "Payload invalido",
        path: "/api/__contract/bad-request",
        requestId: badRequestId,
      });
      assertJsonErrorBodyDoesNotExposeSecrets(badRequest.body, "badRequest");

      const notFound = await app.inject({
        method: "POST",
        url: `/api/__contract/not-found?${sensitiveQuery}`,
        headers: {
          ...sensitiveHeaderValues,
          origin: allowedOrigin,
        },
        payload: sensitivePayload,
      });

      assert.equal(notFound.statusCode, 404);
      const { body: notFoundBody, requestId: notFoundRequestId } =
        assertBodyRequestIdMatchesHeader(notFound, "notFound");
      assert.deepEqual(notFoundBody, {
        success: false,
        error: "Ruta no encontrada",
        path: "/api/__contract/not-found",
        requestId: notFoundRequestId,
      });
      assertJsonErrorBodyDoesNotExposeSecrets(notFound.body, "notFound");
    } finally {
      console.error = originalConsoleError;
      await app.close();
    }
  },
);

test("API error no-secrets contract no introduce dependencia frontend/UI", () => {
  const importSpecifiers = [
    ...listImportSpecifiers(readSource("server/fastify-app.ts")),
    ...listImportSpecifiers(
      readSource("test/api-error-no-secrets-contract.test.ts"),
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
