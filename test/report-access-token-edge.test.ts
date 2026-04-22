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

test("reportAccessTokenRawTokenSchema rechaza longitudes distintas de 64", () => {
  const tooShort = reportAccessTokenRawTokenSchema.safeParse("a".repeat(63));
  const tooLong = reportAccessTokenRawTokenSchema.safeParse("a".repeat(65));

  assert.equal(tooShort.success, false);
  assert.equal(tooLong.success, false);
});

test("reportAccessTokenRawTokenSchema rechaza caracteres no hex y acepta uppercase", () => {
  const invalid = reportAccessTokenRawTokenSchema.safeParse(`${"a".repeat(63)}z`);
  const upper = reportAccessTokenRawTokenSchema.safeParse("A".repeat(64));

  assert.equal(invalid.success, false);
  assert.equal(upper.success, true);

  if (!upper.success) {
    assert.fail(upper.error.message);
  }

  assert.equal(upper.data, "A".repeat(64));
});

test("clinicCreateReportAccessTokenSchema acepta expiresAt vacío y conserva reportId válido", () => {
  const parsed = clinicCreateReportAccessTokenSchema.safeParse({
    reportId: "12",
    expiresAt: "",
  });

  if (!parsed.success) {
    assert.fail(parsed.error.message);
  }

  assert.equal(parsed.data.reportId, 12);
  assert.equal(parsed.data.expiresAt, undefined);
});

test("isReportAccessTokenExpired considera expirado el instante exacto del borde", () => {
  const now = new Date("2026-04-15T12:00:00.000Z");

  assert.equal(
    isReportAccessTokenExpired(new Date("2026-04-15T12:00:00.000Z"), now),
    true,
  );
  assert.equal(
    isReportAccessTokenExpired(new Date("2026-04-15T12:00:00.001Z"), now),
    false,
  );
  assert.equal(isReportAccessTokenExpired(null, now), false);
  assert.equal(isReportAccessTokenExpired(undefined, now), false);
});

test("getReportAccessTokenState prioriza revoked sobre expired y mantiene active sin expiresAt", () => {
  const now = new Date("2026-04-15T12:00:00.000Z");

  assert.equal(
    getReportAccessTokenState(
      {
        expiresAt: new Date("2026-04-14T12:00:00.000Z"),
        revokedAt: new Date("2026-04-15T11:00:00.000Z"),
      } as any,
      now,
    ),
    "revoked",
  );

  assert.equal(
    getReportAccessTokenState(
      {
        expiresAt: null,
        revokedAt: null,
      } as any,
      now,
    ),
    "active",
  );
});

test("isReportAccessTokenRevoked solo considera revocado cuando revokedAt es Date", () => {
  assert.equal(isReportAccessTokenRevoked(new Date("2026-04-15T12:00:00.000Z")), true);
  assert.equal(isReportAccessTokenRevoked(null), false);
  assert.equal(isReportAccessTokenRevoked(undefined), false);
});

test("canAccessReportPublicly mantiene la tabla esperada de estados públicos", () => {
  const cases = [
    ["uploaded", false],
    ["processing", false],
    ["ready", true],
    ["delivered", true],
  ] as const;

  for (const [status, expected] of cases) {
    assert.equal(canAccessReportPublicly(status), expected);
  }
});

test("buildPublicReportAccessPath codifica tokens arbitrarios de forma segura", () => {
  const token = "abc/def?x=1 y=2";

  assert.equal(
    buildPublicReportAccessPath(token),
    "/api/public/report-access/abc%2Fdef%3Fx%3D1%20y%3D2",
  );
});
