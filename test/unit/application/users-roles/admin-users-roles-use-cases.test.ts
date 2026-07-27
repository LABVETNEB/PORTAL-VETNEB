import assert from "node:assert/strict";
import test from "node:test";

import {
  createAdminUsersRolesUseCases,
  type AdminClinicUserRoleChangeInput,
  type AdminClinicUserRoleChangeResult,
  type AdminUsersRolesQuery,
  type AdminUsersRolesRepository,
  type AdminUsersRolesSnapshot,
} from "../../../../server/features/users-roles/application/index.ts";

const snapshot: AdminUsersRolesSnapshot = {
  success: true,
  users: [],
  total: 0,
  limit: 50,
  offset: 0,
  totals: {
    adminUsers: 0,
    clinicUsers: 0,
  },
};

const roleChangedResult: AdminClinicUserRoleChangeResult = {
  ok: true,
  user: {
    userType: "clinic",
    userId: 7,
    username: "clinic-user",
    role: "clinic_owner",
    clinicId: 3,
    clinicName: "Clínica",
    createdAt: "2026-07-27T00:00:00.000Z",
    updatedAt: "2026-07-27T00:00:00.000Z",
  },
  previousRole: "clinic_staff",
  roleChanged: true,
};

function createRepository(
  overrides: Partial<AdminUsersRolesRepository> = {},
): AdminUsersRolesRepository {
  return {
    getAdminUsersRolesSnapshot: async () => snapshot,
    changeClinicUserRole: async () => roleChangedResult,
    ...overrides,
  };
}

test("listAdminUsersRoles delega una vez y preserva input/output por identidad", async () => {
  const query: AdminUsersRolesQuery = {
    userType: "clinic",
    role: "clinic_owner",
    search: "demo",
    limit: 10,
    offset: 5,
  };
  let calls = 0;
  let received: AdminUsersRolesQuery | undefined;
  let commandCalls = 0;
  const useCases = createAdminUsersRolesUseCases(
    createRepository({
      getAdminUsersRolesSnapshot: async (input) => {
        calls += 1;
        received = input;
        return snapshot;
      },
      changeClinicUserRole: async () => {
        commandCalls += 1;
        return roleChangedResult;
      },
    }),
  );

  const result = await useCases.listAdminUsersRoles(query);

  assert.equal(calls, 1);
  assert.equal(commandCalls, 0);
  assert.strictEqual(received, query);
  assert.strictEqual(result, snapshot);
});

test("changeClinicUserRole delega una vez y preserva input/output por identidad", async () => {
  const input: AdminClinicUserRoleChangeInput = {
    clinicUserId: 7,
    role: "clinic_owner",
    now: new Date("2026-07-27T00:00:00.000Z"),
  };
  let calls = 0;
  let received: AdminClinicUserRoleChangeInput | undefined;
  let readCalls = 0;
  const useCases = createAdminUsersRolesUseCases(
    createRepository({
      getAdminUsersRolesSnapshot: async () => {
        readCalls += 1;
        return snapshot;
      },
      changeClinicUserRole: async (value) => {
        calls += 1;
        received = value;
        return roleChangedResult;
      },
    }),
  );

  const result = await useCases.changeClinicUserRole(input);

  assert.equal(calls, 1);
  assert.equal(readCalls, 0);
  assert.strictEqual(received, input);
  assert.strictEqual(result, roleChangedResult);
});

for (const preservedResult of [
  { ok: false, reason: "not_found" },
  { ok: false, reason: "last_clinic_owner" },
  {
    ...roleChangedResult,
    roleChanged: false,
  },
] satisfies AdminClinicUserRoleChangeResult[]) {
  test(`changeClinicUserRole preserva ${preservedResult.ok ? "roleChanged false" : preservedResult.reason}`, async () => {
    const useCases = createAdminUsersRolesUseCases(
      createRepository({
        changeClinicUserRole: async () => preservedResult,
      }),
    );

    assert.strictEqual(
      await useCases.changeClinicUserRole({
        clinicUserId: 7,
        role: "clinic_staff",
      }),
      preservedResult,
    );
  });
}

test("los errores del repository pasan sin envolver", async () => {
  const readError = new Error("read failed");
  const commandError = new Error("command failed");
  const useCases = createAdminUsersRolesUseCases(
    createRepository({
      getAdminUsersRolesSnapshot: async () => {
        throw readError;
      },
      changeClinicUserRole: async () => {
        throw commandError;
      },
    }),
  );

  await assert.rejects(
    useCases.listAdminUsersRoles({}),
    (error) => error === readError,
  );
  await assert.rejects(
    useCases.changeClinicUserRole({
      clinicUserId: 7,
      role: "clinic_staff",
    }),
    (error) => error === commandError,
  );
});
