import test from "node:test";
import assert from "node:assert/strict";
import { createEmailDependencies } from "../../mocks/email-dependencies.ts";
import type { EmailDependencies } from "../../../server/lib/email.ts";

process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { getSafeEmailTransportErrorMetadata, sendContactMessageEmail } = await import(
  "../../../server/lib/email.ts"
);

function gmailApiDependencies(fetch: EmailDependencies["fetch"]): EmailDependencies {
  return createEmailDependencies({
    config: {
      isProduction: true,
      contactTo: ["ops@vetneb.com"],
      gmailApi: {
        enabled: true,
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        refreshToken: "test-refresh-token",
        from: "lab.vetneb@gmail.com",
      },
    },
    fetch,
  });
}

// ── Generic error path ────────────────────────────────────────────────────────

test("getSafeEmailTransportErrorMetadata: errorName para Error genérico", () => {
  const error = new Error("algo salió mal");
  const metadata = getSafeEmailTransportErrorMetadata(error);
  assert.equal(metadata.errorName, "Error");
});

test("getSafeEmailTransportErrorMetadata: unknown_error para non-Error", () => {
  assert.equal(getSafeEmailTransportErrorMetadata("falla").errorName, "unknown_error");
  assert.equal(getSafeEmailTransportErrorMetadata(null).errorName, "unknown_error");
  assert.equal(getSafeEmailTransportErrorMetadata(42).errorName, "unknown_error");
});

test("getSafeEmailTransportErrorMetadata: extrae campos SMTP del error", () => {
  const smtpError = Object.assign(new Error("SMTP conn failed"), {
    code: "ESOCKET",
    command: "CONN",
    syscall: "connect",
    hostname: "smtp.gmail.com",
    port: 587,
    responseCode: 421,
    address: "74.125.140.108",
  });

  const metadata = getSafeEmailTransportErrorMetadata(smtpError);

  assert.equal(metadata.errorName, "Error");
  assert.equal(metadata.code, "ESOCKET");
  assert.equal(metadata.command, "CONN");
  assert.equal(metadata.errorSyscall, "connect");
  assert.equal(metadata.hostname, "smtp.gmail.com");
  assert.equal(metadata.errorPort, 587);
  assert.equal(metadata.responseCode, 421);
  assert.equal(metadata.errorAddress, "74.125.140.108");
  assert.equal("providerError" in metadata, false);
  assert.equal("providerMessage" in metadata, false);
});

test("getSafeEmailTransportErrorMetadata: no expone campos sensibles de error SMTP", () => {
  const smtpError = Object.assign(new Error("SMTP auth failed"), {
    code: "EAUTH",
    command: "AUTH",
    hostname: "smtp.gmail.com",
    pass: "super-secret-password",
    auth: { user: "user@example.com", pass: "secret" },
  });

  const metadata = getSafeEmailTransportErrorMetadata(smtpError);
  const serialized = JSON.stringify(metadata);

  assert.equal("pass" in metadata, false);
  assert.equal("auth" in metadata, false);
  assert.equal(serialized.includes("super-secret-password"), false);
  assert.equal(serialized.includes("secret"), false);
});

// ── SafeEmailTransportError path (vía Gmail API) ──────────────────────────────

test("getSafeEmailTransportErrorMetadata: captura code/command/hostname/responseCode de EmailTransportError (token failure)", async () => {
  const dependencies = gmailApiDependencies(async (url) => {
    if (url.includes("oauth2.googleapis.com")) {
      return new Response(
        JSON.stringify({ error: "invalid_grant", error_description: "Token has been expired or revoked." }),
        { status: 401, headers: { "content-type": "application/json" } },
      );
    }

    throw new Error("unexpected fetch");
  });

  const caught = await sendContactMessageEmail(
    {
      name: "Test User",
      email: "test@example.com",
      clinicName: null,
      message: "Mensaje de prueba para metadata.",
    },
    dependencies,
  ).catch((e: unknown) => e);

  assert.ok(caught instanceof Error, "debe lanzar un Error");

  const metadata = getSafeEmailTransportErrorMetadata(caught);

  assert.equal(metadata.errorName, "EmailTransportError");
  assert.equal(metadata.code, "GMAIL_API_TOKEN_FAILED");
  assert.equal(metadata.command, "TOKEN");
  assert.equal(metadata.hostname, "oauth2.googleapis.com");
  assert.equal(metadata.responseCode, 401);
  assert.equal(metadata.providerError, "invalid_grant");
  assert.equal(
    metadata.providerReason,
    "Token has been expired or revoked.",
  );
  assert.equal("providerMessage" in metadata, false);
});

