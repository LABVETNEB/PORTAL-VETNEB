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
  resolveReportAccessTokenExpiry,
} from "../../../server/features/report-access/index.ts";

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

  assert.equal(parsed.success, true);
  assert.equal(
    resolveReportAccessTokenExpiry(parsed.data?.expiresAt, Date.now()).ok,
    false,
  );
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

test("helpers de expiraciÃ³n y revocaciÃ³n funcionan correctamente", () => {
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

test("buildPublicReportAccessPath construye la ruta pÃºblica esperada", () => {
  const token = "b".repeat(64);
  assert.equal(
    buildPublicReportAccessPath(token),
    `/api/public/report-access/${token}`,
  );
});

const SEC10_DAY = 24 * 60 * 60 * 1000;
const SEC10_NOW = Date.UTC(2026, 10, 12, 12, 0, 0);

test("SEC-10: política de expiración de tokens públicos (dominio compartido)", () => {
  const def = resolveReportAccessTokenExpiry(undefined, SEC10_NOW);
  assert.deepEqual(def, { ok: true, expiresAt: new Date(SEC10_NOW + 7 * SEC10_DAY) });

  const inRange = new Date(SEC10_NOW + 10 * SEC10_DAY);
  assert.deepEqual(resolveReportAccessTokenExpiry(inRange, SEC10_NOW), {
    ok: true,
    expiresAt: inRange,
  });

  const atLimit = new Date(SEC10_NOW + 30 * SEC10_DAY);
  assert.equal(resolveReportAccessTokenExpiry(atLimit, SEC10_NOW).ok, true);

  for (const rejected of [
    null,
    new Date(SEC10_NOW),
    new Date(SEC10_NOW - 1),
    new Date(SEC10_NOW + 30 * SEC10_DAY + 1),
    new Date(Number.NaN),
  ]) {
    assert.equal(resolveReportAccessTokenExpiry(rejected, SEC10_NOW).ok, false);
  }
});

test("SEC-10: token histórico sin vencimiento conserva su comportamiento; vencido y revocado se rechazan", () => {
  assert.equal(
    getReportAccessTokenState({ expiresAt: null, revokedAt: null }, new Date(SEC10_NOW)),
    "active",
  );
  assert.equal(
    getReportAccessTokenState(
      { expiresAt: new Date(SEC10_NOW - 1), revokedAt: null },
      new Date(SEC10_NOW),
    ),
    "expired",
  );
  assert.equal(
    getReportAccessTokenState(
      { expiresAt: null, revokedAt: new Date(SEC10_NOW - 1) },
      new Date(SEC10_NOW),
    ),
    "revoked",
  );
});
