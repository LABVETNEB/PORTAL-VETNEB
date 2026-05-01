import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { ENV } = await import("../server/lib/env.ts");
const {
  clinicPublicProfileNativeRoutes,
} = await import("../server/routes/clinic-public-profile.fastify.ts");

function createClinic() {
  return {
    id: 3,
    name: "Clinica Centro",
    contactEmail: "clinic@example.com",
    contactPhone: "3410000000",
  };
}

function createProfile(overrides: Record<string, unknown> = {}) {
  return {
    clinicId: 3,
    displayName: "Clinica Centro",
    avatarStoragePath: "avatars/3/avatar.png",
    aboutText: "Perfil público",
    specialtyText: "Cardiología",
    servicesText: "Consultas y estudios",
    email: "clinic@example.com",
    phone: "3410000000",
    locality: "Rosario",
    country: "AR",
    isPublic: true,
    createdAt: new Date("2026-04-20T12:00:00.000Z"),
    updatedAt: new Date("2026-04-22T12:00:00.000Z"),
    ...overrides,
  };
}

function createSearch(overrides: Record<string, unknown> = {}) {
  return {
    clinicId: 3,
    isPublic: true,
    hasRequiredPublicFields: true,
    isSearchEligible: true,
    profileQualityScore: 80,
    updatedAt: new Date("2026-04-22T12:00:00.000Z"),
    searchText: "clinica centro cardiologia rosario",
    ...overrides,
  };
}

function createAuthStubs(overrides: Record<string, unknown> = {}) {
  return {
    deleteActiveSession: async () => {},
    getActiveSessionByToken: async () => ({
      clinicUserId: 9,
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      lastAccess: new Date("2026-04-23T00:00:00.000Z"),
    }),
    getClinicUserById: async () => ({
      id: 9,
      clinicId: 3,
      username: "doctor",
      authProId: null,
      role: "clinic_owner",
    }),
    updateSessionLastAccess: async () => {},
    hashSessionToken: (token: string) => `hash:${token}`,
    ...overrides,
  };
}

async function createTestApp(overrides: Record<string, unknown> = {}) {
  const app = Fastify();

  await app.register(clinicPublicProfileNativeRoutes as any, {
    prefix: "/api/clinic/profile",
    ...createAuthStubs(),
    getClinicById: async () => createClinic(),
    getClinicPublicProfileByClinicId: async () => ({
      clinic: createClinic(),
      profile: createProfile(),
      search: createSearch(),
    }),
    buildClinicPublicProfileResponse: (input: {
      clinic: Record<string, unknown>;
      profile: Record<string, unknown> | null;
      avatarUrl: string | null;
    }) => ({
      clinicId: input.clinic.id,
      clinicName: input.clinic.name,
      avatarUrl: input.avatarUrl,
      displayName: input.profile?.displayName ?? null,
      isPublic: input.profile?.isPublic ?? false,
    }),
    evaluateClinicPublicProfilePublication: () => ({
      isPublic: false,
      hasRequiredPublicFields: true,
      hasQualitySupplement: true,
      qualityScore: 80,
      isSearchEligible: true,
      missingRequiredFields: [],
      missingRecommendedFields: [],
      publicationErrors: [],
    }),
    minPublicProfileQualityScore: 60,
    patchClinicPublicProfile: async () => createProfile(),
    removeClinicPublicAvatar: async () => ({
      previousAvatarStoragePath: "avatars/3/avatar.png",
      profile: createProfile({ avatarStoragePath: null }),
    }),
    syncClinicPublicSearch: async () => createSearch(),
    createSignedStorageUrl: async (storagePath: string) => `signed:${storagePath}`,
    uploadClinicAvatar: async () => "avatars/3/avatar-new.png",
    deleteStorageObject: async () => {},
    ...overrides,
  });

  return app;
}

