import test from "node:test";
import assert from "node:assert/strict";
import express from "express";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { ENV } = await import("../server/lib/env.ts");
const { createFastifyApp } = await import("../server/fastify-app.ts");

function buildAdminAuditRouteStubs() {
  return {
    deleteAdminSession: async () => {},
    getAdminSessionByToken: async () => null,
    getAdminUserById: async () => null,
    updateAdminSessionLastAccess: async () => {},
    hashSessionToken: (token: string) => `hash:${token}`,
    listAuditLog: async () => ({
      items: [],
      total: 0,
    }),
    buildAdminAuditListFilters: (_query: Record<string, unknown>) => ({
      filters: {
        limit: 50,
        offset: 0,
      },
      errors: [],
    }),
    buildAdminAuditCsv: () => "id,event",
    buildAdminAuditCsvFilename: () => "admin-audit-log-test.csv",
  };
}

function buildAdminAuthRouteStubs() {
  return {
    createAdminSession: async () => {},
    deleteAdminSession: async () => {},
    getAdminSessionByToken: async () => null,
    getAdminUserById: async () => null,
    getAdminUserByUsername: async () => null,
    updateAdminSessionLastAccess: async () => {},
    generateSessionToken: () => "admin-session-token",
    hashSessionToken: (token: string) => `hash:${token}`,
    verifyPassword: async () => ({
      valid: false,
      needsRehash: false,
    }),
    writeAuditLog: async () => {},
  };
}


function buildAdminReportAccessTokensRouteStubs() {
  return {
    deleteAdminSession: async () => {},
    getAdminSessionByToken: async () => null,
    getAdminUserById: async () => null,
    updateAdminSessionLastAccess: async () => {},
    generateSessionToken: () => "a".repeat(64),
    hashSessionToken: (token: string) => `hash:${token}`,
    getClinicById: async () => null,
    getReportById: async () => null,
    createReportAccessToken: async () => ({
      id: 9,
      clinicId: 3,
      reportId: 55,
      tokenHash: `hash:${"a".repeat(64)}`,
      tokenLast4: "aaaa",
      accessCount: 0,
      lastAccessAt: null,
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      revokedAt: null,
      createdAt: new Date("2026-04-20T12:00:00.000Z"),
      updatedAt: new Date("2026-04-22T12:00:00.000Z"),
      createdByClinicUserId: null,
      createdByAdminUserId: 1,
      revokedByClinicUserId: null,
      revokedByAdminUserId: null,
    }),
    getReportAccessTokenById: async () => null,
    listReportAccessTokens: async () => [],
    revokeReportAccessToken: async () => null,
    writeAuditLog: async () => {},
  };
}
function buildClinicAuthRouteStubs() {
  return {
    createActiveSession: async () => {},
    deleteActiveSession: async () => {},
    getActiveSessionByToken: async () => null,
    getClinicUserById: async () => null,
    getClinicUserByUsername: async () => null,
    updateSessionLastAccess: async () => {},
    upsertClinicUser: async () => {},
    generateSessionToken: () => "session-token",
    hashPassword: async () => "rehash-password",
    hashSessionToken: (token: string) => `hash:${token}`,
    verifyPassword: async () => ({
      valid: false,
      needsRehash: false,
    }),
    writeAuditLog: async () => {},
  };
}

function buildClinicAuditRouteStubs() {
  return {
    deleteActiveSession: async () => {},
    getActiveSessionByToken: async () => null,
    getClinicUserById: async () => null,
    updateSessionLastAccess: async () => {},
    hashSessionToken: (token: string) => `hash:${token}`,
    listAuditLog: async () => ({
      items: [],
      total: 0,
    }),
    buildClinicAuditListFilters: (
      _query: Record<string, unknown>,
      clinicId: number,
    ) => ({
      filters: {
        clinicId,
        limit: 50,
        offset: 0,
      },
      errors: [],
    }),
    buildAdminAuditCsv: () => "id,event",
  };
}

function buildClinicPublicProfileRouteStubs() {
  return {
    deleteActiveSession: async () => {},
    getActiveSessionByToken: async () => null,
    getClinicUserById: async () => null,
    updateSessionLastAccess: async () => {},
    hashSessionToken: (token: string) => `hash:${token}`,
    getClinicById: async () => null,
    getClinicPublicProfileByClinicId: async () => null,
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
    patchClinicPublicProfile: async () => ({
      clinicId: 3,
      displayName: "Clinica Centro",
      avatarStoragePath: "avatars/3/avatar.png",
      isPublic: true,
    }),
    removeClinicPublicAvatar: async () => ({
      previousAvatarStoragePath: "avatars/3/avatar.png",
      profile: {
        clinicId: 3,
        displayName: "Clinica Centro",
        avatarStoragePath: null,
        isPublic: true,
      },
    }),
    syncClinicPublicSearch: async () => ({
      clinicId: 3,
      isPublic: true,
      hasRequiredPublicFields: true,
      isSearchEligible: true,
      profileQualityScore: 80,
      updatedAt: new Date("2026-04-22T12:00:00.000Z"),
      searchText: "clinica centro",
    }),
    createSignedStorageUrl: async (storagePath: string) => `signed:${storagePath}`,
    uploadClinicAvatar: async () => "avatars/3/avatar-new.png",
    deleteStorageObject: async () => {},
  };
}

