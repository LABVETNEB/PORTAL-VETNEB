import test from "node:test";
import assert from "node:assert/strict";
import nodemailer from "nodemailer";

process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { ENV } = await import("../server/lib/env.ts");
const { sendSpecialStainRequiredEmail } = await import("../server/lib/email.ts");

test("sendSpecialStainRequiredEmail envia correo con payload esperado cuando SMTP esta habilitado", async () => {
  const originalInfo = console.info;
  const infoCalls: unknown[][] = [];
  console.info = (...args: unknown[]) => {
    infoCalls.push(args);
  };

  const originalSmtp = {
    enabled: ENV.smtp.enabled,
    host: ENV.smtp.host,
    port: ENV.smtp.port,
    secure: ENV.smtp.secure,
    user: ENV.smtp.user,
    pass: ENV.smtp.pass,
    from: ENV.smtp.from,
  };

  const originalCreateTransport = nodemailer.createTransport;

  let capturedTransportOptions: unknown = null;
  const sendMailCalls: Array<Record<string, unknown>> = [];

  (ENV.smtp as any).enabled = true;
  (ENV.smtp as any).host = "smtp.example.com";
  (ENV.smtp as any).port = 587;
  (ENV.smtp as any).secure = false;
  (ENV.smtp as any).user = "smtp-user";
  (ENV.smtp as any).pass = "smtp-pass";
  (ENV.smtp as any).from = "noreply@vetneb.com";

  (nodemailer as any).createTransport = (options: unknown) => {
    capturedTransportOptions = options;

    return {
      sendMail: async (payload: Record<string, unknown>) => {
        sendMailCalls.push(payload);
        return { messageId: "message-123" };
      },
    };
  };

  try {
    const result = await sendSpecialStainRequiredEmail({
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
    });

    assert.deepEqual(result, {
      sent: true,
      messageId: "message-123",
    });
  } finally {
    console.info = originalInfo;
    (nodemailer as any).createTransport = originalCreateTransport;

    (ENV.smtp as any).enabled = originalSmtp.enabled;
    (ENV.smtp as any).host = originalSmtp.host;
    (ENV.smtp as any).port = originalSmtp.port;
    (ENV.smtp as any).secure = originalSmtp.secure;
    (ENV.smtp as any).user = originalSmtp.user;
    (ENV.smtp as any).pass = originalSmtp.pass;
    (ENV.smtp as any).from = originalSmtp.from;
  }

  assert.deepEqual(capturedTransportOptions, {
    host: "smtp.example.com",
    port: 587,
    secure: false,
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
    recipients: ["test@example.com", "other@example.com"],
    messageId: "message-123",
  });
});
