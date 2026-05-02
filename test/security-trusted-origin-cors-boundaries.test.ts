import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Fastify from "fastify";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { ENV } = await import("../server/lib/env.ts");
const {
  adminAuthNativeRoutes,
} = await import("../server/routes/admin-auth.fastify.ts");
const {
  clinicAuthNativeRoutes,
} = await import("../server/routes/auth.fastify.ts");
const {
  particularAuthNativeRoutes,
} = await import("../server/routes/particular-auth.fastify.ts");
const {
  publicReportAccessNativeRoutes,
} = await import("../server/routes/public-report-access.fastify.ts");

const ALLOWED_ORIGIN = "http://localhost:3000";
const BLOCKED_ORIGIN = "https://evil.example";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

function assertContains(source: string, expected: string, file: string): void {
  assert.ok(
    source.includes(expected),
    `${file}: falta invariant esperado: ${expected}`,
  );
}

function assertNotContains(source: string, forbidden: string, file: string): void {
  assert.ok(
    !source.includes(forbidden),
    `${file}: no debe contener invariant prohibido: ${forbidden}`,
  );
}

function failUnexpectedCall(name: string): never {
  throw new Error(`${name} no debe ejecutarse en esta frontera`);
}

function assertForbiddenOriginResponse(response: {
  statusCode: number;
  headers: Record<string, unknown>;
  body: string;
}) {
  assert.equal(response.statusCode, 403);
  assert.equal(response.headers["access-control-allow-origin"], undefined);
  assert.equal(response.headers["access-control-allow-credentials"], undefined);
  assert.equal(response.headers["set-cookie"], undefined);
  assert.deepEqual(JSON.parse(response.body), {
    success: false,
    error: "Origen no permitido",
  });
}

async function createClinicAuthApp() {
  const app = Fastify();

  await app.register(clinicAuthNativeRoutes as any, {
    prefix: "/api/auth",
    createActiveSession: async () => failUnexpectedCall("createActiveSession"),
    deleteActiveSession: async () => failUnexpectedCall("deleteActiveSession"),
    getActiveSessionByToken: async () =>
      failUnexpectedCall("getActiveSessionByToken"),
    getClinicUserById: async () => failUnexpectedCall("getClinicUserById"),
    getClinicUserByUsername: async () =>
      failUnexpectedCall("getClinicUserByUsername"),
    updateSessionLastAccess: async () =>
      failUnexpectedCall("updateSessionLastAccess"),
    upsertClinicUser: async () => failUnexpectedCall("upsertClinicUser"),
    generateSessionToken: () => failUnexpectedCall("generateSessionToken"),
    hashPassword: async () => failUnexpectedCall("hashPassword"),
    hashSessionToken: () => failUnexpectedCall("hashSessionToken"),
    verifyPassword: async () => failUnexpectedCall("verifyPassword"),
    writeAuditLog: async () => failUnexpectedCall("writeAuditLog"),
  });

  return app;
}

async function createAdminAuthApp() {
  const app = Fastify();

  await app.register(adminAuthNativeRoutes as any, {
    prefix: "/api/admin/auth",
    createAdminSession: async () => failUnexpectedCall("createAdminSession"),
    deleteAdminSession: async () => failUnexpectedCall("deleteAdminSession"),
    getAdminSessionByToken: async () =>
      failUnexpectedCall("getAdminSessionByToken"),
    getAdminUserById: async () => failUnexpectedCall("getAdminUserById"),
    getAdminUserByUsername: async () =>
      failUnexpectedCall("getAdminUserByUsername"),
    updateAdminSessionLastAccess: async () =>
      failUnexpectedCall("updateAdminSessionLastAccess"),
    generateSessionToken: () => failUnexpectedCall("generateSessionToken"),
    hashSessionToken: () => failUnexpectedCall("hashSessionToken"),
    verifyPassword: async () => failUnexpectedCall("verifyPassword"),
    writeAuditLog: async () => failUnexpectedCall("writeAuditLog"),
  });

  return app;
}

async function createParticularAuthApp() {
  const app = Fastify();

  await app.register(particularAuthNativeRoutes as any, {
    prefix: "/api/particular/auth",
    createParticularSession: async () =>
      failUnexpectedCall("createParticularSession"),
    deleteParticularSession: async () =>
      failUnexpectedCall("deleteParticularSession"),
    getParticularSessionByToken: async () =>
      failUnexpectedCall("getParticularSessionByToken"),
    getParticularTokenById: async () =>
      failUnexpectedCall("getParticularTokenById"),
    getParticularTokenByTokenHash: async () =>
      failUnexpectedCall("getParticularTokenByTokenHash"),
    updateParticularSessionLastAccess: async () =>
      failUnexpectedCall("updateParticularSessionLastAccess"),
    updateParticularTokenLastLogin: async () =>
      failUnexpectedCall("updateParticularTokenLastLogin"),
    getReportById: async () => failUnexpectedCall("getReportById"),
    createSignedReportUrl: async () =>
      failUnexpectedCall("createSignedReportUrl"),
    createSignedReportDownloadUrl: async () =>
      failUnexpectedCall("createSignedReportDownloadUrl"),
    generateSessionToken: () => failUnexpectedCall("generateSessionToken"),
    hashSessionToken: () => failUnexpectedCall("hashSessionToken"),
  });

  return app;
}

