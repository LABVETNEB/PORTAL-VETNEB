import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { readSourceFile as read } from "../../../helpers/tracked-source-files.ts";

const PUBLIC_ROUTES = [
  { pathname: "/", page: "frontend/src/app/page.tsx" },
  { pathname: "/servicios", page: "frontend/src/app/servicios/page.tsx" },
  { pathname: "/profesionales", page: "frontend/src/app/profesionales/page.tsx" },
  { pathname: "/clinicas", page: "frontend/src/app/clinicas/page.tsx" },
  { pathname: "/particulares", page: "frontend/src/app/particulares/page.tsx" },
  { pathname: "/contacto", page: "frontend/src/app/contacto/page.tsx" },
  { pathname: "/precios", page: "frontend/src/app/precios/page.tsx" },
  { pathname: "/login", page: "frontend/src/app/login/page.tsx" },
] as const;

const CLINIC_DASHBOARD_ROUTES = [
  { pathname: "/dashboard", page: "frontend/src/app/dashboard/page.tsx" },
  {
    pathname: "/dashboard/informes",
    page: "frontend/src/app/dashboard/informes/page.tsx",
  },
  {
    pathname: "/dashboard/logistica",
    page: "frontend/src/app/dashboard/logistica/page.tsx",
  },
  {
    pathname: "/dashboard/logistica/visitas",
    page: "frontend/src/app/dashboard/logistica/visitas/page.tsx",
  },
  {
    pathname: "/dashboard/logistica/rutas",
    page: "frontend/src/app/dashboard/logistica/rutas/page.tsx",
  },
  {
    pathname: "/dashboard/logistica/metricas",
    page: "frontend/src/app/dashboard/logistica/metricas/page.tsx",
  },
] as const;

const ADMIN_ENDPOINT_MARKERS = [
  '"/api/admin/auth"',
  '"/api/admin/clinics"',
  '"/api/admin/pricing"',
  '"/api/admin/particular-tokens"',
  '"/api/admin/reports"',
  '"/api/admin/report-access-tokens"',
  '"/api/admin/study-tracking"',
  '"/api/admin/sessions"',
  '"/api/admin/system/health"',
  '"/api/admin/system/maintenance"',
] as const;

const BACKEND_ENDPOINT_MARKERS = [
  '"/api/auth"',
  '"/api/admin/auth"',
  '"/api/admin/clinics"',
  '"/api/admin/reports"',
  '"/api/admin/particular-tokens"',
  '"/api/admin/audit-log"',
  '"/api/admin/system/health"',
  '"/api/logistics/field-visits"',
  '"/api/logistics/route-plans"',
  '"/api/logistics/route-events"',
  '"/api/logistics/sla"',
  '"/api/reports"',
  '"/api/particular/auth"',
  '"/api/particular-tokens"',
] as const;

function extractPublicNavigationAllowlist(swSource: string): string {
  const match = swSource.match(/const PUBLIC_NAVIGATION_ALLOWLIST = new Set\(\[([\s\S]*?)\]\);/);

  assert.ok(match, "service worker debe declarar PUBLIC_NAVIGATION_ALLOWLIST");

  return match[1];
}

test("PWA mantiene rutas públicas online explícitas y manifest instalable", () => {
  const manifestSource = read("frontend/src/app/manifest.ts");
  const swSource = read("frontend/public/sw.js");
  const seoSource = read("frontend/src/lib/seo.ts");
  const layoutSource = read("frontend/src/app/layout.tsx");

  const publicAllowlistSource = extractPublicNavigationAllowlist(swSource);

  for (const route of PUBLIC_ROUTES) {
    assert.equal(existsSync(resolve(process.cwd(), route.page)), true, `${route.pathname} debe existir`);
    assert.ok(
      publicAllowlistSource.includes(`"${route.pathname}"`),
      `${route.pathname} debe estar considerado en la allowlist pública PWA`,
    );
  }

  assert.ok(manifestSource.includes('start_url: "/"'));
  assert.ok(manifestSource.includes('scope: "/"'));
  assert.ok(manifestSource.includes('display: "standalone"'));
  assert.ok(manifestSource.includes('prefer_related_applications: false'));
  assert.ok(seoSource.includes('manifest: "/manifest.webmanifest"'));
  assert.ok(layoutSource.includes("PwaServiceWorkerRegistrar"));

  for (const icon of [
    "frontend/public/icons/icon-192x192.png",
    "frontend/public/icons/icon-512x512.png",
    "frontend/public/icons/maskable-icon-192x192.png",
    "frontend/public/icons/maskable-icon-512x512.png",
    "frontend/public/icons/apple-touch-icon.png",
  ]) {
    assert.equal(existsSync(resolve(process.cwd(), icon)), true, `${icon} debe existir`);
    assert.ok(manifestSource.includes(icon.replace("frontend/public", "")) || seoSource.includes(icon.replace("frontend/public", "")));
  }
});

