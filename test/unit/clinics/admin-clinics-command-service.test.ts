import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyAdminClinicsPostgresError,
  createAdminClinicCommand,
  deleteAdminClinicCommand,
  updateAdminClinicCommand,
  updateAdminClinicUserCredentialsCommand,
  type AdminClinicCreateInput,
  type AdminClinicCreateResult,
  type AdminClinicSummary,
  type AdminClinicUserCredentialsUpdateInput,
  type AdminClinicUserCredentialsUpdateResult,
} from "../../../server/features/clinics/admin-clinics-command-service.ts";

const clinic: AdminClinicSummary = {
  clinicId: 17,
  clinicName: "Clínica Norte",
  contactEmail: "norte@example.test",
  contactPhone: null,
  createdAt: "2026-07-23T00:00:00.000Z",
  updatedAt: "2026-07-23T00:00:00.000Z",
};

const clinicUser = {
  userType: "clinic" as const,
  userId: 29,
  username: "clinic-norte",
  role: "clinic_owner" as const,
  clinicId: 17,
  clinicName: "Clínica Norte",
  createdAt: "2026-07-23T00:00:00.000Z",
  updatedAt: "2026-07-23T00:00:00.000Z",
};

test("createAdminClinicCommand hashea una vez y persiste passwordHash", async () => {
  const calls: string[] = [];
  let persistedInput: AdminClinicCreateInput | undefined;
  const expectedResult: AdminClinicCreateResult = {
    ok: true,
    clinic,
    user: clinicUser,
  };

  const result = await createAdminClinicCommand(
    {
      clinicName: clinic.clinicName,
      contactEmail: "norte@example.test",
      contactPhone: null,
      username: "clinic-norte",
      password: "password-for-test",
      role: "clinic_owner",
      now: new Date("2026-07-23T00:00:00.000Z"),
    },
    {
      hashPassword: async (password) => {
        calls.push(`hash:${password}`);
        return "hashed-for-test";
      },
      createAdminClinicWithUser: async (input) => {
        calls.push("persist");
        persistedInput = input;
        return expectedResult;
      },
    },
  );

  assert.deepEqual(calls, [
    "hash:password-for-test",
    "persist",
  ]);
  assert.equal(persistedInput?.passwordHash, "hashed-for-test");
  assert.equal("password" in (persistedInput ?? {}), false);
  assert.strictEqual(result, expectedResult);
});

test("updateAdminClinicCommand delega sin mutar el input", async () => {
  const input = {
    clinicId: 17,
    clinicName: "Clínica Norte Actualizada",
    now: new Date("2026-07-23T12:00:00.000Z"),
  };
  let receivedInput: unknown;

  const result = await updateAdminClinicCommand(input, {
    updateAdminClinic: async (received) => {
      receivedInput = received;
      return clinic;
    },
  });

  assert.strictEqual(receivedInput, input);
  assert.strictEqual(result, clinic);
});

test("deleteAdminClinicCommand no elimina cuando la clínica no existe", async () => {
  let deleteCalls = 0;

  const result = await deleteAdminClinicCommand(
    {
      clinicId: 404,
      confirmClinicName: clinic.clinicName,
    },
    {
      getAdminClinicById: async () => null,
      deleteAdminClinic: async () => {
        deleteCalls += 1;
        return clinic;
      },
    },
  );

  assert.deepEqual(result, {
    ok: false,
    reason: "not_found",
  });
  assert.equal(deleteCalls, 0);
});

test("deleteAdminClinicCommand exige confirmación exacta antes de eliminar", async () => {
  let deleteCalls = 0;

  const result = await deleteAdminClinicCommand(
    {
      clinicId: 17,
      confirmClinicName: "clinica norte",
    },
    {
      getAdminClinicById: async () => clinic,
      deleteAdminClinic: async () => {
        deleteCalls += 1;
        return clinic;
      },
    },
  );

  assert.deepEqual(result, {
    ok: false,
    reason: "confirmation_mismatch",
  });
  assert.equal(deleteCalls, 0);
});

test("deleteAdminClinicCommand respeta el orden get y delete", async () => {
  const calls: string[] = [];

  const result = await deleteAdminClinicCommand(
    {
      clinicId: 17,
      confirmClinicName: clinic.clinicName,
    },
    {
      getAdminClinicById: async () => {
        calls.push("get");
        return clinic;
      },
      deleteAdminClinic: async () => {
        calls.push("delete");
        return clinic;
      },
    },
  );

  assert.deepEqual(calls, ["get", "delete"]);
  assert.deepEqual(result, {
    ok: true,
    clinic,
  });
});

test("updateAdminClinicUserCredentialsCommand hashea cuando recibe password", async () => {
  let hashCalls = 0;
  let persistedInput:
    | AdminClinicUserCredentialsUpdateInput
    | undefined;
  const expectedResult: AdminClinicUserCredentialsUpdateResult = {
    ok: true,
    user: clinicUser,
    previousUsername: "clinic-norte",
    usernameChanged: false,
    credentialUpdated: true,
  };

  const result =
    await updateAdminClinicUserCredentialsCommand(
      {
        clinicUserId: 29,
        username: "clinic-norte",
        password: "new-password-for-test",
      },
      {
        hashPassword: async () => {
          hashCalls += 1;
          return "new-hash-for-test";
        },
        updateAdminClinicUserCredentials: async (input) => {
          persistedInput = input;
          return expectedResult;
        },
      },
    );

  assert.equal(hashCalls, 1);
  assert.equal(
    persistedInput?.passwordHash,
    "new-hash-for-test",
  );
  assert.strictEqual(result, expectedResult);
});

test("updateAdminClinicUserCredentialsCommand no hashea sin password", async () => {
  let hashCalls = 0;
  let persistedInput:
    | AdminClinicUserCredentialsUpdateInput
    | undefined;

  await updateAdminClinicUserCredentialsCommand(
    {
      clinicUserId: 29,
      username: "clinic-norte-next",
    },
    {
      hashPassword: async () => {
        hashCalls += 1;
        return "unused";
      },
      updateAdminClinicUserCredentials: async (input) => {
        persistedInput = input;
        return {
          ok: false,
          reason: "not_found",
        };
      },
    },
  );

  assert.equal(hashCalls, 0);
  assert.equal(persistedInput?.passwordHash, undefined);
  assert.equal("password" in (persistedInput ?? {}), false);
});

test("classifyAdminClinicsPostgresError clasifica 23505", () => {
  assert.equal(
    classifyAdminClinicsPostgresError({
      code: "23505",
    }).kind,
    "username_conflict",
  );
});

test("classifyAdminClinicsPostgresError clasifica 23502 y 23503", () => {
  assert.equal(
    classifyAdminClinicsPostgresError({
      code: "23502",
    }).kind,
    "schema_mismatch",
  );
  assert.equal(
    classifyAdminClinicsPostgresError({
      code: "23503",
    }).kind,
    "active_dependency",
  );
});

test("classifyAdminClinicsPostgresError sanitiza metadata técnica", () => {
  const classified = classifyAdminClinicsPostgresError({
    name: "DatabaseError",
    code: "23503",
    constraint_name: "reports_clinic_id_fkey",
    table_name: "reports",
    column_name: "clinic_id",
    detail: "sensitive detail",
    message: "sensitive message",
  });
  const serialized = JSON.stringify(classified.metadata);

  assert.deepEqual(classified.metadata, {
    errorName: "DatabaseError",
    errorCode: "23503",
    constraintName: "reports_clinic_id_fkey",
    tableName: "reports",
    columnName: "clinic_id",
  });
  assert.doesNotMatch(serialized, /detail|message|sensitive/);
});
