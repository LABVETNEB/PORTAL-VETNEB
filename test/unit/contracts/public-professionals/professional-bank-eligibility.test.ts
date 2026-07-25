import test from "node:test";
import assert from "node:assert/strict";

import {
  HISTOPATHOLOGY_REPORT_STUDY_TYPE,
  addMonths,
  getEligibleUntil,
  getLastHistopathologyReportDeliveredAt,
  getProfessionalBankEligibility,
  getProfessionalBankEligibilityWindow,
  isHistopathologyReport,
  isProfessionalBankEligible,
} from "../../../../server/features/public-professionals/domain/index.ts";
import { REPORT_STUDY_TYPES } from "../../../../server/features/reports/domain/index.ts";

const NOW = new Date("2026-06-03T12:00:00.000Z");

test("professional bank eligibility uses a rolling 3 month UTC window", () => {
  const window = getProfessionalBankEligibilityWindow(NOW);

  assert.equal(window.now.toISOString(), "2026-06-03T12:00:00.000Z");
  assert.equal(window.deliveredFrom.toISOString(), "2026-03-03T12:00:00.000Z");
  assert.equal(
    getEligibleUntil(new Date("2026-04-10T09:30:00.000Z")).toISOString(),
    "2026-07-10T09:30:00.000Z",
  );
});

test("professional bank eligibility includes reports delivered today and inside 3 months", () => {
  assert.equal(isProfessionalBankEligible(NOW, NOW), true);
  assert.equal(
    isProfessionalBankEligible("2026-04-01T08:00:00.000Z", NOW),
    true,
  );
  assert.equal(
    isProfessionalBankEligible("2026-03-03T12:00:00.000Z", NOW),
    true,
  );
});

test("professional bank eligibility rejects missing, invalid, and expired deliveries", () => {
  assert.equal(isProfessionalBankEligible(null, NOW), false);
  assert.equal(isProfessionalBankEligible("not-a-date", NOW), false);
  assert.equal(
    isProfessionalBankEligible("2026-03-03T11:59:59.999Z", NOW),
    false,
  );
});

test("professional bank eligibility keeps month-end arithmetic stable", () => {
  assert.equal(
    addMonths(new Date("2026-01-31T10:00:00.000Z"), 3).toISOString(),
    "2026-04-30T10:00:00.000Z",
  );
});

test("histopathology definition uses the report study type catalog", () => {
  assert.equal(isHistopathologyReport({ studyType: "histopatologia" }), true);
  assert.equal(isHistopathologyReport({ studyType: "citologia" }), false);
  assert.equal(isHistopathologyReport({ studyType: "Histopatologia" }), false);
  assert.equal(isHistopathologyReport({ studyType: null }), false);
});

test("histopathology study type stays a member of the report study type catalog", () => {
  // Relación contractual preservada por test, no por dependencia runtime: el
  // dominio canónico ya no importa `report-study-types.ts` (M21). El nuevo
  // predicado `input.studyType === HISTOPATHOLOGY_REPORT_STUDY_TYPE` es
  // equivalente al anterior `isReportStudyType(x) && x === HISTOPATHOLOGY...`
  // exactamente porque el único valor que satisface la igualdad también
  // pertenece al catálogo. Este assert ancla esa pertenencia.
  assert.equal(
    REPORT_STUDY_TYPES.includes(HISTOPATHOLOGY_REPORT_STUDY_TYPE),
    true,
  );
});

test("last histopathology delivery ignores non-admin, non-histopathology, and invalid rows", () => {
  const lastDeliveredAt = getLastHistopathologyReportDeliveredAt([
    {
      studyType: "histopatologia",
      deliveredAt: "2026-04-01T08:00:00.000Z",
      deliveredByAdmin: false,
    },
    {
      studyType: "citologia",
      deliveredAt: "2026-05-20T08:00:00.000Z",
      deliveredByAdmin: true,
    },
    {
      studyType: "histopatologia",
      deliveredAt: "not-a-date",
      deliveredByAdmin: true,
    },
    {
      studyType: "histopatologia",
      deliveredAt: "2026-05-15T08:00:00.000Z",
      deliveredByAdmin: true,
    },
  ]);

  assert.equal(lastDeliveredAt?.toISOString(), "2026-05-15T08:00:00.000Z");
});

test("professional bank eligibility uses the latest admin histopathology delivery", () => {
  const expiredOnly = getProfessionalBankEligibility(
    [
      {
        studyType: "histopatologia",
        deliveredAt: "2026-02-15T12:00:00.000Z",
        deliveredByAdmin: true,
      },
      {
        studyType: "citologia",
        deliveredAt: "2026-06-01T12:00:00.000Z",
        deliveredByAdmin: true,
      },
    ],
    NOW,
  );

  assert.equal(expiredOnly.eligible, false);
  assert.equal(
    expiredOnly.lastHistopathologyReportDeliveredAt?.toISOString(),
    "2026-02-15T12:00:00.000Z",
  );

  const refreshed = getProfessionalBankEligibility(
    [
      {
        studyType: "histopatologia",
        deliveredAt: "2026-02-15T12:00:00.000Z",
        deliveredByAdmin: true,
      },
      {
        studyType: "histopatologia",
        deliveredAt: "2026-06-03T12:00:00.000Z",
        deliveredByAdmin: true,
      },
    ],
    NOW,
  );

  assert.equal(refreshed.eligible, true);
  assert.equal(
    refreshed.lastHistopathologyReportDeliveredAt?.toISOString(),
    "2026-06-03T12:00:00.000Z",
  );
  assert.equal(
    refreshed.eligibleUntil?.toISOString(),
    "2026-09-03T12:00:00.000Z",
  );
});

test("professional bank eligibility expires automatically without manual state", () => {
  const delivery = new Date("2026-03-03T12:00:00.000Z");

  assert.equal(
    isProfessionalBankEligible(delivery, new Date("2026-06-03T12:00:00.000Z")),
    true,
  );
  assert.equal(
    isProfessionalBankEligible(delivery, new Date("2026-06-03T12:00:00.001Z")),
    false,
  );
});