test("service worker cachea solo navegación pública permitida y assets públicos", () => {
  const swSource = read("frontend/public/sw.js");

  assert.ok(swSource.includes("const PUBLIC_NAVIGATION_ALLOWLIST = new Set(["));
  assert.ok(swSource.includes("const PRECACHE_OPTIONAL_URLS = ["));
  // A1-4: un asset se admite por la identidad de su URL (ruta de build o hash
  // de contenido), nunca por su tipo ni por un prefijo de URL estable. El
  // comportamiento se ejecuta en
  // test/unit/infrastructure/frontend-service-worker-cache-lifecycle.test.ts.
  assert.ok(swSource.includes('url.pathname.startsWith("/_next/static/") || CONTENT_HASHED_PATH.test(url.pathname)'));
  assert.equal(swSource.includes("request.destination"), false, "el destino del request no clasifica un recurso");
  assert.equal(swSource.includes('startsWith("/images/")') || swSource.includes('startsWith("/icons/")'), false);
  assert.ok(swSource.includes("if (response.headers.has(\"Set-Cookie\"))"));

  const publicAllowlistSource = extractPublicNavigationAllowlist(swSource);

  for (const route of CLINIC_DASHBOARD_ROUTES) {
    assert.equal(existsSync(resolve(process.cwd(), route.page)), true, `${route.pathname} debe existir`);
    assert.equal(
      publicAllowlistSource.includes(`"${route.pathname}"`),
      false,
      `${route.pathname} no debe entrar en navegación pública cacheable`,
    );
  }

  assert.equal(
    publicAllowlistSource.includes('"/dashboard/admin"'),
    false,
    "/dashboard/admin no debe entrar en navegación pública cacheable",
  );
});

test("service worker conserva privado/admin/API como network-only sin cache", () => {
  const swSource = read("frontend/public/sw.js");

  for (const marker of [
    '"/api/"',
    '"/dashboard"',
    '"/admin"',
    '"/download-url"',
    '"/preview-url"',
    '"/reports/"',
    '"/particular/auth"',
    '"/auth/"',
  ]) {
    assert.ok(swSource.includes(marker), `service worker debe excluir ${marker}`);
  }

  assert.ok(swSource.includes("if (!isSameOrigin(url) || isPrivatePath(url.pathname))"));
  assert.ok(swSource.includes("return;"));
  assert.equal(swSource.includes("/api/public"), false, "no debe añadirse excepción amplia de API pública en SW");
  assert.equal(swSource.includes("/api/admin"), false, "no debe cachearse admin de forma específica");
  assert.equal(swSource.includes("/api/reports"), false, "no debe cachearse reports de forma específica");
});

// A1-4 reemplazó putIfCacheable por un escritor por clase de recurso. La
// disciplina es la misma: el caller clona antes de devolver la respuesta y el
// escritor nunca clona ni deja escapar un rechazo. La entrega íntegra del body
// y la ausencia de rechazos se ejecutan en el contrato de ciclo de vida.
for (const writer of ["storeVersionedAsset", "refreshPrecached"]) {
  test(`${writer} no llama .clone() internamente y captura sus errores de caché`, () => {
    const swSource = read("frontend/public/sw.js");
    const fnMatch = swSource.match(new RegExp(`async function ${writer}\\b[\\s\\S]*?\\n\\}`));

    assert.ok(fnMatch, `${writer} debe existir en sw.js`);

    const fnBodyNoComments = fnMatch[0].replace(/\/\/[^\n]*/g, "");

    assert.equal(fnBodyNoComments.includes(".clone()"), false, "el clone es responsabilidad del caller");
    assert.ok(fnBodyNoComments.includes("try {") && fnBodyNoComments.includes("} catch"));
    assert.ok(/await cache\.put\((request|key), response\);/.test(fnBodyNoComments));
  });
}

test("los call sites de escritura clonan dentro de event.waitUntil y nunca pasan la respuesta original", () => {
  const swSource = read("frontend/public/sw.js");
  const writes = [...swSource.matchAll(/event\.waitUntil\((?:storeVersionedAsset|refreshPrecached)\(.*\)\);/g)].map(
    (match) => match[0],
  );
  const calls = swSource.match(/(?<!function )\b(?:storeVersionedAsset|refreshPrecached)\(/g) ?? [];

  assert.equal(writes.length, 3, `escrituras dentro de event.waitUntil: ${writes.join(" | ")}`);
  assert.equal(calls.length, writes.length, "ninguna escritura puede quedar fuera de event.waitUntil");

  for (const write of writes) {
    assert.ok(/, (response|carried)\.clone\(\)\)\);$/.test(write), `${write} debe pasar un clon`);
  }
});

test("superficies clínica, admin, particular, logística y backend siguen declaradas para operación online", () => {
  const fastifySource = read("server/fastify-app.ts");
  const apiSource = read("frontend/src/lib/api.ts");
  const middlewareSource = read("frontend/src/proxy.ts");

  assert.equal(existsSync(resolve(process.cwd(), "frontend/src/app/dashboard/admin/page.tsx")), true);

  for (const marker of ADMIN_ENDPOINT_MARKERS) {
    assert.ok(fastifySource.includes(marker), `backend debe registrar ${marker}`);
  }

  for (const marker of BACKEND_ENDPOINT_MARKERS) {
    const isRegistered = fastifySource.includes(marker);
    const isClientAccessible = apiSource.includes(marker.replaceAll('"', "'")) || apiSource.includes(marker);

    assert.equal(
      isRegistered || isClientAccessible,
      true,
      `superficie online requerida debe conservar marcador ${marker}`,
    );
  }

  assert.ok(middlewareSource.includes('matcher: ["/dashboard/:path*"]'));
  assert.ok(middlewareSource.includes("function getRequiredSessionCookieName(pathname: string): string"));
  assert.ok(middlewareSource.includes("return isAdminDashboardPath(pathname)"));
  assert.equal(middlewareSource.includes("hasClinicSession || hasAdminSession"), false);
  assert.equal(middlewareSource.includes("particular_session_id"), false);
});
