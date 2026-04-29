import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPublicProfessionalFixtureRow,
  buildPublicProfessionalsRouteFixtureStubs,
} from "./helpers/public-professionals-fixtures.ts";

const DEFAULT_UPDATED_AT = "2026-04-29T20:00:00.000Z";

test("public professionals fixture rows son objetos independientes entre invocaciones", () => {
  const first = buildPublicProfessionalFixtureRow();
  const second = buildPublicProfessionalFixtureRow();

  assert.notEqual(first, second);
  assert.notEqual(first.updatedAt, second.updatedAt);

  first.displayName = "Clinica Mutada";
  first.email = "mutated@example.com";
  first.updatedAt.setUTCFullYear(2040);

  assert.equal(second.displayName, "Clinica Publica Fixture");
  assert.equal(second.email, "fixture@example.com");
  assert.equal(second.updatedAt.toISOString(), DEFAULT_UPDATED_AT);

  const later = buildPublicProfessionalFixtureRow();

  assert.equal(later.displayName, "Clinica Publica Fixture");
  assert.equal(later.email, "fixture@example.com");
  assert.equal(later.updatedAt.toISOString(), DEFAULT_UPDATED_AT);
});

test("public professionals fixture row clona Date de overrides parciales", () => {
  const overrideDate = new Date("2026-05-01T12:00:00.000Z");
  const customized = buildPublicProfessionalFixtureRow({
    clinicId: 777,
    displayName: "Clinica Override Parcial",
    updatedAt: overrideDate,
  });

  assert.notEqual(customized.updatedAt, overrideDate);
  assert.equal(customized.updatedAt.toISOString(), overrideDate.toISOString());

  customized.displayName = "Clinica Override Mutada";
  customized.updatedAt.setUTCFullYear(2041);

  const defaultAfterOverride = buildPublicProfessionalFixtureRow();

  assert.equal(defaultAfterOverride.clinicId, 123);
  assert.equal(defaultAfterOverride.displayName, "Clinica Publica Fixture");
  assert.equal(defaultAfterOverride.locality, "Rosario");
  assert.equal(defaultAfterOverride.updatedAt.toISOString(), DEFAULT_UPDATED_AT);
  assert.equal(overrideDate.toISOString(), "2026-05-01T12:00:00.000Z");
});

test("public professionals route stubs no comparten mutaciones entre llamadas de search", async () => {
  const searchRow = buildPublicProfessionalFixtureRow({
    clinicId: 654,
    displayName: "Clinica Search Custom",
    email: "search-custom@example.com",
  });

  const stubs = buildPublicProfessionalsRouteFixtureStubs({
    searchRows: [searchRow],
  });

  const firstSearch = await stubs.searchPublicProfessionals();
  const firstRow = firstSearch.rows[0];

  assert.ok(firstRow);
  assert.notEqual(firstRow, searchRow);
  assert.notEqual(firstRow.updatedAt, searchRow.updatedAt);
  assert.deepEqual(firstRow, searchRow);

  firstRow.displayName = "Clinica Search Mutada";
  firstRow.email = "search-mutated@example.com";
  firstRow.updatedAt.setUTCFullYear(2042);
  firstSearch.rows.push(
    buildPublicProfessionalFixtureRow({
      clinicId: 999,
    }),
  );

  const secondSearch = await stubs.searchPublicProfessionals();
  const secondRow = secondSearch.rows[0];

  assert.equal(secondSearch.rows.length, 1);
  assert.ok(secondRow);
  assert.notEqual(secondRow, firstRow);
  assert.equal(secondRow.displayName, "Clinica Search Custom");
  assert.equal(secondRow.email, "search-custom@example.com");
  assert.equal(secondRow.updatedAt.toISOString(), DEFAULT_UPDATED_AT);
});

test("public professionals searchRows custom no altera row default ni detail", async () => {
  const detailRow = buildPublicProfessionalFixtureRow({
    clinicId: 321,
    displayName: "Clinica Detail Fixture",
    email: "detail@example.com",
  });
  const searchRow = buildPublicProfessionalFixtureRow({
    clinicId: 654,
    displayName: "Clinica Search Fixture",
    email: "search@example.com",
  });

  const stubs = buildPublicProfessionalsRouteFixtureStubs({
    row: detailRow,
    searchRows: [searchRow],
  });

  const searchResult = await stubs.searchPublicProfessionals();
  const searchResultRow = searchResult.rows[0];

  assert.ok(searchResultRow);
  assert.deepEqual(searchResult.rows, [searchRow]);
  assert.equal(searchResult.total, 1);

  const detailBeforeMutation = await stubs.getPublicProfessionalByClinicId(321);

  assert.deepEqual(detailBeforeMutation, detailRow);
  assert.equal(await stubs.getPublicProfessionalByClinicId(654), null);

  searchResultRow.displayName = "Clinica Search Mutada";
  searchResultRow.email = "search-mutated@example.com";
  searchResultRow.updatedAt.setUTCFullYear(2043);

  const detailAfterMutation = await stubs.getPublicProfessionalByClinicId(321);
  const searchAfterMutation = await stubs.searchPublicProfessionals();
  const searchAfterMutationRow = searchAfterMutation.rows[0];

  assert.ok(searchAfterMutationRow);
  assert.deepEqual(detailAfterMutation, detailRow);
  assert.equal(detailAfterMutation?.displayName, "Clinica Detail Fixture");
  assert.equal(detailAfterMutation?.email, "detail@example.com");
  assert.equal(detailAfterMutation?.updatedAt.toISOString(), DEFAULT_UPDATED_AT);

  assert.equal(searchAfterMutationRow.displayName, "Clinica Search Fixture");
  assert.equal(searchAfterMutationRow.email, "search@example.com");
  assert.equal(searchAfterMutationRow.updatedAt.toISOString(), DEFAULT_UPDATED_AT);
});

test("public professionals detail devuelve clones independientes entre llamadas", async () => {
  const detailRow = buildPublicProfessionalFixtureRow({
    clinicId: 888,
    displayName: "Clinica Detail Clone",
    email: "detail-clone@example.com",
  });

  const stubs = buildPublicProfessionalsRouteFixtureStubs({
    row: detailRow,
  });

  const firstDetail = await stubs.getPublicProfessionalByClinicId(888);
  const secondDetail = await stubs.getPublicProfessionalByClinicId(888);

  assert.ok(firstDetail);
  assert.ok(secondDetail);
  assert.notEqual(firstDetail, secondDetail);
  assert.notEqual(firstDetail.updatedAt, secondDetail.updatedAt);

  firstDetail.displayName = "Clinica Detail Mutada";
  firstDetail.email = "detail-mutated@example.com";
  firstDetail.updatedAt.setUTCFullYear(2044);

  const thirdDetail = await stubs.getPublicProfessionalByClinicId(888);

  assert.deepEqual(thirdDetail, detailRow);
  assert.equal(thirdDetail?.displayName, "Clinica Detail Clone");
  assert.equal(thirdDetail?.email, "detail-clone@example.com");
  assert.equal(thirdDetail?.updatedAt.toISOString(), DEFAULT_UPDATED_AT);
});
