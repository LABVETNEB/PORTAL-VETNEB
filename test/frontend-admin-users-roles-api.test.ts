import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const API_CLIENT_PATH = "frontend/src/lib/api.ts";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("frontend API client builds admin users roles query parameters explicitly", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(source.includes("export async function getAdminUsersRoles("));
  assert.ok(source.includes("params: AdminUsersRolesQuery = {},"));
  assert.ok(source.includes("options?: RequestInit,"));
  assert.ok(source.includes("): Promise<AdminUsersRolesSnapshot>"));
  assert.ok(source.includes("const query = new URLSearchParams();"));
  assert.ok(source.includes('query.set("userType", params.userType);'));
  assert.ok(source.includes('query.set("role", params.role);'));
  assert.ok(source.includes('query.set("limit", String(params.limit));'));
  assert.ok(source.includes('query.set("offset", String(params.offset));'));
  assert.ok(source.includes("const qs = query.toString();"));
});

test("frontend API client reads admin users roles from backend endpoint", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(source.includes("return apiFetch<AdminUsersRolesSnapshot>("));
  assert.ok(source.includes("`/api/admin/users-roles${qs ? `?${qs}` : \"\"}`,"));
  assert.ok(source.includes("options,"));
});

test("frontend API client changes clinic user role with PATCH", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(source.includes("export async function changeAdminClinicUserRole("));
  assert.ok(source.includes("clinicUserId: number,"));
  assert.ok(source.includes("role: ClinicUserRole,"));
  assert.ok(source.includes("options?: RequestInit,"));
  assert.ok(source.includes("): Promise<AdminClinicUserRoleChangeResponse>"));
  assert.ok(source.includes("return apiFetch<AdminClinicUserRoleChangeResponse>("));
  assert.ok(source.includes("`/api/admin/users-roles/clinic/${clinicUserId}/role`,"));
  assert.ok(source.includes('method: "PATCH",'));
  assert.ok(source.includes("body: JSON.stringify({ role }),"));
});

test("frontend admin users roles API helpers remain typed around role snapshots", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(source.includes("AdminUsersRolesQuery,"));
  assert.ok(source.includes("AdminUsersRolesSnapshot,"));
  assert.ok(source.includes("AdminClinicUserRoleChangeResponse,"));
  assert.ok(source.includes("ClinicUserRole,"));
});

test("frontend API client exposes admin clinics management endpoints", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(source.includes("export async function getAdminClinics("));
  assert.ok(source.includes("): Promise<AdminClinicsSnapshot>"));
  assert.ok(source.includes("`/api/admin/clinics${qs ? `?${qs}` : \"\"}`,"));
  assert.ok(source.includes("export async function createAdminClinicWithUser("));
  assert.ok(source.includes("payload: AdminClinicCreatePayload,"));
  assert.ok(source.includes("): Promise<AdminClinicCreateResponse>"));
  assert.ok(source.includes('"/api/admin/clinics"'));
  assert.ok(source.includes("export async function updateAdminClinic("));
  assert.ok(source.includes("clinicId: number,"));
  assert.ok(source.includes("payload: AdminClinicUpdatePayload,"));
  assert.ok(source.includes("`/api/admin/clinics/${clinicId}`,"));
  assert.ok(source.includes("export async function updateAdminClinicUserCredentials("));
  assert.ok(source.includes("payload: AdminClinicUserCredentialsUpdatePayload,"));
  assert.ok(source.includes("): Promise<AdminClinicUserCredentialsUpdateResponse>"));
  assert.ok(source.includes("`/api/admin/users-roles/clinic/${clinicUserId}/credentials`,"));
});
