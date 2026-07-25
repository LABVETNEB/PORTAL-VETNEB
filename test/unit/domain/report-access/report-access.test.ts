import assert from "node:assert/strict";
import test from "node:test";

import {
  belongsToClinic,
  canAccessReportPublicly,
  getReportAccessTokenState,
  isReportAccessTokenExpired,
  isReportAccessTokenRevoked,
} from "../../../../server/features/report-access/domain/index.ts";

const now = new Date("2026-07-25T12:00:00.000Z");

test("lifecycle distingue activo, revocado y expirado con borde inclusivo", () => {
  assert.equal(
    getReportAccessTokenState(
      { expiresAt: new Date(now.getTime() + 1), revokedAt: null },
      now,
    ),
    "active",
  );
  assert.equal(
    getReportAccessTokenState(
      { expiresAt: null, revokedAt: new Date(now.getTime() - 1) },
      now,
    ),
    "revoked",
  );
  assert.equal(
    getReportAccessTokenState({ expiresAt: now, revokedAt: null }, now),
    "expired",
  );
  assert.equal(isReportAccessTokenExpired(undefined, now), false);
  assert.equal(isReportAccessTokenRevoked(null), false);
});

test("revocación prevalece sobre expiración", () => {
  assert.equal(
    getReportAccessTokenState(
      { expiresAt: now, revokedAt: new Date(now.getTime() - 1) },
      now,
    ),
    "revoked",
  );
});

test("ownership, clinic scope y disponibilidad son decisiones puras", () => {
  assert.equal(belongsToClinic(7, 7), true);
  assert.equal(belongsToClinic(7, 8), false);
  assert.equal(canAccessReportPublicly("ready"), true);
  assert.equal(canAccessReportPublicly("delivered"), true);
  assert.equal(canAccessReportPublicly("draft"), false);
});
