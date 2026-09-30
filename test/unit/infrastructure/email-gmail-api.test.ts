import test from "node:test";
import assert from "node:assert/strict";
import {
  createEmailDependencies,
  type EmailConfigOverrides,
} from "../../mocks/email-dependencies.ts";

process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { sendContactMessageEmail } = await import("../../../server/lib/email.ts");

const TEST_GMAIL_API: EmailConfigOverrides["gmailApi"] = {
  enabled: true,
  clientId: "google-client-id",
  clientSecret: "google-client-secret",
  refreshToken: "google-refresh-token",
  from: "lab.vetneb@gmail.com",
};

const DISABLED_GMAIL_API: EmailConfigOverrides["gmailApi"] = {
  enabled: false,
  clientId: "",
  clientSecret: "",
  refreshToken: "",
  from: "",
};

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");

  return Buffer.from(padded, "base64").toString("utf8");
}

test("sendContactMessageEmail usa Gmail API si esta habilitado y construye MIME esperado", async () => {
  const originalInfo = console.info;
  const infoCalls: unknown[][] = [];
  const fetchCalls: Array<{ url: string; init: RequestInit }> = [];
  let rawMessage = "";

  console.info = (...args: unknown[]) => {
    infoCalls.push(args);
  };

  const dependencies = createEmailDependencies({
    config: {
      isProduction: true,
      contactTo: ["ops@vetneb.com; lab@vetneb.com"],
      smtp: {
        enabled: true,
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        user: "smtp-user",
        pass: "smtp-pass",
        from: "smtp-from@vetneb.com",
      },
      gmailApi: TEST_GMAIL_API,
    },
    createSmtpTransport: () => {
      throw new Error("SMTP fallback should not be used when Gmail API is enabled");
    },
    fetch: async (url, init) => {
      fetchCalls.push({ url, init });

      if (url === "https://oauth2.googleapis.com/token") {
        assert.equal(init.method, "POST");
        assert.equal(String(init.body).includes("grant_type=refresh_token"), true);
        assert.equal(String(init.body).includes("client_id=google-client-id"), true);
        return new Response(
          JSON.stringify({
            access_token: "gmail-access-token",
            token_type: "Bearer",
            expires_in: 3600,
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }

      assert.equal(
        url,
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      );

      const headers = new Headers(init.headers);
      assert.equal(headers.get("authorization"), "Bearer gmail-access-token");
      assert.equal(headers.get("content-type"), "application/json");

      const body = JSON.parse(String(init.body)) as { raw: string };
      rawMessage = body.raw;

      return new Response(JSON.stringify({ id: "gmail-message-123" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  try {
    const result = await sendContactMessageEmail(
      {
        name: "Maria\r\nBcc: hidden@example.com",
        email: "maria@example.com",
        clinicName: "Clinica Sur",
        message: "Necesito coordinar una recepcion de muestras.\nGracias.",
      },
      dependencies,
    );

    assert.deepEqual(result, {
      sent: true,
      messageId: "gmail-message-123",
    });
  } finally {
    console.info = originalInfo;
  }

  assert.equal(fetchCalls.length, 2);
  assert.ok(rawMessage.length > 0);

  const mime = decodeBase64Url(rawMessage);
  // multipart/alternative: split at first double CRLF to get outer headers
  const firstBlankLine = mime.indexOf("\r\n\r\n");
  const outerHeaders = mime.slice(0, firstBlankLine);
  const outerBody = mime.slice(firstBlankLine + 4);

  assert.ok(outerHeaders.includes("From: lab.vetneb@gmail.com"));
  assert.ok(outerHeaders.includes("To: ops@vetneb.com, lab@vetneb.com"));
  assert.ok(outerHeaders.includes("Reply-To: maria@example.com"));
  assert.ok(
    outerHeaders.includes(
      "Subject: [VETNEB] Contacto web: Maria Bcc: hidden@example.com",
    ),
  );
  assert.ok(outerHeaders.includes("MIME-Version: 1.0"));
  assert.ok(outerHeaders.includes("Content-Type: multipart/alternative;"));
  assert.equal(outerHeaders.includes("\r\nBcc: hidden@example.com"), false);
  // text/plain part present
  assert.ok(outerBody.includes("Content-Type: text/plain; charset=UTF-8"));
  assert.ok(outerBody.includes("Nuevo mensaje desde el formulario de contacto"));
  assert.ok(outerBody.includes("Nombre: Maria"));
  assert.ok(outerBody.includes("Email: maria@example.com"));
  assert.ok(outerBody.includes("Clinica Sur"));
  assert.ok(outerBody.includes("Necesito coordinar una recepcion de muestras."));
  // html part present
  assert.ok(outerBody.includes("Content-Type: text/html; charset=UTF-8"));
  assert.ok(outerBody.includes("<!DOCTYPE html>"));
  assert.ok(outerBody.includes("VETNEB"));
  assert.equal(JSON.stringify(infoCalls).includes("google-client-secret"), false);
  assert.equal(JSON.stringify(infoCalls).includes("google-refresh-token"), false);
  assert.equal(JSON.stringify(infoCalls).includes("gmail-access-token"), false);
});

test("sendContactMessageEmail propaga falla Gmail API con diagnostico seguro", async () => {
  const dependencies = createEmailDependencies({
    config: {
      isProduction: true,
      contactTo: ["ops@vetneb.com"],
      gmailApi: TEST_GMAIL_API,
    },
    fetch: async (url) => {
      if (url === "https://oauth2.googleapis.com/token") {
        return new Response(JSON.stringify({ access_token: "gmail-access-token" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "backendError" }), {
        status: 503,
        headers: { "content-type": "application/json" },
      });
    },
  });

  await assert.rejects(
    () =>
      sendContactMessageEmail(
        {
          name: "Maria Gomez",
          email: "maria@example.com",
          clinicName: "Clinica Sur",
          message: "Necesito confirmar una recepcion de muestras.",
        },
        dependencies,
      ),
    (error: unknown) => {
      const record = error as Record<string, unknown>;

      assert.equal(record.name, "EmailTransportError");
      assert.equal(record.code, "GMAIL_API_SEND_FAILED");
      assert.equal(record.command, "SEND");
      assert.equal(record.hostname, "gmail.googleapis.com");
      assert.equal(record.responseCode, 503);

      const serialized = JSON.stringify(record);
      assert.equal(serialized.includes("google-client-secret"), false);
      assert.equal(serialized.includes("google-refresh-token"), false);
      assert.equal(serialized.includes("gmail-access-token"), false);

      return true;
    },
  );
});

test("sendContactMessageEmail usa SMTP como fallback cuando Gmail API no esta configurado", async () => {
  const sendMailCalls: Array<Record<string, unknown>> = [];

  const dependencies = createEmailDependencies({
    config: {
      isProduction: true,
      contactTo: ["contacto@vetneb.com, ops@vetneb.com"],
      gmailApi: DISABLED_GMAIL_API,
      smtp: {
        enabled: true,
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        user: "smtp-user",
        pass: "smtp-pass",
        from: "smtp-from@vetneb.com",
      },
    },
    fetch: async () => {
      throw new Error("Gmail API fetch should not run when disabled");
    },
    createSmtpTransport: () => ({
      sendMail: async (payload) => {
        sendMailCalls.push(payload);
        return { messageId: "smtp-message-123" };
      },
    }),
  });

  const result = await sendContactMessageEmail(
    {
      name: "Juan Perez",
      email: "juan@example.com",
      clinicName: null,
      message: "Necesito registrar mi clinica en el portal.",
    },
    dependencies,
  );

  assert.deepEqual(result, {
    sent: true,
    messageId: "smtp-message-123",
  });

  assert.equal(sendMailCalls.length, 1);
  const smtpPayload = sendMailCalls[0];
  assert.equal(smtpPayload.from, "smtp-from@vetneb.com");
  assert.equal(smtpPayload.to, "contacto@vetneb.com, ops@vetneb.com");
  assert.equal(smtpPayload.replyTo, "juan@example.com");
  assert.equal(smtpPayload.subject, "[VETNEB] Contacto web: Juan Perez");
  assert.equal(
    smtpPayload.text,
    [
      "Nuevo mensaje desde el formulario de contacto de Portal VETNEB",
      "",
      "Nombre: Juan Perez",
      "Email: juan@example.com",
      "Clínica: No informada",
      "",
      "Mensaje:",
      "Necesito registrar mi clinica en el portal.",
      "",
      "Equipo VETNEB",
    ].join("\n"),
  );
  assert.equal(typeof smtpPayload.html, "string");
  assert.ok(String(smtpPayload.html).includes("<!DOCTYPE html>"));
  assert.ok(String(smtpPayload.html).includes("VETNEB"));
  assert.ok(String(smtpPayload.html).includes("Juan Perez"));
});
