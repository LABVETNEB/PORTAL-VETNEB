import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const API_CLIENT_PATH = "frontend/src/lib/api.ts";
const PROFESIONALES_SEARCH_CONTENT_PATH =
  "frontend/src/components/public/ProfesionalesSearchContent.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function extractFunction(source: string, functionName: string): string {
  const declaration = `export async function ${functionName}(`;
  const start = source.indexOf(declaration);
  assert.notEqual(start, -1, `${functionName} declaration must exist`);

  const nextExport = source.indexOf("\nexport ", start + declaration.length);
  return nextExport === -1 ? source.slice(start) : source.slice(start, nextExport);
}

test("public professionals search uses the real backend endpoint", () => {
  const source = read(API_CLIENT_PATH);
  const functionSource = extractFunction(source, "searchPublicProfessionals");

  assert.ok(
    functionSource.includes("apiFetch<PublicProfessionalsSearchSnapshot>("),
  );
  assert.ok(
    functionSource.includes(
      "`/api/public/professionals/search${qs ? `?${qs}` : \"\"}`",
    ),
  );
});

test("public professionals search does not use mock-data fallback", () => {
  const source = read(API_CLIENT_PATH);
  const functionSource = extractFunction(source, "searchPublicProfessionals");

  assert.equal(source.includes('from "@/lib/mock-data"'), false);
  assert.equal(source.includes("MOCK_"), false);
  assert.equal(functionSource.includes("@/lib/mock-data"), false);
  assert.equal(functionSource.includes("MOCK_"), false);
});

test("public professionals search does not convert errors into empty success", () => {
  const source = read(API_CLIENT_PATH);
  const functionSource = extractFunction(source, "searchPublicProfessionals");

  assert.equal(functionSource.includes("catch"), false);
  assert.equal(functionSource.includes("professionals: []"), false);
  assert.equal(functionSource.includes("count: 0"), false);
  assert.equal(functionSource.includes("total: 0"), false);
  assert.equal(functionSource.includes("return {"), false);
});

test("public professionals UI keeps the existing error state", () => {
  const source = read(PROFESIONALES_SEARCH_CONTENT_PATH);

  assert.ok(source.includes(".catch(() => {"));
  assert.ok(source.includes('setState({ status: "error", professionals: [], total: 0 })'));
  assert.ok(
    source.includes("No se pudo realizar la búsqueda. Intente nuevamente."),
  );
});
