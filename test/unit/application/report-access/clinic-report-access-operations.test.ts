import assert from "node:assert/strict";
import test from "node:test";

import { createClinicReportAccessOperations } from "../../../../server/features/report-access/application/index.ts";
import { report, token } from "../../../factories/report-access.ts";

function setup(scopedToken: ReturnType<typeof token> | null = token()) {
  const calls: string[] = [];
  const operations = createClinicReportAccessOperations({
    generateSessionToken: () => "raw-token-abcdef",
    hashSessionToken: () => "digest",
    getClinicScopedReportById: async (reportId, clinicId) => {
      calls.push(`report:${reportId}:${clinicId}`);
      return clinicId === 7 ? report() : null;
    },
    createReportAccessToken: async (input) => {
      calls.push(`write:${input.clinicId}:${input.createdByClinicUserId}`);
      return token({ createdByAdminUserId: null, createdByClinicUserId: 19 });
    },
    getClinicScopedReportAccessToken: async (_id, clinicId) =>
      clinicId === 7 ? scopedToken : null,
    listReportAccessTokens: async (params) => {
      calls.push(`list:${params.clinicId}`);
      return scopedToken ? [scopedToken] : [];
    },
    revokeReportAccessToken: async (input) => {
      calls.push(`revoke:${input.revokedByClinicUserId}`);
      return token({ revokedAt: new Date() });
    },
    writeAuditLog: async (_request, input) => {
      calls.push(`audit:${input.event}`);
    },
  });
  return { calls, operations };
}

test("clínica deriva scope del actor y conserva write → audit", async () => {
  const { calls, operations } = setup();
  const result = await operations.createToken(
    { reportId: 41, expiresAt: null },
    { clinicId: 7, clinicUserId: 19 },
    {},
  );
  assert.equal(result.kind, "success");
  assert.deepEqual(calls, [
    "report:41:7",
    "write:7:19",
    "audit:report_access_token.created",
  ]);
});

test("cross-clinic e inexistente son not found y no escriben", async () => {
  const { calls, operations } = setup(null);
  assert.equal((await operations.getToken(31, 8)).kind, "not_found");
  assert.equal(
    (
      await operations.revokeToken(
        31,
        { clinicId: 8, clinicUserId: 19 },
        {},
      )
    ).kind,
    "not_found",
  );
  assert.deepEqual(calls, []);
});

test("clínica lista y revoca siempre con scope y actor", async () => {
  const { calls, operations } = setup();
  await operations.listTokens(7, undefined, 50, 0);
  await operations.revokeToken(31, { clinicId: 7, clinicUserId: 19 }, {});
  assert.deepEqual(calls, [
    "list:7",
    "revoke:19",
    "report:41:7",
    "audit:report_access_token.revoked",
  ]);
});
