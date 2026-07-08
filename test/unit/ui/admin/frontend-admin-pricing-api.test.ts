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

test("frontend API client exposes admin pricing snapshot contracts", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(source.includes("export type AdminPricingCategoryItem = {"));
  assert.ok(source.includes("export type AdminPricingCategory = {"));
  assert.ok(source.includes("export type AdminPricingSnapshot = {"));
  assert.ok(source.includes("export type AdminPricingItem = {"));
  assert.ok(source.includes("priceLabel: string | null;"));
  assert.ok(source.includes("isActive: boolean;"));
  assert.ok(source.includes("displayOrder: number;"));
  assert.ok(source.includes("updatedAt: string;"));
});

test("frontend API client reads admin pricing from backend endpoint", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(source.includes("export async function getAdminPricing("));
  assert.ok(source.includes("options?: RequestInit,"));
  assert.ok(source.includes("): Promise<AdminPricingSnapshot>"));
  assert.ok(source.includes('return apiFetch<AdminPricingSnapshot>("/api/admin/pricing", options);'));
});

test("frontend API client updates admin pricing with PATCH", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(source.includes("export async function updateAdminPricingItem("));
  assert.ok(source.includes("id: number,"));
  assert.ok(source.includes("payload: AdminPricingUpdatePayload,"));
  assert.ok(source.includes("options?: RequestInit,"));
  assert.ok(source.includes("): Promise<AdminPricingUpdateResponse>"));
  assert.ok(source.includes("const normalizedPayload = buildAdminPricingUpdatePayload(payload);"));
  assert.ok(source.includes("return apiFetch<AdminPricingUpdateResponse>(`/api/admin/pricing/${id}`, {"));
  assert.ok(source.includes('method: "PATCH",'));
  assert.ok(source.includes("body: JSON.stringify(normalizedPayload),"));
});

test("frontend API client normalizes empty priceLabel as null", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(source.includes("function normalizeAdminPricingPriceLabel("));
  assert.ok(source.includes("const trimmed = value.trim();"));
  assert.ok(source.includes("return trimmed ? trimmed : null;"));
  assert.ok(source.includes("if (Object.prototype.hasOwnProperty.call(payload, \"priceLabel\")) {"));
  assert.ok(source.includes("normalizedPayload.priceLabel = normalizeAdminPricingPriceLabel("));
});
