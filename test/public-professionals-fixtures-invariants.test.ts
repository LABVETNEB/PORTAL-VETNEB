import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPublicProfessionalFixtureRow,
  buildPublicProfessionalsRouteFixtureStubs,
} from "./helpers/public-professionals-fixtures.ts";

test("public professionals fixture row mantiene defaults públicos determinísticos", () => {
  const row = buildPublicProfessionalFixtureRow();

  assert.deepEqual(row, {
    clinicId: 123,
    displayName: "Clinica Publica Fixture",
    avatarStoragePath: null,
    aboutText: "Perfil publico fixture",
    specialtyText: "Histopatologia",
    servicesText: "Biopsias",
    email: "fixture@example.com",
    phone: "3411234567",
    locality: "Rosario",
    country: "AR",
    updatedAt: new Date("2026-04-29T20:00:00.000Z"),
    profileQualityScore: 0.9,
    rank: 0.4,
    similarity: 0.3,
    score: 0.7,
  });
});

test("public professionals fixture row permite overrides sin mutar defaults", () => {
  const customized = buildPublicProfessionalFixtureRow({
    clinicId: 777,
    displayName: "Clinica Override",
    email: "override@example.com",
  });
  const defaultRow = buildPublicProfessionalFixtureRow();

  assert.equal(customized.clinicId, 777);
  assert.equal(customized.displayName, "Clinica Override");
  assert.equal(customized.email, "override@example.com");

  assert.equal(defaultRow.clinicId, 123);
  assert.equal(defaultRow.displayName, "Clinica Publica Fixture");
  assert.equal(defaultRow.email, "fixture@example.com");
});

test("public professionals route stubs son determinísticos y sin DB ni storage reales", async () => {
  const row = buildPublicProfessionalFixtureRow({
    clinicId: 456,
    avatarStoragePath: "avatars/456.webp",
  });

  const stubs = buildPublicProfessionalsRouteFixtureStubs({
    row,
    searchRateLimitMaxAttempts: 3,
    detailRateLimitMaxAttempts: 4,
    now: () => 25_000,
  });

  const searchResult = await stubs.searchPublicProfessionals();
  const searchRow = searchResult.rows[0];

  assert.ok(searchRow);
  assert.deepEqual(searchResult, {
    rows: [row],
    total: 1,
    limit: 20,
    offset: 0,
  });
  assert.notEqual(searchRow, row);
  assert.notEqual(searchRow.updatedAt, row.updatedAt);

  const detailResult = await stubs.getPublicProfessionalByClinicId(456);

  assert.deepEqual(detailResult, row);
  assert.notEqual(detailResult, row);
  assert.notEqual(detailResult?.updatedAt, row.updatedAt);

  assert.equal(await stubs.getPublicProfessionalByClinicId(999), null);
  assert.equal(
    await stubs.createSignedStorageUrl("avatars/456.webp"),
    "signed:avatars/456.webp",
  );

  assert.equal(stubs.searchRateLimitWindowMs, 60_000);
  assert.equal(stubs.searchRateLimitMaxAttempts, 3);
  assert.equal(stubs.detailRateLimitWindowMs, 60_000);
  assert.equal(stubs.detailRateLimitMaxAttempts, 4);
  assert.equal(stubs.now(), 25_000);
});