function buildParticularAuthRouteStubs() {
  return {
    createParticularSession: async () => {},
    deleteParticularSession: async () => {},
    getParticularSessionByToken: async () => null,
    getParticularTokenById: async () => null,
    getParticularTokenByTokenHash: async () => null,
    updateParticularSessionLastAccess: async () => {},
    updateParticularTokenLastLogin: async () => {},
    getReportById: async () => null,
    createSignedReportUrl: async (storagePath: string) => `signed-preview:${storagePath}`,
    createSignedReportDownloadUrl: async (
      storagePath: string,
      fileName?: string,
    ) => `signed-download:${storagePath}:${fileName ?? ""}`,
    generateSessionToken: () => "particular-session-token",
    hashSessionToken: (token: string) => `hash:${token}`,
  };
}

function buildPublicReportAccessRouteStubs() {
  return {
    getReportAccessTokenWithReportByTokenHash: async () => null,
    recordReportAccessTokenAccess: async () => null,
    createSignedReportUrl: async (storagePath: string) => `signed-preview:${storagePath}`,
    createSignedReportDownloadUrl: async (
      storagePath: string,
      fileName?: string,
    ) => `signed-download:${storagePath}:${fileName ?? ""}`,
    hashSessionToken: (token: string) => `hash:${token}`,
    writeAuditLog: async () => {},
  };
}

function buildReportAccessTokensRouteStubs() {
  return {
    deleteActiveSession: async () => {},
    getActiveSessionByToken: async () => null,
    getClinicUserById: async () => null,
    updateSessionLastAccess: async () => {},
    generateSessionToken: () => "a".repeat(64),
    hashPassword: async () => "unused",
    hashSessionToken: (token: string) => `hash:${token}`,
    verifyPassword: async () => ({
      valid: false,
      needsRehash: false,
    }),
    getReportById: async () => null,
    createReportAccessToken: async () => ({
      id: 9,
      clinicId: 3,
      reportId: 55,
      tokenHash: `hash:${"a".repeat(64)}`,
      tokenLast4: "aaaa",
      accessCount: 0,
      lastAccessAt: null,
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      revokedAt: null,
      createdAt: new Date("2026-04-20T12:00:00.000Z"),
      updatedAt: new Date("2026-04-22T12:00:00.000Z"),
      createdByClinicUserId: 9,
      createdByAdminUserId: null,
      revokedByClinicUserId: null,
      revokedByAdminUserId: null,
    }),
    getClinicScopedReportAccessToken: async () => null,
    listReportAccessTokens: async () => [],
    revokeReportAccessToken: async () => null,
    writeAuditLog: async () => {},
  };
}

test(
  "createFastifyApp expone root y health nativos y mantiene el bridge Express bajo /api",
  async () => {
    const app = await createFastifyApp({
      createLegacyApp: () => {
        const legacyApp = express();

        legacyApp.get("/bridge", (_req, res) => {
          res.setHeader("x-legacy-bridge", "ok");
          res.status(204).end();
        });

        return legacyApp as any;
      },
      getServiceInfoPayload: () => ({
        success: true,
        service: "portal-vetneb-api",
        environment: "test",
      }),
      getNativeHealthCheckResponse: async () => ({
        statusCode: 200,
        payload: {
          success: true,
          status: "ok",
          checks: {
            database: "up",
            storage: "up",
          },
          uptimeSeconds: 123,
          responseTimeMs: 1,
          timestamp: "2026-04-22T00:00:00.000Z",
        },
      }),
      adminAuditRoutes: buildAdminAuditRouteStubs(),
      adminAuthRoutes: buildAdminAuthRouteStubs(),
      adminReportAccessTokensRoutes: buildAdminReportAccessTokensRouteStubs(),
      clinicAuthRoutes: buildClinicAuthRouteStubs(),
      clinicAuditRoutes: buildClinicAuditRouteStubs(),
      clinicPublicProfileRoutes: buildClinicPublicProfileRouteStubs(),
      particularAuthRoutes: buildParticularAuthRouteStubs(),
      publicProfessionalsRoutes: {
        searchPublicProfessionals: async () => ({
          rows: [],
          total: 0,
          limit: 20,
          offset: 0,
        }),
        getPublicProfessionalByClinicId: async () => null,
        createSignedStorageUrl: async (path: string) => `signed:${path}`,
      },
      publicReportAccessRoutes: buildPublicReportAccessRouteStubs(),
      reportAccessTokensRoutes: buildReportAccessTokensRouteStubs(),
    });

    try {
      const rootResponse = await app.inject({
        method: "GET",
        url: "/",
      });

      assert.equal(rootResponse.statusCode, 200);

      const healthResponse = await app.inject({
        method: "GET",
        url: "/health",
      });
      assert.equal(healthResponse.statusCode, 200);
      assert.equal(healthResponse.headers["x-legacy-bridge"], undefined);

      const apiHealthResponse = await app.inject({
        method: "GET",
        url: "/api/health",
      });

      assert.equal(apiHealthResponse.statusCode, 200);
      assert.equal(apiHealthResponse.headers["x-legacy-bridge"], undefined);

      const legacyResponse = await app.inject({
        method: "GET",
        url: "/api/bridge",
      });

      assert.equal(legacyResponse.statusCode, 204);
      assert.equal(legacyResponse.headers["x-legacy-bridge"], "ok");
      assert.equal(legacyResponse.body, "");
    } finally {
      await app.close();
    }
  },
);

