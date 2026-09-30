import test from "node:test";
import assert from "node:assert/strict";
import { createEmailDependencies } from "../../mocks/email-dependencies.ts";

process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const {
  sendParticularTokenEmail,
  sendSpecialStainRequiredEmail,
} = await import("../../../server/lib/email.ts");

test("sendParticularTokenEmail envia token particular con payload minimo", async () => {
  const originalInfo = console.info;
  const infoCalls: unknown[][] = [];
  console.info = (...args: unknown[]) => {
    infoCalls.push(args);
  };

  const sendMailCalls: Array<Record<string, unknown>> = [];

  const dependencies = createEmailDependencies({
    config: {
      smtp: {
        enabled: true,
        host: "smtp-particular.example.com",
        port: 587,
        secure: false,
        user: "smtp-user",
        pass: "smtp-pass",
        from: "noreply@vetneb.com",
      },
    },
    createSmtpTransport: () => ({
      sendMail: async (payload) => {
        sendMailCalls.push(payload);
        return { messageId: "particular-message-123" };
      },
    }),
  });

  try {
    const result = await sendParticularTokenEmail(
      {
        to: " TUTOR@Example.com ",
        token: "token-visible-una-sola-vez",
        tutorLastName: "Gomez",
        petName: "Luna",
      },
      dependencies,
    );

    assert.deepEqual(result, {
      sent: true,
      messageId: "particular-message-123",
    });
  } finally {
    console.info = originalInfo;
  }

  assert.equal(sendMailCalls.length, 1);
  const payload = sendMailCalls[0];
  assert.equal(payload.from, "noreply@vetneb.com");
  assert.equal(payload.to, "tutor@example.com");
  assert.equal(payload.subject, "[VETNEB] Token de acceso particular");
  assert.equal(typeof payload.text, "string");
  assert.equal(String(payload.text).includes("token-visible-una-sola-vez"), true);
  assert.equal(String(payload.text).includes("Tutor/a: Gomez"), true);
  assert.equal(String(payload.text).includes("Paciente: Luna"), true);
  // html template present
  assert.equal(typeof payload.html, "string");
  assert.ok(String(payload.html).includes("<!DOCTYPE html>"));
  assert.ok(String(payload.html).includes("VETNEB"));
  // token must appear in html (escaped but visible as text)
  assert.ok(String(payload.html).includes("token-visible-una-sola-vez"));
  assert.ok(String(payload.html).includes("Gomez"));
  assert.ok(String(payload.html).includes("Luna"));
  assert.equal(JSON.stringify(infoCalls).includes("token-visible-una-sola-vez"), false);
  // VET-03: el destinatario real (tutor del paciente) no debe llegar al log.
  assert.equal(JSON.stringify(infoCalls).includes("tutor@example.com"), false);
  assert.deepEqual(infoCalls[0][1], {
    recipientCount: 1,
    messageId: "particular-message-123",
    transport: "smtp",
  });
});

test("sendSpecialStainRequiredEmail envia correo con payload esperado cuando SMTP esta habilitado", async () => {
  const originalInfo = console.info;
  const infoCalls: unknown[][] = [];
  console.info = (...args: unknown[]) => {
    infoCalls.push(args);
  };

  let capturedTransportOptions: unknown = null;
  const sendMailCalls: Array<Record<string, unknown>> = [];

  const dependencies = createEmailDependencies({
    config: {
      smtp: {
        enabled: true,
        host: "smtp.example.com",
        port: 587,
        secure: false,
        user: "smtp-user",
        pass: "smtp-pass",
        from: "noreply@vetneb.com",
      },
    },
    createSmtpTransport: (options) => {
      capturedTransportOptions = options;

      return {
        sendMail: async (payload) => {
          sendMailCalls.push(payload);
          return { messageId: "message-123" };
        },
      };
    },
  });

  try {
    const result = await sendSpecialStainRequiredEmail(
      {
        to: [
          " TEST@Example.com ; other@example.com, invalido ",
          "test@example.com",
          null,
        ],
        clinicName: "Clínica Norte",
        trackingCaseId: 55,
        receptionAt: new Date("2026-04-20T12:00:00.000Z"),
        estimatedDeliveryAt: new Date("2026-04-25T12:00:00.000Z"),
        currentStage: "evaluation",
        paymentUrl: "https://example.com/pago/55",
        adminContactEmail: "admin@vetneb.com",
        adminContactPhone: "3511234567",
        notes: "Caso prioritario",
      },
      dependencies,
    );

    assert.deepEqual(result, {
      sent: true,
      messageId: "message-123",
    });
  } finally {
    console.info = originalInfo;
  }

  assert.deepEqual(capturedTransportOptions, {
    host: "smtp.example.com",
    port: 587,
    secure: false,
    family: 4,
    tls: {
      servername: "smtp.example.com",
    },
    auth: {
      user: "smtp-user",
      pass: "smtp-pass",
    },
  });

  assert.equal(sendMailCalls.length, 1);

  const payload = sendMailCalls[0];
  assert.equal(payload.from, "noreply@vetneb.com");
  assert.equal(payload.to, "test@example.com, other@example.com");

  assert.equal(typeof payload.subject, "string");
  assert.equal(String(payload.subject).startsWith("[VETNEB] Estudio #55:"), true);

  assert.equal(typeof payload.text, "string");
  assert.equal(String(payload.text).includes("Clínica Norte"), true);
  assert.equal(String(payload.text).includes("Estado actual: evaluation"), true);
  assert.equal(String(payload.text).includes("Observaciones: Caso prioritario"), true);
  assert.equal(String(payload.text).includes("Link de pago: https://example.com/pago/55"), true);
  assert.equal(String(payload.text).includes("admin@vetneb.com"), true);
  assert.equal(String(payload.text).includes("3511234567"), true);

  assert.equal(infoCalls.length, 1);
  assert.equal(infoCalls[0][0], "[EMAIL] special_stain_required sent");
  assert.deepEqual(infoCalls[0][1], {
    trackingCaseId: 55,
    recipientCount: 2,
    messageId: "message-123",
  });
  // VET-03: ninguna dirección de email real llega al log.
  assert.equal(JSON.stringify(infoCalls).includes("test@example.com"), false);
  assert.equal(JSON.stringify(infoCalls).includes("other@example.com"), false);
});
