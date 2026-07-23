import assert from "node:assert/strict";
import test from "node:test";

import {
  deleteClinicPublicAvatarCommand,
  patchClinicPublicProfileCommand,
  uploadClinicPublicAvatarCommand,
  type ClinicPublicProfileCommandServiceOverrides,
  type ClinicPublicProfilePublication,
} from "../../../server/features/clinics/clinic-public-profile-command-service.ts";

const clinic = {
  id: 37,
  name: "Clínica Norte",
  contactEmail: "norte@example.test",
  contactPhone: "3410000000",
};

const profile = {
  clinicId: 37,
  displayName: "Clínica Norte",
  avatarStoragePath: "avatars/37/previous.png",
  aboutText: "Descripción suficientemente extensa del perfil público.",
  specialtyText: "Cardiología",
  servicesText: "Consultas y estudios cardiológicos",
  email: "norte@example.test",
  phone: "3410000000",
  publicAddress: "Calle 1",
  mapLink: "https://maps.google.com/?q=rosario",
  locality: "Rosario",
  country: "AR",
  isPublic: true,
};

const search = {
  clinicId: 37,
  isSearchEligible: true,
};

const publication: ClinicPublicProfilePublication = {
  isPublic: true,
  hasRequiredPublicFields: true,
  hasQualitySupplement: true,
  qualityScore: 80,
  isSearchEligible: true,
  missingRequiredFields: [],
  missingRecommendedFields: [],
  publicationErrors: [],
};

function buildPngBuffer(width = 256, height = 256) {
  const buffer = Buffer.alloc(24);
  Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a,
    0x0a,
  ]).copy(buffer);
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

const avatarFile = {
  buffer: buildPngBuffer(),
  originalname: "avatar.png",
  mimetype: "image/png",
};

function createOverrides(
  replacements: ClinicPublicProfileCommandServiceOverrides = {},
) {
  const defaults: ClinicPublicProfileCommandServiceOverrides = {
    getClinicPublicProfileByClinicId: async () => ({
      clinic,
      profile,
      search,
    }),
    buildClinicPublicProfileResponse: (input) => ({
      clinicId: input.clinic.id,
      avatarUrl: input.avatarUrl,
      profile: input.profile,
    }),
    evaluateClinicPublicProfilePublication: () =>
      publication,
    minPublicProfileQualityScore: 75,
    patchClinicPublicProfile: async (
      _clinicId,
      input,
    ) => ({
      ...profile,
      ...input,
    }),
    removeClinicPublicAvatar: async () => ({
      previousAvatarStoragePath:
        profile.avatarStoragePath,
      profile: {
        ...profile,
        avatarStoragePath: null,
      },
    }),
    syncClinicPublicSearch: async () => search,
    createSignedStorageUrl: async (storagePath) =>
      `signed:${storagePath}`,
    uploadClinicAvatar: async () =>
      "avatars/37/new.png",
    deleteStorageObject: async () => {},
  };

  return {
    ...defaults,
    ...replacements,
  };
}

