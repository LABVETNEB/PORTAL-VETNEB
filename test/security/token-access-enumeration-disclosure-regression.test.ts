import assert from "node:assert/strict";
import test from "node:test";

import type { Report, ReportAccessToken } from "../../drizzle/schema.ts";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;

const { ENV } = await import("../../server/lib/env.ts");
const { createFastifyApp } = await import("../../server/fastify-app.ts");
const { buildFastifyDispatchRouteStubs } =
  await import("../helpers/fastify-app-route-stubs.ts");

const now = Date.UTC(2026, 6, 25, 12);
const clinicId = 3;
const clinicUserId = 9;
const rawTokenSentinel = "a".repeat(64);
const tokenHashSentinel = "token_hash_sentinel_m35b";
const internalFailureSentinel =
  "SELECT token_hash FROM protected_table; internal_stack_sentinel_m35b";

type JsonObject = Record<string, unknown>;

function report(overrides: Partial<Report> = {}): Report {
  return {
    id: 55,
    clinicId,
    uploadDate: new Date("2026-07-24T09:00:00.000Z"),
    studyType: "Histopatologia",
    patientName: "Paciente de prueba",
    fileName: "report-55.pdf",
    currentStatus: "ready",
    statusChangedAt: new Date("2026-07-24T09:30:00.000Z"),
    createdAt: new Date("2026-07-24T09:00:00.000Z"),
    updatedAt: new Date("2026-07-24T09:30:00.000Z"),
    storagePath: "reports/report-55.pdf",
    previewUrl: null,
    downloadUrl: null,
    statusChangedByClinicUserId: null,
    statusChangedByAdminUserId: null,
    workflowStage: "sample_received",
    specialStainRequested: false,
    specialStainAt: null,
    workflowUpdatedAt: null,
    ...overrides,
  };
}

function reportAccessToken(
  overrides: Partial<ReportAccessToken> = {},
): ReportAccessToken {
  return {
    id: 91,
    clinicId,
    reportId: 55,
    tokenHash: tokenHashSentinel,
    tokenLast4: "rrrr",
    accessCount: 2,
    lastAccessAt: null,
    expiresAt: new Date("2099-01-01T00:00:00.000Z"),
    revokedAt: null,
    createdAt: new Date("2026-07-24T09:00:00.000Z"),
    updatedAt: new Date("2026-07-24T09:30:00.000Z"),
    createdByClinicUserId: clinicUserId,
    createdByAdminUserId: null,
    revokedByClinicUserId: null,
    revokedByAdminUserId: null,
    ...overrides,
  };
}

function particularToken(overrides: JsonObject = {}) {
  return {
    id: 71,
    clinicId,
    reportId: 55,
    tokenHash: tokenHashSentinel,
    tokenLast4: "rrrr",
    tutorLastName: "Tutor",
    petName: "Paciente",
    petAge: "5",
    petBreed: "Mestiza",
    petSex: "Hembra",
    petSpecies: "Canina",
    sampleLocation: "Piel",
    sampleEvolution: "Dos semanas",
    detailsLesion: null,
    extractionDate: new Date("2026-07-22T00:00:00.000Z"),
    shippingDate: new Date("2026-07-23T00:00:00.000Z"),
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date("2026-07-22T12:00:00.000Z"),
    updatedAt: new Date("2026-07-23T12:00:00.000Z"),
    createdByAdminId: null,
    createdByClinicUserId: clinicUserId,
    ...overrides,
  };
}

function clinicAuthStubs() {
  return {
    getActiveSessionByToken: async () => ({
      clinicUserId,
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      lastAccess: new Date(now - 60_000),
    }),
    getClinicUserById: async () => ({
      id: clinicUserId,
      clinicId,
      username: "clinic-owner-m35b",
      authProId: null,
      role: "clinic_owner",
    }),
    updateSessionLastAccess: async () => {},
  };
}

function normalizeBody(body: string): unknown {
  const parsed = JSON.parse(body) as JsonObject;
  delete parsed.requestId;
  return parsed;
}

function relevantHeaders(headers: Record<string, unknown>) {
  return {
    contentType: headers["content-type"],
    noStore: headers["cache-control"],
    rateLimitPolicy: headers["ratelimit-policy"],
    rateLimitLimit: headers["ratelimit-limit"],
    rateLimitRemaining: headers["ratelimit-remaining"],
    rateLimitReset: headers["ratelimit-reset"],
  };
}

