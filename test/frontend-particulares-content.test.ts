import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const PARTICULARES_CONTENT_PATH =
  "frontend/src/components/public/ParticularesContent.tsx";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

test("particulares content keeps refreshSession wired to particular auth me helper", () => {
  const source = read(PARTICULARES_CONTENT_PATH);

  assert.ok(source.includes('import {'));
  assert.ok(source.includes("getParticularSession,"));
  assert.ok(source.includes("async function refreshSession()"));
  assert.ok(source.includes("setIsCheckingSession(true);"));
  assert.ok(source.includes("const response = await getParticularSession();"));
  assert.ok(source.includes("setSession(response?.particular ?? null);"));
});

test("particulares content surfaces refreshSession fetch failures instead of silent logout state", () => {
  const source = read(PARTICULARES_CONTENT_PATH);

  assert.ok(source.includes("setErrorMessage(null);"));
  assert.ok(source.includes("} catch (error) {"));
  assert.ok(source.includes("setSession(null);"));
  assert.ok(source.includes("error instanceof Error"));
  assert.ok(source.includes("? error.message"));
  assert.ok(source.includes(': "No se pudo verificar la sesión particular. Intente nuevamente.",'));
  assert.ok(source.includes("setIsCheckingSession(false);"));
  assert.ok(source.includes('role="alert"'));
});

test("particulares content keeps neutral logout control and removes resumen label", () => {
  const source = read(PARTICULARES_CONTENT_PATH);

  assert.ok(source.includes("Cerrar sesión particular"));
  assert.ok(source.includes("variant=\"outline\""));
  assert.ok(source.includes("className=\"public-cta-outline\""));
  assert.equal(source.includes("variant=\"secondary\""), false);
  assert.equal(source.includes("className=\"public-cta-secondary\""), false);
  assert.equal(source.includes("Resumen de caso"), false);
});