test(
  "createFastifyApp despacha /api/admin/audit-log al router nativo antes del bridge Express",
  async () => {
    const app = await createFastifyApp({
      createLegacyApp: () => {
        const legacyApp = express();

        legacyApp.get("/admin/audit-log", (_req, res) => {
          res.setHeader("x-legacy-bridge", "should-not-run");
          res.status(418).json({
            success: false,
          });
        });

        return legacyApp as any;
      },
      adminAuditRoutes: {
        ...buildAdminAuditRouteStubs(),
        getAdminSessionByToken: async () => ({
          adminUserId: 1,
          expiresAt: new Date("2026-05-01T00:00:00.000Z"),
          lastAccess: new Date("2026-04-23T00:00:00.000Z"),
        }),
        getAdminUserById: async () => ({
          id: 1,
          username: "ADMIN",
        }),
        listAuditLog: async () => ({
          items: [
            {
              id: 201,
              event: "auth.admin.login.succeeded",
              action: "auth.admin.login.succeeded",
              entity: "admin_user",
              entityId: 1,
              actorType: "admin_user",
              actorAdminUserId: 1,
              actorClinicUserId: null,
              actorReportAccessTokenId: null,
              clinicId: 3,
              reportId: null,
              targetAdminUserId: 1,
              targetClinicUserId: null,
              targetReportAccessTokenId: null,
              requestId: "req-admin-1",
              requestMethod: "POST",
              requestPath: "/api/admin/auth/login",
              ipAddress: "127.0.0.1",
              userAgent: "test-agent",
              metadata: {
                username: "ADMIN",
              },
              createdAt: new Date("2026-04-24T00:00:00.000Z"),
            },
          ],
          total: 1,
        }),
        buildAdminAuditListFilters: (_query: Record<string, unknown>) => ({
          filters: {
            limit: 50,
            offset: 0,
          },
          errors: [],
        }),
      },
      adminAuthRoutes: buildAdminAuthRouteStubs(),
      adminReportAccessTokensRoutes: buildAdminReportAccessTokensRouteStubs(),
      clinicAuthRoutes: buildClinicAuthRouteStubs(),
      clinicAuditRoutes: buildClinicAuditRouteStubs(),
      clinicPublicProfileRoutes: buildClinicPublicProfileRouteStubs(),
      particularAuthRoutes: buildParticularAuthRouteStubs(),
      publicProfessionalsRoutes: {
        searchPublicProfessionals: async () => ({
          rows: [],
          total: 0,
          limit: 20,
          offset: 0,
        }),
        getPublicProfessionalByClinicId: async () => null,
        createSignedStorageUrl: async (path: string) => `signed:${path}`,
      },
      publicReportAccessRoutes: buildPublicReportAccessRouteStubs(),
      reportAccessTokensRoutes: buildReportAccessTokensRouteStubs(),
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/admin/audit-log",
        headers: {
          cookie: `${ENV.adminCookieName}=admin-session-token`,
        },
      });

      assert.equal(response.headers["x-legacy-bridge"], undefined);
      assert.notEqual(response.statusCode, 418);
      assert.ok([200, 401].includes(response.statusCode));

      if (response.statusCode === 200 && response.body) {
        const body = JSON.parse(response.body);
        assert.equal(body.success, true);
        assert.equal(body.count, 1);
        assert.equal(body.pagination.total, 1);
      }
    } finally {
      await app.close();
    }
  },
);

test(
  "createFastifyApp despacha /api/admin/auth al router nativo antes del bridge Express",
  async () => {
    const app = await createFastifyApp({
      createLegacyApp: () => {
        const legacyApp = express();

        legacyApp.get("/admin/auth/me", (_req, res) => {
          res.setHeader("x-legacy-bridge", "should-not-run");
          res.status(418).json({
            success: false,
          });
        });

        return legacyApp as any;
      },
      adminAuditRoutes: buildAdminAuditRouteStubs(),
      adminAuthRoutes: {
        ...buildAdminAuthRouteStubs(),
        getAdminSessionByToken: async () => ({
          adminUserId: 7,
          expiresAt: new Date(Date.UTC(2026, 3, 24, 1, 0, 0)),
          lastAccess: new Date(Date.UTC(2026, 3, 23, 23, 0, 0)),
        }),
        getAdminUserById: async () => ({
          id: 7,
          username: "ADMIN",
        }),
        updateAdminSessionLastAccess: async () => {},
      },
      adminReportAccessTokensRoutes: buildAdminReportAccessTokensRouteStubs(),
      clinicAuthRoutes: buildClinicAuthRouteStubs(),
      clinicAuditRoutes: buildClinicAuditRouteStubs(),
      clinicPublicProfileRoutes: buildClinicPublicProfileRouteStubs(),
      particularAuthRoutes: buildParticularAuthRouteStubs(),
      publicProfessionalsRoutes: {
        searchPublicProfessionals: async () => ({
          rows: [],
          total: 0,
          limit: 20,
          offset: 0,
        }),
        getPublicProfessionalByClinicId: async () => null,
        createSignedStorageUrl: async (path: string) => `signed:${path}`,
      },
      publicReportAccessRoutes: buildPublicReportAccessRouteStubs(),
      reportAccessTokensRoutes: buildReportAccessTokensRouteStubs(),
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/admin/auth/me",
        headers: {
          cookie: `${ENV.adminCookieName}=admin-session-token`,
        },
      });

      assert.equal(response.headers["x-legacy-bridge"], undefined);
      assert.notEqual(response.statusCode, 418);
      assert.ok([200, 401].includes(response.statusCode));

      if (response.statusCode === 200) {
        assert.deepEqual(JSON.parse(response.body), {
          success: true,
          admin: {
            id: 7,
            username: "ADMIN",
          },
        });
      }
    } finally {
      await app.close();
    }
  },
);

