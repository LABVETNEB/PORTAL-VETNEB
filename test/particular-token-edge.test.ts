import test from "node:test";
import assert from "node:assert/strict";
import {
  adminCreateParticularTokenSchema,
  clinicCreateParticularTokenSchema,
  serializeParticularToken,
  serializeParticularTokenDetail,
  updateParticularTokenReportSchema,
} from "../server/lib/particular-token.ts";

test("clinicCreateParticularTokenSchema acepta reportId positivo y detailsLesion al limite", () => {
  const parsed = clinicCreateParticularTokenSchema.safeParse({
    tutorLastName: " Gomez ",
    petName: " Luna ",
    petAge: " 8 años ",
    petBreed: " Caniche ",
    petSex: " Hembra ",
    petSpecies: " Canina ",
    sampleLocation: " Pabellón auricular ",
    sampleEvolution: " 15 días de evolución ",
    detailsLesion: "a".repeat(10000),
    extractionDate: "2026-04-20T00:00:00.000Z",
    shippingDate: "2026-04-21T00:00:00.000Z",
    reportId: "25",
  });

  if (!parsed.success) {
    assert.fail(parsed.error.message);
  }

  assert.equal(parsed.data.reportId, 25);
  assert.equal(parsed.data.detailsLesion, "a".repeat(10000));
  assert.equal(parsed.data.tutorLastName, "Gomez");
  assert.equal(parsed.data.petName, "Luna");
});

test("clinicCreateParticularTokenSchema rechaza detailsLesion fuera de limite", () => {
  const parsed = clinicCreateParticularTokenSchema.safeParse({
    tutorLastName: "Gomez",
    petName: "Luna",
    petAge: "8 años",
    petBreed: "Caniche",
    petSex: "Hembra",
    petSpecies: "Canina",
    sampleLocation: "Pabellón auricular",
    sampleEvolution: "15 días",
    detailsLesion: "a".repeat(10001),
    extractionDate: "2026-04-20T00:00:00.000Z",
    shippingDate: "2026-04-21T00:00:00.000Z",
    reportId: null,
  });

  assert.equal(parsed.success, false);

  if (parsed.success) {
    assert.fail("La validación debió fallar");
  }

  assert.equal(
    parsed.error.issues[0]?.message,
    "detallesLesion no puede superar 10000 caracteres",
  );
});

test("clinicCreateParticularTokenSchema rechaza fechas invalidas", () => {
  const parsed = clinicCreateParticularTokenSchema.safeParse({
    tutorLastName: "Gomez",
    petName: "Luna",
    petAge: "8 años",
    petBreed: "Caniche",
    petSex: "Hembra",
    petSpecies: "Canina",
    sampleLocation: "Pabellón auricular",
    sampleEvolution: "15 días",
    extractionDate: "fecha-invalida",
    shippingDate: "otra-fecha-invalida",
    reportId: null,
  });

  assert.equal(parsed.success, false);

  if (parsed.success) {
    assert.fail("La validación debió fallar");
  }

  const messages = parsed.error.issues.map((issue) => issue.message);

  assert.ok(
    messages.includes("Invalid date") ||
      messages.includes("Fecha de extracción inválida") ||
      messages.includes("Fecha de envío inválida"),
  );
});

test("adminCreateParticularTokenSchema acepta reportId positivo y rechaza clinicId no numerico", () => {
  const valid = adminCreateParticularTokenSchema.safeParse({
    clinicId: "8",
    tutorLastName: "Gomez",
    petName: "Luna",
    petAge: "8 años",
    petBreed: "Caniche",
    petSex: "Hembra",
    petSpecies: "Canina",
    sampleLocation: "Pabellón auricular",
    sampleEvolution: "15 días",
    extractionDate: "2026-04-20T00:00:00.000Z",
    shippingDate: "2026-04-21T00:00:00.000Z",
    reportId: "18",
  });

  const invalidClinic = adminCreateParticularTokenSchema.safeParse({
    clinicId: "abc",
    tutorLastName: "Gomez",
    petName: "Luna",
    petAge: "8 años",
    petBreed: "Caniche",
    petSex: "Hembra",
    petSpecies: "Canina",
    sampleLocation: "Pabellón auricular",
    sampleEvolution: "15 días",
    extractionDate: "2026-04-20T00:00:00.000Z",
    shippingDate: "2026-04-21T00:00:00.000Z",
    reportId: null,
  });

  if (!valid.success) {
    assert.fail(valid.error.message);
  }

  assert.equal(valid.data.clinicId, 8);
  assert.equal(valid.data.reportId, 18);
  assert.equal(invalidClinic.success, false);
});

test("updateParticularTokenReportSchema rechaza reportId invalido o no positivo", () => {
  const zero = updateParticularTokenReportSchema.safeParse({ reportId: "0" });
  const text = updateParticularTokenReportSchema.safeParse({ reportId: "abc" });

  assert.equal(zero.success, false);
  assert.equal(text.success, false);
});

test("serializeParticularToken conserva forma publica y marca hasLinkedReport false cuando no hay reporte", () => {
  const token = {
    id: 10,
    clinicId: 3,
    reportId: null,
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
    detailsLesion: null,
    extractionDate: new Date("2026-04-20T00:00:00.000Z"),
    shippingDate: new Date("2026-04-21T00:00:00.000Z"),
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date("2026-04-20T08:00:00.000Z"),
    updatedAt: new Date("2026-04-22T10:00:00.000Z"),
    createdByAdminId: 1,
    createdByClinicUserId: null,
  };

  const serialized = serializeParticularToken(token as any);

  assert.equal(serialized.hasLinkedReport, false);
  assert.equal(serialized.reportId, null);
  assert.equal(serialized.detailsLesion, null);
  assert.equal(serialized.createdByAdminId, 1);
  assert.equal(serialized.createdByClinicUserId, null);
});

test("serializeParticularTokenDetail embebe reporte cuando existe y devuelve null cuando no existe", () => {
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
    lastLoginAt: null,
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

  const withReport = serializeParticularTokenDetail(token as any, report as any);
  const withoutReport = serializeParticularTokenDetail(token as any, null);

  assert.equal(withReport.report?.id, 22);
  assert.equal(withReport.report?.fileName, "informe-luna.pdf");
  assert.equal(withoutReport.report, null);
  assert.equal(withReport.hasLinkedReport, true);
});
