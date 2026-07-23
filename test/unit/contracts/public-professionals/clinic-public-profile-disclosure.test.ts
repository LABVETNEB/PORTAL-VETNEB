import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  MIN_PUBLIC_PROFILE_QUALITY_SCORE,
  buildClinicPublicProfileResponse,
  evaluateClinicPublicProfilePublication,
} from "../../../../server/features/public-professionals/infrastructure/public-professionals-mapping.ts";

const clinic = {
  id: 37,
  name: "Clínica Norte",
  contactEmail: null,
  contactPhone: null,
};

function evaluate(
  profile: Parameters<
    typeof evaluateClinicPublicProfilePublication
  >[0]["profile"],
) {
  return evaluateClinicPublicProfilePublication({
    clinic,
    profile,
  });
}

test("disclosure fija el umbral exacto 74/75 y score 75 elegible", () => {
  const source = readFileSync(
    resolve(
      process.cwd(),
      "server/features/public-professionals/infrastructure/public-professionals-mapping.ts",
    ),
    "utf8",
  );

  assert.equal(MIN_PUBLIC_PROFILE_QUALITY_SCORE, 75);
  assert.match(
    source,
    /qualityScore >= MIN_PUBLIC_PROFILE_QUALITY_SCORE/,
  );
  assert.equal(
    74 >= MIN_PUBLIC_PROFILE_QUALITY_SCORE,
    false,
  );
  assert.equal(
    75 >= MIN_PUBLIC_PROFILE_QUALITY_SCORE,
    true,
  );

  const atThreshold = evaluate({
    displayName: "Clínica Norte",
    specialtyText: "Cardiología X",
    locality: "Rosario",
    country: "AR",
    email: "a@b.c",
    isPublic: true,
  });

  assert.equal(atThreshold.qualityScore, 75);
  assert.equal(atThreshold.isSearchEligible, true);
  assert.deepEqual(atThreshold.publicationErrors, []);
});

test("disclosure mantiene no elegible todo score alcanzable menor a 75", () => {
  const belowThreshold = evaluate({
    displayName: "Clínica Norte",
    specialtyText: "Vet",
    locality: "Rosario",
    country: "AR",
    email: "a@b.c",
    phone: "12345",
    isPublic: true,
  });

  assert.equal(belowThreshold.qualityScore, 73);
  assert.equal(belowThreshold.isSearchEligible, false);
  assert.deepEqual(belowThreshold.publicationErrors, [
    "El perfil todavía no alcanza la calidad mínima para publicarse. Puntaje actual: 73/75.",
  ]);
});

test("disclosure exige campos requeridos y fija missingRequiredFields", () => {
  const snapshot = evaluate({
    displayName: "X",
    specialtyText: "ab",
    locality: "R",
    country: "A",
    avatarStoragePath: "avatars/37/profile.png",
    isPublic: true,
  });

  assert.equal(snapshot.hasRequiredPublicFields, false);
  assert.equal(snapshot.isSearchEligible, false);
  assert.deepEqual(snapshot.missingRequiredFields, [
    "displayName",
    "specialtyText",
    "locality",
    "country",
  ]);
  assert.deepEqual(snapshot.publicationErrors, [
    "Para publicar el perfil completá nombre visible, especialidad, localidad y país.",
  ]);
});

test("disclosure exige al menos un suplemento y fija missingRecommendedFields", () => {
  const snapshot = evaluate({
    displayName: "Clínica Norte",
    specialtyText: "Veterinaria",
    locality: "Rosario",
    country: "AR",
    isPublic: true,
  });

  assert.equal(snapshot.hasRequiredPublicFields, true);
  assert.equal(snapshot.hasQualitySupplement, false);
  assert.equal(snapshot.isSearchEligible, false);
  assert.deepEqual(snapshot.missingRecommendedFields, [
    "avatar",
    "aboutText",
    "servicesText",
    "email",
    "phone",
  ]);
  assert.deepEqual(snapshot.publicationErrors, [
    "Para publicar el perfil agregá al menos uno de estos campos: avatar, descripción, servicios, email o teléfono.",
  ]);
});

test("perfil privado guardado no equivale a isPublic ni search eligible", () => {
  const snapshot = evaluate({
    displayName: "Clínica Norte",
    specialtyText: "Cardiología X",
    locality: "Rosario",
    country: "AR",
    email: "a@b.c",
    isPublic: false,
  });

  assert.equal(snapshot.qualityScore, 75);
  assert.equal(snapshot.hasRequiredPublicFields, true);
  assert.equal(snapshot.hasQualitySupplement, true);
  assert.equal(snapshot.isPublic, false);
  assert.equal(snapshot.isSearchEligible, false);
  assert.deepEqual(snapshot.publicationErrors, []);
});

test("mapper canónico expone disclosure sin reinterpretar listas ni score", () => {
  const response = buildClinicPublicProfileResponse({
    clinic,
    profile: {
      clinicId: 37,
      displayName: "Clínica Norte",
      avatarStoragePath: null,
      aboutText: null,
      specialtyText: "Cardiología X",
      servicesText: null,
      email: "a@b.c",
      phone: null,
      publicAddress: null,
      mapLink: null,
      locality: "Rosario",
      country: "AR",
      isPublic: true,
      createdAt: new Date("2026-07-23T00:00:00.000Z"),
      updatedAt: new Date("2026-07-23T00:00:00.000Z"),
    },
    avatarUrl: null,
  });

  assert.deepEqual(response.publication, {
    hasRequiredPublicFields: true,
    hasQualitySupplement: true,
    qualityScore: 75,
    minimumQualityScore: 75,
    isSearchEligible: true,
    missingRequiredFields: [],
    missingRecommendedFields: [
      "avatar",
      "aboutText",
      "servicesText",
      "phone",
    ],
    publicationErrors: [],
  });
});
