import test from "node:test";
import assert from "node:assert/strict";
import {
  buildValidationError,
  clinicCreateParticularTokenSchema,
  parseEntityId,
  parseOffset,
  parsePositiveInt,
  serializeParticularToken,
  serializeParticularTokenDetail,
  updateParticularTokenReportSchema,
} from "../server/lib/particular-token.ts";

test("clinicCreateParticularTokenSchema normaliza detailsLesion vacío y reportId null", () => {
  const parsed = clinicCreateParticularTokenSchema.safeParse({
    tutorLastName: " Gomez ",
    petName: " Luna ",
    petAge: " 8 años ",
    petBreed: " Caniche ",
    petSex: " Hembra ",
    petSpecies: " Canina ",
    sampleLocation: " Pabellón auricular ",
    sampleEvolution: " 15 días de evolución ",
    detailsLesion: "   ",
    extractionDate: "2026-04-20T00:00:00.000Z",
    shippingDate: "2026-04-21T00:00:00.000Z",
    reportId: null,
  });

  assert.equal(parsed.success, true);

  if (!parsed.success) {
    throw parsed.error;
  }

  assert.equal(parsed.data.detailsLesion, undefined);
  assert.equal(parsed.data.reportId, null);
  assert.equal(parsed.data.tutorLastName, "Gomez");
  assert.equal(parsed.data.petName, "Luna");
  assert.ok(parsed.data.extractionDate instanceof Date);
  assert.ok(parsed.data.shippingDate instanceof Date);
});

test("updateParticularTokenReportSchema acepta número positivo y null", () => {
  const withReport = updateParticularTokenReportSchema.safeParse({ reportId: "12" });
  const withoutReport = updateParticularTokenReportSchema.safeParse({ reportId: null });

  assert.equal(withReport.success, true);
  assert.equal(withoutReport.success, true);

  if (!withReport.success || !withoutReport.success) {
    throw new Error("El schema no aceptó entradas válidas");
  }

  assert.equal(withReport.data.reportId, 12);
  assert.equal(withoutReport.data.reportId, null);
});

test("helpers numéricos de particular-token respetan fallback y límites", () => {
  assert.equal(parsePositiveInt("25", 50, 100), 25);
  assert.equal(parsePositiveInt("250", 50, 100), 100);
  assert.equal(parsePositiveInt("0", 50, 100), 50);

  assert.equal(parseOffset("15", 0), 15);
  assert.equal(parseOffset("-1", 0), 0);
  assert.equal(parseOffset("texto", 3), 3);

  assert.equal(parseEntityId("7"), 7);
  assert.equal(parseEntityId("0"), undefined);
  assert.equal(parseEntityId("abc"), undefined);
});

test("buildValidationError devuelve el primer mensaje del schema", () => {
  const parsed = clinicCreateParticularTokenSchema.safeParse({
    tutorLastName: "",
    petName: "",
    petAge: "",
    petBreed: "",
    petSex: "",
    petSpecies: "",
    sampleLocation: "",
    sampleEvolution: "",
    extractionDate: "invalida",
    shippingDate: "invalida",
  });

  assert.equal(parsed.success, false);

  if (parsed.success) {
    throw new Error("La validación debió fallar");
  }

  assert.equal(buildValidationError(parsed.error), "Tutor: apellido es obligatorio");
});

test("serializeParticularToken y serializeParticularTokenDetail exponen banderas y reporte vinculado", () => {
  const token = {
    id: 10,
    clinicId: 3,
    reportId: 22,
    tokenHash: "hash",
    tokenLast4: "1a2b",
    tutorLastName: "Gomez",
    petName: "Luna",
    petAge: "8 años",
    petBreed: "Caniche",
    petSex: "Hembra",
    petSpecies: "Canina",
    sampleLocation: "Pabellón auricular",
    sampleEvolution: "15 días",
    detailsLesion: "Lesión nodular",
    extractionDate: new Date("2026-04-20T00:00:00.000Z"),
    shippingDate: new Date("2026-04-21T00:00:00.000Z"),
    isActive: true,
    lastLoginAt: new Date("2026-04-22T10:00:00.000Z"),
    createdAt: new Date("2026-04-20T08:00:00.000Z"),
    updatedAt: new Date("2026-04-22T10:00:00.000Z"),
    createdByAdminId: null,
    createdByClinicUserId: 9,
  };

  const report = {
    id: 22,
    clinicId: 3,
    uploadDate: new Date("2026-04-22T09:00:00.000Z"),
    studyType: "Histopatología",
    patientName: "Luna",
    fileName: "informe-luna.pdf",
    createdAt: new Date("2026-04-22T09:00:00.000Z"),
    updatedAt: new Date("2026-04-22T09:30:00.000Z"),
  };

  const serialized = serializeParticularToken(token as any);
  const detailed = serializeParticularTokenDetail(token as any, report as any);
  const withoutReport = serializeParticularTokenDetail(
    { ...token, reportId: null } as any,
    null,
  );

  assert.equal(serialized.hasLinkedReport, true);
  assert.equal(serialized.createdByClinicUserId, 9);
  assert.equal(detailed.report?.id, 22);
  assert.equal(detailed.report?.studyType, "Histopatología");
  assert.equal(withoutReport.hasLinkedReport, false);
  assert.equal(withoutReport.report, null);
});
