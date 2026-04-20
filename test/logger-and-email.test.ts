import test from "node:test";
import assert from "node:assert/strict";
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
const { sendSpecialStainRequiredEmail } = await import("../server/lib/email.ts");

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