function assertNoSensitiveDisclosure(value: unknown) {
  const serialized = JSON.stringify(value);
  for (const forbidden of [
    rawTokenSentinel,
    tokenHashSentinel,
    "tokenHash",
    "tokenRaw",
    "session",
    "SELECT token_hash",
    "internal_stack_sentinel_m35b",
  ]) {
    assert.equal(
      serialized.includes(forbidden),
      false,
      `response must redact ${forbidden}`,
    );
  }
}

async function withMutedExpectedError<T>(operation: () => Promise<T>) {
  const originalError = console.error;
  console.error = () => {};
  try {
    return await operation();
  } finally {
    console.error = originalError;
  }
}

test("Particular Access unifica missing y foreign, ignora selectores hostiles y redacta secretos", async () => {
  const hiddenResponses: Array<{
    status: number;
    body: unknown;
    headers: ReturnType<typeof relevantHeaders>;
    calls: string[];
  }> = [];

  for (const scenario of ["missing", "foreign-clinic"] as const) {
    const calls: string[] = [];
    const stubs = buildFastifyDispatchRouteStubs();
    const app = await createFastifyApp({
      ...stubs,
      particularTokensRoutes: {
        ...stubs.particularTokensRoutes,
        ...clinicAuthStubs(),
        getClinicScopedParticularToken: async (
          tokenId: number,
          authenticatedClinicId: number,
        ) => {
          calls.push(
            `lookup:${scenario}:${tokenId}:${authenticatedClinicId}`,
          );
          return null;
        },
      },
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/particular-tokens/71",
        headers: {
          cookie: `${ENV.cookieName}=clinic-session-m35b`,
        },
      });
      const body = normalizeBody(response.body);
      hiddenResponses.push({
        status: response.statusCode,
        body,
        headers: relevantHeaders(response.headers),
        calls,
      });
      assertNoSensitiveDisclosure(body);
      assert.deepEqual(calls, [`lookup:${scenario}:71:${clinicId}`]);
    } finally {
      await app.close();
    }
  }

  assert.equal(hiddenResponses[0].status, 404);
  assert.equal(hiddenResponses[1].status, 404);
  assert.deepEqual(hiddenResponses[0].body, hiddenResponses[1].body);
  assert.deepEqual(hiddenResponses[0].headers, hiddenResponses[1].headers);

  const listCalls: JsonObject[] = [];
  const stubs = buildFastifyDispatchRouteStubs();
  const app = await createFastifyApp({
    ...stubs,
    particularTokensRoutes: {
      ...stubs.particularTokensRoutes,
      ...clinicAuthStubs(),
      listParticularTokens: async (params: JsonObject) => {
        listCalls.push(params);
        return [particularToken({ isActive: false })];
      },
    },
  });

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/particular-tokens?clinicId=999&tokenId=999&reportId=999",
      headers: {
        cookie: `${ENV.cookieName}=clinic-session-m35b`,
      },
    });
    const body = normalizeBody(response.body);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(listCalls, [{ clinicId, limit: 50, offset: 0 }]);
    assertNoSensitiveDisclosure(body);
  } finally {
    await app.close();
  }
});