test("PATCH respeta profile → preview → patch → sync → signed URL → response", async () => {
  const calls: string[] = [];
  let previewInput: unknown;
  let patchInput: unknown;
  let mapperInput: unknown;

  const result = await patchClinicPublicProfileCommand(
    {
      clinicId: 37,
      clinic,
      body: {
        displayName: " Nombre nuevo ",
        locality: " Córdoba ",
        mapLink: " https://google.com/maps?q=cordoba ",
        isPublic: "true",
      },
    },
    createOverrides({
      getClinicPublicProfileByClinicId: async (
        clinicId,
      ) => {
        calls.push(`profile:${clinicId}`);
        return {
          clinic,
          profile,
          search,
        };
      },
      evaluateClinicPublicProfilePublication:
        (input) => {
          calls.push("preview");
          previewInput = input;
          return publication;
        },
      patchClinicPublicProfile: async (
        clinicId,
        input,
      ) => {
        calls.push(`patch:${clinicId}`);
        patchInput = input;
        return {
          ...profile,
          ...input,
        };
      },
      syncClinicPublicSearch: async (clinicId) => {
        calls.push(`sync:${clinicId}`);
        return search;
      },
      createSignedStorageUrl: async (
        storagePath,
      ) => {
        calls.push(`sign:${storagePath}`);
        return "signed-avatar";
      },
      buildClinicPublicProfileResponse: (input) => {
        calls.push("response");
        mapperInput = input;
        return {
          mapped: true,
        };
      },
    }),
  );

  assert.deepEqual(calls, [
    "profile:37",
    "preview",
    "patch:37",
    "sync:37",
    "sign:avatars/37/previous.png",
    "response",
  ]);
  assert.deepEqual(patchInput, {
    displayName: "Nombre nuevo",
    aboutText: undefined,
    specialtyText: undefined,
    servicesText: undefined,
    email: undefined,
    phone: undefined,
    publicAddress: undefined,
    mapLink: "https://google.com/maps?q=cordoba",
    locality: "Córdoba",
    country: undefined,
    isPublic: true,
  });
  assert.deepEqual(
    (previewInput as { profile: unknown }).profile,
    {
      displayName: "Nombre nuevo",
      avatarStoragePath:
        "avatars/37/previous.png",
      aboutText:
        "Descripción suficientemente extensa del perfil público.",
      specialtyText: "Cardiología",
      servicesText:
        "Consultas y estudios cardiológicos",
      email: "norte@example.test",
      phone: "3410000000",
      publicAddress: "Calle 1",
      locality: "Córdoba",
      mapLink: "https://google.com/maps?q=cordoba",
      country: "AR",
      isPublic: true,
    },
  );
  assert.deepEqual(mapperInput, {
    clinic,
    profile: {
      ...profile,
      ...(patchInput as object),
    },
    avatarUrl: "signed-avatar",
  });
  assert.deepEqual(result, {
    ok: true,
    profile: {
      mapped: true,
    },
    search,
  });
});

test("commands aíslan persistencia publicación búsqueda firma y storage de selectores extranjeros", async () => {
  const clinicIds: number[] = [];
  const publicationAvatarPaths: unknown[] = [];
  const patchInputs: unknown[] = [];
  const uploadedPaths: string[] = [];
  const signedPaths: string[] = [];
  const deletedPaths: string[] = [];
  const overrides = createOverrides({
    getClinicPublicProfileByClinicId: async (
      clinicId,
    ) => {
      clinicIds.push(clinicId);
      return {
        clinic,
        profile,
        search,
      };
    },
    evaluateClinicPublicProfilePublication:
      (input) => {
        publicationAvatarPaths.push(
          input.profile.avatarStoragePath,
        );
        return publication;
      },
    patchClinicPublicProfile: async (
      clinicId,
      input,
    ) => {
      clinicIds.push(clinicId);
      patchInputs.push(input);
      return {
        ...profile,
        ...input,
      };
    },
    removeClinicPublicAvatar: async (
      clinicId,
    ) => {
      clinicIds.push(clinicId);
      return {
        previousAvatarStoragePath:
          profile.avatarStoragePath,
        profile: {
          ...profile,
          avatarStoragePath: null,
        },
      };
    },
    syncClinicPublicSearch: async (clinicId) => {
      clinicIds.push(clinicId);
      return search;
    },
    uploadClinicAvatar: async (input) => {
      clinicIds.push(input.clinicId);
      uploadedPaths.push(
        `avatars/${input.clinicId}/generated.png`,
      );
      return `avatars/${input.clinicId}/generated.png`;
    },
    createSignedStorageUrl: async (storagePath) => {
      signedPaths.push(storagePath);
      return `signed:${storagePath}`;
    },
    deleteStorageObject: async (storagePath) => {
      deletedPaths.push(storagePath);
    },
  });
  const requestDerivedFile = {
    ...avatarFile,
    clinicId: 999,
    avatarStoragePath: "avatars/999/foreign.png",
    storagePath: "avatars/999/foreign.png",
  };
  const requestDerivedDeleteInput = {
    clinicId: 37,
    clinic,
    requestedClinicId: 999,
    avatarStoragePath: "avatars/999/foreign.png",
    storagePath: "avatars/999/foreign.png",
  };

  await patchClinicPublicProfileCommand(
    {
      clinicId: 37,
      clinic,
      body: {
        clinicId: 999,
        avatarStoragePath: "avatars/999/foreign.png",
        storagePath: "avatars/999/foreign.png",
        displayName: "Nombre seguro",
      },
    },
    overrides,
  );
  await uploadClinicPublicAvatarCommand(
    {
      clinicId: 37,
      clinic,
      file: requestDerivedFile,
    },
    overrides,
  );
  await deleteClinicPublicAvatarCommand(
    requestDerivedDeleteInput,
    overrides,
  );

  assert.deepEqual(
    new Set(clinicIds),
    new Set([37]),
  );
  assert.deepEqual(
    publicationAvatarPaths,
    [
      "avatars/37/previous.png",
      null,
    ],
  );
  assert.deepEqual(uploadedPaths, [
    "avatars/37/generated.png",
  ]);
  assert.deepEqual(signedPaths, [
    "avatars/37/previous.png",
    "avatars/37/generated.png",
  ]);
  assert.deepEqual(deletedPaths, [
    "avatars/37/previous.png",
    "avatars/37/previous.png",
  ]);
  assert.equal(
    JSON.stringify(patchInputs).includes("999"),
    false,
  );
  assert.equal(
    JSON.stringify({
      clinicIds,
      publicationAvatarPaths,
      patchInputs,
      uploadedPaths,
      signedPaths,
      deletedPaths,
    }).includes("avatars/999"),
    false,
  );
});

