import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import nodemailer from "nodemailer";
import {
  logError,
  logInfo,
  logWarn,
  serializeError,
} from "../server/lib/logger.ts";

process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { ENV } = await import("../server/lib/env.ts");
const { sendContactMessageEmail, sendSpecialStainRequiredEmail } = await import("../server/lib/email.ts");

test("logInfo agrega prefijo [INFO]", () => {
  const original = console.log;
  const calls: unknown[][] = [];

  console.log = (...args: unknown[]) => {
    calls.push(args);
  };

  try {
    logInfo("hola", { ok: true });
  } finally {
    console.log = original;
  }

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], ["[INFO]", "hola", { ok: true }]);
});

test("logWarn agrega prefijo [WARN]", () => {
  const original = console.warn;
  const calls: unknown[][] = [];

  console.warn = (...args: unknown[]) => {
    calls.push(args);
  };

  try {
    logWarn("atención", 123);
  } finally {
    console.warn = original;
  }

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], ["[WARN]", "atención", 123]);
});

test("logError agrega prefijo [ERROR]", () => {
  const original = console.error;
  const calls: unknown[][] = [];

  console.error = (...args: unknown[]) => {
    calls.push(args);
  };

  try {
    logError("falló", { code: "E_TEST" });
  } finally {
    console.error = original;
  }

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], ["[ERROR]", "falló", { code: "E_TEST" }]);
});

test("serializeError serializa instancias de Error", () => {
  const error = new TypeError("mensaje de prueba");
  const serialized = serializeError(error) as {
    message: string;
    name: string;
    stack?: string;
  };

  assert.equal(serialized.message, "mensaje de prueba");
  assert.equal(serialized.name, "TypeError");
  assert.equal(typeof serialized.stack, "string");
});

test("serializeError deja intactos valores no Error", () => {
  const payload = { ok: false, code: "X" };
  assert.equal(serializeError(payload), payload);
  assert.equal(serializeError("texto"), "texto");
  assert.equal(serializeError(null), null);
});