function buildMultipartAvatarPayload() {
  const boundary = "----vetneb-boundary";
  const chunks = [
    `--${boundary}\r\n`,
    'Content-Disposition: form-data; name="avatar"; filename="avatar.png"\r\n',
    "Content-Type: image/png\r\n\r\n",
    "PNGDATA",
    `\r\n--${boundary}--\r\n`,
  ];

  return {
    boundary,
    payload: Buffer.from(chunks.join(""), "utf8"),
  };
}

test(
  "clinicPublicProfileNativeRoutes expone GET / con payload estable y avatar firmado",
  async () => {
    const app = await createTestApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/clinic/profile",
        headers: {
          origin: "http://localhost:3000",
          cookie: `${ENV.cookieName}=session-token`,
        },
      });

      assert.equal(response.statusCode, 200);
      assert.equal(
        response.headers["access-control-allow-origin"],
        "http://localhost:3000",
      );

      assert.deepEqual(JSON.parse(response.body), {
        success: true,
        profile: {
          clinicId: 3,
          clinicName: "Clinica Centro",
          avatarUrl: "signed:avatars/3/avatar.png",
          displayName: "Clinica Centro",
          isPublic: true,
        },
        search: {
          clinicId: 3,
          isPublic: true,
          hasRequiredPublicFields: true,
          isSearchEligible: true,
          profileQualityScore: 80,
          updatedAt: "2026-04-22T12:00:00.000Z",
          searchText: "clinica centro cardiologia rosario",
        },
      });
    } finally {
      await app.close();
    }
  },
);

test(
  "clinicPublicProfileNativeRoutes actualiza PATCH / con management permission",
  async () => {
    const patchCalls: Array<Record<string, unknown>> = [];

    const app = await createTestApp({
      patchClinicPublicProfile: async (
        clinicId: number,
        input: Record<string, unknown>,
      ) => {
        assert.equal(clinicId, 3);
        patchCalls.push(input);

        return createProfile({
          displayName: "Nuevo nombre",
          locality: "Rosario",
          isPublic: false,
        });
      },
    });

    try {
      const response = await app.inject({
        method: "PATCH",
        url: "/api/clinic/profile",
        headers: {
          origin: "http://localhost:3000",
          cookie: `${ENV.cookieName}=session-token`,
          "content-type": "application/json",
        },
        payload: {
          displayName: " Nuevo nombre ",
          locality: " Rosario ",
          isPublic: "false",
        },
      });

      assert.equal(response.statusCode, 200);
      assert.equal(patchCalls.length, 1);
      assert.deepEqual(patchCalls[0], {
        displayName: "Nuevo nombre",
        aboutText: undefined,
        specialtyText: undefined,
        servicesText: undefined,
        email: undefined,
        phone: undefined,
        locality: "Rosario",
        country: undefined,
        isPublic: false,
      });

      assert.deepEqual(JSON.parse(response.body), {
        success: true,
        message: "Perfil publico actualizado correctamente",
        profile: {
          clinicId: 3,
          clinicName: "Clinica Centro",
          avatarUrl: "signed:avatars/3/avatar.png",
          displayName: "Nuevo nombre",
          isPublic: false,
        },
        search: {
          clinicId: 3,
          isPublic: true,
          hasRequiredPublicFields: true,
          isSearchEligible: true,
          profileQualityScore: 80,
          updatedAt: "2026-04-22T12:00:00.000Z",
          searchText: "clinica centro cardiologia rosario",
        },
      });
    } finally {
      await app.close();
    }
  },
);

test(
  "clinicPublicProfileNativeRoutes bloquea PATCH / sin management permission",
  async () => {
    const app = await createTestApp({
      getClinicUserById: async () => ({
        id: 9,
        clinicId: 3,
        username: "staff",
        authProId: null,
        role: "clinic_staff",
      }),
    });

    try {
      const response = await app.inject({
        method: "PATCH",
        url: "/api/clinic/profile",
        headers: {
          origin: "http://localhost:3000",
          cookie: `${ENV.cookieName}=session-token`,
          "content-type": "application/json",
        },
        payload: {
          displayName: "Nuevo nombre",
        },
      });

      assert.equal(response.statusCode, 403);
      assert.deepEqual(JSON.parse(response.body), {
        success: false,
        error: "No autorizado para administrar recursos de la clinica",
      });
    } finally {
      await app.close();
    }
  },
);