test("PATCH privado incompleto se guarda aunque preview tenga publicationErrors", async () => {
  let patchCalls = 0;

  const result = await patchClinicPublicProfileCommand(
    {
      clinicId: 37,
      clinic,
      body: {
        displayName: "X",
        isPublic: false,
      },
    },
    createOverrides({
      evaluateClinicPublicProfilePublication: () => ({
        ...publication,
        isPublic: false,
        isSearchEligible: false,
        publicationErrors: ["perfil incompleto"],
      }),
      patchClinicPublicProfile: async (
        _clinicId,
        input,
      ) => {
        patchCalls += 1;
        return {
          ...profile,
          ...input,
        };
      },
    }),
  );

  assert.equal(result.ok, true);
  assert.equal(patchCalls, 1);
});

test("PATCH público inválido retorna estado discriminado antes de escribir", async () => {
  let patchCalls = 0;
  let syncCalls = 0;
  const rejectedPublication = {
    ...publication,
    qualityScore: 74,
    isSearchEligible: false,
    publicationErrors: ["calidad insuficiente"],
  };

  const result = await patchClinicPublicProfileCommand(
    {
      clinicId: 37,
      clinic,
      body: {
        isPublic: true,
      },
    },
    createOverrides({
      evaluateClinicPublicProfilePublication: () =>
        rejectedPublication,
      minPublicProfileQualityScore: 75,
      patchClinicPublicProfile: async () => {
        patchCalls += 1;
        return profile;
      },
      syncClinicPublicSearch: async () => {
        syncCalls += 1;
        return search;
      },
    }),
  );

  assert.deepEqual(result, {
    ok: false,
    reason: "publication",
    publication: rejectedPublication,
    minimumQualityScore: 75,
  });
  assert.equal(patchCalls, 0);
  assert.equal(syncCalls, 0);
});

test("PATCH valida después de leer perfil y antes del preview", async () => {
  const calls: string[] = [];

  const result = await patchClinicPublicProfileCommand(
    {
      clinicId: 37,
      clinic,
      body: {
        publicAddress: "<script>",
        mapLink: "not-a-url",
      },
    },
    createOverrides({
      getClinicPublicProfileByClinicId: async () => {
        calls.push("profile");
        return {
          clinic,
          profile,
          search,
        };
      },
      evaluateClinicPublicProfilePublication: () => {
        calls.push("preview");
        return publication;
      },
    }),
  );

  assert.deepEqual(calls, ["profile"]);
  assert.deepEqual(result, {
    ok: false,
    reason: "validation",
    error:
      "La dirección pública no puede contener HTML.",
  });
});

test("PATCH propaga fallo de patch y no ejecuta sync", async () => {
  const expected = new Error("patch failed");
  let syncCalls = 0;

  await assert.rejects(
    () =>
      patchClinicPublicProfileCommand(
        {
          clinicId: 37,
          clinic,
          body: {
            displayName: "Nombre",
          },
        },
        createOverrides({
          patchClinicPublicProfile: async () => {
            throw expected;
          },
          syncClinicPublicSearch: async () => {
            syncCalls += 1;
            return search;
          },
        }),
      ),
    expected,
  );

  assert.equal(syncCalls, 0);
});

