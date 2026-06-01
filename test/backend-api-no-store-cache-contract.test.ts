/**
 * backend-api-no-store-cache-contract.test.ts
 *
 * Garantiza que las rutas API autenticadas del backend responden con
 * Cache-Control: no-store para evitar que proxies o el navegador cacheen
 * respuestas sensibles (sesiones, informes, tokens, admin, particular).
 *
 * Las rutas públicas con caché propia (/api/public/*) quedan excluidas
 * intencionalmente — cada una gestiona su propio Cache-Control.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));

function readSource(relativePath: string): string {
  return readFileSync(resolve(REPO_ROOT, relativePath), "utf8");
}

// ---------------------------------------------------------------------------
// 1. El hook onSend está declarado en fastify-app.ts
// ---------------------------------------------------------------------------

test("fastify-app declara hook onSend que inyecta Cache-Control: no-store en /api/ no-públicas", () => {
  const source = readSource("server/fastify-app.ts");

  assert.ok(
    source.includes('app.addHook(\n    "onSend"') ||
      source.includes("app.addHook('onSend'") ||
      source.includes('app.addHook("onSend"'),
    "createFastifyApp debe registrar un hook onSend",
  );

  assert.ok(
    source.includes('url.startsWith("/api/")'),
    "el hook debe filtrar rutas /api/",
  );

  assert.ok(
    source.includes('url.startsWith("/api/public/")'),
    "el hook debe excluir rutas /api/public/ con caché propia",
  );

  assert.ok(
    source.includes('"cache-control"') && source.includes('"no-store"'),
    "el hook debe emitir Cache-Control: no-store",
  );

  assert.ok(
    source.includes("reply.hasHeader"),
    "el hook no debe sobreescribir headers ya seteados",
  );
});

// ---------------------------------------------------------------------------
// 2. Rutas autenticadas críticas no setean su propio Cache-Control
//    (por lo tanto dependen del hook global)
// ---------------------------------------------------------------------------

const AUTHENTICATED_ROUTES_WITHOUT_OWN_CACHE_HEADER: readonly {
  file: string;
  label: string;
}[] = [
  { file: "server/routes/auth.fastify.ts", label: "clinic auth" },
  { file: "server/routes/admin-auth.fastify.ts", label: "admin auth" },
  { file: "server/routes/admin-reports.fastify.ts", label: "admin reports" },
  { file: "server/routes/admin-sessions.fastify.ts", label: "admin sessions" },
  {
    file: "server/routes/admin-particular-tokens.fastify.ts",
    label: "admin particular tokens",
  },
  {
    file: "server/routes/particular-auth.fastify.ts",
    label: "particular auth",
  },
  { file: "server/routes/reports.fastify.ts", label: "clinic reports" },
] as const;

for (const { file, label } of AUTHENTICATED_ROUTES_WITHOUT_OWN_CACHE_HEADER) {
  test(`${label} no sobreescribe Cache-Control (delega al hook global)`, () => {
    const source = readSource(file);

    const hasOwnCacheControl =
      /reply\s*\.\s*header\s*\(\s*["']cache-control["']/i.test(source);

    assert.equal(
      hasOwnCacheControl,
      false,
      `${file} no debe setear Cache-Control propio — el hook global de fastify-app.ts lo cubre`,
    );
  });
}

// ---------------------------------------------------------------------------
// 3. La ruta pública de precios SÍ setea su propio Cache-Control (excluida)
// ---------------------------------------------------------------------------

test("public-pricing setea su propio Cache-Control y no depende del hook global", () => {
  const source = readSource("server/routes/public-pricing.fastify.ts");

  assert.ok(
    /reply\s*\.\s*header\s*\(\s*["']Cache-Control["']/i.test(source),
    "public-pricing debe declarar su propio Cache-Control",
  );

  assert.ok(
    source.includes("public, max-age="),
    "public-pricing debe usar directiva public con max-age",
  );
});
