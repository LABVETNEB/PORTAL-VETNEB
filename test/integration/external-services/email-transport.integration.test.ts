import assert from "node:assert/strict";
import test from "node:test";
import { createEmailDependencies } from "../../mocks/email-dependencies.ts";

process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { sendContactMessageEmail } = await import("../../../server/lib/email.ts");

test("Gmail API usa únicamente el transport inyectado y propaga un rechazo remoto", async () => {
  const requests: Array<{ url: string; init: RequestInit }> = [];
  const dependencies = createEmailDependencies({
    config: {
      isProduction: true,
      contactTo: ["ops@example.test"],
      gmailApi: {
        enabled: true,
        clientId: "test-client",
        clientSecret: "test-secret",
        refreshToken: "test-refresh",
        from: "noreply@example.test",
      },
    },
    createSmtpTransport: () => {
      throw new Error("SMTP must not run while Gmail API is enabled");
    },
    fetch: async (url, init) => {
      requests.push({ url, init });

      if (url === "https://oauth2.googleapis.com/token") {
        return new Response(JSON.stringify({ access_token: "test-access" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ id: "gmail-message-09" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  const result = await sendContactMessageEmail(
    {
      name: "Test sender",
      email: "sender@example.test",
      clinicName: null,
      message: "Hermetic external-service integration",
    },
    dependencies,
  );

  assert.deepEqual(result, { sent: true, messageId: "gmail-message-09" });
  assert.equal(requests.length, 2);
  assert.equal(requests[0]?.url, "https://oauth2.googleapis.com/token");
  assert.equal(requests[0]?.init.method, "POST");
  assert.equal(
    requests[1]?.url,
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
  );
  assert.equal(requests[1]?.init.method, "POST");
  assert.equal(new Headers(requests[1]?.init.headers).get("authorization"), "Bearer test-access");

  const rejectedDependencies = createEmailDependencies({
    config: {
      isProduction: true,
      contactTo: ["ops@example.test"],
      gmailApi: {
        enabled: true,
        clientId: "test-client",
        clientSecret: "test-secret",
        refreshToken: "test-refresh",
        from: "noreply@example.test",
      },
    },
    fetch: async (url) => new Response(
      JSON.stringify(url.includes("oauth2") ? { access_token: "test-access" } : { error: "rejected" }),
      { status: url.includes("oauth2") ? 200 : 503, headers: { "content-type": "application/json" } },
    ),
  });

  await assert.rejects(
    sendContactMessageEmail(
      {
        name: "Test sender",
        email: "sender@example.test",
        clinicName: null,
        message: "Remote failure must remain observable",
      },
      rejectedDependencies,
    ),
    (error: unknown) => (error as { code?: string }).code === "GMAIL_API_SEND_FAILED",
  );
});

test("SMTP usa el transporte inyectado y conserva el rechazo del proveedor", async () => {
  const messages: Array<{ to: string; subject: string }> = [];
  const dependencies = createEmailDependencies({
    config: {
      isProduction: true,
      contactTo: ["ops@example.test"],
      smtp: {
        enabled: true,
        host: "smtp.example.test",
        port: 587,
        secure: false,
        user: "test-user",
        pass: "test-password",
        from: "noreply@example.test",
      },
    },
    createSmtpTransport: () => ({
      sendMail: async (message) => {
        messages.push({ to: message.to, subject: message.subject });
        return { messageId: "smtp-message-09" };
      },
    }),
  });

  assert.deepEqual(
    await sendContactMessageEmail(
      {
        name: "Test sender",
        email: "sender@example.test",
        clinicName: null,
        message: "Hermetic SMTP integration",
      },
      dependencies,
    ),
    { sent: true, messageId: "smtp-message-09" },
  );
  assert.deepEqual(messages, [
    { to: "ops@example.test", subject: "[VETNEB] Contacto web: Test sender" },
  ]);

  const expected = new Error("SMTP rejected");
  const rejectedDependencies = createEmailDependencies({
    config: { contactTo: ["ops@example.test"], smtp: { enabled: true } },
    createSmtpTransport: () => ({
      sendMail: async () => {
        throw expected;
      },
    }),
  });

  await assert.rejects(
    sendContactMessageEmail(
      {
        name: "Test sender",
        email: "sender@example.test",
        clinicName: null,
        message: "SMTP failure must remain observable",
      },
      rejectedDependencies,
    ),
    (error: unknown) => error === expected,
  );
});
