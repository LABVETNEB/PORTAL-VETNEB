import test from "node:test";
import assert from "node:assert/strict";
import {
  STUDY_TRACKING_STAGES,
  clinicCreateStudyTrackingSchema,
} from "../server/lib/study-tracking.ts";

test("STUDY_TRACKING_STAGES conserva el orden público esperado", () => {
  assert.deepEqual(STUDY_TRACKING_STAGES, [
    "reception",
    "processing",
    "evaluation",
    "report_development",
    "delivered",
  ]);
});

test("STUDY_TRACKING_STAGES contiene valores únicos y normalizados", () => {
  const unique = new Set(STUDY_TRACKING_STAGES);

  assert.equal(unique.size, STUDY_TRACKING_STAGES.length);

  for (const stage of STUDY_TRACKING_STAGES) {
    assert.equal(typeof stage, "string");
    assert.equal(stage.trim(), stage);
    assert.equal(stage.length > 0, true);
    assert.match(stage, /^[a-z_]+$/);
  }
});

test("clinicCreateStudyTrackingSchema omite clinicId y estimatedDeliveryAt del payload parseado", () => {
  const parsed = clinicCreateStudyTrackingSchema.safeParse({
    clinicId: 999,
    reportId: "12",
    particularTokenId: "34",
    receptionAt: "2026-04-21T10:00:00.000Z",
    estimatedDeliveryAt: "2026-04-25T10:00:00.000Z",
    currentStage: "processing",
    specialStainRequired: "true",
    paymentUrl: " https://example.com/pago/12 ",
    adminContactEmail: " admin@example.com ",
    adminContactPhone: " 3511234567 ",
    notes: " observación de prueba ",
  });

  assert.equal(parsed.success, true);

  if (!parsed.success) {
    return;
  }

  assert.equal("clinicId" in parsed.data, false);
  assert.equal("estimatedDeliveryAt" in parsed.data, false);

  assert.equal(parsed.data.reportId, 12);
  assert.equal(parsed.data.particularTokenId, 34);
  assert.equal(parsed.data.currentStage, "processing");
  assert.equal(parsed.data.specialStainRequired, true);
  assert.equal(parsed.data.paymentUrl, "https://example.com/pago/12");
  assert.equal(parsed.data.adminContactEmail, "admin@example.com");
  assert.equal(parsed.data.adminContactPhone, "3511234567");
  assert.equal(parsed.data.notes, "observación de prueba");
});

test("clinicCreateStudyTrackingSchema aplica defaults esperados", () => {
  const parsed = clinicCreateStudyTrackingSchema.safeParse({
    receptionAt: "2026-04-21T10:00:00.000Z",
  });

  assert.equal(parsed.success, true);

  if (!parsed.success) {
    return;
  }

  assert.equal(parsed.data.currentStage, "reception");
  assert.equal(parsed.data.specialStainRequired, false);
  assert.equal(parsed.data.reportId, undefined);
  assert.equal(parsed.data.particularTokenId, undefined);
});

test("clinicCreateStudyTrackingSchema rechaza etapas inválidas", () => {
  const parsed = clinicCreateStudyTrackingSchema.safeParse({
    receptionAt: "2026-04-21T10:00:00.000Z",
    currentStage: "invalid_stage",
  });

  assert.equal(parsed.success, false);
});