test(
  "createFastifyApp despacha /api/auth al router nativo antes del bridge Express",
  async () => {
    const app = await createFastifyApp({
      createLegacyApp: () => {
        const legacyApp = express();

        legacyApp.get("/auth/me", (_req, res) => {
          res.setHeader("x-legacy-bridge", "should-not-run");
          res.status(418).json({
            success: false,
          });
        });

        return legacyApp as any;
      },
      adminAuditRoutes: buildAdminAuditRouteStubs(),
      adminAuthRoutes: buildAdminAuthRouteStubs(),
      adminReportAccessTokensRoutes: buildAdminReportAccessTokensRouteStubs(),
      clinicAuthRoutes: {
        ...buildClinicAuthRouteStubs(),
        getActiveSessionByToken: async () => ({
          clinicUserId: 9,
          expiresAt: new Date(Date.UTC(2026, 3, 23, 1, 0, 0)),
        }),
        getClinicUserById: async () => ({
          id: 9,
          clinicId: 5,
          username: "doctor",
          authProId: null,
          role: "clinic_staff",
        }),
        updateSessionLastAccess: async () => {},
      },
      clinicAuditRoutes: buildClinicAuditRouteStubs(),
      clinicPublicProfileRoutes: buildClinicPublicProfileRouteStubs(),
      particularAuthRoutes: buildParticularAuthRouteStubs(),
      publicProfessionalsRoutes: {
        searchPublicProfessionals: async () => ({
          rows: [],
          total: 0,
          limit: 20,
          offset: 0,
        }),
        getPublicProfessionalByClinicId: async () => null,
        createSignedStorageUrl: async (path: string) => `signed:${path}`,
      },
      publicReportAccessRoutes: buildPublicReportAccessRouteStubs(),
      reportAccessTokensRoutes: buildReportAccessTokensRouteStubs(),
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: {
          cookie: `${ENV.cookieName}=session-token`,
        },
      });

      assert.equal(response.headers["x-legacy-bridge"], undefined);
      assert.notEqual(response.statusCode, 418);
      assert.ok([200, 401].includes(response.statusCode));

      if (response.statusCode === 200) {
        assert.deepEqual(JSON.parse(response.body), {
          success: true,
          clinicUser: {
            id: 9,
            clinicId: 5,
            username: "doctor",
            authProId: null,
            role: "clinic_staff",
          },
          permissions: {
            canManageClinicUsers: false,
            canUploadReports: true,
          },
        });
      }
    } finally {
      await app.close();
    }
  },
);

test(
  "createFastifyApp despacha /api/clinic/audit-log al router nativo antes del bridge Express",
  async () => {
    const app = await createFastifyApp({
      createLegacyApp: () => {
        const legacyApp = express();

        legacyApp.get("/clinic/audit-log", (_req, res) => {
          res.setHeader("x-legacy-bridge", "should-not-run");
          res.status(418).json({
            success: false,
          });
        });

        return legacyApp as any;
      },
      adminAuditRoutes: buildAdminAuditRouteStubs(),
      adminAuthRoutes: buildAdminAuthRouteStubs(),
      adminReportAccessTokensRoutes: buildAdminReportAccessTokensRouteStubs(),
      clinicAuthRoutes: buildClinicAuthRouteStubs(),
      clinicAuditRoutes: {
        ...buildClinicAuditRouteStubs(),
        getActiveSessionByToken: async () => ({
          clinicUserId: 9,
          expiresAt: new Date("2026-05-01T00:00:00.000Z"),
          lastAccess: new Date("2026-04-23T00:00:00.000Z"),
        }),
        getClinicUserById: async () => ({
          id: 9,
          clinicId: 3,
          username: "doctor",
          authProId: null,
          role: "clinic_owner",
        }),
        listAuditLog: async () => ({
          items: [
            {
              id: 101,
              event: "report.public_accessed",
              action: "report.public_accessed",
              entity: "report_access_token",
              entityId: 55,
              actorType: "public_report_access_token",
              actorAdminUserId: null,
              actorClinicUserId: null,
              actorReportAccessTokenId: 9,
              clinicId: 3,
              reportId: 55,
              targetAdminUserId: null,
              targetClinicUserId: null,
              targetReportAccessTokenId: 9,
              requestId: "req-1",
              requestMethod: "GET",
              requestPath: "/api/public/report-access/[REDACTED]",
              ipAddress: "127.0.0.1",
              userAgent: "test-agent",
              metadata: { tokenLast4: "ABCD" },
              createdAt: new Date("2026-04-24T00:00:00.000Z"),
            },
          ],
          total: 1,
        }),
        buildClinicAuditListFilters: (
          _query: Record<string, unknown>,
          clinicId: number,
        ) => ({
          filters: {
            clinicId,
            limit: 50,
            offset: 0,
          },
          errors: [],
        }),
      },
      clinicPublicProfileRoutes: buildClinicPublicProfileRouteStubs(),
      particularAuthRoutes: buildParticularAuthRouteStubs(),
      publicProfessionalsRoutes: {
        searchPublicProfessionals: async () => ({
          rows: [],
          total: 0,
          limit: 20,
          offset: 0,
        }),
        getPublicProfessionalByClinicId: async () => null,
        createSignedStorageUrl: async (path: string) => `signed:${path}`,
      },
      publicReportAccessRoutes: buildPublicReportAccessRouteStubs(),
      reportAccessTokensRoutes: buildReportAccessTokensRouteStubs(),
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/clinic/audit-log",
        headers: {
          cookie: `${ENV.cookieName}=session-token`,
        },
      });

      assert.equal(response.headers["x-legacy-bridge"], undefined);
      assert.notEqual(response.statusCode, 418);
      assert.ok([200, 401].includes(response.statusCode));

      if (response.statusCode === 200 && response.body) {
        const body = JSON.parse(response.body);
        assert.equal(body.success, true);
        assert.equal(body.count, 1);
        assert.equal(body.pagination.total, 1);
        assert.equal(body.filters.clinicId, 3);
      }
    } finally {
      await app.close();
    }
  },
);

