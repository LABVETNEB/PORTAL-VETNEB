import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;
process.env.SUPABASE_STORAGE_BUCKET ??= "reports";

const { ENV } = await import("../../../../server/lib/env.ts");
const { reportsNativeRoutes } = await import("../../../../server/routes/reports.fastify.ts");
const { publicReportAccessNativeRoutes } = await import(
  "../../../../server/routes/public-report-access.fastify.ts"
);
const { serializeSafeReport } = await import("../../../../server/lib/reports.ts");
const { createMemoryRateLimitStore } = await import(
  "../../../../server/lib/rate-limit-store.ts"
);

const RAW_PUBLIC_TOKEN =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function createReportFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 55,
    clinicId: 3,
    patientName: "Luna Gomez",
    studyType: "Histopathology",
    uploadDate: new Date("2026-04-20T00:00:00.000Z"),
    fileName: "luna.pdf",
    storagePath: "private/reports/3/luna.pdf",
    currentStatus: "ready",
    statusChangedAt: new Date("2026-04-21T00:00:00.000Z"),
    statusChangedByClinicUserId: 9,
    statusChangedByAdminUserId: null,
    createdAt: new Date("2026-04-20T12:00:00.000Z"),
    updatedAt: new Date("2026-04-22T12:00:00.000Z"),
    ...overrides,
  };
}

function createReportAccessTokenFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 9,
    clinicId: 3,
    reportId: 55,
    tokenHash: "hash",
    tokenLast4: "aaaa",
    accessCount: 2,
    lastAccessAt: null,
    expiresAt: new Date("2099-01-01T00:00:00.000Z"),
    revokedAt: null,
    createdAt: new Date("2026-04-20T00:00:00.000Z"),
    updatedAt: new Date("2026-04-20T00:00:00.000Z"),
    createdByClinicUserId: 9,
    createdByAdminUserId: null,
    revokedByClinicUserId: null,
    revokedByAdminUserId: null,
    ...overrides,
  };
}

