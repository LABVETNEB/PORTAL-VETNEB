import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

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
  assert.ok(swSource.includes("const PRECACHE_URLS = ["));
  assert.ok(swSource.includes('url.pathname.startsWith("/_next/static/")'));
  assert.ok(swSource.includes('url.pathname.startsWith("/images/")'));
  assert.ok(swSource.includes('url.pathname.startsWith("/icons/")'));
  assert.ok(swSource.includes("putIfCacheable(RUNTIME, request, response.clone())"));
  assert.ok(swSource.includes("if (response.headers.has(\"Set-Cookie\"))"));
  assert.ok(swSource.includes("if (!requestHasCredentials(request))"));

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

test("putIfCacheable no llama .clone() internamente — el clon viene del caller", () => {
  const swSource = read("frontend/public/sw.js");

  // Extraer el cuerpo de la función putIfCacheable
  const fnMatch = swSource.match(/async function putIfCacheable\b[\s\S]*?\n\}/);
  assert.ok(fnMatch, "putIfCacheable debe existir en sw.js");
  const fnBody = fnMatch[0];

  // Eliminar comentarios de línea antes de buscar patrones de código
  const fnBodyNoComments = fnBody.replace(/\/\/[^\n]*/g, "");

  assert.equal(
    fnBodyNoComments.includes(".clone()"),
    false,
    "putIfCacheable no debe llamar .clone() en código (excluidos comentarios); el clone es responsabilidad del caller",
  );

  // Debe usar cache.put(request, response) sin clonar dentro
  assert.ok(fnBodyNoComments.includes("cache.put(request, response)"), "putIfCacheable debe hacer cache.put con la response recibida directamente");
});

test("putIfCacheable envuelve operaciones async en try/catch para evitar unhandled rejection", () => {
  const swSource = read("frontend/public/sw.js");

  const fnMatch = swSource.match(/async function putIfCacheable\b[\s\S]*?\n\}/);
  assert.ok(fnMatch, "putIfCacheable debe existir en sw.js");
  const fnBody = fnMatch[0];

  assert.ok(fnBody.includes("try {"), "putIfCacheable debe tener try/catch para capturar errores de caché");
  assert.ok(fnBody.includes("} catch"), "putIfCacheable debe tener catch para evitar unhandled promise rejection");
});

test("call sites de putIfCacheable pasan response.clone() como argumento", () => {
  const swSource = read("frontend/public/sw.js");

  // Contar ocurrencias de putIfCacheable(RUNTIME, request, response.clone())
  const callsWithClone = (swSource.match(/putIfCacheable\(RUNTIME, request, response\.clone\(\)\)/g) ?? []).length;
  // Contar ocurrencias sin clone (el patrón inseguro)
  const callsWithoutClone = (swSource.match(/putIfCacheable\(RUNTIME, request, response\)/g) ?? []).length;

  assert.ok(callsWithClone >= 2, `todos los call sites deben pasar response.clone() — encontrados: ${callsWithClone}`);
  assert.equal(
    callsWithoutClone,
    0,
    `no debe haber call sites que pasen response sin clonar — encontrados: ${callsWithoutClone}`,
  );
});

test("service worker no contiene el patrón inseguro de clone después de await", () => {
  const swSource = read("frontend/public/sw.js");

  // El patrón peligroso es: await algo; ... response.clone() (dentro de putIfCacheable)
  // Verificamos que dentro de putIfCacheable no exista ningún .clone() en código (excluidos comentarios)
  const fnMatch = swSource.match(/async function putIfCacheable\b[\s\S]*?\n\}/);
  assert.ok(fnMatch, "putIfCacheable debe existir");
  const fnBodyNoComments = fnMatch[0].replace(/\/\/[^\n]*/g, "");

  const awaitBeforeClone = /await[\s\S]*?\.clone\(\)/.test(fnBodyNoComments);
  assert.equal(awaitBeforeClone, false, "no debe haber .clone() en código después de un await dentro de putIfCacheable");
});

test("superficies clínica, admin, particular, logística y backend siguen declaradas para operación online", () => {
  const fastifySource = read("server/fastify-app.ts");
  const apiSource = read("frontend/src/lib/api.ts");
  const middlewareSource = read("frontend/src/middleware.ts");

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
