import assert from "node:assert/strict";
import test from "node:test";

import {
  ADMIN_CLINIC_USER_ROLES,
  ADMIN_ROLE_USER_ROLES,
  ADMIN_ROLE_USER_TYPES,
  parseAdminClinicUserRole,
  parseAdminRoleUserRole,
  parseAdminRoleUserType,
} from "../../../../server/features/users-roles/domain/index.ts";

test("Users/Roles conserva los catálogos canónicos exactos", () => {
  assert.deepEqual(ADMIN_ROLE_USER_TYPES, ["admin", "clinic"]);
  assert.deepEqual(ADMIN_ROLE_USER_ROLES, [
    "admin",
    "clinic_owner",
    "clinic_staff",
  ]);
  assert.deepEqual(ADMIN_CLINIC_USER_ROLES, [
    "clinic_owner",
    "clinic_staff",
  ]);
});

test("parseAdminRoleUserType acepta admin y clinic", () => {
  assert.equal(parseAdminRoleUserType("admin"), "admin");
  assert.equal(parseAdminRoleUserType("clinic"), "clinic");
});

test("parseAdminRoleUserRole acepta el catálogo completo de filtros", () => {
  assert.equal(parseAdminRoleUserRole("admin"), "admin");
  assert.equal(parseAdminRoleUserRole("clinic_owner"), "clinic_owner");
  assert.equal(parseAdminRoleUserRole("clinic_staff"), "clinic_staff");
});

test("parseAdminClinicUserRole acepta sólo roles mutables de clínica", () => {
  assert.equal(parseAdminClinicUserRole("clinic_owner"), "clinic_owner");
  assert.equal(parseAdminClinicUserRole("clinic_staff"), "clinic_staff");
  assert.equal(parseAdminClinicUserRole("admin"), null);
});

test("los parsers rechazan tipos y strings desconocidos sin normalizar", () => {
  const rejectedValues = [
    null,
    undefined,
    {},
    1,
    "owner",
    " clinic_owner ",
    "CLINIC_STAFF",
  ];

  for (const value of rejectedValues) {
    assert.equal(parseAdminRoleUserType(value), null);
    assert.equal(parseAdminRoleUserRole(value), null);
    assert.equal(parseAdminClinicUserRole(value), null);
  }
});
