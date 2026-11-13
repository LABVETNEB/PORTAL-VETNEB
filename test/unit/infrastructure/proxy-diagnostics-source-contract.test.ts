import assert from "node:assert/strict";
import test from "node:test";

import { readSourceFile } from "../../helpers/tracked-source-files.ts";

const MODULE_PATH = "server/lib/proxy-diagnostics.ts";
const APP_PATH = "server/fastify-app.ts";
const ENV_PATH = "server/lib/env.ts";

test("PDS-01 el módulo no crea rutas, no toca la respuesta y no lee la configuración del servidor", () => {
  const source = readSourceFile(MODULE_PATH);

  assert.equal(/\bapp\.(get|post|put|patch|delete|all|route|head|options)\(/.test(source), false);
  assert.equal(/\breply\b/.test(source), false);
  assert.equal(/dotenv|from "\.\/env\.ts"/.test(source), false);

  // Única lectura de process.env: el valor por defecto del parámetro `env`.
  assert.equal(source.split("process.env").length - 1, 1);
});

test("PDS-02 la integración es una sola llamada, después de crear Fastify y antes de las métricas", () => {
  const source = readSourceFile(APP_PATH);
  const trustProxyLine = "trustProxy: ENV.trustProxy,";
  const call = "registerProxyDiagnostics(app,";

  assert.equal(source.split(call).length - 1, 1);
  assert.equal(source.split(trustProxyLine).length - 1, 1);
  assert.ok(source.indexOf(trustProxyLine) < source.indexOf(call));
  assert.ok(source.indexOf(call) < source.indexOf("const metricsRegistry"));
  assert.ok(source.includes("trustProxyConfigured: Boolean(ENV.trustProxy)"));
});

test("PDS-03 la configuración del servidor y su esquema de entorno no conocen el diagnóstico", () => {
  assert.equal(readSourceFile(ENV_PATH).includes("PROXY_DIAG"), false);
  assert.equal(readSourceFile(APP_PATH).includes("PROXY_DIAG"), false);
});