test("sendContactMessageEmail usa CONTACT_TO y fallback SMTP_FROM sin loguear secretos", async () => {
  const originalInfo = console.info;
  const originalCreateTransport = nodemailer.createTransport;
  const originalEnv = {
    contactTo: ENV.contactTo,
    smtp: {
      enabled: ENV.smtp.enabled,
      host: ENV.smtp.host,
      port: ENV.smtp.port,
      secure: ENV.smtp.secure,
      user: ENV.smtp.user,
      pass: ENV.smtp.pass,
      from: ENV.smtp.from,
    },
  };
  const infoCalls: unknown[][] = [];
  const sendMailCalls: Array<Record<string, unknown>> = [];
  const transportCalls: unknown[] = [];

  console.info = (...args: unknown[]) => {
    infoCalls.push(args);
  };

  (ENV as any).contactTo = [
    "contacto@vetneb.com; ops@vetneb.com, CONTACTO@vetneb.com",
  ];
  (ENV.smtp as any).enabled = true;
  (ENV.smtp as any).host = "smtp.gmail.com";
  (ENV.smtp as any).port = 587;
  (ENV.smtp as any).secure = false;
  (ENV.smtp as any).user = "smtp-user-contact";
  (ENV.smtp as any).pass = "smtp-pass-contact";
  (ENV.smtp as any).from = "fallback@vetneb.com";

  (nodemailer as any).createTransport = (options: unknown) => {
    transportCalls.push(options);

    return {
    sendMail: async (payload: Record<string, unknown>) => {
      sendMailCalls.push(payload);
      return { messageId: `contact-${sendMailCalls.length}` };
    },
  };
  };

  try {
    const contactToResult = await sendContactMessageEmail({
      name: "Maria Gomez",
      email: "maria@example.com",
      clinicName: "Clínica Sur",
      message: "Necesito coordinar una consulta clínica.",
    });

    (ENV as any).contactTo = [];

    const fallbackResult = await sendContactMessageEmail({
      name: "Juan Perez",
      email: "juan@example.com",
      clinicName: null,
      message: "Necesito registrar mi clínica en el portal.",
    });

    assert.deepEqual(contactToResult, {
      sent: true,
      messageId: "contact-1",
    });
    assert.deepEqual(fallbackResult, {
      sent: true,
      messageId: "contact-2",
    });
  } finally {
    console.info = originalInfo;
    (nodemailer as any).createTransport = originalCreateTransport;
    (ENV as any).contactTo = originalEnv.contactTo;
    (ENV.smtp as any).enabled = originalEnv.smtp.enabled;
    (ENV.smtp as any).host = originalEnv.smtp.host;
    (ENV.smtp as any).port = originalEnv.smtp.port;
    (ENV.smtp as any).secure = originalEnv.smtp.secure;
    (ENV.smtp as any).user = originalEnv.smtp.user;
    (ENV.smtp as any).pass = originalEnv.smtp.pass;
    (ENV.smtp as any).from = originalEnv.smtp.from;
  }

  assert.equal(sendMailCalls.length, 2);
  assert.equal(sendMailCalls[0].to, "contacto@vetneb.com, ops@vetneb.com");
  assert.equal(sendMailCalls[0].replyTo, "maria@example.com");
  assert.equal(sendMailCalls[1].to, "fallback@vetneb.com");
  assert.equal(sendMailCalls[1].replyTo, "juan@example.com");
  assert.equal(transportCalls.length, 1);
  const transport = transportCalls[0] as {
    family?: unknown;
    host?: unknown;
    port?: unknown;
    secure?: unknown;
    tls?: { servername?: unknown };
    auth?: { user?: unknown; pass?: unknown };
  };
  assert.equal(transport.family, 4);
  assert.equal(transport.host, "smtp.gmail.com");
  assert.equal(transport.port, 587);
  assert.equal(transport.secure, false);
  assert.deepEqual(transport.tls, {
    servername: "smtp.gmail.com",
  });
  assert.equal(transport.auth?.user, "smtp-user-contact");
  assert.equal(transport.auth?.pass, "smtp-pass-contact");
  assert.equal(JSON.stringify(infoCalls).includes("smtp-pass-contact"), false);
  assert.equal(JSON.stringify(infoCalls).includes("smtp-user-contact"), false);
  assert.equal(JSON.stringify(infoCalls).toLowerCase().includes("auth"), false);
});

test("sendContactMessageEmail exige CONTACT_TO explícito en entorno público", async () => {
  const originalInfo = console.info;
  const originalCreateTransport = nodemailer.createTransport;
  const originalEnv = {
    isProduction: ENV.isProduction,
    contactTo: ENV.contactTo,
    smtp: {
      enabled: ENV.smtp.enabled,
      host: ENV.smtp.host,
      port: ENV.smtp.port,
      secure: ENV.smtp.secure,
      user: ENV.smtp.user,
      pass: ENV.smtp.pass,
      from: ENV.smtp.from,
    },
  };
  const infoCalls: unknown[][] = [];
  const sendMailCalls: Array<Record<string, unknown>> = [];

  console.info = (...args: unknown[]) => {
    infoCalls.push(args);
  };

  (ENV as any).isProduction = true;
  (ENV as any).contactTo = [];
  (ENV.smtp as any).enabled = true;
  (ENV.smtp as any).host = "smtp.contact.example";
  (ENV.smtp as any).port = 587;
  (ENV.smtp as any).secure = false;
  (ENV.smtp as any).user = "smtp-user-contact";
  (ENV.smtp as any).pass = "smtp-pass-contact";
  (ENV.smtp as any).from = "fallback@vetneb.com";

  (nodemailer as any).createTransport = () => ({
    sendMail: async (payload: Record<string, unknown>) => {
      sendMailCalls.push(payload);
      return { messageId: `contact-${sendMailCalls.length}` };
    },
  });

  try {
    const result = await sendContactMessageEmail({
      name: "Producción sin CONTACT_TO",
      email: "ops@example.com",
      clinicName: "Clínica Norte",
      message: "Debe marcarse como smtp_disabled por configuración pública incompleta.",
    });

    assert.deepEqual(result, {
      sent: false,
      reason: "smtp_disabled",
    });
  } finally {
    console.info = originalInfo;
    (nodemailer as any).createTransport = originalCreateTransport;
    (ENV as any).isProduction = originalEnv.isProduction;
    (ENV as any).contactTo = originalEnv.contactTo;
    (ENV.smtp as any).enabled = originalEnv.smtp.enabled;
    (ENV.smtp as any).host = originalEnv.smtp.host;
    (ENV.smtp as any).port = originalEnv.smtp.port;
    (ENV.smtp as any).secure = originalEnv.smtp.secure;
    (ENV.smtp as any).user = originalEnv.smtp.user;
    (ENV.smtp as any).pass = originalEnv.smtp.pass;
    (ENV.smtp as any).from = originalEnv.smtp.from;
  }

  assert.equal(sendMailCalls.length, 0);
  assert.equal(infoCalls.length, 1);
  assert.equal(infoCalls[0][0], "[EMAIL] contact_message skipped: smtp disabled");
});

