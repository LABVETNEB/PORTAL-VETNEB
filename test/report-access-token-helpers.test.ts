import test from "node:test";
import assert from "node:assert/strict";
import {
  buildValidationError,
  clinicCreateReportAccessTokenSchema,
  parseEntityId,
  parseOffset,
  parsePositiveInt,
} from "../server/lib/report-access-token.ts";

test("parsePositiveInt respeta fallback y límite máximo", () => {
  assert.equal(parsePositiveInt("25", 50, 100), 25);
  assert.equal(parsePositiveInt("250", 50, 100), 100);
  assert.equal(parsePositiveInt("0", 50, 100), 50);
  assert.equal(parsePositiveInt("-1", 50, 100), 50);
  assert.equal(parsePositiveInt("texto", 50, 100), 50);
});

test("parseOffset acepta enteros no negativos y aplica fallback", () => {
  assert.equal(parseOffset("15", 0), 15);
  assert.equal(parseOffset("0", 3), 0);
  assert.equal(parseOffset("-1", 3), 3);
  assert.equal(parseOffset("abc", 7), 7);
});

test("parseEntityId devuelve sólo enteros positivos", () => {
  assert.equal(parseEntityId("7"), 7);
  assert.equal(parseEntityId(12), 12);
  assert.equal(parseEntityId("0"), undefined);
  assert.equal(parseEntityId("-5"), undefined);
  assert.equal(parseEntityId("abc"), undefined);
});

test("buildValidationError devuelve el primer mensaje del schema", () => {
  const parsed = clinicCreateReportAccessTokenSchema.safeParse({
    reportId: 0,
  });

  assert.equal(parsed.success, false);

  if (parsed.success) {
    throw new Error("La validación debió fallar");
  }

  assert.equal(buildValidationError(parsed.error), "reportId es obligatorio");
});

test("buildValidationError usa fallback cuando no hay issues", () => {
  const fakeError = { issues: [] } as any;
  assert.equal(buildValidationError(fakeError), "Datos inválidos");
});