test(
  "createFastifyApp despacha /api/clinic/profile al router nativo antes del bridge Express",
  async () => {
    const app = await createFastifyApp({
      createLegacyApp: () => {
        const legacyApp = express();

        legacyApp.get("/clinic/profile", (_req, res) => {
          res.setHeader("x-legacy-bridge", "should-not-run");
          res.status(418).json({
            success: false,
          });
        });

        return legacyApp as any;
      },
      adminAuditRoutes: buildAdminAuditRouteStubs(),
      adminAuthRoutes: buildAdminAuthRouteStubs(),
      adminReportAccessTokensRoutes: buildAdminReportAccessTokensRouteStubs(),
      clinicAuthRoutes: buildClinicAuthRouteStubs(),
      clinicAuditRoutes: buildClinicAuditRouteStubs(),
      clinicPublicProfileRoutes: {
        ...buildClinicPublicProfileRouteStubs(),
        getActiveSessionByToken: async () => ({
          clinicUserId: 9,
          expiresAt: new Date("2026-05-01T00:00:00.000Z"),
          lastAccess: new Date("2026-04-23T00:00:00.000Z"),
        }),
        getClinicUserById: async () => ({
          id: 9,
          clinicId: 3,
          username: "doctor",
          authProId: null,
          role: "clinic_owner",
        }),
        getClinicPublicProfileByClinicId: async () => ({
          clinic: {
            id: 3,
            name: "Clinica Centro",
            contactEmail: "clinic@example.com",
            contactPhone: "3410000000",
          },
          profile: {
            clinicId: 3,
            displayName: "Clinica Centro",
            avatarStoragePath: "avatars/3/avatar.png",
            isPublic: true,
          },
          search: {
            clinicId: 3,
            isPublic: true,
            hasRequiredPublicFields: true,
            isSearchEligible: true,
            profileQualityScore: 80,
            updatedAt: new Date("2026-04-22T12:00:00.000Z"),
            searchText: "clinica centro",
          },
        }),
      },
      particularAuthRoutes: buildParticularAuthRouteStubs(),
      publicProfessionalsRoutes: {
        searchPublicProfessionals: async () => ({
          rows: [],
          total: 0,
          limit: 20,
          offset: 0,
        }),
        getPublicProfessionalByClinicId: async () => null,
        createSignedStorageUrl: async (path: string) => `signed:${path}`,
      },
      publicReportAccessRoutes: buildPublicReportAccessRouteStubs(),
      reportAccessTokensRoutes: buildReportAccessTokensRouteStubs(),
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/clinic/profile",
        headers: {
          cookie: `${ENV.cookieName}=session-token`,
        },
      });

      assert.equal(response.headers["x-legacy-bridge"], undefined);
      assert.notEqual(response.statusCode, 418);
      assert.ok([200, 401, 404].includes(response.statusCode));

      if (response.statusCode === 200 && response.body) {
        const body = JSON.parse(response.body);
        assert.equal(body.success, true);
        assert.equal(body.profile.clinicId, 3);
        assert.equal(body.profile.clinicName, "Clinica Centro");
        assert.equal(body.profile.avatarUrl, "signed:avatars/3/avatar.png");
      }
    } finally {
      await app.close();
    }
  },
);