test("templates de email no tienen mojibake visible", () => {
  const source = readFileSync(
    resolve(process.cwd(), "server/lib/email.ts"),
    "utf8",
  );

  for (const expected of [
    "clínica",
    "tinción",
    "Recepción",
    "Teléfono",
    "Ingresá",
    "gestión",
    "Clínica",
  ]) {
    assert.ok(source.includes(expected), `email.ts debe incluir ${expected}`);
  }

  assert.doesNotMatch(source, /Ã|Â|�/);
});

test("sendSpecialStainRequiredEmail omite envío cuando no hay destinatarios válidos", async () => {
  const original = console.info;
  const calls: unknown[][] = [];

  console.info = (...args: unknown[]) => {
    calls.push(args);
  };

  try {
    const result = await sendSpecialStainRequiredEmail({
      to: [undefined, null, "", "invalido", " ; , "],
      clinicName: "Clínica Centro",
      trackingCaseId: 77,
      receptionAt: new Date("2026-04-20T12:00:00.000Z"),
      estimatedDeliveryAt: new Date("2026-04-25T12:00:00.000Z"),
      currentStage: "processing",
    });

    assert.deepEqual(result, {
      sent: false,
      reason: "no_recipients",
    });
  } finally {
    console.info = original;
  }

  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "[EMAIL] special_stain_required skipped: no recipients");
  assert.deepEqual(calls[0][1], {
    trackingCaseId: 77,
  });
});

test("sendSpecialStainRequiredEmail normaliza destinatarios y omite envío si SMTP está deshabilitado", async (t) => {
  if (ENV.smtp.enabled) {
    t.skip("Este entorno tiene SMTP habilitado; este caso cubre únicamente smtp_disabled");
    return;
  }

  const original = console.info;
  const calls: unknown[][] = [];

  console.info = (...args: unknown[]) => {
    calls.push(args);
  };

  try {
    const result = await sendSpecialStainRequiredEmail({
      to: [
        " TEST@Example.com ; other@example.com, invalido ",
        "test@example.com",
        null,
      ],
      clinicName: "Clínica Norte",
      trackingCaseId: 88,
      receptionAt: new Date("2026-04-20T12:00:00.000Z"),
      estimatedDeliveryAt: new Date("2026-04-25T12:00:00.000Z"),
      currentStage: "evaluation",
      paymentUrl: "https://example.com/pago/88",
      adminContactEmail: "admin@vetneb.com",
      adminContactPhone: "3511234567",
      notes: "Caso prioritario",
    });

    assert.deepEqual(result, {
      sent: false,
      reason: "smtp_disabled",
    });
  } finally {
    console.info = original;
  }

  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "[EMAIL] special_stain_required skipped: smtp disabled");
  assert.deepEqual(calls[0][1], {
    trackingCaseId: 88,
    recipients: ["test@example.com", "other@example.com"],
  });
});
