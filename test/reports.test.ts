import test from "node:test";
import assert from "node:assert/strict";

import {
  getReadClinicScope,
  normalizeOptionalNote,
  normalizeSearchText,
  parseClinicId,
  parseOffset,
  parseOptionalDate,
  parsePositiveInt,
  parseReportId,
  parseReportStatus,
} from "../server/lib/reports.ts";

test("reports helpers parsean enteros positivos con fallback y límite máximo", () => {
  assert.equal(parsePositiveInt("25", 50, 100), 25);
  assert.equal(parsePositiveInt("500", 50, 100), 100);
  assert.equal(parsePositiveInt("0", 50, 100), 50);
  assert.equal(parsePositiveInt("-1", 50, 100), 50);
  assert.equal(parsePositiveInt("abc", 50, 100), 50);
});

test("reports helpers parsean offset y entity ids seguros", () => {
  assert.equal(parseOffset("25"), 25);
  assert.equal(parseOffset("0"), 0);
  assert.equal(parseOffset("-1"), 0);
  assert.equal(parseOffset("abc", 10), 10);

  assert.equal(parseClinicId("3"), 3);
  assert.equal(parseClinicId("0"), undefined);
  assert.equal(parseClinicId("abc"), undefined);

  assert.equal(parseReportId("55"), 55);
  assert.equal(parseReportId("0"), undefined);
  assert.equal(parseReportId("abc"), undefined);
});

test("reports helpers normalizan texto, notas y fechas opcionales", () => {
  assert.equal(normalizeSearchText("  cardio  "), "cardio");
  assert.equal(normalizeSearchText("   "), undefined);
  assert.equal(normalizeSearchText(null), undefined);

  assert.equal(normalizeOptionalNote("  nota  "), "nota");
  assert.equal(normalizeOptionalNote("   "), null);
  assert.equal(normalizeOptionalNote(null), null);
  assert.equal(normalizeOptionalNote("a".repeat(2100)), "a".repeat(2000));

  assert.equal(
    parseOptionalDate("2026-04-20T00:00:00.000Z")?.toISOString(),
    "2026-04-20T00:00:00.000Z",
  );
  assert.equal(parseOptionalDate("invalid"), undefined);
  assert.equal(parseOptionalDate("   "), undefined);
});

test("reports helpers calculan scope de lectura clinic-scoped", () => {
  assert.deepEqual(getReadClinicScope(undefined, 3), {
    clinicId: 3,
    isForbidden: false,
  });

  assert.deepEqual(getReadClinicScope("3", 3), {
    clinicId: 3,
    isForbidden: false,
  });

  assert.deepEqual(getReadClinicScope("5", 3), {
    clinicId: 3,
    isForbidden: true,
  });

  assert.deepEqual(getReadClinicScope("abc", 3), {
    clinicId: 3,
    isForbidden: false,
  });
});

test("reports helpers normalizan estados de informe", () => {
  assert.equal(parseReportStatus("ready"), "ready");
  assert.equal(parseReportStatus(" READY "), "ready");
  assert.equal(parseReportStatus("bad"), undefined);
  assert.equal(parseReportStatus(undefined), undefined);
});
