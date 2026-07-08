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

function getFunctionSource(source: string, functionName: string): string {
  const signature = `export async function ${functionName}`;
  const start = source.indexOf(signature);

  if (start === -1) {
    return "";
  }

  const nextFunction = source.indexOf("\nexport async function ", start + signature.length);

  return nextFunction === -1 ? source.slice(start) : source.slice(start, nextFunction);
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
  const functionSource = getFunctionSource(source, "getReportDownloadUrl");

  assert.ok(functionSource.includes("export async function getReportDownloadUrl("));
  assert.ok(functionSource.includes("reportId: number,"));
  assert.ok(functionSource.includes('options: { scope?: "clinic" | "admin" } = {},'));
  assert.ok(functionSource.includes("): Promise<string | null>"));
  assert.ok(functionSource.includes('options.scope === "admin" ? "/api/admin/reports" : "/api/reports"'));
  assert.ok(functionSource.includes("`${basePath}/${reportId}/download-url`,"));
  assert.ok(functionSource.includes("downloadUrl?: string | null;"));
  assert.ok(functionSource.includes("url?: string | null;"));
  assert.ok(functionSource.includes("return res.downloadUrl ?? res.url ?? null;"));
  assert.equal(functionSource.includes("} catch {"), false);
});

test("frontend API client requests report preview URLs by report id", () => {
  const source = read(API_CLIENT_PATH);
  const functionSource = getFunctionSource(source, "getReportPreviewUrl");

  assert.ok(functionSource.includes("export async function getReportPreviewUrl("));
  assert.ok(functionSource.includes("reportId: number,"));
  assert.ok(functionSource.includes('options: { scope?: "clinic" | "admin" } = {},'));
  assert.ok(functionSource.includes("): Promise<string | null>"));
  assert.ok(functionSource.includes('options.scope === "admin" ? "/api/admin/reports" : "/api/reports"'));
  assert.ok(functionSource.includes("`${basePath}/${reportId}/preview-url`,"));
  assert.ok(functionSource.includes("previewUrl?: string | null;"));
  assert.ok(functionSource.includes("url?: string | null;"));
  assert.ok(functionSource.includes("return res.previewUrl ?? res.url ?? null;"));
  assert.equal(functionSource.includes("} catch {"), false);
});

test("frontend reports API helpers remain typed around Report", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(source.includes("Report,"));
  assert.ok(source.includes("Promise<Report[]>"));
  assert.ok(source.includes("apiFetch<{ reports: Report[] }>"));
  assert.ok(source.includes("type AdminReportUploadResponse = {"));
  assert.ok(source.includes("report: Report;"));
});

test("frontend API client exposes getReportsPaginated for server-side pagination", () => {
  const source = read(API_CLIENT_PATH);

  assert.ok(source.includes("export type PaginatedReports = {"));
  assert.ok(source.includes("export async function getReportsPaginated("));
  assert.ok(source.includes("export async function searchReportsPaginated("));
  assert.ok(source.includes("Promise<PaginatedReports>"));
  assert.ok(source.includes("total: number;"));
  assert.ok(source.includes("totalPages: number;"));
  assert.ok(source.includes("pageSize: number;"));
});

test("frontend getReportsPaginated computes offset from page and pageSize", () => {
  const source = read(API_CLIENT_PATH);
  const start = source.indexOf("export async function getReportsPaginated(");
  const end = source.indexOf("\nexport async function ", start + 10);
  const fn = end === -1 ? source.slice(start) : source.slice(start, end);

  assert.ok(fn.includes("const page = Math.max(1,"));
  assert.ok(fn.includes("const pageSize = Math.min("));
  assert.ok(fn.includes("const offset = (page - 1) * pageSize;"));
  assert.ok(fn.includes("query.set(\"limit\","));
  assert.ok(fn.includes("query.set(\"offset\","));
  assert.ok(fn.includes("return { reports, total, page, pageSize, totalPages };"));
});

test("frontend searchReportsPaginated computes offset and passes all search params", () => {
  const source = read(API_CLIENT_PATH);
  const start = source.indexOf("export async function searchReportsPaginated(");
  const end = source.indexOf("\nexport async function ", start + 10);
  const fn = end === -1 ? source.slice(start) : source.slice(start, end);

  assert.ok(fn.includes("const offset = (page - 1) * pageSize;"));
  assert.ok(fn.includes("limit: String(pageSize),"));
  assert.ok(fn.includes("offset: String(offset),"));
  assert.ok(fn.includes("`/api/reports/search${qs ? `?${qs}` : \"\"}`"));
  assert.ok(fn.includes("return { reports, total, page, pageSize, totalPages };"));
});
