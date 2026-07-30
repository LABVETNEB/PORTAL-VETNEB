import assert from "node:assert/strict";
import test from "node:test";

import { createPublicReportAccessOperations } from "../../../../server/features/report-access/application/index.ts";
import { now, report, token } from "../../../factories/report-access.ts";

function setup(
  record: { token: ReturnType<typeof token>; report: ReturnType<typeof report> } | null = {
    token: token(),
    report: report(),
  },
) {
  const calls: string[] = [];
  const operations = createPublicReportAccessOperations({
    hashSessionToken: () => {
      calls.push("hash");
      return "digest";
    },
    getReportAccessTokenWithReportByTokenHash: async () => {
      calls.push("lookup");
      return record;
    },
    recordReportAccessTokenAccess: async () => {
      calls.push("record");
      return token({ accessCount: 1, lastAccessAt: now });
    },
    createSignedReportUrl: async () => {
      calls.push("preview");
      return "preview";
    },
    createSignedReportDownloadUrl: async () => {
      calls.push("download");
      return "download";
    },
    writeAuditLog: async (_request, input) => {
      calls.push(`audit:${input.actor?.type}`);
    },
    buildPublicActor: (tokenId) => ({
      type: "report_access_token",
      reportAccessTokenId: tokenId,
    }),
  });
  return { calls, operations };
}

test("público preserva hash → lookup → record → signed URLs → audit", async () => {
  const { calls, operations } = setup();
  assert.equal(
    (await operations.access("raw-token", now.getTime(), {})).kind,
    "success",
  );
  assert.deepEqual(calls.slice(0, 3), ["hash", "lookup", "record"]);
  assert.deepEqual(new Set(calls.slice(3, 5)), new Set(["preview", "download"]));
  assert.equal(calls[5], "audit:report_access_token");
});

test("público unifica missing, cross-clinic, revoked y expired", async () => {
  const records = [
    null,
    { token: token(), report: report({ clinicId: 8 }) },
    { token: token({ revokedAt: now }), report: report() },
    { token: token({ expiresAt: now }), report: report() },
  ];
  for (const record of records) {
    const { operations } = setup(record);
    assert.equal(
      (await operations.access("raw-token", now.getTime(), {})).kind,
      "not_found",
    );
  }
});

test("público distingue unavailable sin registrar ni firmar", async () => {
  const { calls, operations } = setup({
    token: token(),
    report: report({ currentStatus: "draft" }),
  });
  const result = await operations.access("raw-token", now.getTime(), {});
  assert.deepEqual(result, { kind: "unavailable", currentStatus: "draft" });
  assert.deepEqual(calls, ["hash", "lookup"]);
});

test("fallos de repository se propagan sin fabricar respuesta", async () => {
  const expected = new Error("repository unavailable");
  const { operations } = setup();
  const failing = createPublicReportAccessOperations({
    hashSessionToken: () => "digest",
    getReportAccessTokenWithReportByTokenHash: async () => {
      throw expected;
    },
    recordReportAccessTokenAccess: async () => token(),
    createSignedReportUrl: async () => "preview",
    createSignedReportDownloadUrl: async () => "download",
    writeAuditLog: async () => {},
    buildPublicActor: () => ({}),
  });
  await assert.rejects(
    failing.access("raw-token", now.getTime(), {}),
    (error) => error === expected,
  );
  assert.ok(operations);
});
