import assert from "node:assert/strict";
import test from "node:test";

import { createAdminReportAccessOperations } from "../../../../server/features/report-access/application/index.ts";
import { report, token } from "./fixtures.ts";

function setup(overrides: Record<string, unknown> = {}) {
  const calls: string[] = [];
  const created = token();
  return {
    calls,
    operations: createAdminReportAccessOperations({
      generateSessionToken: () => "raw-token-abcdef",
      hashSessionToken: () => "digest",
      getClinicById: async () => ({ id: 7 }),
      getReportById: async () => report(),
      createReportAccessToken: async (input) => {
        calls.push(`write:${input.createdByAdminUserId}`);
        return created;
      },
      getReportAccessTokenById: async () => created,
      listReportAccessTokens: async () => [created],
      revokeReportAccessToken: async (input) => {
        calls.push(`revoke:${input.revokedByAdminUserId}`);
        return token({ revokedAt: new Date() });
      },
      writeAuditLog: async (_request, input) => {
        calls.push(`audit:${input.event}`);
      },
      ...overrides,
    }),
  };
}

test("admin valida ownership y conserva write → audit con actor", async () => {
  const { calls, operations } = setup();
  const result = await operations.createToken(
    { clinicId: 7, reportId: 41, expiresAt: null },
    { id: 5 },
    {},
  );
  assert.equal(result.kind, "success");
  assert.deepEqual(calls, ["write:5", "audit:report_access_token.created"]);
});

test("admin rechaza clinic/report inexistente y cross-clinic antes de write", async () => {
  assert.equal(
    (
      await setup({ getClinicById: async () => null }).operations.createToken(
        { clinicId: 7, reportId: 41, expiresAt: null },
        { id: 5 },
        {},
      )
    ).kind,
    "clinic_not_found",
  );
  assert.equal(
    (
      await setup({ getReportById: async () => null }).operations.createToken(
        { clinicId: 7, reportId: 41, expiresAt: null },
        { id: 5 },
        {},
      )
    ).kind,
    "report_not_found",
  );
  assert.equal(
    (
      await setup({
        getReportById: async () => report({ clinicId: 8 }),
      }).operations.createToken(
        { clinicId: 7, reportId: 41, expiresAt: null },
        { id: 5 },
        {},
      )
    ).kind,
    "report_wrong_clinic",
  );
});

test("admin revoke preserva atribución y audit posterior", async () => {
  const { calls, operations } = setup();
  assert.equal((await operations.revokeToken(31, { id: 5 }, {})).kind, "success");
  assert.deepEqual(calls, ["revoke:5", "audit:report_access_token.revoked"]);
  assert.equal(
    (
      await setup({
        getReportAccessTokenById: async () => null,
      }).operations.revokeToken(31, { id: 5 }, {})
    ).kind,
    "not_found",
  );
});
