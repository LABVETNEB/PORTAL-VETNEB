import test from "node:test";
import assert from "node:assert/strict";
import {
  adminCreateStudyTrackingSchema,
  applyEstimatedDeliveryRules,
  applyStageTimestampDefaults,
  calculateEstimatedDeliveryAt,
  updateStudyTrackingSchema,
} from "../server/lib/study-tracking.ts";

test("calculateEstimatedDeliveryAt rechaza receptionAt invalido", () => {
  assert.throws(
    () => calculateEstimatedDeliveryAt(new Date("invalido"), 15),
    /receptionAt inválido|receptionAt invÃ¡lido/,
  );
});

test("calculateEstimatedDeliveryAt devuelve el mismo dia cuando requiredBusinessDays ya se consume en receptionAt", () => {
  const result = calculateEstimatedDeliveryAt(
    new Date("2026-01-05T00:00:00.000Z"),
    1,
  );

  assert.equal(result.toISOString(), "2026-01-05T00:00:00.000Z");
});

test("applyEstimatedDeliveryRules no marca ajuste manual cuando la fecha manual coincide con la automatica", () => {
  const receptionAt = new Date("2026-01-02T00:00:00.000Z");
  const autoCalculated = calculateEstimatedDeliveryAt(receptionAt, 15);

  const result = applyEstimatedDeliveryRules({
    receptionAt,
    manualEstimatedDeliveryAt: autoCalculated,
  });

  assert.equal(
    result.estimatedDeliveryAt.toISOString(),
    autoCalculated.toISOString(),
  );
  assert.equal(
    result.estimatedDeliveryAutoCalculatedAt.toISOString(),
    autoCalculated.toISOString(),
  );
  assert.equal(result.estimatedDeliveryWasManuallyAdjusted, false);
});

test("applyStageTimestampDefaults no pisa timestamps existentes al cambiar de etapa", () => {
  const existingProcessingAt = new Date("2026-04-20T10:00:00.000Z");

  const result = applyStageTimestampDefaults(
    {
      currentStage: "reception",
      processingAt: existingProcessingAt,
      evaluationAt: null,
      reportDevelopmentAt: null,
      deliveredAt: null,
    } as any,
    {
      currentStage: "processing",
    },
  );

  assert.equal(result.processingAt, undefined);
  assert.equal(result.evaluationAt, undefined);
  assert.equal(result.reportDevelopmentAt, undefined);
  assert.equal(result.deliveredAt, undefined);
});

test("applyStageTimestampDefaults respeta timestamps explicitos enviados en patch", () => {
  const explicitEvaluationAt = new Date("2026-04-21T12:00:00.000Z");

  const result = applyStageTimestampDefaults(
    {
      currentStage: "processing",
      processingAt: new Date("2026-04-20T10:00:00.000Z"),
      evaluationAt: null,
      reportDevelopmentAt: null,
      deliveredAt: null,
    } as any,
    {
      currentStage: "evaluation",
      evaluationAt: explicitEvaluationAt,
    },
  );

  assert.equal(result.processingAt, undefined);
  assert.equal(result.evaluationAt, explicitEvaluationAt);
  assert.equal(result.reportDevelopmentAt, undefined);
  assert.equal(result.deliveredAt, undefined);
});

test("applyStageTimestampDefaults no completa etapas futuras cuando la etapa actual no lo requiere", () => {
  const result = applyStageTimestampDefaults(
    {
      currentStage: "reception",
      processingAt: null,
      evaluationAt: null,
      reportDevelopmentAt: null,
      deliveredAt: null,
    } as any,
    {},
  );

  assert.equal(result.processingAt, undefined);
  assert.equal(result.evaluationAt, undefined);
  assert.equal(result.reportDevelopmentAt, undefined);
  assert.equal(result.deliveredAt, undefined);
});

test("adminCreateStudyTrackingSchema normaliza variantes booleanas adicionales", () => {
  const parsedYes = adminCreateStudyTrackingSchema.safeParse({
    clinicId: "4",
    receptionAt: "2026-04-20T10:00:00.000Z",
    specialStainRequired: "yes",
  });

  const parsedOne = adminCreateStudyTrackingSchema.safeParse({
    clinicId: "4",
    receptionAt: "2026-04-20T10:00:00.000Z",
    specialStainRequired: "1",
  });

  const parsedZero = adminCreateStudyTrackingSchema.safeParse({
    clinicId: "4",
    receptionAt: "2026-04-20T10:00:00.000Z",
    specialStainRequired: "0",
  });

  assert.equal(parsedYes.success, true);
  assert.equal(parsedOne.success, true);
  assert.equal(parsedZero.success, true);

  if (!parsedYes.success || !parsedOne.success || !parsedZero.success) {
    throw new Error("Las variantes booleanas debieron parsearse correctamente");
  }

  assert.equal(parsedYes.data.specialStainRequired, true);
  assert.equal(parsedOne.data.specialStainRequired, true);
  assert.equal(parsedZero.data.specialStainRequired, false);
});

test("adminCreateStudyTrackingSchema rechaza email invalido y paymentUrl demasiado largo", () => {
  const parsed = adminCreateStudyTrackingSchema.safeParse({
    clinicId: "4",
    receptionAt: "2026-04-20T10:00:00.000Z",
    adminContactEmail: "correo-invalido",
    paymentUrl: "x".repeat(2001),
  });

  if (parsed.success) {
    assert.fail("La validacion debio fallar");
  }

  assert.equal(parsed.success, false);

  const messages = parsed.error.issues.map((issue) => issue.message);

  assert.ok(messages.includes("adminContactEmail invÃ¡lido") || messages.includes("adminContactEmail inválido"));
  assert.ok(messages.includes("paymentUrl no puede superar 2000 caracteres"));
});

test("updateStudyTrackingSchema trimea textos y convierte blancos a null", () => {
  const parsed = updateStudyTrackingSchema.safeParse({
    paymentUrl: "   https://example.com/pago/44   ",
    adminContactPhone: "   ",
    notes: "   observacion interna   ",
  });

  if (!parsed.success) {
    assert.fail(parsed.error.message);
  }

  assert.equal(parsed.success, true);

  assert.equal(parsed.data.paymentUrl, "https://example.com/pago/44");
  assert.equal(parsed.data.adminContactPhone, null);
  assert.equal(parsed.data.notes, "observacion interna");
});

test("updateStudyTrackingSchema rechaza adminContactEmail invalido", () => {
  const parsed = updateStudyTrackingSchema.safeParse({
    adminContactEmail: "mail-invalido",
  });

  if (parsed.success) {
    assert.fail("La validacion debio fallar");
  }

  assert.equal(parsed.success, false);
  assert.equal(parsed.error.issues[0]?.message, "adminContactEmail invÃ¡lido");
});

test("updateStudyTrackingSchema rechaza adminContactPhone y notes fuera de limite", () => {
  const parsed = updateStudyTrackingSchema.safeParse({
    adminContactPhone: "1".repeat(51),
    notes: "a".repeat(10001),
  });

  if (parsed.success) {
    assert.fail("La validacion debio fallar");
  }

  assert.equal(parsed.success, false);

  const messages = parsed.error.issues.map((issue) => issue.message);

  assert.ok(messages.includes("adminContactPhone no puede superar 50 caracteres"));
  assert.ok(messages.includes("notes no puede superar 10000 caracteres"));
});
