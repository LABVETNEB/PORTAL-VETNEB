import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

process.env.NODE_ENV ??= "development";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
process.env.SUPABASE_DB_URL ??= process.env.DATABASE_URL;
process.env.CORS_ORIGIN ??= "http://localhost:3000";

const { createFastifyApp } = await import("../server/fastify-app.ts");
const { clearPublicPricingCache } = await import(
  "../server/lib/public-pricing-cache.ts"
);
const { createMemoryRateLimitStore } = await import(
  "../server/lib/rate-limit-store.ts"
);

const FORBIDDEN_PUBLIC_BODY_MARKERS = [
  "storagePath",
  "storage_path",
  "tokenHash",
  "sessionToken",
  "passwordHash",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
  "SMTP_PASS",
  "GMAIL_API_REFRESH_TOKEN",
  "app_session_id",
  "admin_session_id",
  "particular_session_id",
] as const;

type PublicReportAccessCalls = {
  hash: string[];
  lookup: string[];
  record: number[];
  preview: string[];
  download: string[];
  audit: number;
};

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function assertPublicApiSecurityHeaders(
  response: { headers: Record<string, unknown> },
  label: string,
): void {
  assert.equal(response.headers["x-content-type-options"], "nosniff", label);
  assert.equal(response.headers["referrer-policy"], "no-referrer", label);
  assert.equal(response.headers["set-cookie"], undefined, label);
}

function assertBodyDoesNotExposePublicMarkers(rawBody: string, label: string) {
  for (const marker of FORBIDDEN_PUBLIC_BODY_MARKERS) {
    assert.equal(
      rawBody.includes(marker),
      false,
      `${label} must not expose ${marker}`,
    );
  }
}

function createPublicReportAccessDeps(calls: PublicReportAccessCalls) {
  return {
    getReportAccessTokenWithReportByTokenHash: async (tokenHash: string) => {
      calls.lookup.push(tokenHash);
      return null;
    },
    recordReportAccessTokenAccess: async (tokenId: number) => {
      calls.record.push(tokenId);
      return null;
    },
    createSignedReportUrl: async (storagePath: string) => {
      calls.preview.push(storagePath);
      return `https://signed.example/preview/${encodeURIComponent(storagePath)}`;
    },
    createSignedReportDownloadUrl: async (storagePath: string) => {
      calls.download.push(storagePath);
      return `https://signed.example/download/${encodeURIComponent(storagePath)}`;
    },
    hashSessionToken: (token: string) => {
      calls.hash.push(token);
      return `hash:${token}`;
    },
    writeAuditLog: async () => {
      calls.audit += 1;
    },
    publicReportAccessRateLimitMaxAttempts: 100,
    publicReportAccessRateLimitStore: createMemoryRateLimitStore(),
    now: () => new Date("2026-06-03T12:00:00.000Z").getTime(),
  };
}

async function createContractApp(calls: PublicReportAccessCalls) {
  return createFastifyApp({
    publicPricingRoutes: {
      listPublicPricingItems: async () => [
        {
          id: 1,
          category: "Base",
          studyName: "Histopathology",
          priceLabel: "$100",
          displayOrder: 1,
        },
      ],
    },
    publicProfessionalsRoutes: {
      searchRateLimitMaxAttempts: 100,
      detailRateLimitMaxAttempts: 100,
      searchRateLimitStore: createMemoryRateLimitStore(),
      detailRateLimitStore: createMemoryRateLimitStore(),
      now: () => new Date("2026-06-03T12:00:00.000Z").getTime(),
      searchPublicProfessionals: async (input) => {
        assert.equal(input.limit, 50);
        assert.equal(input.offset, 0);

        return {
          rows: [
            {
              clinicId: 3,
              displayName: "Clinica Norte",
              avatarStoragePath: "private/avatars/clinic-norte.webp",
              aboutText: "Public profile",
              specialtyText: "Dermatology",
              servicesText: "Biopsies",
              email: "public@example.test",
              phone: "555-0100",
              locality: "Buenos Aires",
              country: "AR",
              updatedAt: new Date("2026-06-03T00:00:00.000Z"),
              rank: 1,
              similarity: 0.99,
              score: 0.8,
            },
          ],
          total: 1,
          limit: input.limit,
          offset: input.offset,
        };
      },
      getPublicProfessionalByClinicId: async () => null,
      createSignedStorageUrl: async (storagePath: string) =>
        `https://signed.example/avatar/${encodeURIComponent(storagePath)}`,
    },
    publicReportAccessRoutes: createPublicReportAccessDeps(calls),
    adminSystemHealthRoutes: {
      deleteAdminSession: async () => {},
      getAdminSessionByToken: async () => null,
      getAdminUserById: async () => null,
      updateAdminSessionLastAccess: async () => {},
      hashSessionToken: (token: string) => `hash:${token}`,
      getSystemHealthSnapshot: async () => ({
        statusCode: 200,
        payload: { status: "ok", checks: {} },
      }),
      getBackendVersion: () => "contract",
    },
  });
}