test(
  "createFastifyApp despacha /api/particular/auth al router nativo antes del bridge Express",
  async () => {
    const app = await createFastifyApp({
      createLegacyApp: () => {
        const legacyApp = express();

        legacyApp.get("/particular/auth/me", (_req, res) => {
          res.setHeader("x-legacy-bridge", "should-not-run");
          res.status(418).json({
            success: false,
          });
        });

        return legacyApp as any;
      },
      adminAuditRoutes: buildAdminAuditRouteStubs(),
      adminAuthRoutes: buildAdminAuthRouteStubs(),
      adminReportAccessTokensRoutes: buildAdminReportAccessTokensRouteStubs(),
      clinicAuthRoutes: buildClinicAuthRouteStubs(),
      clinicAuditRoutes: buildClinicAuditRouteStubs(),
      clinicPublicProfileRoutes: buildClinicPublicProfileRouteStubs(),
      particularAuthRoutes: {
        ...buildParticularAuthRouteStubs(),
        getParticularSessionByToken: async () => ({
          particularTokenId: 7,
          expiresAt: new Date(Date.UTC(2026, 3, 24, 1, 0, 0)),
          lastAccess: new Date(Date.UTC(2026, 3, 23, 23, 0, 0)),
        }),
        getParticularTokenById: async () => ({
          id: 7,
          clinicId: 3,
          reportId: 55,
          tokenLast4: "ABCD",
          tutorLastName: "Gomez",
          petName: "Luna",
          petAge: "8 años",
          petBreed: "Caniche",
          petSex: "Hembra",
          petSpecies: "Canina",
          sampleLocation: "Pabellón auricular",
          sampleEvolution: "15 días",
          detailsLesion: "Lesión nodular pequeña",
          extractionDate: new Date("2026-04-20T00:00:00.000Z"),
          shippingDate: new Date("2026-04-21T00:00:00.000Z"),
          isActive: true,
          lastLoginAt: new Date("2026-04-22T10:00:00.000Z"),
          createdAt: new Date("2026-04-20T12:00:00.000Z"),
          updatedAt: new Date("2026-04-22T12:00:00.000Z"),
          createdByAdminId: 1,
          createdByClinicUserId: null,
        }),
        updateParticularSessionLastAccess: async () => {},
        getReportById: async () => ({
          id: 55,
          clinicId: 3,
          storagePath: "reports/report-55.pdf",
          uploadDate: new Date("2026-04-22T09:00:00.000Z"),
          studyType: "Histopatología",
          patientName: "Luna",
          fileName: "luna-report.pdf",
          createdAt: new Date("2026-04-22T09:00:00.000Z"),
          updatedAt: new Date("2026-04-22T09:30:00.000Z"),
        }),
      },
      publicProfessionalsRoutes: {
        searchPublicProfessionals: async () => ({
          rows: [],
          total: 0,
          limit: 20,
          offset: 0,
        }),
        getPublicProfessionalByClinicId: async () => null,
        createSignedStorageUrl: async (path: string) => `signed:${path}`,
      },
      publicReportAccessRoutes: buildPublicReportAccessRouteStubs(),
      reportAccessTokensRoutes: buildReportAccessTokensRouteStubs(),
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/particular/auth/me",
        headers: {
          cookie: `${ENV.particularCookieName}=particular-session-token`,
        },
      });

      assert.equal(response.headers["x-legacy-bridge"], undefined);
      assert.notEqual(response.statusCode, 418);
      assert.ok([200, 401].includes(response.statusCode));

      if (response.statusCode === 200) {
        const body = JSON.parse(response.body);
        assert.equal(body.success, true);
        assert.equal(body.particular.id, 7);
        assert.equal(body.particular.clinicId, 3);
        assert.equal(body.particular.report.id, 55);
      }
    } finally {
      await app.close();
    }
  },
);

test(
  "createFastifyApp despacha /api/public/professionals al router nativo antes del bridge Express",
  async () => {
    const app = await createFastifyApp({
      createLegacyApp: () => {
        const legacyApp = express();

        legacyApp.get("/public/professionals/search", (_req, res) => {
          res.setHeader("x-legacy-bridge", "should-not-run");
          res.status(418).json({
            success: false,
          });
        });

        return legacyApp as any;
      },
      adminAuditRoutes: buildAdminAuditRouteStubs(),
      adminAuthRoutes: buildAdminAuthRouteStubs(),
      adminReportAccessTokensRoutes: buildAdminReportAccessTokensRouteStubs(),
      clinicAuthRoutes: buildClinicAuthRouteStubs(),
      clinicAuditRoutes: buildClinicAuditRouteStubs(),
      clinicPublicProfileRoutes: buildClinicPublicProfileRouteStubs(),
      particularAuthRoutes: buildParticularAuthRouteStubs(),
      publicProfessionalsRoutes: {
        searchPublicProfessionals: async () => ({
          rows: [],
          total: 0,
          limit: 20,
          offset: 0,
        }),
        getPublicProfessionalByClinicId: async () => null,
        createSignedStorageUrl: async (path: string) => `signed:${path}`,
      },
      publicReportAccessRoutes: buildPublicReportAccessRouteStubs(),
      reportAccessTokensRoutes: buildReportAccessTokensRouteStubs(),
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/public/professionals/search",
      });

      assert.equal(response.statusCode, 200);
      assert.equal(response.headers["x-legacy-bridge"], undefined);
      assert.notEqual(response.statusCode, 418);

      if (response.body) {
        assert.deepEqual(JSON.parse(response.body), {
          success: true,
          count: 0,
          total: 0,
          professionals: [],
          filters: {
            query: null,
            locality: null,
            country: null,
          },
          pagination: {
            limit: 20,
            offset: 0,
          },
        });
      }
    } finally {
      await app.close();
    }
  },
);

