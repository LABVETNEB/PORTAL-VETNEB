import test from "node:test";
import assert from "node:assert/strict";
import {
  adminCreateStudyTrackingSchema,
  addBusinessDaysFromLabReceivedDate,
  applyEstimatedDeliveryRules,
  applyStageTimestampDefaults,
  buildValidationError,
  calculateEstimatedDeliveryAt,
  getArgentinaNonWorkingDates,
  getArgentinaNationalHolidayKeys,
  getBusinessDayWeight,
  getWorkingDayWeight,
  isArgentinaNationalHoliday,
  isSaturday,
  isSunday,
  parseBooleanQuery,
  parseEntityId,
  parseOffset,
  parsePositiveInt,
  serializeStudyTrackingCase,
  serializeStudyTrackingNotification,
  shouldCreateSpecialStainNotification,
  updateStudyTrackingSchema,
} from "../../../../server/features/study-tracking/domain/index.ts";

test("adminCreateStudyTrackingSchema normaliza booleanos, textos y fechas", () => {
  const parsed = adminCreateStudyTrackingSchema.safeParse({
    clinicId: "4",
    reportId: "12",
    particularTokenId: null,
    labReceivedAt: "2026-04-20T10:00:00.000Z",
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
  assert.ok(parsed.data.labReceivedAt instanceof Date);
  assert.ok(parsed.data.receptionAt instanceof Date);
  assert.equal(parsed.data.labReceivedAt.toISOString(), parsed.data.receptionAt.toISOString());
});

test("updateStudyTrackingSchema permite limpiar campos opcionales con null", () => {
  const parsed = updateStudyTrackingSchema.safeParse({
    reportId: null,
    particularTokenId: "18",
    labReceivedAt: "2026-05-04T00:00:00.000Z",
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
  assert.equal(parsed.data.labReceivedAt?.toISOString(), "2026-05-04T00:00:00.000Z");
  assert.equal(parsed.data.receptionAt?.toISOString(), "2026-05-04T00:00:00.000Z");
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

test("feriados configurados 2026 y pesos de días hábiles se calculan correctamente", () => {
  const holidays2026 = getArgentinaNationalHolidayKeys(2026);
  const nonWorking2026 = getArgentinaNonWorkingDates(2026);

  assert.equal(holidays2026.has("2026-01-01"), true);
  assert.equal(holidays2026.has("2026-02-16"), true);
  assert.equal(holidays2026.has("2026-02-17"), true);
  assert.equal(holidays2026.has("2026-03-23"), true);
  assert.equal(holidays2026.has("2026-04-03"), true);
  assert.equal(holidays2026.has("2026-07-10"), true);
  assert.equal(nonWorking2026.has("2026-12-25"), true);

  assert.equal(isSunday("2026-05-24"), true);
  assert.equal(isSaturday("2026-05-23"), true);
  assert.equal(isArgentinaNationalHoliday(new Date("2026-05-25T00:00:00.000Z")), true);
  assert.equal(getBusinessDayWeight(new Date("2026-05-25T00:00:00.000Z")), 0);
  assert.equal(getWorkingDayWeight("2026-05-23"), 0.5);
  assert.equal(getWorkingDayWeight("2026-05-24"), 0);
  assert.equal(getWorkingDayWeight("2026-07-10"), 0);
  assert.equal(getBusinessDayWeight(new Date("2026-05-26T00:00:00.000Z")), 1);
});

test("calculateEstimatedDeliveryAt contempla sábado como medio día hábil", () => {
  const deliveryAt = calculateEstimatedDeliveryAt(
    new Date("2026-01-02T00:00:00.000Z"),
    2,
  );

  assert.equal(deliveryAt.toISOString(), "2026-01-06T00:00:00.000Z");
});

test("addBusinessDaysFromLabReceivedDate atraviesa sábado, domingo y feriado", () => {
  assert.equal(addBusinessDaysFromLabReceivedDate("2026-01-02", 0.5), "2026-01-03");
  assert.equal(addBusinessDaysFromLabReceivedDate("2026-01-02", 1), "2026-01-05");
  assert.equal(addBusinessDaysFromLabReceivedDate("2026-07-08", 0.5), "2026-07-11");
  assert.equal(addBusinessDaysFromLabReceivedDate("2026-07-08", 1), "2026-07-13");
});

test("applyEstimatedDeliveryRules diferencia ajuste manual y cálculo automático", () => {
  const labReceivedAt = new Date("2026-01-02T00:00:00.000Z");
  const manualEstimatedDeliveryAt = new Date("2026-01-06T00:00:00.000Z");

  const automatic = applyEstimatedDeliveryRules({ labReceivedAt });
  const manual = applyEstimatedDeliveryRules({
    labReceivedAt,
    manualEstimatedDeliveryAt,
  });

  assert.equal(automatic.estimatedDeliveryAt.toISOString(), "2026-01-22T00:00:00.000Z");
  assert.equal(automatic.estimatedDeliveryWasManuallyAdjusted, false);
  assert.equal(manual.estimatedDeliveryAt.toISOString(), "2026-01-06T00:00:00.000Z");
  assert.equal(manual.estimatedDeliveryAutoCalculatedAt.toISOString(), "2026-01-22T00:00:00.000Z");
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

  assert.equal(serializedCase.labReceivedAt.toISOString(), "2026-04-20T00:00:00.000Z");
  assert.equal(serializedCase.receptionAt.toISOString(), "2026-04-20T00:00:00.000Z");
  assert.equal(serializedCase.estimatedDeliveryWasManuallyAdjusted, true);
  assert.equal(serializedCase.currentStage, "processing");
  assert.equal(serializedCase.paymentUrl, "https://example.com/pay/123");
  assert.equal(serializedNotification.type, "special_stain_required");
  assert.equal(serializedNotification.isRead, false);

  const serializedText = JSON.stringify(serializedCase);
  for (const forbiddenKey of [
    "storagePath",
    "signedUrl",
    "rawToken",
    "cookie",
    "session",
    "secret",
    "service_role",
    "stack",
    "cause",
    "details",
  ]) {
    assert.equal(serializedText.includes(forbiddenKey), false, forbiddenKey);
  }
});
