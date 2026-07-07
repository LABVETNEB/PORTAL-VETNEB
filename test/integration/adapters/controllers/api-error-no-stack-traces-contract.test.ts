import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { createFastifyApp } = await import("../../../../server/fastify-app.ts");
const { assertBodyRequestIdMatchesHeader } = await import(
  "../../../helpers/api-request-id-contract.ts"
);

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

test(
  "API error responses no exponen stack traces en errores 500 ni 400",
  async () => {
    const app = await createFastifyApp();
    const originalConsoleError = console.error;

    console.error = () => {};

    try {
      app.get("/api/__contract/internal-crash", async () => {
        throw buildErrorWithStack("detalle interno con stack sensible");
      });

      app.get("/api/__contract/bad-request", async () => {
        throw buildErrorWithStack("Payload invalido", 400);
      });

      const internalError = await app.inject({
        method: "GET",
        url: "/api/__contract/internal-crash",
      });

      assert.equal(internalError.statusCode, 500);
      const { body: internalBody, requestId: internalRequestId } =
        assertBodyRequestIdMatchesHeader(internalError, "internalError");
      assert.deepEqual(internalBody, {
        success: false,
        error: "Error interno del servidor",
        path: "/api/__contract/internal-crash",
        requestId: internalRequestId,
      });
      assert.equal(
        internalError.body.includes("detalle interno con stack sensible"),
        false,
      );
      assertNoStackTraceDisclosure(
        internalBody,
        internalError.body,
        "internalError",
      );

      const badRequest = await app.inject({
        method: "GET",
        url: "/api/__contract/bad-request",
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
      assertNoStackTraceDisclosure(
        badRequestBody,
        badRequest.body,
        "badRequest",
      );
    } finally {
      console.error = originalConsoleError;
      await app.close();
    }
  },
);