test(
  "createFastifyApp despacha /api/public/report-access al router nativo antes del bridge Express",
  async () => {
    const rawToken = "a".repeat(64);

    const app = await createFastifyApp({
      createLegacyApp: () => {
        const legacyApp = express();

        legacyApp.get("/public/report-access/:token", (_req, res) => {
          res.setHeader("x-legacy-bridge", "should-not-run");
          res.status(418).json({
            success: false,
          });
        });

        return legacyApp as any;
      },
      adminAuditRoutes: buildAdminAuditRouteStubs(),
      adminAuthRoutes: buildAdminAuthRouteStubs(),
      adminReportAccessTokensRoutes: buildAdminReportAccessTokensRouteStubs(),
      clinicAuthRoutes: buildClinicAuthRouteStubs(),
      clinicAuditRoutes: buildClinicAuditRouteStubs(),
      clinicPublicProfileRoutes: buildClinicPublicProfileRouteStubs(),
      particularAuthRoutes: buildParticularAuthRouteStubs(),
      publicProfessionalsRoutes: {
        searchPublicProfessionals: async () => ({
          rows: [],
          total: 0,
          limit: 20,
          offset: 0,
        }),
        getPublicProfessionalByClinicId: async () => null,
        createSignedStorageUrl: async (path: string) => `signed:${path}`,
      },
      publicReportAccessRoutes: {
        ...buildPublicReportAccessRouteStubs(),
        getReportAccessTokenWithReportByTokenHash: async () => ({
          token: {
            id: 9,
            clinicId: 3,
            reportId: 55,
            tokenLast4: "ABCD",
            accessCount: 2,
            lastAccessAt: new Date("2026-04-22T10:00:00.000Z"),
            expiresAt: new Date("2026-05-01T00:00:00.000Z"),
            revokedAt: null,
            createdAt: new Date("2026-04-20T12:00:00.000Z"),
            updatedAt: new Date("2026-04-22T12:00:00.000Z"),
            createdByClinicUserId: 5,
            createdByAdminUserId: null,
            revokedByClinicUserId: null,
            revokedByAdminUserId: null,
          },
          report: {
            id: 55,
            clinicId: 3,
            uploadDate: new Date("2026-04-22T09:00:00.000Z"),
            studyType: "Histopatología",
            patientName: "Luna",
            fileName: "luna-report.pdf",
            currentStatus: "ready",
            statusChangedAt: new Date("2026-04-22T09:30:00.000Z"),
            createdAt: new Date("2026-04-22T09:00:00.000Z"),
            updatedAt: new Date("2026-04-22T09:30:00.000Z"),
            storagePath: "reports/report-55.pdf",
          },
        }),
        recordReportAccessTokenAccess: async () => ({
          id: 9,
          clinicId: 3,
          reportId: 55,
          tokenLast4: "ABCD",
          accessCount: 3,
          lastAccessAt: new Date("2026-04-24T00:00:00.000Z"),
          expiresAt: new Date("2026-05-01T00:00:00.000Z"),
          revokedAt: null,
          createdAt: new Date("2026-04-20T12:00:00.000Z"),
          updatedAt: new Date("2026-04-22T12:00:00.000Z"),
          createdByClinicUserId: 5,
          createdByAdminUserId: null,
          revokedByClinicUserId: null,
          revokedByAdminUserId: null,
        }),
        createSignedReportUrl: async () => "https://signed.example/preview",
        createSignedReportDownloadUrl: async () =>
          "https://signed.example/download",
      },
      reportAccessTokensRoutes: buildReportAccessTokensRouteStubs(),
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: `/api/public/report-access/${rawToken}`,
      });

      assert.equal(response.headers["x-legacy-bridge"], undefined);
      assert.notEqual(response.statusCode, 418);
      assert.ok([200, 404, 410, 409].includes(response.statusCode));

      if (response.statusCode === 200 && response.body) {
        const body = JSON.parse(response.body);
        assert.equal(body.success, true);
        assert.equal(body.report.id, 55);
        assert.equal(body.report.previewUrl, "https://signed.example/preview");
        assert.equal(
          body.report.downloadUrl,
          "https://signed.example/download",
        );
      }
    } finally {
      await app.close();
    }
  },
);