async function createPublicReportAccessApp(overrides: Record<string, unknown>) {
  const app = Fastify();

  await app.register(publicReportAccessNativeRoutes as any, {
    prefix: "/api/public/report-access",
    getReportAccessTokenWithReportByTokenHash: async () => null,
    recordReportAccessTokenAccess: async () => null,
    createSignedReportUrl: async (storagePath: string) =>
      `signed-preview:${storagePath}`,
    createSignedReportDownloadUrl: async (
      storagePath: string,
      fileName?: string,
    ) => `signed-download:${storagePath}:${fileName ?? ""}`,
    hashSessionToken: (token: string) => `hash:${token}`,
    writeAuditLog: async () => {},
    ...overrides,
  });

  return app;
}

function createReportFixture(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}

function createReportAccessTokenFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 9,
    clinicId: 3,
    reportId: 55,
    tokenLast4: "ABCD",
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
    ...overrides,
  };
}

test("auth login y mutations bloquean Origin no permitido antes de tocar dependencias", async () => {
  const scenarios = [
    {
      name: "clinic auth",
      createApp: createClinicAuthApp,
      loginUrl: "/api/auth/login",
      logoutUrl: "/api/auth/logout",
      cookie: `${ENV.cookieName}=session-token`,
      payload: {
        username: "vetneb",
        password: "secret",
      },
    },
    {
      name: "admin auth",
      createApp: createAdminAuthApp,
      loginUrl: "/api/admin/auth/login",
      logoutUrl: "/api/admin/auth/logout",
      cookie: `${ENV.adminCookieName}=admin-session-token`,
      payload: {
        username: "VETNEB",
        password: "secret",
      },
    },
    {
      name: "particular auth",
      createApp: createParticularAuthApp,
      loginUrl: "/api/particular/auth/login",
      logoutUrl: "/api/particular/auth/logout",
      cookie: `${ENV.particularCookieName}=particular-session-token`,
      payload: {
        token: "PARTICULAR-RAW-TOKEN",
      },
    },
  ];

  for (const scenario of scenarios) {
    const app = await scenario.createApp();

    try {
      const loginResponse = await app.inject({
        method: "POST",
        url: scenario.loginUrl,
        headers: {
          origin: BLOCKED_ORIGIN,
        },
        payload: scenario.payload,
      });

      assertForbiddenOriginResponse(loginResponse);

      const logoutResponse = await app.inject({
        method: "POST",
        url: scenario.logoutUrl,
        headers: {
          origin: BLOCKED_ORIGIN,
          cookie: scenario.cookie,
        },
      });

      assertForbiddenOriginResponse(logoutResponse);
    } finally {
      await app.close();
    }
  }
});

test("auth preflight OPTIONS solo expone CORS con origins confiables y sin wildcard credentials", async () => {
  const scenarios = [
    {
      name: "clinic auth",
      createApp: createClinicAuthApp,
      urls: ["/api/auth/login", "/api/auth/me", "/api/auth/logout"],
    },
    {
      name: "admin auth",
      createApp: createAdminAuthApp,
      urls: [
        "/api/admin/auth/login",
        "/api/admin/auth/me",
        "/api/admin/auth/logout",
      ],
    },
    {
      name: "particular auth",
      createApp: createParticularAuthApp,
      urls: [
        "/api/particular/auth/login",
        "/api/particular/auth/me",
        "/api/particular/auth/logout",
        "/api/particular/auth/report/preview-url",
        "/api/particular/auth/report/download-url",
      ],
    },
  ];

  for (const scenario of scenarios) {
    const app = await scenario.createApp();

    try {
      for (const url of scenario.urls) {
        const allowedResponse = await app.inject({
          method: "OPTIONS",
          url,
          headers: {
            origin: ALLOWED_ORIGIN,
            "access-control-request-headers":
              "content-type,x-requested-with",
          },
        });

        assert.equal(
          allowedResponse.statusCode,
          204,
          `${scenario.name} ${url}`,
        );
        assert.equal(allowedResponse.body, "");
        assert.equal(
          allowedResponse.headers["access-control-allow-origin"],
          ALLOWED_ORIGIN,
        );
        assert.notEqual(
          allowedResponse.headers["access-control-allow-origin"],
          "*",
        );
        assert.equal(
          allowedResponse.headers["access-control-allow-credentials"],
          "true",
        );
        assert.equal(
          allowedResponse.headers["access-control-allow-methods"],
          "GET,POST,OPTIONS",
        );
        assert.equal(
          allowedResponse.headers["access-control-allow-headers"],
          "content-type,x-requested-with",
        );
        assert.equal(allowedResponse.headers["set-cookie"], undefined);

        const blockedResponse = await app.inject({
          method: "OPTIONS",
          url,
          headers: {
            origin: BLOCKED_ORIGIN,
            "access-control-request-headers": "content-type",
          },
        });

        assertForbiddenOriginResponse(blockedResponse);
      }
    } finally {
      await app.close();
    }
  }
});