test("Particular Access unifica report foreign y missing y redacta fallos repository", async () => {
  const outcomes: Array<{ status: number; body: unknown; updateCalls: number }> =
    [];

  for (const scenario of ["missing", "foreign-clinic"] as const) {
    let updateCalls = 0;
    const stubs = buildFastifyDispatchRouteStubs();
    const app = await createFastifyApp({
      ...stubs,
      particularTokensRoutes: {
        ...stubs.particularTokensRoutes,
        ...clinicAuthStubs(),
        getClinicScopedParticularToken: async () =>
          particularToken({ reportId: null }),
        getClinicScopedReportById: async () => null,
        updateParticularTokenReport: async () => {
          updateCalls += 1;
          return particularToken();
        },
      },
    });

    try {
      const response = await app.inject({
        method: "PATCH",
        url: "/api/particular-tokens/71/report",
        headers: {
          cookie: `${ENV.cookieName}=clinic-session-m35b`,
          origin: ENV.corsOrigins[0] ?? "http://localhost:3000",
        },
        payload: {
          reportId: 999,
          clinicId: scenario === "foreign-clinic" ? 999 : clinicId,
        },
      });
      const body = normalizeBody(response.body);
      outcomes.push({ status: response.statusCode, body, updateCalls });
      assertNoSensitiveDisclosure(body);
    } finally {
      await app.close();
    }
  }

  assert.deepEqual(outcomes[0], outcomes[1]);
  assert.deepEqual(outcomes[0], {
    status: 404,
    body: { success: false, error: "Informe no encontrado" },
    updateCalls: 0,
  });

  const stubs = buildFastifyDispatchRouteStubs();
  const app = await createFastifyApp({
    ...stubs,
    particularTokensRoutes: {
      ...stubs.particularTokensRoutes,
      ...clinicAuthStubs(),
      getClinicScopedParticularToken: async () => {
        throw new Error(internalFailureSentinel);
      },
    },
  });

  try {
    const response = await withMutedExpectedError(() =>
      app.inject({
        method: "GET",
        url: "/api/particular-tokens/71",
        headers: {
          cookie: `${ENV.cookieName}=clinic-session-m35b`,
        },
      }),
    );
    const body = normalizeBody(response.body);
    assert.equal(response.statusCode, 500);
    assert.equal((body as JsonObject).error, "Error interno del servidor");
    assertNoSensitiveDisclosure(body);
  } finally {
    await app.close();
  }
});

test("Report Access publico ejecuta la matriz M35b sin enumeracion ni disclosure", async () => {
  type Scenario = {
    name:
      | "malformed"
      | "missing"
      | "revoked"
      | "expired"
      | "cross-clinic"
      | "unavailable"
      | "success"
      | "repository-failure"
      | "storage-failure";
    rawToken: string;
    record?: ReturnType<typeof reportAccessToken> extends infer TToken
      ? { token: TToken; report: ReturnType<typeof report> } | null
      : never;
    expectedStatus: number;
    expectedCalls: readonly string[];
  };

  const scenarios: readonly Scenario[] = [
    {
      name: "malformed",
      rawToken: "malformed",
      expectedStatus: 404,
      expectedCalls: [],
    },
    {
      name: "missing",
      rawToken: rawTokenSentinel,
      record: null,
      expectedStatus: 404,
      expectedCalls: ["hash", "lookup"],
    },
    {
      name: "revoked",
      rawToken: rawTokenSentinel,
      record: {
        token: reportAccessToken({ revokedAt: new Date(now - 1) }),
        report: report(),
      },
      expectedStatus: 404,
      expectedCalls: ["hash", "lookup"],
    },
    {
      name: "expired",
      rawToken: rawTokenSentinel,
      record: {
        token: reportAccessToken({ expiresAt: new Date(now) }),
        report: report(),
      },
      expectedStatus: 404,
      expectedCalls: ["hash", "lookup"],
    },
    {
      name: "cross-clinic",
      rawToken: rawTokenSentinel,
      record: {
        token: reportAccessToken(),
        report: report({ clinicId: 999 }),
      },
      expectedStatus: 404,
      expectedCalls: ["hash", "lookup"],
    },
    {
      name: "unavailable",
      rawToken: rawTokenSentinel,
      record: {
        token: reportAccessToken(),
        report: report({ currentStatus: "processing" }),
      },
      expectedStatus: 409,
      expectedCalls: ["hash", "lookup"],
    },
    {
      name: "success",
      rawToken: rawTokenSentinel,
      record: { token: reportAccessToken(), report: report() },
      expectedStatus: 200,
      expectedCalls: [
        "hash",
        "lookup",
        "record-access",
        "signed-preview",
        "signed-download",
        "audit",
      ],
    },
    {
      name: "repository-failure",
      rawToken: rawTokenSentinel,
      expectedStatus: 500,
      expectedCalls: ["hash", "lookup"],
    },
    {
      name: "storage-failure",
      rawToken: rawTokenSentinel,
      record: { token: reportAccessToken(), report: report() },
      expectedStatus: 500,
      expectedCalls: [
        "hash",
        "lookup",
        "record-access",
        "signed-preview",
        "signed-download",
      ],
    },
  ];

  const generic404: Array<{
    body: unknown;
    headers: ReturnType<typeof relevantHeaders>;
  }> = [];

  for (const scenario of scenarios) {
    const calls: string[] = [];
    const stubs = buildFastifyDispatchRouteStubs();
    const app = await createFastifyApp({
      ...stubs,
      publicReportAccessRoutes: {
        ...stubs.publicReportAccessRoutes,
        now: () => now,
        hashSessionToken: () => {
          calls.push("hash");
          return tokenHashSentinel;
        },
        getReportAccessTokenWithReportByTokenHash: async () => {
          calls.push("lookup");
          if (scenario.name === "repository-failure") {
            throw new Error(internalFailureSentinel);
          }
          return scenario.record ?? null;
        },
        recordReportAccessTokenAccess: async () => {
          calls.push("record-access");
          return reportAccessToken({
            accessCount: 3,
            lastAccessAt: new Date(now),
          }) as never;
        },
        createSignedReportUrl: async () => {
          calls.push("signed-preview");
          if (scenario.name === "storage-failure") {
            throw new Error(internalFailureSentinel);
          }
          return "https://signed.example/preview";
        },
        createSignedReportDownloadUrl: async () => {
          calls.push("signed-download");
          return "https://signed.example/download";
        },
        writeAuditLog: async (_request: unknown, input: JsonObject) => {
          calls.push("audit");
          assert.equal(input.clinicId, clinicId);
          assert.equal(input.reportId, 55);
          assert.equal(input.targetReportAccessTokenId, 91);
          assert.equal(
            JSON.stringify(input).includes(tokenHashSentinel),
            false,
          );
          assert.equal(
            JSON.stringify(input).includes(rawTokenSentinel),
            false,
          );
        },
      },
    });

    try {
      const operation = () =>
        app.inject({
          method: "GET",
          url: `/api/public/report-access/${scenario.rawToken}`,
        });
      const response =
        scenario.expectedStatus === 500
          ? await withMutedExpectedError(operation)
          : await operation();
      const body = normalizeBody(response.body);

      assert.equal(response.statusCode, scenario.expectedStatus, scenario.name);
      assert.deepEqual(calls, scenario.expectedCalls, scenario.name);
      assertNoSensitiveDisclosure(body);

      if (scenario.expectedStatus === 404) {
        generic404.push({
          body,
          headers: relevantHeaders(response.headers),
        });
      }
      if (scenario.name === "unavailable") {
        assert.deepEqual(body, {
          success: false,
          error:
            "El informe todavia no esta disponible para acceso publico"
              .replace("todavia", "todavía")
              .replace("esta", "está")
              .replace("publico", "público"),
          currentStatus: "processing",
        });
      }
      if (scenario.expectedStatus === 500) {
        assert.equal(
          (body as JsonObject).error,
          "Error interno del servidor",
        );
        assert.equal(
          (body as JsonObject).path,
          "/api/public/report-access/[REDACTED]",
        );
        assert.equal(calls.includes("audit"), false);
      }
    } finally {
      await app.close();
    }
  }

  assert.equal(generic404.length, 5);
  for (const outcome of generic404.slice(1)) {
    assert.deepEqual(outcome, generic404[0]);
  }
});

