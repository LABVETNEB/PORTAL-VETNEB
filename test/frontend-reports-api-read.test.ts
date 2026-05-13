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

test("frontend API client reads reports from backend reports endpoint", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(source.includes("export async function getReports("));
  assert.ok(source.includes("options?: RequestInit,"));
  assert.ok(source.includes("params?: {"));
  assert.ok(source.includes("status?: string;"));
  assert.ok(source.includes("limit?: number;"));
  assert.ok(source.includes("offset?: number;"));
  assert.ok(source.includes("readOptions: ReportReadOptions = {},"));
  assert.ok(source.includes("throwOnError?: boolean;"));
  assert.ok(source.includes("const query = new URLSearchParams();"));
  assert.ok(source.includes("`/api/reports${qs ? `?${qs}` : \"\"}`"));
  assert.ok(source.includes("return res.reports ?? [];"));
  assert.ok(source.includes('console.warn("[API] getReports: endpoint no disponible");'));
  assert.ok(source.includes("if (readOptions.throwOnError) {"));
  assert.ok(source.includes("throw error;"));
  assert.ok(source.includes("return [];"));
});

test("frontend API client searches reports with optional query parameters", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(source.includes("export async function searchReports("));
  assert.ok(source.includes("query?: string;"));
  assert.ok(source.includes("status?: string;"));
  assert.ok(source.includes("studyType?: string;"));
  assert.ok(source.includes("options?: RequestInit,"));
  assert.ok(source.includes("readOptions: ReportReadOptions = {},"));
  assert.ok(source.includes("const qs = new URLSearchParams("));
  assert.ok(source.includes("Object.entries(params).filter(([, v]) => v !== undefined)"));
  assert.ok(source.includes("/api/reports/search"));
  assert.ok(source.includes("return res.reports ?? [];"));
  assert.ok(source.includes('console.warn("[API] searchReports: endpoint no disponible");'));
  assert.ok(source.includes("if (readOptions.throwOnError) {"));
  assert.ok(source.includes("throw error;"));
});

test("frontend API client requests report download URLs by report id", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(source.includes("export async function getReportDownloadUrl("));
  assert.ok(source.includes("reportId: number,"));
  assert.ok(source.includes("): Promise<string | null>"));
  assert.ok(source.includes("`/api/reports/${reportId}/download-url`,"));
  assert.ok(source.includes("return res.url ?? null;"));
  assert.ok(source.includes("return null;"));
});

test("frontend reports API helpers remain typed around Report", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(source.includes("Report,"));
  assert.ok(source.includes("Promise<Report[]>"));
  assert.ok(source.includes("apiFetch<{ reports: Report[] }>"));
  assert.ok(source.includes("type AdminReportUploadResponse = {"));
  assert.ok(source.includes("report: Report;"));
});
