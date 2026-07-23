import assert from "node:assert/strict";
import test from "node:test";

import {
  getClinicPublicProfileQuery,
  type ClinicPublicProfileQueryServiceOverrides,
} from "../../../server/features/clinics/clinic-public-profile-query-service.ts";

const clinic = {
  id: 37,
  name: "Clínica Norte",
};

const profile = {
  displayName: "Clínica Norte",
  avatarStoragePath: "avatars/37/profile.png",
};

const search = {
  clinicId: 37,
  isPublic: true,
  hasRequiredPublicFields: true,
  isSearchEligible: true,
  profileQualityScore: 75,
  updatedAt: new Date("2026-07-23T00:00:00.000Z"),
  searchText: "clinica norte",
  internalOnly: "hidden",
};

function createOverrides(
  replacements: ClinicPublicProfileQueryServiceOverrides = {},
): ClinicPublicProfileQueryServiceOverrides {
  return {
    getClinicPublicProfileByClinicId: async () => ({
      clinic,
      profile,
      search,
    }),
    createSignedStorageUrl: async (storagePath) =>
      `signed:${storagePath}`,
    buildClinicPublicProfileResponse: (input) => ({
      clinicId: input.clinic.id,
      profile: input.profile,
      avatarUrl: input.avatarUrl,
      publication: {
        qualityScore: 75,
      },
    }),
    ...replacements,
  };
}

test("query found respeta get → signed URL → mapper y conserva clinicId", async () => {
  const calls: string[] = [];
  let mapperInput: unknown;

  const result = await getClinicPublicProfileQuery(
    37,
    createOverrides({
      getClinicPublicProfileByClinicId: async (
        clinicId,
      ) => {
        calls.push(`get:${clinicId}`);
        return {
          clinic,
          profile,
          search,
        };
      },
      createSignedStorageUrl: async (storagePath) => {
        calls.push(`sign:${storagePath}`);
        return "signed-avatar";
      },
      buildClinicPublicProfileResponse: (input) => {
        calls.push("map");
        mapperInput = input;
        return {
          mapped: true,
          publication: {
            qualityScore: 75,
          },
        };
      },
    }),
  );

  assert.deepEqual(calls, [
    "get:37",
    "sign:avatars/37/profile.png",
    "map",
  ]);
  assert.deepEqual(mapperInput, {
    clinic,
    profile,
    avatarUrl: "signed-avatar",
  });
  assert.deepEqual(result, {
    ok: true,
    profile: {
      mapped: true,
      publication: {
        qualityScore: 75,
      },
    },
    search: {
      clinicId: 37,
      isPublic: true,
      hasRequiredPublicFields: true,
      isSearchEligible: true,
      profileQualityScore: 75,
      updatedAt: new Date(
        "2026-07-23T00:00:00.000Z",
      ),
      searchText: "clinica norte",
    },
  });
});

test("query acepta perfil ausente y llama al mapper canónico con null", async () => {
  let signedCalls = 0;
  let mapperInput: unknown;

  const result = await getClinicPublicProfileQuery(
    37,
    createOverrides({
      getClinicPublicProfileByClinicId: async () => ({
        clinic,
        profile: null,
        search: null,
      }),
      createSignedStorageUrl: async () => {
        signedCalls += 1;
        return "unused";
      },
      buildClinicPublicProfileResponse: (input) => {
        mapperInput = input;
        return {
          mapped: true,
        };
      },
    }),
  );

  assert.equal(signedCalls, 0);
  assert.deepEqual(mapperInput, {
    clinic,
    profile: null,
    avatarUrl: null,
  });
  assert.deepEqual(result, {
    ok: true,
    profile: {
      mapped: true,
    },
    search: null,
  });
});

test("query no firma cuando el avatar está ausente o vacío", async () => {
  for (const avatarStoragePath of [
    null,
    "",
    undefined,
  ]) {
    let signedCalls = 0;

    const result = await getClinicPublicProfileQuery(
      37,
      createOverrides({
        getClinicPublicProfileByClinicId:
          async () => ({
            clinic,
            profile: {
              ...profile,
              avatarStoragePath,
            },
            search,
          }),
        createSignedStorageUrl: async () => {
          signedCalls += 1;
          return "unused";
        },
      }),
    );

    assert.equal(result.ok, true);
    assert.equal(signedCalls, 0);
    if (result.ok) {
      assert.equal(result.profile.avatarUrl, null);
    }
  }
});

test("query retorna clinic_not_found sin firmar ni mapear", async () => {
  let signedCalls = 0;
  let mapperCalls = 0;

  const result = await getClinicPublicProfileQuery(
    912,
    createOverrides({
      getClinicPublicProfileByClinicId:
        async (clinicId) => {
          assert.equal(clinicId, 912);
          return null;
        },
      createSignedStorageUrl: async () => {
        signedCalls += 1;
        return "unused";
      },
      buildClinicPublicProfileResponse: () => {
        mapperCalls += 1;
        return {};
      },
    }),
  );

  assert.deepEqual(result, {
    ok: false,
    reason: "clinic_not_found",
  });
  assert.equal(signedCalls, 0);
  assert.equal(mapperCalls, 0);
});

test("query propaga exactamente el error del snapshot", async () => {
  const expected = new Error("snapshot failed");

  await assert.rejects(
    () =>
      getClinicPublicProfileQuery(
        37,
        createOverrides({
          getClinicPublicProfileByClinicId:
            async () => {
              throw expected;
            },
        }),
      ),
    expected,
  );
});

test("query propaga exactamente el error de signed URL y no mapea", async () => {
  const expected = new Error("sign failed");
  let mapperCalls = 0;

  await assert.rejects(
    () =>
      getClinicPublicProfileQuery(
        37,
        createOverrides({
          createSignedStorageUrl: async () => {
            throw expected;
          },
          buildClinicPublicProfileResponse: () => {
            mapperCalls += 1;
            return {};
          },
        }),
      ),
    expected,
  );

  assert.equal(mapperCalls, 0);
});

test("query propaga exactamente el error del mapper canónico", async () => {
  const expected = new Error("mapper failed");

  await assert.rejects(
    () =>
      getClinicPublicProfileQuery(
        37,
        createOverrides({
          buildClinicPublicProfileResponse: () => {
            throw expected;
          },
        }),
      ),
    expected,
  );
});
