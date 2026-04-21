import test from "node:test";
import assert from "node:assert/strict";
import {
  adminCreateReportAccessTokenSchema,
} from "../server/lib/report-access-token.ts";

test("adminCreateReportAccessTokenSchema requiere clinicId y reportId válidos", () => {
  const parsed = adminCreateReportAccessTokenSchema.safeParse({
    clinicId: "7",
    reportId: "12",
  });

  assert.equal(parsed.success, true);

  if (!parsed.success) {
    return;
  }

  assert.equal(parsed.data.clinicId, 7);
  assert.equal(parsed.data.reportId, 12);
  assert.equal(parsed.data.expiresAt, undefined);
});

test("adminCreateReportAccessTokenSchema parsea expiresAt futura", () => {
  const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const parsed = adminCreateReportAccessTokenSchema.safeParse({
    clinicId: "9",
    reportId: "21",
    expiresAt: future,
  });

  assert.equal(parsed.success, true);

  if (!parsed.success) {
    return;
  }

  assert.equal(parsed.data.clinicId, 9);
  assert.equal(parsed.data.reportId, 21);
  assert.ok(parsed.data.expiresAt instanceof Date);
  assert.equal(parsed.data.expiresAt?.toISOString(), future);
});

test("adminCreateReportAccessTokenSchema rechaza clinicId ausente", () => {
  const parsed = adminCreateReportAccessTokenSchema.safeParse({
    reportId: "21",
  });

  assert.equal(parsed.success, false);
});

test("adminCreateReportAccessTokenSchema rechaza clinicId no positivo", () => {
  const parsed = adminCreateReportAccessTokenSchema.safeParse({
    clinicId: "0",
    reportId: "21",
  });

  assert.equal(parsed.success, false);
});

test("adminCreateReportAccessTokenSchema rechaza expiresAt pasada", () => {
  const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const parsed = adminCreateReportAccessTokenSchema.safeParse({
    clinicId: "5",
    reportId: "18",
    expiresAt: past,
  });

  assert.equal(parsed.success, false);
});
