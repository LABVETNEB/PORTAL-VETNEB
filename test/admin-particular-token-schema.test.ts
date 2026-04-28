import test from "node:test";
import assert from "node:assert/strict";
import {
  adminCreateParticularTokenSchema,
} from "../server/lib/particular-token.ts";

test("adminCreateParticularTokenSchema requiere clinicId válido y normaliza campos base", () => {
  const parsed = adminCreateParticularTokenSchema.safeParse({
    clinicId: "5",
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

  if (!parsed.success) {
    assert.fail(parsed.error.message);
  }

  assert.equal(parsed.success, true);

  assert.equal(parsed.data.clinicId, 5);
  assert.equal(parsed.data.detailsLesion, undefined);
  assert.equal(parsed.data.reportId, null);
  assert.equal(parsed.data.tutorLastName, "Gomez");
  assert.equal(parsed.data.petName, "Luna");
  assert.equal(parsed.data.petAge, "8 años");
  assert.equal(parsed.data.petBreed, "Caniche");
  assert.ok(parsed.data.extractionDate instanceof Date);
  assert.ok(parsed.data.shippingDate instanceof Date);
});

test("adminCreateParticularTokenSchema rechaza clinicId ausente", () => {
  const parsed = adminCreateParticularTokenSchema.safeParse({
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

  assert.equal(parsed.success, false);
});

test("adminCreateParticularTokenSchema rechaza clinicId no positivo", () => {
  const parsed = adminCreateParticularTokenSchema.safeParse({
    clinicId: "0",
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

  assert.equal(parsed.success, false);
});

test("adminCreateParticularTokenSchema conserva detailsLesion cuando viene con texto", () => {
  const parsed = adminCreateParticularTokenSchema.safeParse({
    clinicId: "8",
    tutorLastName: "Gomez",
    petName: "Luna",
    petAge: "8 años",
    petBreed: "Caniche",
    petSex: "Hembra",
    petSpecies: "Canina",
    sampleLocation: "Pabellón auricular",
    sampleEvolution: "15 días",
    detailsLesion: "Lesión nodular",
    extractionDate: "2026-04-20T00:00:00.000Z",
    shippingDate: "2026-04-21T00:00:00.000Z",
    reportId: null,
  });

  if (!parsed.success) {
    assert.fail(parsed.error.message);
  }

  assert.equal(parsed.success, true);

  assert.equal(parsed.data.clinicId, 8);
  assert.equal(parsed.data.detailsLesion, "Lesión nodular");
});