test(
  "clinicPublicProfileNativeRoutes actualiza POST /avatar con upload y reemplazo de avatar previo",
  async () => {
    const uploadCalls: Array<Record<string, unknown>> = [];
    const deleteCalls: string[] = [];
    const multipart = buildMultipartAvatarPayload();

    const app = await createTestApp({
      uploadClinicAvatar: async (input: {
        clinicId: number;
        file: Buffer;
        fileName: string;
        mimeType: string;
      }) => {
        uploadCalls.push({
          clinicId: input.clinicId,
          fileName: input.fileName,
          mimeType: input.mimeType,
          file: input.file.toString("utf8"),
        });

        return "avatars/3/avatar-new.png";
      },
      patchClinicPublicProfile: async () =>
        createProfile({ avatarStoragePath: "avatars/3/avatar-new.png" }),
      deleteStorageObject: async (storagePath: string) => {
        deleteCalls.push(storagePath);
      },
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/api/clinic/profile/avatar",
        headers: {
          origin: "http://localhost:3000",
          cookie: `${ENV.cookieName}=session-token`,
          "content-type": `multipart/form-data; boundary=${multipart.boundary}`,
        },
        payload: multipart.payload,
      });

      assert.equal(response.statusCode, 201);
      assert.equal(uploadCalls.length, 1);
      assert.equal(uploadCalls[0].clinicId, 3);
      assert.equal(uploadCalls[0].fileName, "avatar.png");
      assert.equal(uploadCalls[0].mimeType, "image/png");
      assert.equal(uploadCalls[0].file, "PNGDATA");
      assert.deepEqual(deleteCalls, ["avatars/3/avatar.png"]);

      assert.deepEqual(JSON.parse(response.body), {
        success: true,
        message: "Avatar actualizado correctamente",
        profile: {
          clinicId: 3,
          clinicName: "Clinica Centro",
          avatarUrl: "signed:avatars/3/avatar-new.png",
          displayName: "Clinica Centro",
          isPublic: true,
        },
        search: {
          clinicId: 3,
          isPublic: true,
          hasRequiredPublicFields: true,
          isSearchEligible: true,
          profileQualityScore: 80,
          updatedAt: "2026-04-22T12:00:00.000Z",
          searchText: "clinica centro cardiologia rosario",
        },
      });
    } finally {
      await app.close();
    }
  },
);

test(
  "clinicPublicProfileNativeRoutes elimina DELETE /avatar cuando el perfil lo permite",
  async () => {
    const deleteCalls: string[] = [];

    const app = await createTestApp({
      deleteStorageObject: async (storagePath: string) => {
        deleteCalls.push(storagePath);
      },
    });

    try {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/clinic/profile/avatar",
        headers: {
          origin: "http://localhost:3000",
          cookie: `${ENV.cookieName}=session-token`,
        },
      });

      assert.equal(response.statusCode, 200);
      assert.deepEqual(deleteCalls, ["avatars/3/avatar.png"]);

      assert.deepEqual(JSON.parse(response.body), {
        success: true,
        message: "Avatar eliminado correctamente",
        profile: {
          clinicId: 3,
          clinicName: "Clinica Centro",
          avatarUrl: null,
          displayName: "Clinica Centro",
          isPublic: true,
        },
        search: {
          clinicId: 3,
          isPublic: true,
          hasRequiredPublicFields: true,
          isSearchEligible: true,
          profileQualityScore: 80,
          updatedAt: "2026-04-22T12:00:00.000Z",
          searchText: "clinica centro cardiologia rosario",
        },
      });
    } finally {
      await app.close();
    }
  },
);