test("PATCH propaga fallo de sync después de patch sin compensación", async () => {
  const expected = new Error("sync failed");
  const calls: string[] = [];

  await assert.rejects(
    () =>
      patchClinicPublicProfileCommand(
        {
          clinicId: 37,
          clinic,
          body: {
            displayName: "Nombre",
          },
        },
        createOverrides({
          patchClinicPublicProfile: async () => {
            calls.push("patch");
            return profile;
          },
          syncClinicPublicSearch: async () => {
            calls.push("sync");
            throw expected;
          },
          createSignedStorageUrl: async () => {
            calls.push("sign");
            return "unused";
          },
        }),
      ),
    expected,
  );

  assert.deepEqual(calls, ["patch", "sync"]);
});

test("UPLOAD respeta profile → upload → patch → sync → delete previous → signed URL → response", async () => {
  const calls: string[] = [];
  let uploadInput: unknown;

  const result = await uploadClinicPublicAvatarCommand(
    {
      clinicId: 37,
      clinic,
      file: avatarFile,
    },
    createOverrides({
      getClinicPublicProfileByClinicId: async (
        clinicId,
      ) => {
        calls.push(`profile:${clinicId}`);
        return {
          clinic,
          profile,
          search,
        };
      },
      uploadClinicAvatar: async (input) => {
        calls.push(`upload:${input.clinicId}`);
        uploadInput = input;
        return "avatars/37/new.png";
      },
      patchClinicPublicProfile: async (
        clinicId,
        input,
      ) => {
        calls.push(`patch:${clinicId}`);
        assert.deepEqual(input, {
          avatarStoragePath: "avatars/37/new.png",
        });
        return {
          ...profile,
          ...input,
        };
      },
      syncClinicPublicSearch: async (clinicId) => {
        calls.push(`sync:${clinicId}`);
        return search;
      },
      deleteStorageObject: async (storagePath) => {
        calls.push(`delete:${storagePath}`);
      },
      createSignedStorageUrl: async (
        storagePath,
      ) => {
        calls.push(`sign:${storagePath}`);
        return "signed-new";
      },
      buildClinicPublicProfileResponse: (input) => {
        calls.push("response");
        return {
          mapped: input.avatarUrl,
        };
      },
    }),
  );

  assert.deepEqual(calls, [
    "profile:37",
    "upload:37",
    "patch:37",
    "sync:37",
    "delete:avatars/37/previous.png",
    "sign:avatars/37/new.png",
    "response",
  ]);
  assert.deepEqual(uploadInput, {
    clinicId: 37,
    file: avatarFile.buffer,
    fileName: "avatar.png",
    mimeType: "image/png",
  });
  assert.deepEqual(result, {
    ok: true,
    profile: {
      mapped: "signed-new",
    },
    search,
  });
});

test("UPLOAD sin avatar previo no borra storage", async () => {
  let deleteCalls = 0;

  const result = await uploadClinicPublicAvatarCommand(
    {
      clinicId: 37,
      clinic,
      file: avatarFile,
    },
    createOverrides({
      getClinicPublicProfileByClinicId: async () => ({
        clinic,
        profile: {
          ...profile,
          avatarStoragePath: null,
        },
        search,
      }),
      deleteStorageObject: async () => {
        deleteCalls += 1;
      },
    }),
  );

  assert.equal(result.ok, true);
  assert.equal(deleteCalls, 0);
});

test("UPLOAD con path anterior igual al nuevo no borra storage", async () => {
  let deleteCalls = 0;

  const result = await uploadClinicPublicAvatarCommand(
    {
      clinicId: 37,
      clinic,
      file: avatarFile,
    },
    createOverrides({
      uploadClinicAvatar: async () =>
        profile.avatarStoragePath,
      deleteStorageObject: async () => {
        deleteCalls += 1;
      },
    }),
  );

  assert.equal(result.ok, true);
  assert.equal(deleteCalls, 0);
});

test("UPLOAD devuelve validación discriminada antes de consultar perfil", async () => {
  let profileCalls = 0;

  const result = await uploadClinicPublicAvatarCommand(
    {
      clinicId: 37,
      clinic,
      file: {
        ...avatarFile,
        buffer: buildPngBuffer(159, 159),
      },
    },
    createOverrides({
      getClinicPublicProfileByClinicId: async () => {
        profileCalls += 1;
        return null;
      },
    }),
  );

  assert.deepEqual(result, {
    ok: false,
    reason: "avatar_validation",
    error:
      "La imagen debe tener al menos 160 x 160 px.",
  });
  assert.equal(profileCalls, 0);
});