test(
  "createFastifyApp despacha /api/report-access-tokens al router nativo antes del bridge Express",
  async () => {
    const app = await createFastifyApp({
      createLegacyApp: () => {
        const legacyApp = express();

        legacyApp.get("/report-access-tokens", (_req, res) => {
          res.setHeader("x-legacy-bridge", "should-not-run");
          res.status(418).json({
            success: false,
          });
        });

        return legacyApp as any;
      },
      adminAuditRoutes: buildAdminAuditRouteStubs(),
      adminAuthRoutes: buildAdminAuthRouteStubs(),
      adminReportAccessTokensRoutes: buildAdminReportAccessTokensRouteStubs(),
      clinicAuthRoutes: buildClinicAuthRouteStubs(),
      clinicAuditRoutes: buildClinicAuditRouteStubs(),
      clinicPublicProfileRoutes: buildClinicPublicProfileRouteStubs(),
      particularAuthRoutes: buildParticularAuthRouteStubs(),
      publicProfessionalsRoutes: {
        searchPublicProfessionals: async () => ({
          rows: [],
          total: 0,
          limit: 20,
          offset: 0,
        }),
        getPublicProfessionalByClinicId: async () => null,
        createSignedStorageUrl: async (path: string) => `signed:${path}`,
      },
      publicReportAccessRoutes: buildPublicReportAccessRouteStubs(),
      reportAccessTokensRoutes: {
        ...buildReportAccessTokensRouteStubs(),
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
        listReportAccessTokens: async () => [
          {
            id: 9,
            clinicId: 3,
            reportId: 55,
            tokenHash: `hash:${"a".repeat(64)}`,
            tokenLast4: "aaaa",
            accessCount: 0,
            lastAccessAt: null,
            expiresAt: new Date("2099-01-01T00:00:00.000Z"),
            revokedAt: null,
            createdAt: new Date("2026-04-20T12:00:00.000Z"),
            updatedAt: new Date("2026-04-22T12:00:00.000Z"),
            createdByClinicUserId: 9,
            createdByAdminUserId: null,
            revokedByClinicUserId: null,
            revokedByAdminUserId: null,
          },
        ],
      },
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/report-access-tokens?reportId=55",
        headers: {
          cookie: `${ENV.cookieName}=session-token`,
        },
      });

      assert.equal(response.headers["x-legacy-bridge"], undefined);
      assert.notEqual(response.statusCode, 418);
      assert.ok([200, 401].includes(response.statusCode));

      if (response.statusCode === 200 && response.body) {
        const body = JSON.parse(response.body);
        assert.equal(body.success, true);
        assert.equal(body.count, 1);
        assert.equal(body.filters.reportId, 55);
        assert.equal(body.reportAccessTokens[0].id, 9);
      }
    } finally {
      await app.close();
    }
  },
);

test(
  "createFastifyApp despacha /api/admin/report-access-tokens al router nativo antes del bridge Express",
  async () => {
    const app = await createFastifyApp({
      createLegacyApp: () => {
        const legacyApp = express();

        legacyApp.get("/admin/report-access-tokens", (_req, res) => {
          res.setHeader("x-legacy-bridge", "should-not-run");
          res.status(418).json({
            success: false,
          });
        });

        return legacyApp as any;
      },
      adminAuditRoutes: buildAdminAuditRouteStubs(),
      adminAuthRoutes: buildAdminAuthRouteStubs(),
      adminReportAccessTokensRoutes: {
        ...buildAdminReportAccessTokensRouteStubs(),
        getAdminSessionByToken: async () => ({
          adminUserId: 1,
          expiresAt: new Date("2099-01-01T00:00:00.000Z"),
          lastAccess: new Date("2026-04-23T00:00:00.000Z"),
        }),
        getAdminUserById: async () => ({
          id: 1,
          username: "ADMIN",
        }),
        listReportAccessTokens: async () => [
          {
            id: 9,
            clinicId: 3,
            reportId: 55,
            tokenHash: `hash:${"a".repeat(64)}`,
            tokenLast4: "aaaa",
            accessCount: 0,
            lastAccessAt: null,
            expiresAt: new Date("2099-01-01T00:00:00.000Z"),
            revokedAt: null,
            createdAt: new Date("2026-04-20T12:00:00.000Z"),
            updatedAt: new Date("2026-04-22T12:00:00.000Z"),
            createdByClinicUserId: null,
            createdByAdminUserId: 1,
            revokedByClinicUserId: null,
            revokedByAdminUserId: null,
          },
        ],
      },
      clinicAuthRoutes: buildClinicAuthRouteStubs(),
      clinicAuditRoutes: buildClinicAuditRouteStubs(),
      clinicPublicProfileRoutes: buildClinicPublicProfileRouteStubs(),
      particularAuthRoutes: buildParticularAuthRouteStubs(),
      publicProfessionalsRoutes: {
        searchPublicProfessionals: async () => ({
          rows: [],
          total: 0,
          limit: 20,
          offset: 0,
        }),
        getPublicProfessionalByClinicId: async () => null,
        createSignedStorageUrl: async (path: string) => `signed:${path}`,
      },
      publicReportAccessRoutes: buildPublicReportAccessRouteStubs(),
      reportAccessTokensRoutes: buildReportAccessTokensRouteStubs(),
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/admin/report-access-tokens?clinicId=3&reportId=55",
        headers: {
          cookie: `${ENV.adminCookieName}=admin-session-token`,
        },
      });

      assert.equal(response.headers["x-legacy-bridge"], undefined);
      assert.notEqual(response.statusCode, 418);
      assert.ok([200, 401].includes(response.statusCode));

      if (response.statusCode === 200 && response.body) {
        const body = JSON.parse(response.body);
        assert.equal(body.success, true);
        assert.equal(body.count, 1);
        assert.equal(body.filters.clinicId, 3);
        assert.equal(body.filters.reportId, 55);
        assert.equal(body.reportAccessTokens[0].id, 9);
      }
    } finally {
      await app.close();
    }
  },
);

