import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPublicReportAccessPath,
  canAccessReportPublicly,
  clinicCreateReportAccessTokenSchema,
  getReportAccessTokenState,
  isReportAccessTokenExpired,
  isReportAccessTokenRevoked,
  reportAccessTokenRawTokenSchema,
} from "../server/lib/report-access-token.ts";

test("reportAccessTokenRawTokenSchema acepta tokens hex de 64 caracteres", () => {
  const token = "a".repeat(64);
  const parsed = reportAccessTokenRawTokenSchema.safeParse(token);

  assert.equal(parsed.success, true);
});

test("clinicCreateReportAccessTokenSchema rechaza expiresAt pasado", () => {
  const parsed = clinicCreateReportAccessTokenSchema.safeParse({
    reportId: 12,
    expiresAt: "2000-01-01T00:00:00.000Z",
  });

  assert.equal(parsed.success, false);
});

test("report access token state distingue active expired y revoked", () => {
  const now = new Date("2026-04-15T12:00:00.000Z");

  assert.equal(
    getReportAccessTokenState(
      {
        expiresAt: new Date("2026-04-16T12:00:00.000Z"),
        revokedAt: null,
      },
      now,
    ),
    "active",
  );

  assert.equal(
    getReportAccessTokenState(
      {
        expiresAt: new Date("2026-04-14T12:00:00.000Z"),
        revokedAt: null,
      },
      now,
    ),
    "expired",
  );

  assert.equal(
    getReportAccessTokenState(
      {
        expiresAt: new Date("2026-04-16T12:00:00.000Z"),
        revokedAt: new Date("2026-04-15T11:00:00.000Z"),
      },
      now,
    ),
    "revoked",
  );
});

test("public report access solo permite ready y delivered", () => {
  assert.equal(canAccessReportPublicly("uploaded"), false);
  assert.equal(canAccessReportPublicly("processing"), false);
  assert.equal(canAccessReportPublicly("ready"), true);
  assert.equal(canAccessReportPublicly("delivered"), true);
});

test("helpers de expiración y revocación funcionan correctamente", () => {
  const now = new Date("2026-04-15T12:00:00.000Z");

  assert.equal(
    isReportAccessTokenExpired(new Date("2026-04-14T12:00:00.000Z"), now),
    true,
  );
  assert.equal(
    isReportAccessTokenExpired(new Date("2026-04-16T12:00:00.000Z"), now),
    false,
  );
  assert.equal(isReportAccessTokenRevoked(new Date()), true);
  assert.equal(isReportAccessTokenRevoked(null), false);
});

test("buildPublicReportAccessPath construye la ruta pública esperada", () => {
  const token = "b".repeat(64);
  assert.equal(
    buildPublicReportAccessPath(token),
    `/api/public/report-access/${token}`,
  );
});
