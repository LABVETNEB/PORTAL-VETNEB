import test from "node:test";
import assert from "node:assert/strict";

import {
  getPublicProfessionalDetail,
  resolvePublicProfessionalsQueryDeps,
  searchPublicProfessionalsDirectory,
  type PublicProfessionalRow,
  type PublicProfessionalsQueryDeps,
} from "../../../../server/features/public-professionals/public-professionals-query-service.ts";

function buildProfessionalRow(
  overrides: Partial<PublicProfessionalRow> = {},
): PublicProfessionalRow {
  return {
    clinicId: 7,
    displayName: "Clínica Norte",
    avatarStoragePath: "avatars/7.webp",
    aboutText: "Cardiología veterinaria",
    specialtyText: "Cardiología",
    servicesText: "Ecocardiograma",
    email: "norte@example.com",
    phone: "3410000000",
    publicAddress: "Av. Central 123",
    mapLink: "https://maps.example.com/clinic/7",
    locality: "Rosario",
    country: "AR",
    updatedAt: new Date("2026-07-01T12:00:00.000Z"),
    profileQualityScore: 90,
    rank: 0.8,
    similarity: 0.7,
    score: 1.5,
    ...overrides,
  };
}

test("searchPublicProfessionalsDirectory consulta, serializa y firma avatares", async () => {
  const receivedInputs: unknown[] = [];
  const signedPaths: string[] = [];

  const deps: PublicProfessionalsQueryDeps = {
    searchPublicProfessionals: async (input) => {
      receivedInputs.push(input);

      return {
        rows: [buildProfessionalRow()],
        total: 1,
        limit: input.limit,
        offset: input.offset,
      };
    },
    getPublicProfessionalByClinicId: async () => null,
    createSignedStorageUrl: async (path) => {
      signedPaths.push(path);
      return `signed:${path}`;
    },
  };

  const result = await searchPublicProfessionalsDirectory(
    {
      query: "cardio",
      locality: "Rosario",
      country: "AR",
      limit: 5,
      offset: 2,
    },
    deps,
  );

  assert.deepEqual(receivedInputs, [
    {
      query: "cardio",
      locality: "Rosario",
      country: "AR",
      limit: 5,
      offset: 2,
    },
  ]);

  assert.deepEqual(signedPaths, ["avatars/7.webp"]);
  assert.equal(result.total, 1);
  assert.equal(result.limit, 5);
  assert.equal(result.offset, 2);
  assert.equal(result.professionals.length, 1);

  assert.deepEqual(result.professionals[0], {
    clinicId: 7,
    displayName: "Clínica Norte",
    avatarUrl: "signed:avatars/7.webp",
    specialtyText: "Cardiología",
    servicesText: "Ecocardiograma",
    email: "norte@example.com",
    phone: "3410000000",
    locality: "Rosario",
    country: "AR",
    aboutText: "Cardiología veterinaria",
    publicAddress: "Av. Central 123",
    mapLink: "https://maps.example.com/clinic/7",
    updatedAt: new Date("2026-07-01T12:00:00.000Z"),
    relevance: {
      rank: 0.8,
      similarity: 0.7,
      score: 1.5,
    },
    profileQualityScore: 90,
  });

  assert.equal(
    "avatarStoragePath" in result.professionals[0],
    false,
  );
});

test("getPublicProfessionalDetail devuelve null sin firmar storage cuando no existe perfil", async () => {
  let signed = false;

  const deps: PublicProfessionalsQueryDeps = {
    searchPublicProfessionals: async () => ({
      rows: [],
      total: 0,
      limit: 20,
      offset: 0,
    }),
    getPublicProfessionalByClinicId: async () => null,
    createSignedStorageUrl: async () => {
      signed = true;
      return "unexpected";
    },
  };

  const result = await getPublicProfessionalDetail(404, deps);

  assert.equal(result, null);
  assert.equal(signed, false);
});

test("getPublicProfessionalDetail conserva campos opcionales ausentes", async () => {
  const deps: PublicProfessionalsQueryDeps = {
    searchPublicProfessionals: async () => ({
      rows: [],
      total: 0,
      limit: 20,
      offset: 0,
    }),
    getPublicProfessionalByClinicId: async () =>
      buildProfessionalRow({
        avatarStoragePath: null,
        publicAddress: null,
        mapLink: null,
        rank: undefined,
        similarity: undefined,
        score: undefined,
        profileQualityScore: undefined,
      }),
    createSignedStorageUrl: async () => "unexpected",
  };

  const result = await getPublicProfessionalDetail(7, deps);

  assert.ok(result);
  assert.equal(result.avatarUrl, null);
  assert.equal("publicAddress" in result, false);
  assert.equal("mapLink" in result, false);
  assert.deepEqual(result.relevance, {
    rank: 0,
    similarity: 0,
    score: 0,
  });
  assert.equal(result.profileQualityScore, null);
});

test("resolvePublicProfessionalsQueryDeps prioriza un conjunto completo de overrides", async () => {
  const searchPublicProfessionals = async () => ({
    rows: [],
    total: 0,
    limit: 20,
    offset: 0,
  });

  const getPublicProfessionalByClinicId = async () => null;
  const createSignedStorageUrl = async () => null;

  const deps = await resolvePublicProfessionalsQueryDeps({
    searchPublicProfessionals,
    getPublicProfessionalByClinicId,
    createSignedStorageUrl,
  });

  assert.equal(
    deps.searchPublicProfessionals,
    searchPublicProfessionals,
  );
  assert.equal(
    deps.getPublicProfessionalByClinicId,
    getPublicProfessionalByClinicId,
  );
  assert.equal(
    deps.createSignedStorageUrl,
    createSignedStorageUrl,
  );
});