test("UPLOAD propaga fallo de upload sin patch", async () => {
  const expected = new Error("upload failed");
  let patchCalls = 0;

  await assert.rejects(
    () =>
      uploadClinicPublicAvatarCommand(
        {
          clinicId: 37,
          clinic,
          file: avatarFile,
        },
        createOverrides({
          uploadClinicAvatar: async () => {
            throw expected;
          },
          patchClinicPublicProfile: async () => {
            patchCalls += 1;
            return profile;
          },
        }),
      ),
    expected,
  );

  assert.equal(patchCalls, 0);
});

test("UPLOAD propaga fallo de patch posterior al upload sin cleanup", async () => {
  const expected = new Error("patch failed");
  const calls: string[] = [];

  await assert.rejects(
    () =>
      uploadClinicPublicAvatarCommand(
        {
          clinicId: 37,
          clinic,
          file: avatarFile,
        },
        createOverrides({
          uploadClinicAvatar: async () => {
            calls.push("upload");
            return "avatars/37/new.png";
          },
          patchClinicPublicProfile: async () => {
            calls.push("patch");
            throw expected;
          },
          deleteStorageObject: async () => {
            calls.push("delete");
          },
        }),
      ),
    expected,
  );

  assert.deepEqual(calls, ["upload", "patch"]);
});

test("UPLOAD propaga fallo de sync sin borrar avatar anterior", async () => {
  const expected = new Error("sync failed");
  const calls: string[] = [];

  await assert.rejects(
    () =>
      uploadClinicPublicAvatarCommand(
        {
          clinicId: 37,
          clinic,
          file: avatarFile,
        },
        createOverrides({
          uploadClinicAvatar: async () => {
            calls.push("upload");
            return "avatars/37/new.png";
          },
          patchClinicPublicProfile: async () => {
            calls.push("patch");
            return profile;
          },
          syncClinicPublicSearch: async () => {
            calls.push("sync");
            throw expected;
          },
          deleteStorageObject: async () => {
            calls.push("delete");
          },
        }),
      ),
    expected,
  );

  assert.deepEqual(calls, [
    "upload",
    "patch",
    "sync",
  ]);
});

test("UPLOAD propaga fallo de delete anterior después de DB/search y no firma", async () => {
  const expected = new Error("delete failed");
  const calls: string[] = [];

  await assert.rejects(
    () =>
      uploadClinicPublicAvatarCommand(
        {
          clinicId: 37,
          clinic,
          file: avatarFile,
        },
        createOverrides({
          uploadClinicAvatar: async () => {
            calls.push("upload");
            return "avatars/37/new.png";
          },
          patchClinicPublicProfile: async () => {
            calls.push("patch");
            return profile;
          },
          syncClinicPublicSearch: async () => {
            calls.push("sync");
            return search;
          },
          deleteStorageObject: async () => {
            calls.push("delete");
            throw expected;
          },
          createSignedStorageUrl: async () => {
            calls.push("sign");
            return "unused";
          },
        }),
      ),
    expected,
  );

  assert.deepEqual(calls, [
    "upload",
    "patch",
    "sync",
    "delete",
  ]);
});

test("DELETE sin avatar previo retorna not-found sin preview ni escrituras", async () => {
  const calls: string[] = [];

  const result = await deleteClinicPublicAvatarCommand(
    {
      clinicId: 37,
      clinic,
    },
    createOverrides({
      getClinicPublicProfileByClinicId:
        async (clinicId) => {
          calls.push(`profile:${clinicId}`);
          return {
            clinic,
            profile: {
              ...profile,
              avatarStoragePath: null,
            },
            search,
          };
        },
      evaluateClinicPublicProfilePublication: () => {
        calls.push("preview");
        return publication;
      },
      removeClinicPublicAvatar: async () => {
        calls.push("remove");
        return {
          previousAvatarStoragePath: null,
          profile,
        };
      },
    }),
  );

  assert.deepEqual(calls, ["profile:37"]);
  assert.deepEqual(result, {
    ok: false,
    reason: "avatar_not_found",
  });
});

