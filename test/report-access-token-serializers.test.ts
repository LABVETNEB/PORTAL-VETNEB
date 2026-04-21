import test from "node:test";
import assert from "node:assert/strict";
import {
  serializePublicReportAccess,
  serializeReportAccessToken,
  serializeReportAccessTokenDetail,
} from "../server/lib/report-access-token.ts";

test("serializeReportAccessToken expone estado y banderas derivadas", () => {
  const token = {
    id: 14,
    clinicId: 3,
    reportId: 22,
    tokenHash: "hash",
    tokenLast4: "1a2b",
    accessCount: 5,
    lastAccessAt: new Date("2026-04-22T10:00:00.000Z"),
    expiresAt: new Date("2099-04-30T12:00:00.000Z"),
    revokedAt: null,
    createdAt: new Date("2026-04-20T08:00:00.000Z"),
    updatedAt: new Date("2026-04-22T10:00:00.000Z"),
    createdByClinicUserId: 9,
    createdByAdminUserId: null,
    revokedByClinicUserId: null,
    revokedByAdminUserId: null,
  };

  const serialized = serializeReportAccessToken(token as any);

  assert.equal(serialized.id, 14);
  assert.equal(serialized.clinicId, 3);
  assert.equal(serialized.reportId, 22);
  assert.equal(serialized.tokenLast4, "1a2b");
  assert.equal(serialized.accessCount, 5);
  assert.equal(serialized.createdByClinicUserId, 9);
  assert.equal(serialized.createdByAdminUserId, null);
  assert.equal(serialized.state, "active");
  assert.equal(serialized.isExpired, false);
  assert.equal(serialized.isRevoked, false);
});

test("serializeReportAccessToken marca expired y revoked según corresponda", () => {
  const expired = serializeReportAccessToken({
    id: 1,
    clinicId: 1,
    reportId: 1,
    tokenHash: "hash",
    tokenLast4: "eeee",
    accessCount: 0,
    lastAccessAt: null,
    expiresAt: new Date("2000-01-01T00:00:00.000Z"),
    revokedAt: null,
    createdAt: new Date("2026-04-20T08:00:00.000Z"),
    updatedAt: new Date("2026-04-20T08:00:00.000Z"),
    createdByClinicUserId: null,
    createdByAdminUserId: 1,
    revokedByClinicUserId: null,
    revokedByAdminUserId: null,
  } as any);

  const revoked = serializeReportAccessToken({
    id: 2,
    clinicId: 1,
    reportId: 1,
    tokenHash: "hash",
    tokenLast4: "rrrr",
    accessCount: 0,
    lastAccessAt: null,
    expiresAt: new Date("2099-01-01T00:00:00.000Z"),
    revokedAt: new Date("2026-04-21T00:00:00.000Z"),
    createdAt: new Date("2026-04-20T08:00:00.000Z"),
    updatedAt: new Date("2026-04-21T00:00:00.000Z"),
    createdByClinicUserId: null,
    createdByAdminUserId: 1,
    revokedByClinicUserId: null,
    revokedByAdminUserId: 1,
  } as any);

  assert.equal(expired.state, "expired");
  assert.equal(expired.isExpired, true);
  assert.equal(expired.isRevoked, false);

  assert.equal(revoked.state, "revoked");
  assert.equal(revoked.isExpired, false);
  assert.equal(revoked.isRevoked, true);
});

test("serializeReportAccessTokenDetail incluye reporte cuando existe", () => {
  const token = {
    id: 14,
    clinicId: 3,
    reportId: 22,
    tokenHash: "hash",
    tokenLast4: "1a2b",
    accessCount: 5,
    lastAccessAt: new Date("2026-04-22T10:00:00.000Z"),
    expiresAt: null,
    revokedAt: null,
    createdAt: new Date("2026-04-20T08:00:00.000Z"),
    updatedAt: new Date("2026-04-22T10:00:00.000Z"),
    createdByClinicUserId: 9,
    createdByAdminUserId: null,
    revokedByClinicUserId: null,
    revokedByAdminUserId: null,
  };

  const report = {
    id: 22,
    clinicId: 3,
    uploadDate: new Date("2026-04-22T09:00:00.000Z"),
    studyType: "Histopatología",
    patientName: "Luna",
    fileName: "informe-luna.pdf",
    currentStatus: "ready",
    statusChangedAt: new Date("2026-04-22T09:30:00.000Z"),
    createdAt: new Date("2026-04-22T09:00:00.000Z"),
    updatedAt: new Date("2026-04-22T09:30:00.000Z"),
  };

  const detailed = serializeReportAccessTokenDetail(token as any, report as any);

  assert.equal(detailed.id, 14);
  assert.equal(detailed.state, "active");
  assert.equal(detailed.report?.id, 22);
  assert.equal(detailed.report?.studyType, "Histopatología");
  assert.equal(detailed.report?.currentStatus, "ready");
});

test("serializeReportAccessTokenDetail devuelve report null cuando no existe", () => {
  const token = {
    id: 99,
    clinicId: 7,
    reportId: 55,
    tokenHash: "hash",
    tokenLast4: "ffff",
    accessCount: 0,
    lastAccessAt: null,
    expiresAt: null,
    revokedAt: null,
    createdAt: new Date("2026-04-20T08:00:00.000Z"),
    updatedAt: new Date("2026-04-20T08:00:00.000Z"),
    createdByClinicUserId: null,
    createdByAdminUserId: 3,
    revokedByClinicUserId: null,
    revokedByAdminUserId: null,
  };

  const detailed = serializeReportAccessTokenDetail(token as any, null);

  assert.equal(detailed.id, 99);
  assert.equal(detailed.report, null);
});

test("serializePublicReportAccess expone urls y datos públicos del reporte", () => {
  const report = {
    id: 22,
    clinicId: 3,
    uploadDate: new Date("2026-04-22T09:00:00.000Z"),
    studyType: "Histopatología",
    patientName: "Luna",
    fileName: "informe-luna.pdf",
    currentStatus: "ready",
    statusChangedAt: new Date("2026-04-22T09:30:00.000Z"),
    createdAt: new Date("2026-04-22T09:00:00.000Z"),
    updatedAt: new Date("2026-04-22T09:30:00.000Z"),
  };

  const serialized = serializePublicReportAccess({
    report: report as any,
    previewUrl: "https://example.com/preview",
    downloadUrl: "https://example.com/download",
  });

  assert.equal(serialized.id, 22);
  assert.equal(serialized.clinicId, 3);
  assert.equal(serialized.patientName, "Luna");
  assert.equal(serialized.currentStatus, "ready");
  assert.equal(serialized.previewUrl, "https://example.com/preview");
  assert.equal(serialized.downloadUrl, "https://example.com/download");
});
