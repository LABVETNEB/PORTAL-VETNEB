import assert from "node:assert/strict";
import test from "node:test";

import {
  getAdminClinicQuery,
  listAdminClinicsQuery,
  type AdminClinicSummary,
  type AdminClinicsSnapshot,
} from "../../../server/features/clinics/admin-clinics-query-service.ts";

const clinic: AdminClinicSummary = {
  clinicId: 17,
  clinicName: "Clínica Norte",
  contactEmail: "norte@example.test",
  contactPhone: null,
  createdAt: "2026-07-23T00:00:00.000Z",
  updatedAt: "2026-07-23T00:00:00.000Z",
};

test("listAdminClinicsQuery delega los params exactos y retorna el snapshot exacto", async () => {
  const params = {
    limit: 25,
    offset: 50,
    search: "norte",
  };
  const snapshot: AdminClinicsSnapshot = {
    success: true,
    clinics: [{ ...clinic, users: [] }],
    total: 1,
    limit: 25,
    offset: 50,
  };
  let receivedParams: unknown;

  const result = await listAdminClinicsQuery(params, {
    listAdminClinics: async (input) => {
      receivedParams = input;
      return snapshot;
    },
  });

  assert.strictEqual(receivedParams, params);
  assert.strictEqual(result, snapshot);
});

test("getAdminClinicQuery retorna la clínica encontrada sin transformarla", async () => {
  let receivedClinicId: number | undefined;

  const result = await getAdminClinicQuery(17, {
    getAdminClinicById: async (clinicId) => {
      receivedClinicId = clinicId;
      return clinic;
    },
  });

  assert.equal(receivedClinicId, 17);
  assert.strictEqual(result, clinic);
});

test("getAdminClinicQuery preserva not-found", async () => {
  const result = await getAdminClinicQuery(404, {
    getAdminClinicById: async () => null,
  });

  assert.equal(result, null);
});