test("Report Access publico aplica rate limit antes de parse, hash y repository", async () => {
  const calls: string[] = [];
  const stubs = buildFastifyDispatchRouteStubs();
  const app = await createFastifyApp({
    ...stubs,
    publicReportAccessRoutes: {
      ...stubs.publicReportAccessRoutes,
      now: () => now,
      publicReportAccessRateLimitMaxAttempts: 1,
      publicReportAccessRateLimitWindowMs: 60_000,
      hashSessionToken: () => {
        calls.push("hash");
        return tokenHashSentinel;
      },
      getReportAccessTokenWithReportByTokenHash: async () => {
        calls.push("lookup");
        return null;
      },
    },
  });

  try {
    const first = await app.inject({
      method: "GET",
      url: `/api/public/report-access/${rawTokenSentinel}`,
      remoteAddress: "203.0.113.35",
    });
    const callsAfterFirst = [...calls];
    const second = await app.inject({
      method: "GET",
      url: `/api/public/report-access/${rawTokenSentinel}`,
      remoteAddress: "203.0.113.35",
    });

    assert.equal(first.statusCode, 404);
    assert.equal(second.statusCode, 429);
    assert.deepEqual(callsAfterFirst, ["hash", "lookup"]);
    assert.deepEqual(calls, callsAfterFirst);
    assertNoSensitiveDisclosure(normalizeBody(second.body));
  } finally {
    await app.close();
  }
});