async function createReportsApp(overrides: Record<string, unknown> = {}) {
  const app = Fastify();

  await app.register(reportsNativeRoutes as any, {
    prefix: "/api/reports",
    deleteActiveSession: async () => {},
    getActiveSessionByToken: async () => ({
      clinicUserId: 9,
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      lastAccess: new Date("2026-06-03T00:00:00.000Z"),
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
    getReportsByClinicId: async (
      _clinicId: number,
      limit: number,
      offset: number,
    ) => {
      assert.equal(limit, 100);
      assert.equal(offset, 2);
      return [createReportFixture()];
    },
    searchReports: async () => [createReportFixture()],
    countReportsByClinicId: async () => 1,
    countSearchReports: async () => 0,
    getStudyTypes: async () => ["Histopathology"],
    getReportById: async () => createReportFixture(),
    getReportStatusHistory: async () => [],
    createSignedReportUrl: async () => {
      throw new Error("list routes must not create preview signed URLs");
    },
    createSignedReportDownloadUrl: async () => {
      throw new Error("list routes must not create download signed URLs");
    },
    now: () => new Date("2026-06-03T12:00:00.000Z").getTime(),
    ...overrides,
  });

  return app;
}

async function createPublicReportAccessApp(calls: {
  preview: string[];
  download: string[];
  audit: number;
}) {
  const app = Fastify();

  await app.register(publicReportAccessNativeRoutes as any, {
    prefix: "/api/public/report-access",
    getReportAccessTokenWithReportByTokenHash: async (tokenHash: string) => {
      assert.equal(tokenHash, `hash:${RAW_PUBLIC_TOKEN}`);
      return {
        token: createReportAccessTokenFixture(),
        report: createReportFixture(),
      };
    },
    recordReportAccessTokenAccess: async () =>
      createReportAccessTokenFixture({
        accessCount: 3,
        lastAccessAt: new Date("2026-06-03T12:00:00.000Z"),
      }),
    createSignedReportUrl: async (storagePath: string) => {
      calls.preview.push(storagePath);
      return "https://signed.example/preview/luna.pdf";
    },
    createSignedReportDownloadUrl: async (storagePath: string) => {
      calls.download.push(storagePath);
      return "https://signed.example/download/luna.pdf";
    },
    hashSessionToken: (token: string) => `hash:${token}`,
    writeAuditLog: async () => {
      calls.audit += 1;
    },
    publicReportAccessRateLimitMaxAttempts: 100,
    publicReportAccessRateLimitStore: createMemoryRateLimitStore(),
    now: () => new Date("2026-06-03T12:00:00.000Z").getTime(),
  });

  return app;
}

test("safe report serializer removes private storage paths from JSON", () => {
  const serialized = serializeSafeReport(createReportFixture() as any);
  const raw = JSON.stringify(serialized);

  assert.equal("storagePath" in serialized, false);
  assert.equal(raw.includes("private/reports/3/luna.pdf"), false);
  assert.equal(serialized.hasFile, true);
});

test("clinic report list stays bounded and does not eagerly sign report URLs", async () => {
  const app = await createReportsApp();
  const originalConsoleLog = console.log;

  console.log = () => {};

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/reports?limit=999&offset=2",
      headers: {
        cookie: `${ENV.cookieName}=session-token`,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.includes("storagePath"), false);
    assert.equal(response.body.includes("private/reports/3/luna.pdf"), false);
    assert.equal(response.body.includes("previewUrl"), false);
    assert.equal(response.body.includes("downloadUrl"), false);

    const body = JSON.parse(response.body) as {
      pagination: { limit: number; offset: number };
      reports: Array<{ hasFile: boolean }>;
    };
    assert.deepEqual(body.pagination, { limit: 100, offset: 2 });
    assert.equal(body.reports[0]?.hasFile, true);
  } finally {
    console.log = originalConsoleLog;
    await app.close();
  }
});

test("public report access signs lazily and never returns raw storage path or token hash", async () => {
  const calls = {
    preview: [] as string[],
    download: [] as string[],
    audit: 0,
  };
  const app = await createPublicReportAccessApp(calls);
  const originalConsoleLog = console.log;

  console.log = () => {};

  try {
    const response = await app.inject({
      method: "GET",
      url: `/api/public/report-access/${RAW_PUBLIC_TOKEN}`,
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(calls.preview, ["private/reports/3/luna.pdf"]);
    assert.deepEqual(calls.download, ["private/reports/3/luna.pdf"]);
    assert.equal(calls.audit, 1);
    assert.equal(response.body.includes("private/reports/3/luna.pdf"), false);
    assert.equal(response.body.includes("storagePath"), false);
    assert.equal(response.body.includes("tokenHash"), false);
    assert.equal(response.body.includes(RAW_PUBLIC_TOKEN), false);
    assert.ok(response.body.includes("https://signed.example/preview/luna.pdf"));
    assert.ok(response.body.includes("https://signed.example/download/luna.pdf"));
  } finally {
    console.log = originalConsoleLog;
    await app.close();
  }
});

test("storage report safety remains anchored in private bucket and TTL helpers", () => {
  const supabaseSource = read("server/lib/supabase.ts");
  const publicAccessSource = read("server/routes/public-report-access.fastify.ts");

  for (const marker of [
    "public: false",
    "upsert: false",
    "sanitizeFileName(fileName: string, fallback: string)",
    "ENV.signedUrlExpiresInSeconds",
    "createSignedUrl",
  ]) {
    assert.ok(supabaseSource.includes(marker), `supabase storage must contain ${marker}`);
  }

  const accessRecordIndex = publicAccessSource.indexOf(
    "const updatedToken = await deps.recordReportAccessTokenAccess",
  );
  const signingIndex = publicAccessSource.indexOf(
    "const [previewUrl, downloadUrl] = await Promise.all",
  );

  assert.notEqual(accessRecordIndex, -1);
  assert.notEqual(signingIndex, -1);
  assert.ok(
    accessRecordIndex < signingIndex,
    "public report access must record access before signing URLs",
  );
});

test("global storage report guardrail source stays ascii only", () => {
  const source = read("test/integration/adapters/controllers/global-storage-report-safety-contract.test.ts");

  for (let index = 0; index < source.length; index += 1) {
    assert.equal(
      source.charCodeAt(index) <= 0x7f,
      true,
      `global storage report source must stay ascii-only at index ${index}`,
    );
  }
});