test("DELETE respeta preview sin avatar → remove → sync → delete storage → response", async () => {
  const calls: string[] = [];
  let previewInput: unknown;

  const result = await deleteClinicPublicAvatarCommand(
    {
      clinicId: 37,
      clinic,
    },
    createOverrides({
      getClinicPublicProfileByClinicId: async () => {
        calls.push("profile");
        return {
          clinic,
          profile,
          search,
        };
      },
      evaluateClinicPublicProfilePublication:
        (input) => {
          calls.push("preview");
          previewInput = input;
          return publication;
        },
      removeClinicPublicAvatar: async (
        clinicId,
      ) => {
        calls.push(`remove:${clinicId}`);
        return {
          previousAvatarStoragePath:
            profile.avatarStoragePath,
          profile: {
            ...profile,
            avatarStoragePath: null,
          },
        };
      },
      syncClinicPublicSearch: async (clinicId) => {
        calls.push(`sync:${clinicId}`);
        return search;
      },
      deleteStorageObject: async (storagePath) => {
        calls.push(`delete:${storagePath}`);
      },
      buildClinicPublicProfileResponse: (input) => {
        calls.push("response");
        assert.equal(input.avatarUrl, null);
        return {
          mapped: true,
        };
      },
    }),
  );

  assert.equal(
    (
      previewInput as {
        profile: {
          avatarStoragePath: string | null;
        };
      }
    ).profile.avatarStoragePath,
    null,
  );
  assert.deepEqual(calls, [
    "profile",
    "preview",
    "remove:37",
    "sync:37",
    "delete:avatars/37/previous.png",
    "response",
  ]);
  assert.deepEqual(result, {
    ok: true,
    profile: {
      mapped: true,
    },
    search,
  });
});

test("DELETE público inválido rechaza antes de remove", async () => {
  let removeCalls = 0;
  const rejectedPublication = {
    ...publication,
    isSearchEligible: false,
    publicationErrors: ["avatar requerido"],
  };

  const result = await deleteClinicPublicAvatarCommand(
    {
      clinicId: 37,
      clinic,
    },
    createOverrides({
      evaluateClinicPublicProfilePublication: () =>
        rejectedPublication,
      removeClinicPublicAvatar: async () => {
        removeCalls += 1;
        return {
          previousAvatarStoragePath: null,
          profile,
        };
      },
    }),
  );

  assert.deepEqual(result, {
    ok: false,
    reason: "publication",
    publication: rejectedPublication,
    minimumQualityScore: 75,
  });
  assert.equal(removeCalls, 0);
});

test("DELETE propaga fallo de remove sin sync", async () => {
  const expected = new Error("remove failed");
  let syncCalls = 0;

  await assert.rejects(
    () =>
      deleteClinicPublicAvatarCommand(
        {
          clinicId: 37,
          clinic,
        },
        createOverrides({
          removeClinicPublicAvatar: async () => {
            throw expected;
          },
          syncClinicPublicSearch: async () => {
            syncCalls += 1;
            return search;
          },
        }),
      ),
    expected,
  );

  assert.equal(syncCalls, 0);
});

test("DELETE propaga fallo de sync después de remove sin compensación", async () => {
  const expected = new Error("sync failed");
  const calls: string[] = [];

  await assert.rejects(
    () =>
      deleteClinicPublicAvatarCommand(
        {
          clinicId: 37,
          clinic,
        },
        createOverrides({
          removeClinicPublicAvatar: async () => {
            calls.push("remove");
            return {
              previousAvatarStoragePath:
                profile.avatarStoragePath,
              profile,
            };
          },
          syncClinicPublicSearch: async () => {
            calls.push("sync");
            throw expected;
          },
          deleteStorageObject: async () => {
            calls.push("delete");
          },
        }),
      ),
    expected,
  );

  assert.deepEqual(calls, ["remove", "sync"]);
});

test("DELETE propaga fallo de storage después de remove y sync", async () => {
  const expected = new Error("storage failed");
  const calls: string[] = [];

  await assert.rejects(
    () =>
      deleteClinicPublicAvatarCommand(
        {
          clinicId: 37,
          clinic,
        },
        createOverrides({
          removeClinicPublicAvatar: async () => {
            calls.push("remove");
            return {
              previousAvatarStoragePath:
                profile.avatarStoragePath,
              profile,
            };
          },
          syncClinicPublicSearch: async () => {
            calls.push("sync");
            return search;
          },
          deleteStorageObject: async () => {
            calls.push("delete");
            throw expected;
          },
          buildClinicPublicProfileResponse: () => {
            calls.push("response");
            return {};
          },
        }),
      ),
    expected,
  );

  assert.deepEqual(calls, [
    "remove",
    "sync",
    "delete",
  ]);
});
