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

function extractFunction(source: string, functionName: string): string {
  const signature = `export async function ${functionName}(`;
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `${functionName} declaration must exist`);

  const nextExport = source.indexOf("\nexport ", start + signature.length);
  return nextExport === -1 ? source.slice(start) : source.slice(start, nextExport);
}

test("public pricing API client defines frontend contract types", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(source.includes("export type PublicPricingItem = {"));
  assert.ok(source.includes("export type PublicPricingCategory = {"));
  assert.ok(source.includes("export type PublicPricingSnapshot = {"));
  assert.ok(source.includes("priceLabel: string | null;"));
  assert.ok(source.includes("categories: PublicPricingCategory[];"));
});

test("public pricing API client reads the real pricing endpoint", () => {
  const source = read(API_CLIENT_PATH);
  const functionSource = extractFunction(source, "getPublicPricing");

  assert.ok(functionSource.includes("options?: RequestInit,"));
  assert.ok(functionSource.includes("readOptions: PublicPricingReadOptions = {},"));
  assert.ok(functionSource.includes("apiFetch<PublicPricingSnapshot>("));
  assert.ok(functionSource.includes("\"/api/public/pricing\","));
});

test("public pricing API client preserves API errors by default", () => {
  const source = read(API_CLIENT_PATH);
  const functionSource = extractFunction(source, "getPublicPricing");

  assert.ok(functionSource.includes("if (readOptions.throwOnError ?? true) {"));
  assert.ok(functionSource.includes("throw error;"));
  assert.ok(functionSource.includes("categories: [],"));
});

test("public pricing API client does not use mock pricing fallback", () => {
  const source = read(API_CLIENT_PATH);
  const functionSource = extractFunction(source, "getPublicPricing");

  assert.equal(source.includes('from "@/lib/mock-data"'), false);
  assert.equal(source.includes("MOCK_"), false);
  assert.equal(functionSource.includes("@/lib/mock-data"), false);
  assert.equal(functionSource.includes("MOCK_"), false);
});
