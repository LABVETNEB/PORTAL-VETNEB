import test from "node:test";
import assert from "node:assert/strict";
import {
  adminCreateStudyTrackingSchema,
  applyEstimatedDeliveryRules,
  applyStageTimestampDefaults,
  buildValidationError,
  calculateEstimatedDeliveryAt,
  getArgentinaNationalHolidayKeys,
  getBusinessDayWeight,
  isArgentinaNationalHoliday,
  parseBooleanQuery,
  parseEntityId,
  parseOffset,
  parsePositiveInt,
  serializeStudyTrackingCase,
  serializeStudyTrackingNotification,
  shouldCreateSpecialStainNotification,
  updateStudyTrackingSchema,
} from "../server/lib/study-tracking.ts";

test("adminCreateStudyTrackingSchema normaliza booleanos, textos y fechas", () => {
  const parsed = adminCreateStudyTrackingSchema.safeParse({
    clinicId: "4",
    reportId: "12",
    particularTokenId: null,
    receptionAt: "2026-04-20T10:00:00.000Z",
    estimatedDeliveryAt: "2026-05-12T10:00:00.000Z",
    currentStage: "processing",
    specialStainRequired: "si",
    paymentUrl: "  https://example.com/pay/123  ",
    adminContactEmail: " lab@example.com ",
    adminContactPhone: " 3511234567 ",
    notes: "  Caso prioritario  ",
  });

  if (!parsed.success) {
    assert.fail(parsed.error.message);
  }

  assert.equal(parsed.success, true);

  assert.equal(parsed.data.clinicId, 4);
  assert.equal(parsed.data.reportId, 12);
  assert.equal(parsed.data.particularTokenId, undefined);
  assert.equal(parsed.data.specialStainRequired, true);
  assert.equal(parsed.data.paymentUrl, "https://example.com/pay/123");
  assert.equal(parsed.data.adminContactEmail, "lab@example.com");
  assert.equal(parsed.data.adminContactPhone, "3511234567");
  assert.equal(parsed.data.notes, "Caso prioritario");
  assert.ok(parsed.data.receptionAt instanceof Date);
});

test("updateStudyTrackingSchema permite limpiar campos opcionales con null", () => {
  const parsed = updateStudyTrackingSchema.safeParse({
    reportId: null,
    particularTokenId: "18",
    estimatedDeliveryAt: null,
    processingAt: null,
    evaluationAt: undefined,
    reportDevelopmentAt: null,
    deliveredAt: null,
    specialStainRequired: "0",
    paymentUrl: "   ",
    adminContactEmail: null,
    adminContactPhone: "   ",
    notes: null,
  });

  if (!parsed.success) {
    assert.fail(parsed.error.message);
  }

  assert.equal(parsed.success, true);

  assert.equal(parsed.data.reportId, null);
  assert.equal(parsed.data.particularTokenId, 18);
  assert.equal(parsed.data.estimatedDeliveryAt, null);
  assert.equal(parsed.data.processingAt, null);
  assert.equal(parsed.data.reportDevelopmentAt, null);
  assert.equal(parsed.data.deliveredAt, null);
  assert.equal(parsed.data.specialStainRequired, false);
  assert.equal(parsed.data.paymentUrl, null);
  assert.equal(parsed.data.adminContactEmail, null);
  assert.equal(parsed.data.adminContactPhone, null);
  assert.equal(parsed.data.notes, null);
});

test("helpers de query parsing en study-tracking son estables", () => {
  assert.equal(parsePositiveInt("25", 50, 100), 25);
  assert.equal(parsePositiveInt("250", 50, 100), 100);
  assert.equal(parsePositiveInt(undefined, 50, 100), 50);

  assert.equal(parseOffset("20", 0), 20);
  assert.equal(parseOffset("-5", 3), 3);

  assert.equal(parseEntityId("9"), 9);
  assert.equal(parseEntityId("0"), undefined);

  assert.equal(parseBooleanQuery("true"), true);
  assert.equal(parseBooleanQuery("si"), true);
  assert.equal(parseBooleanQuery("false"), false);
  assert.equal(parseBooleanQuery("otro"), undefined);
});

test("buildValidationError devuelve el primer error de study-tracking", () => {
  const parsed = adminCreateStudyTrackingSchema.safeParse({
    clinicId: "0",
    receptionAt: "fecha-invalida",
  });

  if (parsed.success) {
    assert.fail("La validacion debio fallar");
  }

  assert.equal(parsed.success, false);
  assert.equal(buildValidationError(parsed.error), "clinicId es obligatorio");
});

test("feriados nacionales y pesos de días hábiles se calculan correctamente", () => {
  const holidays2026 = getArgentinaNationalHolidayKeys(2026);

  assert.equal(holidays2026.has("2026-01-01"), true);
  assert.equal(holidays2026.has("2026-02-16"), true);
  assert.equal(holidays2026.has("2026-02-17"), true);
  assert.equal(holidays2026.has("2026-04-03"), true);

  assert.equal(isArgentinaNationalHoliday(new Date("2026-05-25T00:00:00.000Z")), true);
  assert.equal(getBusinessDayWeight(new Date("2026-05-25T00:00:00.000Z")), 0);
  assert.equal(getBusinessDayWeight(new Date("2026-05-23T00:00:00.000Z")), 0.5);
  assert.equal(getBusinessDayWeight(new Date("2026-05-26T00:00:00.000Z")), 1);
});

