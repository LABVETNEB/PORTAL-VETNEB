import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { ENV } = await import("../../../server/lib/env.ts");
const { createFastifyApp } = await import("../../../server/fastify-app.ts");
const { API_NOSNIFF_HEADER_VALUE, API_REFERRER_POLICY_HEADER_VALUE } =
  await import("../../../server/lib/http/api-response-security.ts");
const {
  assertApiErrorLogRequestId,
  assertBodyDoesNotIncludeRequestId,
  assertBodyRequestIdMatchesHeader,
  assertRequestIdHeader,
  serializeConsoleCalls,
} = await import("../../helpers/api-request-id-contract.ts");
const fastifyAppHelpers = await import("../../helpers/fastify-app-route-stubs.ts");

test(
  "createFastifyApp aplica trusted origin global antes de rutas mutables",
  async () => {
    const app = await createFastifyApp(fastifyAppHelpers.buildFastifyDispatchRouteStubs());
    const allowedOrigin = ENV.corsOrigins[0] ?? "http://localhost:3000";
    const secretSessionToken = "secret-session-token";
    const consoleCalls: string[] = [];
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    const capture = (...args: unknown[]) => {
      consoleCalls.push(args.map(String).join(" "));
    };

    console.log = capture;
    console.warn = capture;
    console.error = capture;

    try {
      const blockedPostWithoutOrigin = await app.inject({
        method: "POST",
        url: "/api/admin/auth/logout",
        headers: {
          cookie: `${ENV.adminCookieName}=${secretSessionToken}`,
        },
      });

      const blockedPatchWithoutOrigin = await app.inject({
        method: "PATCH",
        url: "/api/reports/55/status",
        headers: {
          cookie: `${ENV.cookieName}=clinic-session-token`,
        },
        payload: {
          status: "ready",
        },
      });

      const blockedDeleteWithoutOrigin = await app.inject({
        method: "DELETE",
        url: "/api/admin/particular-tokens/7",
        headers: {
          cookie: `${ENV.adminCookieName}=admin-session-token`,
        },
      });

      const blockedPostWithBadOrigin = await app.inject({
        method: "POST",
        url: "/api/admin/auth/logout",
        headers: {
          origin: "https://blocked.invalid",
        },
      });

      const allowedPostWithOrigin = await app.inject({
        method: "POST",
        url: "/api/admin/auth/logout",
        headers: {
          origin: allowedOrigin,
          cookie: `${ENV.adminCookieName}=admin-session-token`,
        },
      });

      const getWithoutOrigin = await app.inject({
        method: "GET",
        url: "/api/reports",
      });

      const optionsWithoutOrigin = await app.inject({
        method: "OPTIONS",
        url: "/api/admin/auth/logout",
      });

      for (const [index, response] of [
        blockedPostWithoutOrigin,
        blockedPatchWithoutOrigin,
        blockedDeleteWithoutOrigin,
        blockedPostWithBadOrigin,
      ].entries()) {
        assert.equal(response.statusCode, 403);
        const { body, requestId } = assertBodyRequestIdMatchesHeader(
          response,
          `trustedOriginBlocked:${index}`,
        );

        assert.deepEqual(body, {
          success: false,
          error: "Origen no permitido",
          requestId,
        });
      }

      assert.notEqual(allowedPostWithOrigin.statusCode, 403);
      assert.equal(getWithoutOrigin.statusCode, 401);
      assert.equal(optionsWithoutOrigin.statusCode, 204);

      const serializedConsoleCalls = consoleCalls.join("\n");
      assert.equal(serializedConsoleCalls.includes(secretSessionToken), false);
      assert.equal(serializedConsoleCalls.includes(ENV.adminCookieName), false);
      assert.equal(serializedConsoleCalls.toLowerCase().includes("cookie"), false);
    } finally {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
      await app.close();
    }
  },
);