test("getSafeEmailTransportErrorMetadata: captura providerError/providerMessage de fallo Gmail send", async () => {
  const dependencies = gmailApiDependencies(async (url) => {
    if (url.includes("oauth2.googleapis.com")) {
      return new Response(
        JSON.stringify({ access_token: "ya29.test-access-token" }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    if (url.includes("gmail.googleapis.com")) {
      return new Response(
        JSON.stringify({
          error: {
            code: 403,
            status: "PERMISSION_DENIED",
            message: "Request had insufficient authentication scopes.",
          },
        }),
        { status: 403, headers: { "content-type": "application/json" } },
      );
    }

    throw new Error("unexpected fetch");
  });

  const caught = await sendContactMessageEmail(
    {
      name: "Test User",
      email: "test@example.com",
      clinicName: null,
      message: "Mensaje de prueba para metadata de send.",
    },
    dependencies,
  ).catch((e: unknown) => e);

  assert.ok(caught instanceof Error, "debe lanzar un Error");

  const metadata = getSafeEmailTransportErrorMetadata(caught);

  assert.equal(metadata.errorName, "EmailTransportError");
  assert.equal(metadata.code, "GMAIL_API_SEND_FAILED");
  assert.equal(metadata.command, "SEND");
  assert.equal(metadata.hostname, "gmail.googleapis.com");
  assert.equal(metadata.responseCode, 403);
  assert.equal(metadata.providerError, "PERMISSION_DENIED");
  assert.equal(
    metadata.providerMessage,
    "Request had insufficient authentication scopes.",
  );
  assert.equal("providerReason" in metadata, false);
});

// ── Sanitizer ────────────────────────────────────────────────────────────────

test("getSafeEmailTransportErrorMetadata: redacta access token ya29 en providerReason", async () => {
  const dependencies = gmailApiDependencies(async (url) => {
    if (url.includes("oauth2.googleapis.com")) {
      return new Response(
        JSON.stringify({
          error: "invalid_grant",
          error_description: "Token ya29.AQEBsJ_SENSITIVE_TOKEN has expired. Contact user@domain.com.",
        }),
        { status: 401, headers: { "content-type": "application/json" } },
      );
    }

    throw new Error("unexpected fetch");
  });

  const caught = await sendContactMessageEmail(
    {
      name: "Sanitizer Test",
      email: "sanitizer@example.com",
      clinicName: null,
      message: "Mensaje de prueba sanitizer.",
    },
    dependencies,
  ).catch((e: unknown) => e);

  assert.ok(caught instanceof Error);

  const metadata = getSafeEmailTransportErrorMetadata(caught);
  const reason = metadata.providerReason as string;

  assert.ok(typeof reason === "string");
  assert.equal(reason.includes("ya29."), false, "access token debe estar redactado");
  assert.equal(reason.includes("AQEBsJ_SENSITIVE_TOKEN"), false);
  assert.equal(reason.includes("[REDACTED:access_token]"), true);
  assert.equal(reason.includes("@domain.com"), false, "email debe estar redactado");
  assert.equal(reason.includes("[REDACTED:email]"), true);
});

test("getSafeEmailTransportErrorMetadata: redacta refresh token 1// en providerReason", async () => {
  const dependencies = gmailApiDependencies(async (url) => {
    if (url.includes("oauth2.googleapis.com")) {
      return new Response(
        JSON.stringify({
          error: "invalid_grant",
          error_description: "Invalid refresh token 1//AEzb9SENSITIVE_REFRESH_HERE provided.",
        }),
        { status: 400, headers: { "content-type": "application/json" } },
      );
    }

    throw new Error("unexpected fetch");
  });

  const caught = await sendContactMessageEmail(
    {
      name: "Refresh Test",
      email: "refresh@example.com",
      clinicName: null,
      message: "Mensaje de prueba refresh token.",
    },
    dependencies,
  ).catch((e: unknown) => e);

  assert.ok(caught instanceof Error);

  const metadata = getSafeEmailTransportErrorMetadata(caught);
  const reason = metadata.providerReason as string;

  assert.ok(typeof reason === "string");
  assert.equal(reason.includes("1//AEzb9"), false, "refresh token debe estar redactado");
  assert.equal(reason.includes("[REDACTED:refresh_token]"), true);
});

test("getSafeEmailTransportErrorMetadata: trunca providerReason cuando supera el límite", async () => {
  const longDescription = "A".repeat(300);

  const dependencies = gmailApiDependencies(async (url) => {
    if (url.includes("oauth2.googleapis.com")) {
      return new Response(
        JSON.stringify({ error: "invalid_grant", error_description: longDescription }),
        { status: 401, headers: { "content-type": "application/json" } },
      );
    }

    throw new Error("unexpected fetch");
  });

  const caught = await sendContactMessageEmail(
    {
      name: "Truncate Test",
      email: "truncate@example.com",
      clinicName: null,
      message: "Mensaje de prueba truncado.",
    },
    dependencies,
  ).catch((e: unknown) => e);

  assert.ok(caught instanceof Error);

  const metadata = getSafeEmailTransportErrorMetadata(caught);
  const reason = metadata.providerReason as string;

  assert.ok(typeof reason === "string");
  assert.ok(reason.length <= 215, `providerReason debe estar truncado; longitud: ${reason.length}`);
  assert.ok(reason.includes("...[truncated]"), "debe incluir marcador de truncado");
});

test("getSafeEmailTransportErrorMetadata: no expone secretos de token ni creds en metadata", async () => {
  const dependencies = gmailApiDependencies(async (url) => {
    if (url.includes("oauth2.googleapis.com")) {
      return new Response(
        JSON.stringify({ access_token: "ya29.secret-access-token" }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    if (url.includes("gmail.googleapis.com")) {
      return new Response(
        JSON.stringify({ error: { status: "UNAUTHENTICATED", message: "Invalid credentials." } }),
        { status: 401, headers: { "content-type": "application/json" } },
      );
    }

    throw new Error("unexpected fetch");
  });

  const caught = await sendContactMessageEmail(
    {
      name: "Secrets Test",
      email: "secrets@example.com",
      clinicName: null,
      message: "Mensaje de prueba secretos.",
    },
    dependencies,
  ).catch((e: unknown) => e);

  assert.ok(caught instanceof Error);

  const metadata = getSafeEmailTransportErrorMetadata(caught);
  const serialized = JSON.stringify(metadata);

  assert.equal(serialized.includes("test-client-secret"), false, "client_secret no debe aparecer");
  assert.equal(serialized.includes("test-refresh-token"), false, "refresh_token no debe aparecer");
  assert.equal(serialized.includes("ya29.secret-access-token"), false, "access_token no debe aparecer");
  assert.equal(serialized.includes("secrets@example.com"), false, "email no debe aparecer");
});