test("calculateEstimatedDeliveryAt contempla sábado como medio día hábil", () => {
  const deliveryAt = calculateEstimatedDeliveryAt(
    new Date("2026-01-02T00:00:00.000Z"),
    2,
  );

  assert.equal(deliveryAt.toISOString(), "2026-01-05T00:00:00.000Z");
});

test("applyEstimatedDeliveryRules diferencia ajuste manual y cálculo automático", () => {
  const receptionAt = new Date("2026-01-02T00:00:00.000Z");
  const manualEstimatedDeliveryAt = new Date("2026-01-06T00:00:00.000Z");

  const automatic = applyEstimatedDeliveryRules({ receptionAt });
  const manual = applyEstimatedDeliveryRules({
    receptionAt,
    manualEstimatedDeliveryAt,
  });

  assert.equal(automatic.estimatedDeliveryAt.toISOString(), "2026-01-21T00:00:00.000Z");
  assert.equal(automatic.estimatedDeliveryWasManuallyAdjusted, false);
  assert.equal(manual.estimatedDeliveryAt.toISOString(), "2026-01-06T00:00:00.000Z");
  assert.equal(manual.estimatedDeliveryAutoCalculatedAt.toISOString(), "2026-01-21T00:00:00.000Z");
  assert.equal(manual.estimatedDeliveryWasManuallyAdjusted, true);
});

test("applyStageTimestampDefaults completa únicamente la marca requerida por la etapa", () => {
  const current = {
    currentStage: "reception",
    processingAt: null,
    evaluationAt: null,
    reportDevelopmentAt: null,
    deliveredAt: null,
  };

  const processing = applyStageTimestampDefaults(current as any, {
    currentStage: "processing",
  });

  const delivered = applyStageTimestampDefaults(
    {
      ...current,
      currentStage: "report_development",
      deliveredAt: null,
    } as any,
    {
      currentStage: "delivered",
      processingAt: null,
    },
  );

  assert.ok(processing.processingAt instanceof Date);
  assert.equal(processing.evaluationAt, undefined);
  assert.equal(processing.reportDevelopmentAt, undefined);
  assert.ok(delivered.deliveredAt instanceof Date);
});

test("shouldCreateSpecialStainNotification sólo crea cuando corresponde", () => {
  assert.equal(
    shouldCreateSpecialStainNotification({
      previousRequired: false,
      nextRequired: true,
      notifiedAt: null,
    }),
    true,
  );

  assert.equal(
    shouldCreateSpecialStainNotification({
      previousRequired: true,
      nextRequired: true,
      notifiedAt: null,
    }),
    true,
  );

  assert.equal(
    shouldCreateSpecialStainNotification({
      previousRequired: true,
      nextRequired: false,
      notifiedAt: null,
    }),
    false,
  );

  assert.equal(
    shouldCreateSpecialStainNotification({
      previousRequired: false,
      nextRequired: true,
      notifiedAt: new Date("2026-04-20T00:00:00.000Z"),
    }),
    false,
  );
});

test("serializers de study-tracking mantienen la forma pública esperada", () => {
  const trackingCase = {
    id: 5,
    clinicId: 3,
    reportId: 12,
    particularTokenId: 18,
    createdByAdminId: 1,
    createdByClinicUserId: null,
    receptionAt: new Date("2026-04-20T00:00:00.000Z"),
    estimatedDeliveryAt: new Date("2026-05-12T00:00:00.000Z"),
    estimatedDeliveryAutoCalculatedAt: new Date("2026-05-11T00:00:00.000Z"),
    estimatedDeliveryWasManuallyAdjusted: true,
    currentStage: "processing",
    processingAt: new Date("2026-04-21T00:00:00.000Z"),
    evaluationAt: null,
    reportDevelopmentAt: null,
    deliveredAt: null,
    specialStainRequired: true,
    specialStainNotifiedAt: null,
    paymentUrl: "https://example.com/pay/123",
    adminContactEmail: "lab@example.com",
    adminContactPhone: "3511234567",
    notes: "Caso prioritario",
    createdAt: new Date("2026-04-20T00:00:00.000Z"),
    updatedAt: new Date("2026-04-21T00:00:00.000Z"),
  };

  const notification = {
    id: 9,
    studyTrackingCaseId: 5,
    clinicId: 3,
    reportId: 12,
    particularTokenId: 18,
    type: "special_stain_required",
    title: "Tinción especial requerida",
    message: "Se requiere tinción especial para continuar.",
    isRead: false,
    readAt: null,
    createdAt: new Date("2026-04-21T00:00:00.000Z"),
  };

  const serializedCase = serializeStudyTrackingCase(trackingCase as any);
  const serializedNotification = serializeStudyTrackingNotification(notification as any);

  assert.equal(serializedCase.estimatedDeliveryWasManuallyAdjusted, true);
  assert.equal(serializedCase.currentStage, "processing");
  assert.equal(serializedCase.paymentUrl, "https://example.com/pay/123");
  assert.equal(serializedNotification.type, "special_stain_required");
  assert.equal(serializedNotification.isRead, false);
});
