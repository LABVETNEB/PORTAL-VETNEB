import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const { normalizeListPagination } = await import(
  "../../../server/lib/list-pagination.ts"
);
const {
  shouldApplySensitiveApiNoStore,
  SENSITIVE_API_CACHE_CONTROL,
} = await import("../../../server/lib/sensitive-response-cache.ts");

type HeavySurface = {
  file: string;
  markers: readonly string[];
};

const HEAVY_SURFACES: readonly HeavySurface[] = [
  {
    // M27: Clinics canonical persistence remains in the context
    // infrastructure layer after the compatibility shim was retired.
    file: "server/features/clinics/infrastructure/admin-clinics-repository.ts",
    markers: ["normalizeListPagination", ".limit(limit)", ".offset(offset)"],
  },
  {
    file: "server/db-admin-failed-login-alerts.ts",
    markers: ["normalizeListPagination", ".limit(limit)", ".offset(offset)"],
  },
  {
    file: "server/db-admin-sessions.ts",
    markers: ["normalizeListPagination", "fetchLimit", ".limit(fetchLimit)"],
  },
  {
    file: "server/db-admin-users-roles.ts",
    markers: ["normalizeListPagination", ".limit(adminLimit)", ".limit(clinicLimit)"],
  },
  {
    file: "server/features/particular-access/infrastructure/particular-access-repository.ts",
    markers: ["normalizeListPagination", ".limit(limit)", ".offset(offset)"],
  },
  {
    file: "server/features/report-access/infrastructure/report-access-repository.ts",
    markers: ["normalizeListPagination", ".limit(limit)", ".offset(offset)"],
  },
  {
    file: "server/db-report-workflow.ts",
    markers: ["normalizeListPagination", ".limit(limit)", ".offset(offset)"],
  },
  {
    // M31: Study Tracking persistence moved behind its context infrastructure
    // barrel; the legacy path is now only a compatibility re-export.
    file: "server/features/study-tracking/infrastructure/study-tracking-repository.ts",
    markers: ["normalizeListPagination", ".limit(limit)", ".offset(offset)"],
  },
  {
    // M12: Logistics canonical persistence lives in the context infrastructure
    // layer; `server/db-logistics.ts` is only a compatibility shim. This
    // contract must measure the real implementation, not the re-export.
    file: "server/features/logistics/infrastructure/db-logistics.ts",
    markers: ["normalizeLogisticsLimit", "normalizeLogisticsOffset"],
  },
];

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("global pagination clamps heavy list defaults and extremes", () => {
  assert.deepEqual(normalizeListPagination(undefined), {
    limit: 50,
    offset: 0,
  });
  assert.deepEqual(normalizeListPagination({ limit: 999, offset: 999_999 }), {
    limit: 100,
    offset: 100_000,
  });
  assert.deepEqual(normalizeListPagination({ limit: -5, offset: Number.NaN }), {
    limit: 1,
    offset: 0,
  });
});

test("global heavy route and DB surfaces stay bounded by pagination markers", () => {
  for (const surface of HEAVY_SURFACES) {
    const source = read(surface.file);

    for (const marker of surface.markers) {
      assert.ok(
        source.includes(marker),
        `${surface.file} must contain pagination marker ${marker}`,
      );
    }
  }
});

test("sensitive no-store applies only to non-public API surfaces", () => {
  assert.equal(SENSITIVE_API_CACHE_CONTROL, "no-store");
  assert.equal(shouldApplySensitiveApiNoStore("/api/reports"), true);
  assert.equal(shouldApplySensitiveApiNoStore("/api/admin/reports"), true);
  assert.equal(shouldApplySensitiveApiNoStore("/api/clinic/profile"), true);
  assert.equal(shouldApplySensitiveApiNoStore("/api/particular/auth/me"), true);
  assert.equal(shouldApplySensitiveApiNoStore("/api/public/pricing"), false);
  assert.equal(
    shouldApplySensitiveApiNoStore("/api/public/report-access/token"),
    false,
  );
  assert.equal(shouldApplySensitiveApiNoStore("/health"), false);
});

test("resilience contracts keep request ids security headers and safe logging wired", () => {
  const fastifyApp = read("server/fastify-app.ts");
  const requestLogger = read("server/middlewares/request-logger.ts");
  const apiRequestId = read("server/lib/api-request-id.ts");
  const apiResponseSecurity = read("server/lib/api-response-security.ts");

  for (const marker of [
    "generateFastifyRequestId",
    "applyApiRequestIdHeader",
    "applyApiSecurityHeaders",
    "addApiErrorRequestIdToJsonPayload",
    "applySensitiveApiNoStoreHeaders",
  ]) {
    assert.ok(fastifyApp.includes(marker), `fastify app must contain ${marker}`);
  }

  for (const marker of ["sanitizeUrlForLogs", "[REDACTED]", "RATE_LIMITED"]) {
    assert.ok(requestLogger.includes(marker), `request logger must contain ${marker}`);
  }

  assert.ok(apiRequestId.includes("X-Request-ID"));
  assert.ok(apiResponseSecurity.includes("X-Content-Type-Options"));
  assert.ok(apiResponseSecurity.includes("Referrer-Policy"));
});

test("validation scripts keep production readiness gates explicit", () => {
  const packageJson = JSON.parse(read("package.json")) as {
    scripts: Record<string, string>;
  };

  assert.equal(packageJson.scripts.test, "node --experimental-strip-types --experimental-specifier-resolution=node --test test/**/*.test.ts");
  assert.equal(packageJson.scripts.build.includes("esbuild server/index.ts"), true);
  assert.equal(packageJson.scripts.typecheck, "tsc --noEmit");
  assert.equal(packageJson.scripts["typecheck:test"], "tsc -p ./test/tsconfig.json --noEmit");
  assert.equal(
    packageJson.scripts["security:public-surface"],
    "node scripts/security/audit-public-devtools-surface.mjs",
  );
});

test("global performance resilience guardrail source stays ascii only", () => {
  const source = read("test/unit/infrastructure/global-performance-resilience-contract.test.ts");

  for (let index = 0; index < source.length; index += 1) {
    assert.equal(
      source.charCodeAt(index) <= 0x7f,
      true,
      `global performance resilience source must stay ascii-only at index ${index}`,
    );
  }
});