test(
  "createFastifyApp expone root y health nativos",
  async () => {
    const app = await createFastifyApp({
      ...fastifyAppHelpers.buildFastifyDispatchRouteStubs(),
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
      adminAuditRoutes: fastifyAppHelpers.buildAdminAuditRouteStubs(),
      adminAuthRoutes: fastifyAppHelpers.buildAdminAuthRouteStubs(),
      adminParticularTokensRoutes: fastifyAppHelpers.buildAdminParticularTokensRouteStubs(),
      adminReportsRoutes: fastifyAppHelpers.buildAdminReportsRouteStubs(),
    adminReportAccessTokensRoutes: fastifyAppHelpers.buildAdminReportAccessTokensRouteStubs(),
      adminStudyTrackingRoutes: fastifyAppHelpers.buildAdminStudyTrackingRouteStubs(),
    adminSystemHealthRoutes: fastifyAppHelpers.buildAdminSystemHealthRouteStubs(),
      clinicAuthRoutes: fastifyAppHelpers.buildClinicAuthRouteStubs(),
      clinicAuditRoutes: fastifyAppHelpers.buildClinicAuditRouteStubs(),
      clinicPublicProfileRoutes: fastifyAppHelpers.buildClinicPublicProfileRouteStubs(),
      particularAuditRoutes: fastifyAppHelpers.buildParticularAuditRouteStubs(),
      particularAuthRoutes: fastifyAppHelpers.buildParticularAuthRouteStubs(),
      particularTokensRoutes: fastifyAppHelpers.buildParticularTokensRouteStubs(),
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
      publicReportAccessRoutes: fastifyAppHelpers.buildPublicReportAccessRouteStubs(),
      reportAccessTokensRoutes: fastifyAppHelpers.buildReportAccessTokensRouteStubs(),
      studyTrackingRoutes: fastifyAppHelpers.buildStudyTrackingRouteStubs(),
    logisticsFieldVisitsRoutes: fastifyAppHelpers.buildLogisticsFieldVisitsRouteStubs(),
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
    } finally {
      await app.close();
    }
  },
);

test(
  "createFastifyApp despacha /api/admin/audit-log al router nativo",
  async () => {
    const app = await createFastifyApp({
      ...fastifyAppHelpers.buildFastifyDispatchRouteStubs(),
      adminAuditRoutes: {
        ...fastifyAppHelpers.buildAdminAuditRouteStubs(),
        getAdminSessionByToken: async () => ({
          adminUserId: 1,
          expiresAt: new Date("2099-01-01T00:00:00.000Z"),
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
      adminAuthRoutes: fastifyAppHelpers.buildAdminAuthRouteStubs(),
      adminParticularTokensRoutes: fastifyAppHelpers.buildAdminParticularTokensRouteStubs(),
      adminReportsRoutes: fastifyAppHelpers.buildAdminReportsRouteStubs(),
    adminReportAccessTokensRoutes: fastifyAppHelpers.buildAdminReportAccessTokensRouteStubs(),
      adminStudyTrackingRoutes: fastifyAppHelpers.buildAdminStudyTrackingRouteStubs(),
    adminSystemHealthRoutes: fastifyAppHelpers.buildAdminSystemHealthRouteStubs(),
      clinicAuthRoutes: fastifyAppHelpers.buildClinicAuthRouteStubs(),
      clinicAuditRoutes: fastifyAppHelpers.buildClinicAuditRouteStubs(),
      clinicPublicProfileRoutes: fastifyAppHelpers.buildClinicPublicProfileRouteStubs(),
      particularAuditRoutes: fastifyAppHelpers.buildParticularAuditRouteStubs(),
      particularAuthRoutes: fastifyAppHelpers.buildParticularAuthRouteStubs(),
      particularTokensRoutes: fastifyAppHelpers.buildParticularTokensRouteStubs(),
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
      publicReportAccessRoutes: fastifyAppHelpers.buildPublicReportAccessRouteStubs(),
      reportAccessTokensRoutes: fastifyAppHelpers.buildReportAccessTokensRouteStubs(),
      studyTrackingRoutes: fastifyAppHelpers.buildStudyTrackingRouteStubs(),
    logisticsFieldVisitsRoutes: fastifyAppHelpers.buildLogisticsFieldVisitsRouteStubs(),
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
  "createFastifyApp despacha /api/admin/auth al router nativo",
  async () => {
    const app = await createFastifyApp({
      ...fastifyAppHelpers.buildFastifyDispatchRouteStubs(),
      adminAuditRoutes: fastifyAppHelpers.buildAdminAuditRouteStubs(),
      adminAuthRoutes: {
        ...fastifyAppHelpers.buildAdminAuthRouteStubs(),
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
      adminParticularTokensRoutes: fastifyAppHelpers.buildAdminParticularTokensRouteStubs(),
      adminReportsRoutes: fastifyAppHelpers.buildAdminReportsRouteStubs(),
    adminReportAccessTokensRoutes: fastifyAppHelpers.buildAdminReportAccessTokensRouteStubs(),
      adminStudyTrackingRoutes: fastifyAppHelpers.buildAdminStudyTrackingRouteStubs(),
    adminSystemHealthRoutes: fastifyAppHelpers.buildAdminSystemHealthRouteStubs(),
      clinicAuthRoutes: fastifyAppHelpers.buildClinicAuthRouteStubs(),
      clinicAuditRoutes: fastifyAppHelpers.buildClinicAuditRouteStubs(),
      clinicPublicProfileRoutes: fastifyAppHelpers.buildClinicPublicProfileRouteStubs(),
      particularAuditRoutes: fastifyAppHelpers.buildParticularAuditRouteStubs(),
      particularAuthRoutes: fastifyAppHelpers.buildParticularAuthRouteStubs(),
      particularTokensRoutes: fastifyAppHelpers.buildParticularTokensRouteStubs(),
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
      publicReportAccessRoutes: fastifyAppHelpers.buildPublicReportAccessRouteStubs(),
      reportAccessTokensRoutes: fastifyAppHelpers.buildReportAccessTokensRouteStubs(),
      studyTrackingRoutes: fastifyAppHelpers.buildStudyTrackingRouteStubs(),
    logisticsFieldVisitsRoutes: fastifyAppHelpers.buildLogisticsFieldVisitsRouteStubs(),
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
      assert.equal(response.headers["cache-control"], "no-store");
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
  "createFastifyApp despacha /api/auth al router nativo",
  async () => {
    const app = await createFastifyApp({
      ...fastifyAppHelpers.buildFastifyDispatchRouteStubs(),
      adminAuditRoutes: fastifyAppHelpers.buildAdminAuditRouteStubs(),
      adminAuthRoutes: fastifyAppHelpers.buildAdminAuthRouteStubs(),
      adminParticularTokensRoutes: fastifyAppHelpers.buildAdminParticularTokensRouteStubs(),
      adminReportsRoutes: fastifyAppHelpers.buildAdminReportsRouteStubs(),
    adminReportAccessTokensRoutes: fastifyAppHelpers.buildAdminReportAccessTokensRouteStubs(),
      adminStudyTrackingRoutes: fastifyAppHelpers.buildAdminStudyTrackingRouteStubs(),
    adminSystemHealthRoutes: fastifyAppHelpers.buildAdminSystemHealthRouteStubs(),
      clinicAuthRoutes: {
        ...fastifyAppHelpers.buildClinicAuthRouteStubs(),
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
      clinicAuditRoutes: fastifyAppHelpers.buildClinicAuditRouteStubs(),
      clinicPublicProfileRoutes: fastifyAppHelpers.buildClinicPublicProfileRouteStubs(),
      particularAuditRoutes: fastifyAppHelpers.buildParticularAuditRouteStubs(),
      particularAuthRoutes: fastifyAppHelpers.buildParticularAuthRouteStubs(),
      particularTokensRoutes: fastifyAppHelpers.buildParticularTokensRouteStubs(),
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
      publicReportAccessRoutes: fastifyAppHelpers.buildPublicReportAccessRouteStubs(),
      reportAccessTokensRoutes: fastifyAppHelpers.buildReportAccessTokensRouteStubs(),
      studyTrackingRoutes: fastifyAppHelpers.buildStudyTrackingRouteStubs(),
    logisticsFieldVisitsRoutes: fastifyAppHelpers.buildLogisticsFieldVisitsRouteStubs(),
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
  "createFastifyApp despacha /api/clinic/audit-log al router nativo",
  async () => {
    const app = await createFastifyApp({
      ...fastifyAppHelpers.buildFastifyDispatchRouteStubs(),
      adminAuditRoutes: fastifyAppHelpers.buildAdminAuditRouteStubs(),
      adminAuthRoutes: fastifyAppHelpers.buildAdminAuthRouteStubs(),
      adminParticularTokensRoutes: fastifyAppHelpers.buildAdminParticularTokensRouteStubs(),
      adminReportsRoutes: fastifyAppHelpers.buildAdminReportsRouteStubs(),
    adminReportAccessTokensRoutes: fastifyAppHelpers.buildAdminReportAccessTokensRouteStubs(),
      adminStudyTrackingRoutes: fastifyAppHelpers.buildAdminStudyTrackingRouteStubs(),
    adminSystemHealthRoutes: fastifyAppHelpers.buildAdminSystemHealthRouteStubs(),
      clinicAuthRoutes: fastifyAppHelpers.buildClinicAuthRouteStubs(),
      clinicAuditRoutes: {
        ...fastifyAppHelpers.buildClinicAuditRouteStubs(),
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
      clinicPublicProfileRoutes: fastifyAppHelpers.buildClinicPublicProfileRouteStubs(),
      particularAuditRoutes: fastifyAppHelpers.buildParticularAuditRouteStubs(),
      particularAuthRoutes: fastifyAppHelpers.buildParticularAuthRouteStubs(),
      particularTokensRoutes: fastifyAppHelpers.buildParticularTokensRouteStubs(),
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
      publicReportAccessRoutes: fastifyAppHelpers.buildPublicReportAccessRouteStubs(),
      reportAccessTokensRoutes: fastifyAppHelpers.buildReportAccessTokensRouteStubs(),
      studyTrackingRoutes: fastifyAppHelpers.buildStudyTrackingRouteStubs(),
    logisticsFieldVisitsRoutes: fastifyAppHelpers.buildLogisticsFieldVisitsRouteStubs(),
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
  "createFastifyApp despacha /api/clinic/profile al router nativo",
  async () => {
    const app = await createFastifyApp({
      ...fastifyAppHelpers.buildFastifyDispatchRouteStubs(),
      adminAuditRoutes: fastifyAppHelpers.buildAdminAuditRouteStubs(),
      adminAuthRoutes: fastifyAppHelpers.buildAdminAuthRouteStubs(),
      adminParticularTokensRoutes: fastifyAppHelpers.buildAdminParticularTokensRouteStubs(),
      adminReportsRoutes: fastifyAppHelpers.buildAdminReportsRouteStubs(),
    adminReportAccessTokensRoutes: fastifyAppHelpers.buildAdminReportAccessTokensRouteStubs(),
      adminStudyTrackingRoutes: fastifyAppHelpers.buildAdminStudyTrackingRouteStubs(),
    adminSystemHealthRoutes: fastifyAppHelpers.buildAdminSystemHealthRouteStubs(),
      clinicAuthRoutes: fastifyAppHelpers.buildClinicAuthRouteStubs(),
      clinicAuditRoutes: fastifyAppHelpers.buildClinicAuditRouteStubs(),
      clinicPublicProfileRoutes: {
        ...fastifyAppHelpers.buildClinicPublicProfileRouteStubs(),
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
      particularAuditRoutes: fastifyAppHelpers.buildParticularAuditRouteStubs(),
      particularAuthRoutes: fastifyAppHelpers.buildParticularAuthRouteStubs(),
      particularTokensRoutes: fastifyAppHelpers.buildParticularTokensRouteStubs(),
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
      publicReportAccessRoutes: fastifyAppHelpers.buildPublicReportAccessRouteStubs(),
      reportAccessTokensRoutes: fastifyAppHelpers.buildReportAccessTokensRouteStubs(),
      studyTrackingRoutes: fastifyAppHelpers.buildStudyTrackingRouteStubs(),
    logisticsFieldVisitsRoutes: fastifyAppHelpers.buildLogisticsFieldVisitsRouteStubs(),
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
  "createFastifyApp despacha /api/particular/auth al router nativo",
  async () => {
    const app = await createFastifyApp({
      ...fastifyAppHelpers.buildFastifyDispatchRouteStubs(),
      adminAuditRoutes: fastifyAppHelpers.buildAdminAuditRouteStubs(),
      adminAuthRoutes: fastifyAppHelpers.buildAdminAuthRouteStubs(),
      adminParticularTokensRoutes: fastifyAppHelpers.buildAdminParticularTokensRouteStubs(),
      adminReportsRoutes: fastifyAppHelpers.buildAdminReportsRouteStubs(),
    adminReportAccessTokensRoutes: fastifyAppHelpers.buildAdminReportAccessTokensRouteStubs(),
      adminStudyTrackingRoutes: fastifyAppHelpers.buildAdminStudyTrackingRouteStubs(),
    adminSystemHealthRoutes: fastifyAppHelpers.buildAdminSystemHealthRouteStubs(),
      clinicAuthRoutes: fastifyAppHelpers.buildClinicAuthRouteStubs(),
      clinicAuditRoutes: fastifyAppHelpers.buildClinicAuditRouteStubs(),
      clinicPublicProfileRoutes: fastifyAppHelpers.buildClinicPublicProfileRouteStubs(),
      particularAuditRoutes: fastifyAppHelpers.buildParticularAuditRouteStubs(),
      particularAuthRoutes: {
        ...fastifyAppHelpers.buildParticularAuthRouteStubs(),
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
          petAge: "8 aÃƒÆ’Ã‚Â±os",
          petBreed: "Caniche",
          petSex: "Hembra",
          petSpecies: "Canina",
          sampleLocation: "PabellÃƒÆ’Ã‚Â³n auricular",
          sampleEvolution: "15 dÃƒÆ’Ã‚Â­as",
          detailsLesion: "LesiÃƒÆ’Ã‚Â³n nodular pequeÃƒÆ’Ã‚Â±a",
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
          studyType: "HistopatologÃƒÆ’Ã‚Â­a",
          patientName: "Luna",
          fileName: "luna-report.pdf",
          currentStatus: "ready",
          previewUrl: null,
          downloadUrl: null,
          statusChangedAt: new Date("2026-04-22T09:30:00.000Z"),
          statusChangedByClinicUserId: null,
          statusChangedByAdminUserId: null,
          workflowStage: "sample_received",
          specialStainRequested: false,
          specialStainAt: null,
          workflowUpdatedAt: null,
          createdAt: new Date("2026-04-22T09:00:00.000Z"),
          updatedAt: new Date("2026-04-22T09:30:00.000Z"),
        }),
      },
      particularTokensRoutes: fastifyAppHelpers.buildParticularTokensRouteStubs(),
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
      publicReportAccessRoutes: fastifyAppHelpers.buildPublicReportAccessRouteStubs(),
      reportAccessTokensRoutes: fastifyAppHelpers.buildReportAccessTokensRouteStubs(),
      studyTrackingRoutes: fastifyAppHelpers.buildStudyTrackingRouteStubs(),
    logisticsFieldVisitsRoutes: fastifyAppHelpers.buildLogisticsFieldVisitsRouteStubs(),
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
  "createFastifyApp despacha /api/public/professionals al router nativo",
  async () => {
    const app = await createFastifyApp({
      ...fastifyAppHelpers.buildFastifyDispatchRouteStubs(),
      adminAuditRoutes: fastifyAppHelpers.buildAdminAuditRouteStubs(),
      adminAuthRoutes: fastifyAppHelpers.buildAdminAuthRouteStubs(),
      adminParticularTokensRoutes: fastifyAppHelpers.buildAdminParticularTokensRouteStubs(),
      adminReportsRoutes: fastifyAppHelpers.buildAdminReportsRouteStubs(),
    adminReportAccessTokensRoutes: fastifyAppHelpers.buildAdminReportAccessTokensRouteStubs(),
      adminStudyTrackingRoutes: fastifyAppHelpers.buildAdminStudyTrackingRouteStubs(),
    adminSystemHealthRoutes: fastifyAppHelpers.buildAdminSystemHealthRouteStubs(),
      clinicAuthRoutes: fastifyAppHelpers.buildClinicAuthRouteStubs(),
      clinicAuditRoutes: fastifyAppHelpers.buildClinicAuditRouteStubs(),
      clinicPublicProfileRoutes: fastifyAppHelpers.buildClinicPublicProfileRouteStubs(),
      particularAuditRoutes: fastifyAppHelpers.buildParticularAuditRouteStubs(),
      particularAuthRoutes: fastifyAppHelpers.buildParticularAuthRouteStubs(),
      particularTokensRoutes: fastifyAppHelpers.buildParticularTokensRouteStubs(),
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
      publicReportAccessRoutes: fastifyAppHelpers.buildPublicReportAccessRouteStubs(),
      reportAccessTokensRoutes: fastifyAppHelpers.buildReportAccessTokensRouteStubs(),
      studyTrackingRoutes: fastifyAppHelpers.buildStudyTrackingRouteStubs(),
    logisticsFieldVisitsRoutes: fastifyAppHelpers.buildLogisticsFieldVisitsRouteStubs(),
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
  "createFastifyApp despacha /api/public/report-access al router nativo",
  async () => {
    const rawToken = "a".repeat(64);

    const app = await createFastifyApp({
      ...fastifyAppHelpers.buildFastifyDispatchRouteStubs(),
      adminAuditRoutes: fastifyAppHelpers.buildAdminAuditRouteStubs(),
      adminAuthRoutes: fastifyAppHelpers.buildAdminAuthRouteStubs(),
      adminParticularTokensRoutes: fastifyAppHelpers.buildAdminParticularTokensRouteStubs(),
      adminReportsRoutes: fastifyAppHelpers.buildAdminReportsRouteStubs(),
    adminReportAccessTokensRoutes: fastifyAppHelpers.buildAdminReportAccessTokensRouteStubs(),
      adminStudyTrackingRoutes: fastifyAppHelpers.buildAdminStudyTrackingRouteStubs(),
    adminSystemHealthRoutes: fastifyAppHelpers.buildAdminSystemHealthRouteStubs(),
      clinicAuthRoutes: fastifyAppHelpers.buildClinicAuthRouteStubs(),
      clinicAuditRoutes: fastifyAppHelpers.buildClinicAuditRouteStubs(),
      clinicPublicProfileRoutes: fastifyAppHelpers.buildClinicPublicProfileRouteStubs(),
      particularAuditRoutes: fastifyAppHelpers.buildParticularAuditRouteStubs(),
      particularAuthRoutes: fastifyAppHelpers.buildParticularAuthRouteStubs(),
      particularTokensRoutes: fastifyAppHelpers.buildParticularTokensRouteStubs(),
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
        ...fastifyAppHelpers.buildPublicReportAccessRouteStubs(),
        getReportAccessTokenWithReportByTokenHash: async () => ({
          token: {
            id: 9,
            clinicId: 3,
            reportId: 55,
            tokenLast4: "ABCD",
            tokenHash: "hash:ABCD",
            accessCount: 2,
            lastAccessAt: new Date("2026-04-22T10:00:00.000Z"),
            expiresAt: new Date("2099-01-01T00:00:00.000Z"),
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
            studyType: "HistopatologÃƒÆ’Ã‚Â­a",
            patientName: "Luna",
            fileName: "luna-report.pdf",
            currentStatus: "ready",
            previewUrl: null,
            downloadUrl: null,
            statusChangedAt: new Date("2026-04-22T09:30:00.000Z"),
            statusChangedByClinicUserId: null,
            statusChangedByAdminUserId: null,
            workflowStage: "sample_received",
            specialStainRequested: false,
            specialStainAt: null,
            workflowUpdatedAt: null,
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
          tokenHash: "hash:ABCD",
          accessCount: 3,
          lastAccessAt: new Date("2026-04-24T00:00:00.000Z"),
          expiresAt: new Date("2099-01-01T00:00:00.000Z"),
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
      reportAccessTokensRoutes: fastifyAppHelpers.buildReportAccessTokensRouteStubs(),
      studyTrackingRoutes: fastifyAppHelpers.buildStudyTrackingRouteStubs(),
    logisticsFieldVisitsRoutes: fastifyAppHelpers.buildLogisticsFieldVisitsRouteStubs(),
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
  "createFastifyApp despacha /api/report-access-tokens al router nativo",
  async () => {
    const app = await createFastifyApp({
      ...fastifyAppHelpers.buildFastifyDispatchRouteStubs(),
      adminAuditRoutes: fastifyAppHelpers.buildAdminAuditRouteStubs(),
      adminAuthRoutes: fastifyAppHelpers.buildAdminAuthRouteStubs(),
      adminParticularTokensRoutes: fastifyAppHelpers.buildAdminParticularTokensRouteStubs(),
      adminReportsRoutes: fastifyAppHelpers.buildAdminReportsRouteStubs(),
    adminReportAccessTokensRoutes: fastifyAppHelpers.buildAdminReportAccessTokensRouteStubs(),
      adminStudyTrackingRoutes: fastifyAppHelpers.buildAdminStudyTrackingRouteStubs(),
    adminSystemHealthRoutes: fastifyAppHelpers.buildAdminSystemHealthRouteStubs(),
      clinicAuthRoutes: fastifyAppHelpers.buildClinicAuthRouteStubs(),
      clinicAuditRoutes: fastifyAppHelpers.buildClinicAuditRouteStubs(),
      clinicPublicProfileRoutes: fastifyAppHelpers.buildClinicPublicProfileRouteStubs(),
      particularAuditRoutes: fastifyAppHelpers.buildParticularAuditRouteStubs(),
      particularAuthRoutes: fastifyAppHelpers.buildParticularAuthRouteStubs(),
      particularTokensRoutes: fastifyAppHelpers.buildParticularTokensRouteStubs(),
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
      publicReportAccessRoutes: fastifyAppHelpers.buildPublicReportAccessRouteStubs(),
      studyTrackingRoutes: fastifyAppHelpers.buildStudyTrackingRouteStubs(),
    logisticsFieldVisitsRoutes: fastifyAppHelpers.buildLogisticsFieldVisitsRouteStubs(),
      reportAccessTokensRoutes: {
        ...fastifyAppHelpers.buildReportAccessTokensRouteStubs(),
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
  "createFastifyApp despacha /api/admin/reports al router nativo",
  async () => {
    const app = await createFastifyApp({
      ...fastifyAppHelpers.buildFastifyDispatchRouteStubs(),
      adminReportsRoutes: {
        ...fastifyAppHelpers.buildAdminReportsRouteStubs(),
        getAdminSessionByToken: async () => ({
          adminUserId: 1,
          expiresAt: new Date("2099-01-01T00:00:00.000Z"),
          lastAccess: new Date("2026-04-23T00:00:00.000Z"),
        }),
        getAdminUserById: async () => ({
          id: 1,
          username: "ADMIN",
        }),
      },
    });

    try {
      const response = await app.inject({
        method: "OPTIONS",
        url: "/api/admin/reports/upload",
        headers: {
          origin: "http://localhost:3000",
          "access-control-request-headers": "content-type",
        },
      });

      assert.equal(response.headers["x-legacy-bridge"], undefined);
      assert.equal(response.statusCode, 204);
      assert.equal(
        response.headers["access-control-allow-methods"],
        "POST,OPTIONS",
      );
    } finally {
      await app.close();
    }
  },
);

test(
  "createFastifyApp despacha /api/admin/report-access-tokens al router nativo",
  async () => {
    const app = await createFastifyApp({
      ...fastifyAppHelpers.buildFastifyDispatchRouteStubs(),
      adminAuditRoutes: fastifyAppHelpers.buildAdminAuditRouteStubs(),
      adminAuthRoutes: fastifyAppHelpers.buildAdminAuthRouteStubs(),
      adminParticularTokensRoutes: fastifyAppHelpers.buildAdminParticularTokensRouteStubs(),
      adminReportsRoutes: fastifyAppHelpers.buildAdminReportsRouteStubs(),
    adminReportAccessTokensRoutes: {
        ...fastifyAppHelpers.buildAdminReportAccessTokensRouteStubs(),
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
      adminStudyTrackingRoutes: fastifyAppHelpers.buildAdminStudyTrackingRouteStubs(),
    adminSystemHealthRoutes: fastifyAppHelpers.buildAdminSystemHealthRouteStubs(),
      clinicAuthRoutes: fastifyAppHelpers.buildClinicAuthRouteStubs(),
      clinicAuditRoutes: fastifyAppHelpers.buildClinicAuditRouteStubs(),
      clinicPublicProfileRoutes: fastifyAppHelpers.buildClinicPublicProfileRouteStubs(),
      particularAuditRoutes: fastifyAppHelpers.buildParticularAuditRouteStubs(),
      particularAuthRoutes: fastifyAppHelpers.buildParticularAuthRouteStubs(),
      particularTokensRoutes: fastifyAppHelpers.buildParticularTokensRouteStubs(),
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
      publicReportAccessRoutes: fastifyAppHelpers.buildPublicReportAccessRouteStubs(),
      reportAccessTokensRoutes: fastifyAppHelpers.buildReportAccessTokensRouteStubs(),
      studyTrackingRoutes: fastifyAppHelpers.buildStudyTrackingRouteStubs(),
    logisticsFieldVisitsRoutes: fastifyAppHelpers.buildLogisticsFieldVisitsRouteStubs(),
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


test(
  "createFastifyApp despacha /api/admin/particular-tokens al router nativo",
  async () => {
    const app = await createFastifyApp({
      ...fastifyAppHelpers.buildFastifyDispatchRouteStubs(),
      adminAuditRoutes: fastifyAppHelpers.buildAdminAuditRouteStubs(),
      adminAuthRoutes: fastifyAppHelpers.buildAdminAuthRouteStubs(),
      adminParticularTokensRoutes: {
        ...fastifyAppHelpers.buildAdminParticularTokensRouteStubs(),
        getAdminSessionByToken: async () => ({
          adminUserId: 1,
          expiresAt: new Date("2099-01-01T00:00:00.000Z"),
          lastAccess: new Date("2026-04-23T00:00:00.000Z"),
        }),
        getAdminUserById: async () => ({
          id: 1,
          username: "ADMIN",
        }),
        listParticularTokens: async () => [
          {
            id: 7,
            clinicId: 3,
            reportId: 55,
            tokenHash: `hash:${"a".repeat(64)}`,
            tokenLast4: "aaaa",
            tutorLastName: "Gomez",
            petName: "Luna",
            petAge: "8 aÃƒÆ’Ã‚Â±os",
            petBreed: "Caniche",
            petSex: "Hembra",
            petSpecies: "Canina",
            sampleLocation: "PabellÃƒÆ’Ã‚Â³n auricular",
            sampleEvolution: "15 dÃƒÆ’Ã‚Â­as",
            detailsLesion: null,
            extractionDate: new Date("2026-04-20T00:00:00.000Z"),
            shippingDate: new Date("2026-04-21T00:00:00.000Z"),
            isActive: true,
            lastLoginAt: null,
            createdAt: new Date("2026-04-20T12:00:00.000Z"),
            updatedAt: new Date("2026-04-22T12:00:00.000Z"),
            createdByAdminId: 1,
            createdByClinicUserId: null,
          },
        ],
      },
      adminReportsRoutes: fastifyAppHelpers.buildAdminReportsRouteStubs(),
    adminReportAccessTokensRoutes: fastifyAppHelpers.buildAdminReportAccessTokensRouteStubs(),
      adminStudyTrackingRoutes: fastifyAppHelpers.buildAdminStudyTrackingRouteStubs(),
    adminSystemHealthRoutes: fastifyAppHelpers.buildAdminSystemHealthRouteStubs(),
      clinicAuthRoutes: fastifyAppHelpers.buildClinicAuthRouteStubs(),
      clinicAuditRoutes: fastifyAppHelpers.buildClinicAuditRouteStubs(),
      clinicPublicProfileRoutes: fastifyAppHelpers.buildClinicPublicProfileRouteStubs(),
      particularAuditRoutes: fastifyAppHelpers.buildParticularAuditRouteStubs(),
      particularAuthRoutes: fastifyAppHelpers.buildParticularAuthRouteStubs(),
      particularTokensRoutes: fastifyAppHelpers.buildParticularTokensRouteStubs(),
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
      publicReportAccessRoutes: fastifyAppHelpers.buildPublicReportAccessRouteStubs(),
      reportAccessTokensRoutes: fastifyAppHelpers.buildReportAccessTokensRouteStubs(),
      studyTrackingRoutes: fastifyAppHelpers.buildStudyTrackingRouteStubs(),
    logisticsFieldVisitsRoutes: fastifyAppHelpers.buildLogisticsFieldVisitsRouteStubs(),
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/admin/particular-tokens?clinicId=3&limit=5&offset=2",
        headers: {
          cookie: `${ENV.adminCookieName}=admin-session-token`,
        },
      });

      assert.equal(response.headers["x-legacy-bridge"], undefined);
      assert.notEqual(response.statusCode, 418);
      assert.equal(response.statusCode, 200);
    } finally {
      await app.close();
    }
  },
);








test(
  "createFastifyApp despacha /api/study-tracking al router nativo",
  async () => {
    const app = await createFastifyApp({
      ...fastifyAppHelpers.buildFastifyDispatchRouteStubs(),
      adminAuditRoutes: fastifyAppHelpers.buildAdminAuditRouteStubs(),
      adminAuthRoutes: fastifyAppHelpers.buildAdminAuthRouteStubs(),
      adminParticularTokensRoutes: fastifyAppHelpers.buildAdminParticularTokensRouteStubs(),
      adminReportsRoutes: fastifyAppHelpers.buildAdminReportsRouteStubs(),
    adminReportAccessTokensRoutes: fastifyAppHelpers.buildAdminReportAccessTokensRouteStubs(),
      adminStudyTrackingRoutes: fastifyAppHelpers.buildAdminStudyTrackingRouteStubs(),
    adminSystemHealthRoutes: fastifyAppHelpers.buildAdminSystemHealthRouteStubs(),
      clinicAuthRoutes: fastifyAppHelpers.buildClinicAuthRouteStubs(),
      clinicAuditRoutes: fastifyAppHelpers.buildClinicAuditRouteStubs(),
      clinicPublicProfileRoutes: fastifyAppHelpers.buildClinicPublicProfileRouteStubs(),
      particularAuditRoutes: fastifyAppHelpers.buildParticularAuditRouteStubs(),
      particularAuthRoutes: fastifyAppHelpers.buildParticularAuthRouteStubs(),
      particularTokensRoutes: fastifyAppHelpers.buildParticularTokensRouteStubs(),
      publicProfessionalsRoutes: {
        searchPublicProfessionals: async () => ({ rows: [], total: 0, limit: 20, offset: 0 }),
        getPublicProfessionalByClinicId: async () => null,
        createSignedStorageUrl: async (path: string) => `signed:${path}`,
      },
      publicReportAccessRoutes: fastifyAppHelpers.buildPublicReportAccessRouteStubs(),
      reportAccessTokensRoutes: fastifyAppHelpers.buildReportAccessTokensRouteStubs(),
      studyTrackingRoutes: fastifyAppHelpers.buildStudyTrackingRouteStubs(),
    logisticsFieldVisitsRoutes: fastifyAppHelpers.buildLogisticsFieldVisitsRouteStubs(),
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/study-tracking",
      });

      assert.equal(response.headers["x-legacy-bridge"], undefined);
      assert.notEqual(response.statusCode, 418);
      assert.equal(response.statusCode, 401);
    } finally {
      await app.close();
    }
  },
);


test(
  "createFastifyApp despacha /api/admin/study-tracking al router nativo",
  async () => {
    const app = await createFastifyApp({
      ...fastifyAppHelpers.buildFastifyDispatchRouteStubs(),
      adminAuditRoutes: fastifyAppHelpers.buildAdminAuditRouteStubs(),
      adminAuthRoutes: fastifyAppHelpers.buildAdminAuthRouteStubs(),
      adminParticularTokensRoutes: fastifyAppHelpers.buildAdminParticularTokensRouteStubs(),
      adminReportsRoutes: fastifyAppHelpers.buildAdminReportsRouteStubs(),
    adminReportAccessTokensRoutes: fastifyAppHelpers.buildAdminReportAccessTokensRouteStubs(),
      adminStudyTrackingRoutes: {
        ...fastifyAppHelpers.buildAdminStudyTrackingRouteStubs(),
        getAdminSessionByToken: async () => ({
          adminUserId: 1,
          expiresAt: new Date("2099-01-01T00:00:00.000Z"),
          lastAccess: new Date("2026-04-23T00:00:00.000Z"),
        }),
        getAdminUserById: async () => ({
          id: 1,
          username: "VETNEB",
        }),
        listStudyTrackingCases: async () => [],
      },
      clinicAuthRoutes: fastifyAppHelpers.buildClinicAuthRouteStubs(),
      clinicAuditRoutes: fastifyAppHelpers.buildClinicAuditRouteStubs(),
      clinicPublicProfileRoutes: fastifyAppHelpers.buildClinicPublicProfileRouteStubs(),
      particularAuditRoutes: fastifyAppHelpers.buildParticularAuditRouteStubs(),
      particularAuthRoutes: fastifyAppHelpers.buildParticularAuthRouteStubs(),
      particularTokensRoutes: fastifyAppHelpers.buildParticularTokensRouteStubs(),
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
      publicReportAccessRoutes: fastifyAppHelpers.buildPublicReportAccessRouteStubs(),
      reportAccessTokensRoutes: fastifyAppHelpers.buildReportAccessTokensRouteStubs(),
      studyTrackingRoutes: fastifyAppHelpers.buildStudyTrackingRouteStubs(),
    logisticsFieldVisitsRoutes: fastifyAppHelpers.buildLogisticsFieldVisitsRouteStubs(),
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/admin/study-tracking?clinicId=3",
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
        assert.equal(body.count, 0);
      }
    } finally {
      await app.close();
    }
  },
);




test(
  "createFastifyApp despacha rutas nativas restantes al router nativo",
  async () => {
    const app = await createFastifyApp(fastifyAppHelpers.buildFastifyDispatchRouteStubs());

    try {
      const reportsResponse = await app.inject({
        method: "GET",
        url: "/api/reports",
      });

      assert.equal(reportsResponse.headers["x-legacy-bridge"], undefined);
      assert.notEqual(reportsResponse.statusCode, 418);
      assert.equal(reportsResponse.statusCode, 401);

      const reportStatusResponse = await app.inject({
        method: "PATCH",
        url: "/api/reports/55/status",
      });

      assert.equal(reportStatusResponse.headers["x-legacy-bridge"], undefined);
      assert.notEqual(reportStatusResponse.statusCode, 418);
      assert.equal(reportStatusResponse.statusCode, 401);

      const particularTokensResponse = await app.inject({
        method: "GET",
        url: "/api/particular-tokens",
      });

      assert.equal(particularTokensResponse.headers["x-legacy-bridge"], undefined);
      assert.notEqual(particularTokensResponse.statusCode, 418);
      assert.equal(particularTokensResponse.statusCode, 401);

      const particularStudyTrackingResponse = await app.inject({
        method: "GET",
        url: "/api/particular/study-tracking/me",
      });

      assert.equal(
        particularStudyTrackingResponse.headers["x-legacy-bridge"],
        undefined,
      );
      assert.notEqual(particularStudyTrackingResponse.statusCode, 418);
      assert.equal(particularStudyTrackingResponse.statusCode, 401);
    } finally {
      await app.close();
    }
  },
);

test(
  "createFastifyApp usa handlers globales para 404 y errores no capturados",
  async () => {
    const app = await createFastifyApp({
      ...fastifyAppHelpers.buildFastifyDispatchRouteStubs(),
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
        },
      }),
      adminAuditRoutes: fastifyAppHelpers.buildAdminAuditRouteStubs(),
      adminAuthRoutes: fastifyAppHelpers.buildAdminAuthRouteStubs(),
      adminParticularTokensRoutes: fastifyAppHelpers.buildAdminParticularTokensRouteStubs(),
      adminReportsRoutes: fastifyAppHelpers.buildAdminReportsRouteStubs(),
    adminReportAccessTokensRoutes: fastifyAppHelpers.buildAdminReportAccessTokensRouteStubs(),
      adminStudyTrackingRoutes: fastifyAppHelpers.buildAdminStudyTrackingRouteStubs(),
    adminSystemHealthRoutes: fastifyAppHelpers.buildAdminSystemHealthRouteStubs(),
      clinicAuthRoutes: fastifyAppHelpers.buildClinicAuthRouteStubs(),
      clinicAuditRoutes: fastifyAppHelpers.buildClinicAuditRouteStubs(),
      clinicPublicProfileRoutes: fastifyAppHelpers.buildClinicPublicProfileRouteStubs(),
      particularAuditRoutes: fastifyAppHelpers.buildParticularAuditRouteStubs(),
      particularAuthRoutes: fastifyAppHelpers.buildParticularAuthRouteStubs(),
      particularTokensRoutes: fastifyAppHelpers.buildParticularTokensRouteStubs(),
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
      publicReportAccessRoutes: fastifyAppHelpers.buildPublicReportAccessRouteStubs(),
      reportAccessTokensRoutes: fastifyAppHelpers.buildReportAccessTokensRouteStubs(),
      studyTrackingRoutes: fastifyAppHelpers.buildStudyTrackingRouteStubs(),
    logisticsFieldVisitsRoutes: fastifyAppHelpers.buildLogisticsFieldVisitsRouteStubs(),
    });

    try {
      app.get("/__test/internal-error", async () => {
        throw new Error("detalle interno sensible");
      });

      app.get("/__test/bad-request", async () => {
        const error = new Error("Payload invalido") as Error & {
          statusCode: number;
        };
        error.statusCode = 400;
        throw error;
      });

      const notFoundResponse = await app.inject({
        method: "GET",
        url: "/api/no-existe",
      });

      assert.equal(notFoundResponse.statusCode, 404);
      const { body: notFoundBody, requestId: notFoundRequestId } =
        assertBodyRequestIdMatchesHeader(notFoundResponse, "apiNotFound");
      assert.deepEqual(notFoundBody, {
        success: false,
        error: "Ruta no encontrada",
        path: "/api/no-existe",
        requestId: notFoundRequestId,
      });

      const internalResponse = await app.inject({
        method: "GET",
        url: "/__test/internal-error",
      });

      assert.equal(internalResponse.statusCode, 500);
      assert.deepEqual(JSON.parse(internalResponse.body), {
        success: false,
        error: "Error interno del servidor",
        path: "/__test/internal-error",
      });
      assert.doesNotMatch(internalResponse.body, /detalle interno sensible/);

      const badRequestResponse = await app.inject({
        method: "GET",
        url: "/__test/bad-request",
      });

      assert.equal(badRequestResponse.statusCode, 400);
      assert.deepEqual(JSON.parse(badRequestResponse.body), {
        success: false,
        error: "Payload invalido",
        details: "Payload invalido",
        path: "/__test/bad-request",
      });
    } finally {
      await app.close();
    }
  },
);

test(
  "createFastifyApp incluye requestId en cuerpos JSON de errores API",
  async () => {
    const app = await createFastifyApp({
      ...fastifyAppHelpers.buildFastifyDispatchRouteStubs(),
      getNativeHealthCheckResponse: async () => ({
        statusCode: 200,
        payload: {
          success: true,
          status: "ok",
        },
      }),
    });
    const originalConsoleError = console.error;
    const consoleErrorCalls: unknown[][] = [];

    console.error = (...args: unknown[]) => {
      consoleErrorCalls.push(args);
    };

    try {
      const throwInternalError = async () => {
        throw new Error("detalle interno sensible");
      };
      const allowedOrigin = ENV.corsOrigins[0] ?? "http://localhost:3000";

      // "Paciente_307" pasaria una regex sintactica de identificador; sólo la
      // allowlist finita de nombres de Error nativos lo rechaza. El mismo
      // valor se reutiliza como `code` para probar que el campo no existe en
      // absoluto: no hay una allowlist parcial de codigos permitidos.
      const manipulatedNameThrow = async () => {
        const failure = new Error(
          "historia clinica confidencial del paciente",
        ) as Error & { code?: string };

        failure.name = "Paciente_307";
        failure.code = "Paciente_307";

        throw failure;
      };

      // Un codigo con forma de SQLSTATE tambien debe omitirse por completo:
      // el contrato es ausencia total de `code`/`safeCode`, no una lista
      // parcial de valores "tecnicos" aceptados. "40001" (serialization
      // failure) se elige porque, a diferencia de 23505/23503/22P02/42703,
      // no dispara el mapeo especial preexistente de getFastifyErrorStatus a
      // 400: este test aisla el hallazgo (ausencia del campo en el log) sin
      // interferir con esa logica de status ya existente.
      const technicalCodeThrow = async () => {
        const failure = new Error(
          "could not serialize access due to concurrent update",
        ) as Error & { code?: string };

        failure.code = "40001";

        throw failure;
      };

      app.get("/api/__test/internal-error", throwInternalError);
      app.post("/api/__test/internal-error", throwInternalError);
      app.get("/api/__test/manipulated-error-name", manipulatedNameThrow);
      app.get("/api/__test/technical-error-code", technicalCodeThrow);

      const genericError = await app.inject({
        method: "POST",
        url: "/api/__test/internal-error",
        headers: {
          authorization: "Bearer secret-authorization-token",
          cookie: `${ENV.cookieName}=secret-cookie-token`,
          origin: allowedOrigin,
        },
        payload: {
          password: "secret-request-password",
          token: "secret-request-token",
        },
      });

      assert.equal(genericError.statusCode, 500);
      const { body: genericBody, requestId: genericRequestId } =
        assertBodyRequestIdMatchesHeader(genericError, "genericError");
      assert.deepEqual(genericBody, {
        success: false,
        error: "Error interno del servidor",
        path: "/api/__test/internal-error",
        requestId: genericRequestId,
      });
      assert.doesNotMatch(genericError.body, /detalle interno sensible/);
      const genericLogPayload = assertApiErrorLogRequestId(
        consoleErrorCalls,
        0,
        genericRequestId,
        "genericError",
      );
      assert.equal(genericLogPayload.method, "POST");
      assert.equal(
        genericLogPayload.routeTemplate,
        "/api/__test/internal-error",
      );
      assert.equal(genericLogPayload.status, 500);
      assert.equal("path" in genericLogPayload, false);
      assert.equal("url" in genericLogPayload, false);

      const validIncomingRequestId = "client-req_123.abc:456";
      const validIncomingError = await app.inject({
        method: "GET",
        url: "/api/__test/internal-error",
        headers: {
          "x-request-id": validIncomingRequestId,
        },
      });
      const { body: validIncomingBody, requestId: validRequestId } =
        assertBodyRequestIdMatchesHeader(
          validIncomingError,
          "validIncomingError",
        );

      assert.equal(validRequestId, validIncomingRequestId);
      assert.equal(validIncomingBody.requestId, validIncomingRequestId);
      assertApiErrorLogRequestId(
        consoleErrorCalls,
        1,
        validIncomingRequestId,
        "validIncomingError",
      );

      const invalidIncomingRequestId = "client request id";
      const invalidIncomingError = await app.inject({
        method: "GET",
        url: "/api/__test/internal-error",
        headers: {
          "x-request-id": invalidIncomingRequestId,
        },
      });
      const { body: invalidIncomingBody, requestId: invalidRequestId } =
        assertBodyRequestIdMatchesHeader(
          invalidIncomingError,
          "invalidIncomingError",
        );

      assert.notEqual(invalidRequestId, invalidIncomingRequestId);
      assert.equal(invalidIncomingBody.requestId, invalidRequestId);
      assertApiErrorLogRequestId(
        consoleErrorCalls,
        2,
        invalidRequestId,
        "invalidIncomingError",
      );

      const manipulatedNameError = await app.inject({
        method: "GET",
        url: "/api/__test/manipulated-error-name",
      });

      assert.equal(manipulatedNameError.statusCode, 500);
      const {
        body: manipulatedNameBody,
        requestId: manipulatedNameRequestId,
      } = assertBodyRequestIdMatchesHeader(
        manipulatedNameError,
        "manipulatedNameError",
      );
      assert.deepEqual(manipulatedNameBody, {
        success: false,
        error: "Error interno del servidor",
        path: "/api/__test/manipulated-error-name",
        requestId: manipulatedNameRequestId,
      });
      assert.doesNotMatch(
        manipulatedNameError.body,
        /historia clinica confidencial/,
      );
      assert.doesNotMatch(manipulatedNameError.body, /Paciente_307/);

      const manipulatedNameLogPayload = assertApiErrorLogRequestId(
        consoleErrorCalls,
        3,
        manipulatedNameRequestId,
        "manipulatedNameError",
      );

      assert.equal(manipulatedNameLogPayload.errorName, "Error");
      assert.equal(
        manipulatedNameLogPayload.routeTemplate,
        "/api/__test/manipulated-error-name",
      );
      assert.equal(manipulatedNameLogPayload.method, "GET");
      assert.equal(manipulatedNameLogPayload.status, 500);

      // El contexto de API_ERROR es cerrado: exactamente method, routeTemplate,
      // status y errorName, con requestId promovido al nivel superior. Nunca
      // safeCode ni code, sin importar que el error los traiga adjuntos.
      assert.deepEqual(Object.keys(manipulatedNameLogPayload).sort(), [
        "errorName",
        "method",
        "requestId",
        "routeTemplate",
        "status",
      ]);
      assert.equal("safeCode" in manipulatedNameLogPayload, false);
      assert.equal("code" in manipulatedNameLogPayload, false);

      const manipulatedNameLogLine = serializeConsoleCalls([
        consoleErrorCalls[3] ?? [],
      ]);

      assert.equal(
        manipulatedNameLogLine.includes("Paciente_307"),
        false,
      );
      assert.equal(
        manipulatedNameLogLine.includes("historia clinica confidencial"),
        false,
      );
      assert.equal(manipulatedNameLogLine.includes("safeCode"), false);
      assert.equal(manipulatedNameLogLine.includes('"code"'), false);

      const technicalCodeError = await app.inject({
        method: "GET",
        url: "/api/__test/technical-error-code",
      });

      assert.equal(technicalCodeError.statusCode, 500);
      const {
        body: technicalCodeBody,
        requestId: technicalCodeRequestId,
      } = assertBodyRequestIdMatchesHeader(
        technicalCodeError,
        "technicalCodeError",
      );
      assert.deepEqual(technicalCodeBody, {
        success: false,
        error: "Error interno del servidor",
        path: "/api/__test/technical-error-code",
        requestId: technicalCodeRequestId,
      });
      assert.doesNotMatch(
        technicalCodeError.body,
        /could not serialize access/,
      );
      assert.doesNotMatch(technicalCodeError.body, /40001/);

      const technicalCodeLogPayload = assertApiErrorLogRequestId(
        consoleErrorCalls,
        4,
        technicalCodeRequestId,
        "technicalCodeError",
      );

      assert.equal(technicalCodeLogPayload.errorName, "Error");
      assert.deepEqual(Object.keys(technicalCodeLogPayload).sort(), [
        "errorName",
        "method",
        "requestId",
        "routeTemplate",
        "status",
      ]);
      assert.equal("safeCode" in technicalCodeLogPayload, false);
      assert.equal("code" in technicalCodeLogPayload, false);

      const technicalCodeLogLine = serializeConsoleCalls([
        consoleErrorCalls[4] ?? [],
      ]);

      assert.equal(technicalCodeLogLine.includes("40001"), false);
      assert.equal(
        technicalCodeLogLine.includes("could not serialize access"),
        false,
      );
      assert.equal(technicalCodeLogLine.includes("safeCode"), false);
      assert.equal(technicalCodeLogLine.includes('"code"'), false);

      const publicApiNotFound = await app.inject({
        method: "GET",
        url: "/api/public/no-existe",
      });

      assert.equal(publicApiNotFound.statusCode, 404);
      const { body: publicApiNotFoundBody, requestId: publicApiNotFoundId } =
        assertBodyRequestIdMatchesHeader(
          publicApiNotFound,
          "publicApiNotFound",
        );
      assert.deepEqual(publicApiNotFoundBody, {
        success: false,
        error: "Ruta no encontrada",
        path: "/api/public/no-existe",
        requestId: publicApiNotFoundId,
      });

      const apiHealth = await app.inject({
        method: "GET",
        url: "/api/health",
      });

      assert.equal(apiHealth.statusCode, 200);
      assertRequestIdHeader(apiHealth, "apiHealth");
      assertBodyDoesNotIncludeRequestId(apiHealth, "apiHealth");
      assert.equal(
        consoleErrorCalls.length,
        5,
        "respuesta API exitosa no debe registrar log de error nuevo",
      );

      const serializedConsoleCalls = serializeConsoleCalls(consoleErrorCalls);

      assert.equal(
        serializedConsoleCalls.includes("secret-authorization-token"),
        false,
      );
      assert.equal(serializedConsoleCalls.includes("secret-cookie-token"), false);
      assert.equal(serializedConsoleCalls.includes("secret-request-token"), false);
      assert.equal(
        serializedConsoleCalls.includes("secret-request-password"),
        false,
      );
      assert.equal(
        serializedConsoleCalls.toLowerCase().includes("authorization"),
        false,
      );
      assert.equal(serializedConsoleCalls.toLowerCase().includes("cookie"), false);
    } finally {
      console.error = originalConsoleError;
      await app.close();
    }
  },
);

test(
  "createFastifyApp mantiene search de profesionales pÃºblicos montado en el router nativo",
  async () => {
    let receivedSearchInput:
      | {
          query?: string;
          locality?: string;
          country?: string;
          limit: number;
          offset: number;
        }
      | null = null;
    let detailHelperWasCalled = false;

    const app = await createFastifyApp({
      ...fastifyAppHelpers.buildFastifyDispatchRouteStubs(),
      publicProfessionalsRoutes: {
        searchPublicProfessionals: async (input: {
          query?: string;
          locality?: string;
          country?: string;
          limit: number;
          offset: number;
        }) => {
          receivedSearchInput = input;

          return {
            rows: [
              {
                clinicId: 23,
                displayName: "Clinica Publica Integrada",
                avatarStoragePath: "avatars/23.webp",
                aboutText: "Servicio publico de histopatologia veterinaria",
                specialtyText: "Histopatologia",
                servicesText: "Biopsias, citologias y seguimiento",
                email: "publica@example.com",
                phone: "3412222222",
                locality: "Cordoba",
                country: "AR",
                updatedAt: new Date("2026-04-25T12:00:00.000Z"),
                profileQualityScore: 0.97,
                rank: 0.8,
                similarity: 0.7,
                score: 1.6,
              },
            ],
            total: 1,
            limit: input.limit,
            offset: input.offset,
          };
        },
        getPublicProfessionalByClinicId: async () => {
          detailHelperWasCalled = true;
          throw new Error(
            "search dispatch must not call getPublicProfessionalByClinicId",
          );
        },
        createSignedStorageUrl: async (path: string) => `signed:${path}`,
      },
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/public/professionals/search?q=%20Histo%20&locality=%20Cordoba%20&country=%20AR%20&limit=7&offset=3",
      });

      assert.equal(response.headers["x-legacy-bridge"], undefined);
      assert.equal(response.headers["cache-control"], undefined);
      assert.equal(response.statusCode, 200);
      assert.equal(detailHelperWasCalled, false);
      assert.deepEqual(receivedSearchInput, {
        query: "Histo",
        locality: "Cordoba",
        country: "AR",
        limit: 7,
        offset: 3,
      });

      const body = JSON.parse(response.body);

      assert.equal(body.success, true);
      assert.equal(body.count, 1);
      assert.equal(body.total, 1);
      assert.deepEqual(body.filters, {
        query: "Histo",
        locality: "Cordoba",
        country: "AR",
      });
      assert.deepEqual(body.pagination, {
        limit: 7,
        offset: 3,
      });
      assert.deepEqual(body.professionals[0], {
        clinicId: 23,
        displayName: "Clinica Publica Integrada",
        avatarUrl: "signed:avatars/23.webp",
        specialtyText: "Histopatologia",
        servicesText: "Biopsias, citologias y seguimiento",
        email: "publica@example.com",
        phone: "3412222222",
        locality: "Cordoba",
        country: "AR",
        aboutText: "Servicio publico de histopatologia veterinaria",
        updatedAt: "2026-04-25T12:00:00.000Z",
        relevance: {
          rank: 0.8,
          similarity: 0.7,
          score: 1.6,
        },
        profileQualityScore: 0.97,
      });
    } finally {
      await app.close();
    }
  },
);

test(
  "createFastifyApp preserva Cache-Control publico de pricing",
  async () => {
    const app = await createFastifyApp(fastifyAppHelpers.buildFastifyDispatchRouteStubs());

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/public/pricing",
      });

      assert.equal(response.statusCode, 200);
      assert.equal(
        response.headers["cache-control"],
        "public, max-age=60, stale-while-revalidate=300",
      );
    } finally {
      await app.close();
    }
  },
);

test(
  "createFastifyApp aplica security headers a respuestas API publicas autenticadas y de error",
  async () => {
    const app = await createFastifyApp({
      ...fastifyAppHelpers.buildFastifyDispatchRouteStubs(),
      getNativeHealthCheckResponse: async () => ({
        statusCode: 200,
        payload: {
          success: true,
          status: "ok",
        },
      }),
      adminSystemHealthRoutes: {
        ...fastifyAppHelpers.buildAdminSystemHealthRouteStubs(),
        getAdminSessionByToken: async () => ({
          adminUserId: 1,
          expiresAt: new Date("2099-01-01T00:00:00.000Z"),
          lastAccess: new Date("2026-04-23T00:00:00.000Z"),
        }),
        getAdminUserById: async () => ({
          id: 1,
          username: "VETNEB",
        }),
        getSystemHealthSnapshot: async () => ({
          statusCode: 200,
          payload: {
            success: true,
            status: "ok",
            checks: {
              database: "up",
              storage: "up",
            },
          },
        }),
        getBackendVersion: () => "2.1.0-test",
      },
    });

    try {
      const adminAuthenticated = await app.inject({
        method: "GET",
        url: "/api/admin/system/health",
        headers: {
          cookie: `${ENV.adminCookieName}=admin-session-token`,
        },
      });

      const publicApi = await app.inject({
        method: "GET",
        url: "/api/public/pricing",
      });

      const apiError = await app.inject({
        method: "GET",
        url: "/api/no-existe",
      });

      const apiHealth = await app.inject({
        method: "GET",
        url: "/api/health",
      });

      const apiHealthWithValidRequestId = await app.inject({
        method: "GET",
        url: "/api/health",
        headers: {
          "x-request-id": "client-req_123.abc:456",
        },
      });

      const apiHealthWithInvalidRequestId = await app.inject({
        method: "GET",
        url: "/api/health",
        headers: {
          "x-request-id": "client request id",
        },
      });

      const publicRoot = await app.inject({
        method: "GET",
        url: "/",
      });

      assert.equal(adminAuthenticated.statusCode, 200);
      assert.equal(publicApi.statusCode, 200);
      assert.equal(apiError.statusCode, 404);
      assert.equal(apiHealth.statusCode, 200);

      const apiResponses = [
        { label: "adminAuthenticated", response: adminAuthenticated },
        { label: "publicApi", response: publicApi },
        { label: "apiError", response: apiError },
        { label: "apiHealth", response: apiHealth },
      ];

      for (const { label, response } of apiResponses) {
        assert.equal(
          response.headers["x-content-type-options"],
          API_NOSNIFF_HEADER_VALUE,
          `${label} debe incluir X-Content-Type-Options`,
        );
        assert.equal(
          response.headers["referrer-policy"],
          API_REFERRER_POLICY_HEADER_VALUE,
          `${label} debe incluir Referrer-Policy`,
        );
        assertRequestIdHeader(response, label);
      }

      assert.equal(
        apiHealthWithValidRequestId.headers["x-request-id"],
        "client-req_123.abc:456",
      );
      const replacementRequestId = assertRequestIdHeader(
        apiHealthWithInvalidRequestId,
        "apiHealthWithInvalidRequestId",
      );
      assert.notEqual(replacementRequestId, "client request id");

      assert.equal(publicRoot.headers["x-content-type-options"], undefined);
      assert.equal(publicRoot.headers["referrer-policy"], undefined);
      assert.equal(publicRoot.headers["x-request-id"], undefined);
    } finally {
      await app.close();
    }
  },
);

test(
  "createFastifyApp mantiene detail de profesionales pÃºblicos montado en el router nativo",
  async () => {
    let receivedClinicId: number | null = null;
    let searchHelperWasCalled = false;

    const app = await createFastifyApp({
      ...fastifyAppHelpers.buildFastifyDispatchRouteStubs(),
      publicProfessionalsRoutes: {
        searchPublicProfessionals: async () => {
          searchHelperWasCalled = true;
          throw new Error("detail dispatch must not call searchPublicProfessionals");
        },
        getPublicProfessionalByClinicId: async (clinicId: number) => {
          receivedClinicId = clinicId;

          return {
            clinicId,
            displayName: "Clinica Detail Integrada",
            avatarStoragePath: null,
            aboutText: "Detalle publico servido desde createFastifyApp",
            specialtyText: "Histopatologia",
            servicesText: "Diagnostico histopatologico",
            email: "detail@example.com",
            phone: "3413333333",
            locality: "Rosario",
            country: "AR",
            updatedAt: new Date("2026-04-26T12:00:00.000Z"),
            profileQualityScore: 0.91,
          };
        },
        createSignedStorageUrl: async (path: string) => `signed:${path}`,
      },
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/public/professionals/23",
      });

      assert.equal(response.headers["x-legacy-bridge"], undefined);
      assert.equal(response.statusCode, 200);
      assert.equal(searchHelperWasCalled, false);
      assert.equal(receivedClinicId, 23);

      assert.deepEqual(JSON.parse(response.body), {
        success: true,
        professional: {
          clinicId: 23,
          displayName: "Clinica Detail Integrada",
          avatarUrl: null,
          specialtyText: "Histopatologia",
          servicesText: "Diagnostico histopatologico",
          email: "detail@example.com",
          phone: "3413333333",
          locality: "Rosario",
          country: "AR",
          aboutText: "Detalle publico servido desde createFastifyApp",
          updatedAt: "2026-04-26T12:00:00.000Z",
          relevance: {
            rank: 0,
            similarity: 0,
            score: 0,
          },
          profileQualityScore: 0.91,
        },
      });
    } finally {
      await app.close();
    }
  },
);

test(
  "createFastifyApp despacha /api/admin/system/health al router nativo",
  async () => {
    const app = await createFastifyApp({
      ...fastifyAppHelpers.buildFastifyDispatchRouteStubs(),
      adminSystemHealthRoutes: {
        ...fastifyAppHelpers.buildAdminSystemHealthRouteStubs(),
        getAdminSessionByToken: async () => ({
          adminUserId: 1,
          expiresAt: new Date("2099-01-01T00:00:00.000Z"),
          lastAccess: new Date("2026-04-23T00:00:00.000Z"),
        }),
        getAdminUserById: async () => ({
          id: 1,
          username: "VETNEB",
        }),
        getSystemHealthSnapshot: async () => ({
          statusCode: 200,
          payload: {
            success: true,
            status: "ok",
            checks: {
              database: "up",
              storage: "up",
            },
          },
        }),
        getBackendVersion: () => "2.1.0-test",
      },
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/admin/system/health",
        headers: {
          cookie: `${ENV.adminCookieName}=admin-session-token`,
        },
      });

      assert.equal(response.statusCode, 200);
      assert.equal(response.headers["cache-control"], "no-store");

      const body = JSON.parse(response.body);
      assert.equal(body.success, true);
      assert.equal(body.version, "2.1.0-test");
      assert.deepEqual(body.services, {
        database: "up",
        storage: "up",
        smtp: ENV.smtp.enabled ? "configured" : "not_configured",
        gmail_api: ENV.gmailApi.enabled ? "configured" : "not_configured",
        email_transport: ENV.gmailApi.enabled
          ? "gmail_api"
          : ENV.smtp.enabled
            ? "smtp"
            : "not_configured",
        ...fastifyAppHelpers.buildExpectedContactServiceSnapshot(),
        ...fastifyAppHelpers.buildExpectedCorsSnapshot(),
      });
    } finally {
      await app.close();
    }
  },
);

test(
  "createFastifyApp despacha /api/admin/failed-login-alerts al router nativo",
  async () => {
    const app = await createFastifyApp({
      ...fastifyAppHelpers.buildFastifyDispatchRouteStubs(),
      adminFailedLoginAlertsRoutes: {
        ...fastifyAppHelpers.buildAdminFailedLoginAlertsRouteStubs(),
        getAdminSessionByToken: async () => ({
          id: 99,
          adminUserId: 1,
          expiresAt: new Date("2099-01-01T00:00:00.000Z"),
          lastAccess: new Date("2026-05-08T00:00:00.000Z"),
        }),
        getAdminUserById: async () => ({
          id: 1,
          username: "VETNEB",
        }),
        listAdminFailedLoginAlerts: async () => ({
          success: true as const,
          failedLoginAlerts: [
            {
              id: 10,
              surface: "admin",
              username: "VETNEB",
              reason: "invalid_credentials",
              ipAddress: "203.0.113.10",
              userAgent: "node-test",
              createdAt: "2026-05-08T00:00:00.000Z",
            },
          ],
          count: 1,
          total: 1,
          limit: 5,
          offset: 0,
          filters: {
            surface: "admin",
            reason: null,
          },
        }),
      },
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/admin/failed-login-alerts?surface=admin&limit=5",
        headers: {
          cookie: `${ENV.adminCookieName}=admin-session-token`,
        },
      });

      assert.equal(response.headers["x-legacy-bridge"], undefined);
      assert.equal(response.statusCode, 200);
      assert.equal(response.headers["cache-control"], "no-store");

      const body = JSON.parse(response.body);

      assert.equal(body.success, true);
      assert.equal(body.count, 1);
      assert.equal(body.failedLoginAlerts[0].surface, "admin");
      assert.equal(body.failedLoginAlerts[0].tokenHash, undefined);
      assert.equal(JSON.stringify(body).includes("hash:"), false);
    } finally {
      await app.close();
    }
  },
);


test(
  "createFastifyApp despacha /api/admin/failed-login-alerts/export.csv al router nativo",
  async () => {
    let receivedParams: any = null;

    const app = await createFastifyApp({
      ...fastifyAppHelpers.buildFastifyDispatchRouteStubs(),
      adminFailedLoginAlertsRoutes: {
        ...fastifyAppHelpers.buildAdminFailedLoginAlertsRouteStubs(),
        getAdminSessionByToken: async () => ({
          id: 99,
          adminUserId: 1,
          expiresAt: new Date("2099-01-01T00:00:00.000Z"),
          lastAccess: new Date("2026-05-08T00:00:00.000Z"),
        }),
        getAdminUserById: async () => ({
          id: 1,
          username: "VETNEB",
        }),
        listAdminFailedLoginAlerts: async (params: any) => {
          receivedParams = params;

          return {
            success: true as const,
            failedLoginAlerts: [
              {
                id: 10,
                surface: "admin" as const,
                username: "VETNEB",
                reason: "invalid_credentials" as const,
                ipAddress: "203.0.113.10",
                userAgent: "node-test",
                createdAt: "2026-05-08T00:00:00.000Z",
              },
            ],
            count: 1,
            total: 1,
            limit: params.limit ?? 50,
            offset: params.offset ?? 0,
            filters: {
              surface: params.surface ?? null,
              reason: params.reason ?? null,
            },
          };
        },
        buildAdminFailedLoginAlertsCsv: () =>
          [
            "id,surface,username,reason,ipAddress,userAgent,createdAt",
            "10,admin,VETNEB,invalid_credentials,203.0.113.10,node-test,2026-05-08T00:00:00.000Z",
          ].join("\n"),
        buildAdminFailedLoginAlertsCsvFilename: () =>
          "admin-failed-login-alerts-test.csv",
      },
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/admin/failed-login-alerts/export.csv?surface=admin&reason=invalid_credentials&limit=5&offset=5",
        headers: {
          cookie: `${ENV.adminCookieName}=admin-session-token`,
        },
      });

      assert.equal(response.headers["x-legacy-bridge"], undefined);
      assert.equal(response.statusCode, 200);
      assert.equal(response.headers["content-type"], "text/csv; charset=utf-8");
      assert.equal(
        response.headers["content-disposition"],
        'attachment; filename="admin-failed-login-alerts-test.csv"',
      );
      assert.deepEqual(receivedParams, {
        surface: "admin",
        reason: "invalid_credentials",
        limit: 10000,
        offset: 0,
      });
      assert.equal(
        response.body,
        [
          "id,surface,username,reason,ipAddress,userAgent,createdAt",
          "10,admin,VETNEB,invalid_credentials,203.0.113.10,node-test,2026-05-08T00:00:00.000Z",
        ].join("\n"),
      );
      assert.equal(response.body.includes("tokenHash"), false);
      assert.equal(response.body.includes("hash:"), false);
      assert.equal(response.body.includes("password"), false);
      assert.equal(response.body.includes("cookie"), false);
    } finally {
      await app.close();
    }
  },
);

test(
  "createFastifyApp instrumenta metricas in-process sin alterar el contrato HTTP",
  async () => {
    const { createObservabilityMetricsRegistry } = await import(
      "../../../server/lib/observability-metrics.ts"
    );
    const observabilityMetricsRegistry = createObservabilityMetricsRegistry();
    const app = await createFastifyApp({
      ...fastifyAppHelpers.buildFastifyDispatchRouteStubs(),
      observabilityMetricsRegistry,
    });

    const originalConsoleError = console.error;
    const consoleErrorCalls: unknown[][] = [];

    console.error = (...args: unknown[]) => {
      consoleErrorCalls.push(args);
    };

    try {
      app.get("/api/__metrics/boom", async () => {
        throw new Error("detalle interno sensible");
      });
      app.get("/api/__metrics/ok", async () => ({ success: true }));

      const health = await app.inject({
        method: "GET",
        url: "/api/__metrics/ok",
      });
      const notFound = await app.inject({
        method: "GET",
        url: "/api/__metrics/no-existe",
      });
      const failure = await app.inject({
        method: "GET",
        url: "/api/__metrics/boom",
      });

      assert.equal(health.statusCode, 200);
      assert.equal(notFound.statusCode, 404);
      assert.equal(failure.statusCode, 500);
      assert.deepEqual(JSON.parse(failure.body), {
        success: false,
        error: "Error interno del servidor",
        path: "/api/__metrics/boom",
        requestId: assertRequestIdHeader(failure, "failure"),
      });

      const snapshot = observabilityMetricsRegistry.getSnapshot();

      assert.equal(snapshot.requestsStartedTotal, 3);
      assert.equal(snapshot.requestsCompletedTotal, 3);
      assert.equal(snapshot.inFlightRequests, 0);
      assert.equal(snapshot.responsesByStatusClass["2xx"], 1);
      assert.equal(snapshot.responsesByStatusClass["4xx"], 1);
      assert.equal(snapshot.responsesByStatusClass["5xx"], 1);
      assert.equal(snapshot.serverErrors5xxTotal, 1);
      assert.equal(snapshot.serverErrorRate, 0.3333);
      assert.equal(snapshot.latencyMs.count, 3);
      assert.equal(typeof snapshot.latencyMs.p95, "number");

      const routeKeys = snapshot.routes.map((route) => route.route).sort();

      assert.deepEqual(routeKeys, [
        "GET /api/__metrics/boom",
        "GET /api/__metrics/ok",
        "GET UNMATCHED_ROUTE",
      ]);

      const serializedRoutes = JSON.stringify(snapshot.routes);

      assert.equal(serializedRoutes.includes("no-existe"), false);
      assert.equal(serializedRoutes.includes("?"), false);

      const errorLog = assertApiErrorLogRequestId(
        consoleErrorCalls,
        0,
        assertRequestIdHeader(failure, "failure"),
        "metricsFailure",
      );

      assert.equal(errorLog.status, 500);
      assert.equal(errorLog.errorName, "Error");
      assert.equal(errorLog.routeTemplate, "/api/__metrics/boom");
      assert.equal("path" in errorLog, false);
      assert.equal("url" in errorLog, false);
      assert.equal(
        serializeConsoleCalls(consoleErrorCalls).includes(
          "detalle interno sensible",
        ),
        false,
      );
    } finally {
      console.error = originalConsoleError;
      await app.close();
    }
  },
);

test(
  "createFastifyApp mantiene la respuesta cuando la instrumentacion de metricas falla",
  async () => {
    const failingRegistry = {
      recordRequestStarted() {
        throw new Error("metrics start failure");
      },
      recordRequestCompleted() {
        throw new Error("metrics complete failure");
      },
      recordRequestAborted() {
        throw new Error("metrics abort failure");
      },
      getSnapshot() {
        throw new Error("metrics snapshot failure");
      },
      reset() {},
    };

    const app = await createFastifyApp({
      ...fastifyAppHelpers.buildFastifyDispatchRouteStubs(),
      observabilityMetricsRegistry: failingRegistry as never,
    });

    try {
      app.get("/api/__metrics/resilient", async () => ({ success: true }));

      const response = await app.inject({
        method: "GET",
        url: "/api/__metrics/resilient",
      });

      assert.equal(response.statusCode, 200);
      assert.deepEqual(JSON.parse(response.body), { success: true });
      assertRequestIdHeader(response, "respuestaConMetricasRotas");
    } finally {
      await app.close();
    }
  },
);

test(
  "logs y metricas de rutas con IDs reales sólo conservan el route template",
  async () => {
    const { createObservabilityMetricsRegistry } = await import(
      "../../../server/lib/observability-metrics.ts"
    );
    const observabilityMetricsRegistry = createObservabilityMetricsRegistry();
    const app = await createFastifyApp({
      ...fastifyAppHelpers.buildFastifyDispatchRouteStubs(),
      observabilityMetricsRegistry,
    });

    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    const consoleLogCalls: unknown[][] = [];
    const consoleErrorCalls: unknown[][] = [];

    console.log = (...args: unknown[]) => {
      consoleLogCalls.push(args);
    };
    console.error = (...args: unknown[]) => {
      consoleErrorCalls.push(args);
    };

    try {
      app.get(
        "/api/__ids/clinics/:clinicId/reports/:reportId",
        async () => ({ success: true }),
      );
      app.get("/api/__ids/clinics/:clinicId/boom", async () => {
        throw new Error("detalle interno sensible");
      });

      const ok = await app.inject({
        method: "GET",
        url: "/api/__ids/clinics/307/reports/4821?trackingCaseId=99&token=raw-secret",
      });
      const unmatched = await app.inject({
        method: "GET",
        url: "/api/__ids/clinics/307/no-existe",
      });
      const failure = await app.inject({
        method: "GET",
        url: "/api/__ids/clinics/307/boom",
      });

      assert.equal(ok.statusCode, 200);
      assert.equal(unmatched.statusCode, 404);
      assert.equal(failure.statusCode, 500);

      assertRequestIdHeader(ok, "okConIds");

      // Se inspeccionan las dimensiones string deterministas: requestId es un
      // UUID y durationMs un float, de modo que incluirlos en un scan de
      // substrings volveria el assert dependiente del azar.
      const loggedDimensions = consoleLogCalls
        .map((call) => String(call[0]))
        .map((line) => JSON.parse(line) as { context: Record<string, unknown> })
        .map(({ context }) =>
          JSON.stringify({
            method: context.method,
            routeTemplate: context.routeTemplate,
            statusClass: context.statusClass,
          }),
        )
        .join("\n");

      for (const leaked of [
        "307",
        "4821",
        "trackingCaseId",
        "raw-secret",
        "no-existe",
        "REDACTED",
        "path",
        "url",
      ]) {
        assert.equal(
          loggedDimensions.includes(leaked),
          false,
          `los access logs no deben conservar ${leaked}`,
        );
      }

      // El 404 se agrega bajo UNMATCHED_ROUTE, sin el pathname original.
      const snapshot = observabilityMetricsRegistry.getSnapshot();
      const routeKeys = snapshot.routes.map((route) => route.route).sort();

      assert.deepEqual(routeKeys, [
        "GET /api/__ids/clinics/:clinicId/boom",
        "GET /api/__ids/clinics/:clinicId/reports/:reportId",
        "GET UNMATCHED_ROUTE",
      ]);

      // Las route keys son la unica dimension libre del snapshot; el resto son
      // contadores y latencias numericas.
      const serializedRouteKeys = JSON.stringify(routeKeys);

      for (const leaked of [
        "307",
        "4821",
        "clinicId=",
        "reportId=",
        "trackingCaseId",
        "raw-secret",
        "no-existe",
        "?",
      ]) {
        assert.equal(
          serializedRouteKeys.includes(leaked),
          false,
          `las metricas no deben conservar ${leaked}`,
        );
      }

      const errorLog = assertApiErrorLogRequestId(
        consoleErrorCalls,
        0,
        assertRequestIdHeader(failure, "failureConIds"),
        "failureConIds",
      );

      assert.equal(errorLog.routeTemplate, "/api/__ids/clinics/:clinicId/boom");

      const { requestId: loggedRequestId, ...errorLogDimensions } = errorLog;

      assert.equal(typeof loggedRequestId, "string");
      assert.equal(JSON.stringify(errorLogDimensions).includes("307"), false);
      assert.equal(
        serializeConsoleCalls(consoleErrorCalls).includes(
          "detalle interno sensible",
        ),
        false,
      );
    } finally {
      console.log = originalConsoleLog;
      console.error = originalConsoleError;
      await app.close();
    }
  },
);

test(
  "el access log estructurado correlaciona con X-Request-ID en la app integrada",
  async () => {
    const app = await createFastifyApp(
      fastifyAppHelpers.buildFastifyDispatchRouteStubs(),
    );

    const originalConsoleLog = console.log;
    const consoleLogCalls: unknown[][] = [];

    console.log = (...args: unknown[]) => {
      consoleLogCalls.push(args);
    };

    try {
      const incomingRequestId = "client-req_correlation.1:2";
      const response = await app.inject({
        method: "GET",
        url: "/api/admin/audit-log?limit=25&token=raw-secret",
        headers: {
          "x-request-id": incomingRequestId,
        },
      });

      const headerRequestId = assertRequestIdHeader(response, "accessLog");

      assert.equal(headerRequestId, incomingRequestId);

      const accessLogLine = consoleLogCalls
        .map((call) => String(call[0]))
        .find((line) => line.includes("HTTP_REQUEST_COMPLETED"));

      assert.equal(typeof accessLogLine, "string");

      const logEvent = JSON.parse(accessLogLine as string) as {
        requestId?: string;
        context: Record<string, unknown>;
      };

      assert.equal(logEvent.requestId, headerRequestId);
      assert.equal(logEvent.context.routeTemplate, "/api/admin/audit-log");
      assert.deepEqual(Object.keys(logEvent.context).sort(), [
        "durationMs",
        "method",
        "rateLimited",
        "routeTemplate",
        "statusClass",
        "statusCode",
      ]);
      assert.equal((accessLogLine as string).includes("raw-secret"), false);
      assert.equal((accessLogLine as string).includes("limit=25"), false);
      assert.equal((accessLogLine as string).includes("REDACTED"), false);
    } finally {
      console.log = originalConsoleLog;
      await app.close();
    }
  },
);

test(
  "los errores de pricing se correlacionan con X-Request-ID sin metadata extra",
  async () => {
    // El name viene manipulado a proposito con forma de identificador valido
    // ("MariaGomez" pasaria una regex sintactica de tipo /^[A-Za-z][\w]*$/):
    // sólo una allowlist finita de nombres de Error nativos lo rechaza. Sin
    // esa allowlist, un Error construido por una libreria o por datos
    // externos filtraria PII al log a traves del nombre de la clase.
    const sensitiveErrorMessage =
      "Paciente Maria Gomez biopsia con celulas atipicas tutor@example.com";
    const listFailure = () => {
      const failure = new Error(sensitiveErrorMessage);

      failure.name = "MariaGomez";

      throw failure;
    };

    const app = await createFastifyApp({
      ...fastifyAppHelpers.buildFastifyDispatchRouteStubs(),
      adminPricingRoutes: {
        deleteAdminSession: async () => {},
        getAdminSessionByToken: async () => ({
          id: 1,
          adminUserId: 1,
          expiresAt: new Date("2099-01-01T00:00:00.000Z"),
        }),
        getAdminUserById: async () => ({ id: 1, username: "VETNEB" }),
        updateAdminSessionLastAccess: async () => {},
        hashSessionToken: (token: string) => `hash:${token}`,
        listAdminPricingItems: listFailure,
        updatePricingItem: listFailure,
        writeAuditLog: async () => {},
      },
      publicPricingRoutes: {
        listPublicPricingItems: listFailure,
      },
    });

    const { invalidatePublicPricingCache } = await import(
      "../../../server/features/pricing/admin-pricing-service.ts"
    );

    // El listado publico se sirve con read-through cache: sin invalidarla, una
    // suite previa del mismo proceso puede devolver 200 desde memoria.
    invalidatePublicPricingCache();

    const originalConsoleError = console.error;
    const consoleErrorCalls: unknown[][] = [];

    console.error = (...args: unknown[]) => {
      consoleErrorCalls.push(args);
    };

    try {
      const adminCookie = `${ENV.adminCookieName}=admin-session-value`;
      const allowedOrigin = ENV.corsOrigins[0] ?? "http://localhost:3000";

      const cases = [
        {
          label: "ADMIN_PRICING_LIST_ERROR",
          routeTemplate: "/api/admin/pricing",
          response: await app.inject({
            method: "GET",
            url: "/api/admin/pricing",
            headers: { cookie: adminCookie },
          }),
          expectedBody: {
            success: false,
            error: "No se pudieron cargar los precios administrables.",
          },
        },
        {
          label: "ADMIN_PRICING_PATCH_ERROR",
          routeTemplate: "/api/admin/pricing/:id",
          response: await app.inject({
            method: "PATCH",
            url: "/api/admin/pricing/4821",
            headers: { cookie: adminCookie, origin: allowedOrigin },
            payload: { isActive: false },
          }),
          expectedBody: {
            success: false,
            error: "No se pudieron guardar los cambios de precio.",
          },
        },
        {
          label: "PUBLIC_PRICING_LIST_ERROR",
          routeTemplate: "/api/public/pricing",
          response: await app.inject({
            method: "GET",
            url: "/api/public/pricing",
          }),
          expectedBody: {
            success: false,
            error: "Error interno del servidor",
          },
        },
      ];

      const logLines = consoleErrorCalls.map((call) => String(call[0]));

      for (const testCase of cases) {
        assert.equal(testCase.response.statusCode, 500, testCase.label);

        const headerRequestId = assertRequestIdHeader(
          testCase.response,
          testCase.label,
        );

        assert.deepEqual(JSON.parse(testCase.response.body), {
          ...testCase.expectedBody,
          requestId: headerRequestId,
        });

        const logLine = logLines.find((line) =>
          line.includes(`"event":"${testCase.label}"`),
        );

        assert.equal(typeof logLine, "string", testCase.label);

        const logEvent = JSON.parse(logLine as string) as {
          level: string;
          event: string;
          requestId?: string;
          context: Record<string, unknown>;
        };

        assert.equal(logEvent.event, testCase.label);
        assert.equal(logEvent.level, "error");

        // requestId se promueve al nivel superior y no queda duplicado.
        assert.equal(logEvent.requestId, headerRequestId);
        assert.equal("requestId" in logEvent.context, false);

        // El name manipulado se degrada a la allowlist del logger.
        assert.deepEqual(logEvent.context, {
          routeTemplate: testCase.routeTemplate,
          errorName: "Error",
        });
        assert.deepEqual(Object.keys(logEvent.context).sort(), [
          "errorName",
          "routeTemplate",
        ]);

        for (const forbidden of [
          sensitiveErrorMessage,
          "Maria",
          "Gomez",
          "biopsia",
          "atipicas",
          "tutor@example.com",
          "MariaGomez",
          "admin-session-value",
          "hash:",
          "VETNEB",
          "4821",
          "isActive",
          "cookie",
          "session",
          "message",
          "stack",
          "path",
          "url",
          "body",
        ]) {
          assert.equal(
            (logLine as string).includes(forbidden),
            false,
            `${testCase.label} no debe registrar ${forbidden}`,
          );
        }

        // "error" se verifica contra el context porque el nivel del evento es
        // literalmente "error" en el nivel superior del JSON.
        const serializedContext = JSON.stringify(logEvent.context);

        for (const forbiddenKey of [
          "error",
          "message",
          "stack",
          "path",
          "url",
          "body",
          "cookie",
          "session",
          "messageSanitized",
          "code",
          "params",
        ]) {
          assert.equal(
            forbiddenKey in (logEvent.context as Record<string, unknown>),
            false,
            `${testCase.label} no debe registrar la clave ${forbiddenKey}`,
          );
          assert.equal(
            serializedContext.includes(`"${forbiddenKey}"`),
            false,
            `${testCase.label} no debe serializar ${forbiddenKey}`,
          );
        }
      }
    } finally {
      console.error = originalConsoleError;
      invalidatePublicPricingCache();
      await app.close();
    }
  },
);

test(
  "un request finalizado por la app no vuelve a finalizarse ante un aborto",
  async () => {
    const {
      createObservabilityMetricsRegistry,
      createObservabilityRequestFinalizer,
    } = await import("../../../server/lib/observability-metrics.ts");
    const observabilityMetricsRegistry = createObservabilityMetricsRegistry();
    const app = await createFastifyApp({
      ...fastifyAppHelpers.buildFastifyDispatchRouteStubs(),
      observabilityMetricsRegistry,
    });

    try {
      app.get("/api/__finalize/ok", async () => ({ success: true }));

      const response = await app.inject({
        method: "GET",
        url: "/api/__finalize/ok",
      });

      assert.equal(response.statusCode, 200);

      const afterResponse = observabilityMetricsRegistry.getSnapshot();

      assert.equal(afterResponse.requestsStartedTotal, 1);
      assert.equal(afterResponse.requestsCompletedTotal, 1);
      assert.equal(afterResponse.inFlightRequests, 0);
      assert.equal(afterResponse.responsesByStatusClass["2xx"], 1);
      assert.equal(afterResponse.latencyMs.count, 1);

      // Contrato de finalizacion once-only: el mismo finalizer que ya cerro el
      // request no puede volver a tocar la registry por la via de aborto.
      const finalizer = createObservabilityRequestFinalizer(
        observabilityMetricsRegistry,
      );

      assert.equal(
        finalizer.recordCompleted({
          method: "GET",
          routeTemplate: "/api/__finalize/ok",
          statusCode: 200,
          durationMs: 1,
        }),
        true,
      );
      assert.equal(finalizer.recordAborted(), false);
      assert.equal(finalizer.recordCompleted({
        method: "GET",
        routeTemplate: "/api/__finalize/ok",
        statusCode: 200,
        durationMs: 1,
      }), false);

      const afterFinalizer = observabilityMetricsRegistry.getSnapshot();

      assert.equal(afterFinalizer.requestsCompletedTotal, 2);
      assert.equal(afterFinalizer.inFlightRequests, 0);
    } finally {
      await app.close();
    }
  },
);

function buildAuthenticatedAdminSystemHealthStubs(
  overrides: Record<string, unknown> = {},
) {
  return {
    ...fastifyAppHelpers.buildAdminSystemHealthRouteStubs(),
    getAdminSessionByToken: async () => ({
      adminUserId: 1,
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      lastAccess: new Date("2026-07-31T00:00:00.000Z"),
    }),
    getAdminUserById: async () => ({ id: 1, username: "VETNEB" }),
    ...overrides,
  };
}

test(
  "el endpoint privado de metricas lee la registry instrumentada por createFastifyApp",
  async () => {
    const { createObservabilityMetricsRegistry } = await import(
      "../../../server/lib/observability-metrics.ts"
    );
    const observabilityMetricsRegistry = createObservabilityMetricsRegistry();
    const sentinelRoute = "/api/__injected-registry-sentinel";

    // La sentinel se siembra directamente en la registry inyectada: no es
    // alcanzable por HTTP, asi que su presencia prueba que el endpoint consulta
    // esta instancia y no otra.
    observabilityMetricsRegistry.recordRequestStarted();
    observabilityMetricsRegistry.recordRequestCompleted({
      method: "GET",
      routeTemplate: sentinelRoute,
      statusCode: 200,
      durationMs: 17,
    });

    const app = await createFastifyApp({
      ...fastifyAppHelpers.buildFastifyDispatchRouteStubs(),
      observabilityMetricsRegistry,
      adminSystemHealthRoutes: buildAuthenticatedAdminSystemHealthStubs(),
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/admin/system/health/metrics",
        headers: {
          cookie: `${ENV.adminCookieName}=admin-session-value`,
        },
      });

      assert.equal(response.statusCode, 200);

      const body = JSON.parse(response.body) as {
        success: boolean;
        metrics: {
          routes: Array<{ route: string; count: number; p50: number | null }>;
          requestsStartedTotal: number;
          inFlightRequests: number;
          requestsCompletedTotal: number;
          latencyMs: { count: number };
        };
      };

      assert.equal(body.success, true);

      const sentinelEntry = body.metrics.routes.find(
        (route) => route.route === `GET ${sentinelRoute}`,
      );

      assert.ok(
        sentinelEntry,
        "el endpoint debe exponer la ruta sembrada en la registry inyectada",
      );
      assert.equal(sentinelEntry.count, 1);
      assert.equal(sentinelEntry.p50, 17);

      // El propio GET /metrics ya esta iniciado y en vuelo cuando el handler
      // toma el snapshot: se afirma la semantica, no un conteo cerrado.
      assert.equal(body.metrics.requestsStartedTotal >= 2, true);
      assert.equal(body.metrics.inFlightRequests >= 1, true);
      assert.equal(body.metrics.requestsCompletedTotal >= 1, true);
      assert.equal(body.metrics.latencyMs.count >= 1, true);

      // No es una fixture estatica: la registry sigue viva y acumula.
      const afterResponse = observabilityMetricsRegistry.getSnapshot();

      assert.equal(afterResponse.inFlightRequests, 0);
      assert.equal(
        afterResponse.routes.some(
          (route) => route.route === "GET /api/admin/system/health/metrics",
        ),
        true,
      );
    } finally {
      await app.close();
    }
  },
);

test(
  "adminSystemHealthRoutes puede sobrescribir el getter de metricas inyectado",
  async () => {
    const { createObservabilityMetricsRegistry } = await import(
      "../../../server/lib/observability-metrics.ts"
    );
    const observabilityMetricsRegistry = createObservabilityMetricsRegistry();

    observabilityMetricsRegistry.recordRequestStarted();
    observabilityMetricsRegistry.recordRequestCompleted({
      method: "GET",
      routeTemplate: "/api/__injected-registry-sentinel",
      statusCode: 200,
      durationMs: 17,
    });

    const overrideSnapshot = {
      startedAt: "2026-07-31T00:00:00.000Z",
      uptimeSeconds: 42,
      requestsStartedTotal: 7,
      requestsCompletedTotal: 7,
      inFlightRequests: 0,
      responsesByStatusClass: {
        "1xx": 0,
        "2xx": 7,
        "3xx": 0,
        "4xx": 0,
        "5xx": 0,
      },
      serverErrors5xxTotal: 0,
      serverErrorRate: 0,
      rateLimitedResponsesTotal: 0,
      latencyMs: {
        count: 7,
        min: 1,
        max: 9,
        average: 4,
        p50: 4,
        p95: 9,
        p99: 9,
      },
      routes: [
        {
          route: "GET /api/__override-snapshot-sentinel",
          count: 7,
          serverErrors5xx: 0,
          p50: 4,
          p95: 9,
        },
      ],
      routeKeysTracked: 1,
      routeKeyLimitReached: false,
      latencySampleLimit: 1024,
    } as const;

    const app = await createFastifyApp({
      ...fastifyAppHelpers.buildFastifyDispatchRouteStubs(),
      observabilityMetricsRegistry,
      adminSystemHealthRoutes: buildAuthenticatedAdminSystemHealthStubs({
        getObservabilityMetricsSnapshot: () => overrideSnapshot,
      }),
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/admin/system/health/metrics",
        headers: {
          cookie: `${ENV.adminCookieName}=admin-session-value`,
        },
      });

      assert.equal(response.statusCode, 200);

      // El spread de options va despues del getter por defecto: un override
      // explicito sigue ganando.
      assert.deepEqual(JSON.parse(response.body), {
        success: true,
        metrics: overrideSnapshot,
      });
      assert.equal(
        response.body.includes("__injected-registry-sentinel"),
        false,
      );
    } finally {
      await app.close();
    }
  },
);