test("rutas public report access no dependen de cookies de sesión", async () => {
  const rawToken = "a".repeat(64);
  const report = createReportFixture();
  const token = createReportAccessTokenFixture();
  const seenTokenHashes: string[] = [];

  const app = await createPublicReportAccessApp({
    now: () => Date.UTC(2026, 3, 24, 0, 0, 0),
    hashSessionToken: (value: string) => `hash:${value}`,
    getReportAccessTokenWithReportByTokenHash: async (tokenHash: string) => {
      seenTokenHashes.push(tokenHash);
      return { token, report };
    },
    recordReportAccessTokenAccess: async (tokenId: number) => {
      assert.equal(tokenId, token.id);

      return {
        ...token,
        accessCount: 3,
        lastAccessAt: new Date("2026-04-24T00:00:00.000Z"),
      };
    },
    createSignedReportUrl: async (storagePath: string) => {
      assert.equal(storagePath, report.storagePath);
      return "https://signed.example/preview";
    },
    createSignedReportDownloadUrl: async (
      storagePath: string,
      fileName?: string,
    ) => {
      assert.equal(storagePath, report.storagePath);
      assert.equal(fileName, report.fileName);
      return "https://signed.example/download";
    },
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: `/api/public/report-access/${rawToken}`,
      headers: {
        origin: ALLOWED_ORIGIN,
        cookie: [
          `${ENV.cookieName}=clinic-session-token`,
          `${ENV.adminCookieName}=admin-session-token`,
          `${ENV.particularCookieName}=particular-session-token`,
        ].join("; "),
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(
      response.headers["access-control-allow-origin"],
      ALLOWED_ORIGIN,
    );
    assert.notEqual(response.headers["access-control-allow-origin"], "*");
    assert.equal(response.headers["access-control-allow-credentials"], "true");
    assert.equal(response.headers["set-cookie"], undefined);
    assert.deepEqual(seenTokenHashes, [`hash:${rawToken}`]);

    const body = JSON.parse(response.body);
    assert.equal(body.success, true);
    assert.equal(body.report.id, report.id);
    assert.equal(body.report.previewUrl, "https://signed.example/preview");
    assert.equal(body.report.downloadUrl, "https://signed.example/download");
    assert.equal(body.token.accessCount, 3);
  } finally {
    await app.close();
  }
});

test("CORS con credentials no usa wildcard y trust proxy queda gobernado por ENV", () => {
  const corsRouteFiles = [
    "server/routes/admin-auth.fastify.ts",
    "server/routes/admin-particular-tokens.fastify.ts",
    "server/routes/admin-report-access-tokens.fastify.ts",
    "server/routes/admin-reports.fastify.ts",
    "server/routes/admin-study-tracking.fastify.ts",
    "server/routes/auth.fastify.ts",
    "server/routes/clinic-public-profile.fastify.ts",
    "server/routes/particular-auth.fastify.ts",
    "server/routes/particular-study-tracking.fastify.ts",
    "server/routes/particular-tokens.fastify.ts",
    "server/routes/public-professionals.fastify.ts",
    "server/routes/public-report-access.fastify.ts",
    "server/routes/report-access-tokens.fastify.ts",
    "server/routes/reports-status.fastify.ts",
    "server/routes/reports.fastify.ts",
    "server/routes/study-tracking.fastify.ts",
  ];

  for (const file of corsRouteFiles) {
    const source = read(file);

    assertContains(
      source,
      'reply.header("access-control-allow-credentials", "true")',
      file,
    );
    assertNotContains(source, 'access-control-allow-origin", "*"', file);
    assertNotContains(source, "access-control-allow-origin', '*'", file);
  }

  const fastifyApp = read("server/fastify-app.ts");
  assertContains(fastifyApp, "trustProxy: ENV.trustProxy", "server/fastify-app.ts");
  assertNotContains(fastifyApp, "trustProxy: true", "server/fastify-app.ts");
  assertNotContains(fastifyApp, "trustProxy: false", "server/fastify-app.ts");

  const env = read("server/lib/env.ts");
  assertContains(
    env,
    "TRUST_PROXY: z.coerce.number().int().min(0).max(10).optional()",
    "server/lib/env.ts",
  );
  assertContains(env, "trustProxy: rawEnv.TRUST_PROXY ?? 1", "server/lib/env.ts");
});