function createEmptyPublicReportAccessCalls(): PublicReportAccessCalls {
  return {
    hash: [],
    lookup: [],
    record: [],
    preview: [],
    download: [],
    audit: 0,
  };
}

test("public API responses keep security headers and avoid session leakage", async () => {
  clearPublicPricingCache();
  const calls = createEmptyPublicReportAccessCalls();
  const app = await createContractApp(calls);

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/public/pricing",
    });

    assert.equal(response.statusCode, 200);
    assertPublicApiSecurityHeaders(response, "public pricing");
    assert.notEqual(response.headers["cache-control"], "no-store");
    assertBodyDoesNotExposePublicMarkers(response.body, "public pricing");
  } finally {
    await app.close();
  }
});

test("public professionals serializes signed avatar URL without private storage path", async () => {
  const calls = createEmptyPublicReportAccessCalls();
  const app = await createContractApp(calls);
  const originalConsoleLog = console.log;

  console.log = () => {};

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/public/professionals/search?limit=999&offset=-10",
      headers: { origin: "http://localhost:3000" },
    });

    assert.equal(response.statusCode, 200);
    assertPublicApiSecurityHeaders(response, "public professionals search");
    assert.equal(response.headers["access-control-allow-origin"], "http://localhost:3000");
    assertBodyDoesNotExposePublicMarkers(response.body, "public professionals search");
    assert.equal(response.body.includes("private/avatars/clinic-norte.webp"), false);
    assert.ok(response.body.includes("https://signed.example/avatar/"));
  } finally {
    console.log = originalConsoleLog;
    await app.close();
  }
});

test("invalid public report token rejects before hashing lookup signing or audit", async () => {
  const calls = createEmptyPublicReportAccessCalls();
  const app = await createContractApp(calls);
  const originalConsoleLog = console.log;

  console.log = () => {};

  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/public/report-access/not-a-token",
    });

    assert.equal(response.statusCode, 400);
    assertPublicApiSecurityHeaders(response, "public report invalid token");
    assert.notEqual(response.headers["cache-control"], "no-store");
    assert.deepEqual(calls.hash, []);
    assert.deepEqual(calls.lookup, []);
    assert.deepEqual(calls.record, []);
    assert.deepEqual(calls.preview, []);
    assert.deepEqual(calls.download, []);
    assert.equal(calls.audit, 0);
    assert.equal(response.body.includes("not-a-token"), false);
    assertBodyDoesNotExposePublicMarkers(response.body, "public report invalid token");
  } finally {
    console.log = originalConsoleLog;
    await app.close();
  }
});

test("public surface hardening stays connected to frontend bundle auditor", () => {
  const source = read("scripts/security/audit-public-devtools-surface.mjs");

  for (const marker of [
    "DANGEROUSLY_SET_INNER_HTML_REGEX",
    "NON_PUBLIC_API_KEY_IDENTIFIER_REGEX",
    "SENSITIVE_ATTRIBUTE_VALUE_REGEX",
    "publicExposure",
    "NEXT_PUBLIC_",
  ]) {
    assert.ok(source.includes(marker), `public auditor must contain ${marker}`);
  }
});

test("global public surface guardrail source stays ascii only", () => {
  const source = read("test/global-public-surface-hardening-contract.test.ts");

  for (let index = 0; index < source.length; index += 1) {
    assert.equal(
      source.charCodeAt(index) <= 0x7f,
      true,
      `global public surface source must stay ascii-only at index ${index}`,
    );
  }
});
