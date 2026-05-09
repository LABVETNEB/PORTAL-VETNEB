import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const TYPES_PATH = "frontend/src/types/index.ts";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("frontend core types expose auth user and login credentials contracts", () => {
  const source = read(TYPES_PATH);

  assert.ok(source.includes("export type AuthUser = {"));
  assert.ok(source.includes("id: number;"));
  assert.ok(source.includes("username: string;"));
  assert.ok(source.includes('role: ClinicUserRole | "admin";'));
  assert.ok(source.includes("export type LoginCredentials = {"));
  assert.ok(source.includes("password: string;"));
});

test("frontend core types expose report status and report contracts", () => {
  const source = read(TYPES_PATH);

  assert.ok(source.includes("export const REPORT_STATUSES = ["));
  assert.ok(source.includes('"uploaded",'));
  assert.ok(source.includes('"processing",'));
  assert.ok(source.includes('"ready",'));
  assert.ok(source.includes('"delivered",'));
  assert.ok(source.includes("export type ReportStatus = (typeof REPORT_STATUSES)[number];"));
  assert.ok(source.includes("export type Report = {"));
  assert.ok(source.includes("status: ReportStatus;"));
});

test("frontend core types expose logistics visit and route plan contracts", () => {
  const source = read(TYPES_PATH);

  assert.ok(source.includes("export type FieldVisit = {"));
  assert.ok(source.includes("status: FieldVisitStatus;"));
  assert.ok(source.includes("export type RoutePlan = {"));
  assert.ok(source.includes("status: RoutePlanStatus;"));
  assert.ok(source.includes("export type RouteMetrics = {"));
  assert.ok(source.includes("complianceRate: number;"));
});

test("frontend core types expose dashboard and admin system contracts", () => {
  const source = read(TYPES_PATH);

  assert.ok(source.includes("export type DashboardStats = {"));
  assert.ok(source.includes("totalReports: number;"));
  assert.ok(source.includes("pendingReports: number;"));
  assert.ok(source.includes("activeVisits: number;"));
  assert.ok(source.includes("activePlans: number;"));
  assert.ok(source.includes("export type SystemHealth = {"));
  assert.ok(source.includes("export type MaintenancePurgeDryRunSnapshot = {"));
});

test("frontend core types expose admin sessions and users roles contracts", () => {
  const source = read(TYPES_PATH);

  assert.ok(source.includes("export type AdminSessionType ="));
  assert.ok(source.includes('"admin" | "clinic" | "particular";'));
  assert.ok(source.includes("export type AdminSessionsQuery = {"));
  assert.ok(source.includes("export type AdminSessionsSnapshot = {"));
  assert.ok(source.includes("export type AdminSessionRevocationResponse = {"));
  assert.ok(source.includes("export type AdminUsersRolesQuery = {"));
  assert.ok(source.includes("export type AdminUsersRolesSnapshot = {"));
  assert.ok(source.includes("export type AdminClinicUserRoleChangeResponse = {"));
  assert.ok(source.includes("export type ClinicUserRole = (typeof CLINIC_USER_ROLES)[number];"));
});
