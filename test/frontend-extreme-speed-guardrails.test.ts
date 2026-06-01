/**
 * frontend-extreme-speed-guardrails.test.ts
 *
 * Guardrails contractuales para velocidad web extrema de Portal VETNEB.
 * Verifica invariantes de performance a nivel source que deben mantenerse
 * en cada PR: contratos de navegación pública, LCP assets, SW security,
 * bundle safety y headers.
 *
 * IMPORTANTE: Este proyecto mantiene NEXT_LINK_IMPORTS=0 y LINK_TAGS=0
 * por contrato de seguridad de preview/navegación pública. Los tests
 * refuerzan ese invariante.
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import test from "node:test";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

function findFiles(dir: string, ext: string[]): string[] {
  const results: string[] = [];

  function walk(current: string) {
    let entries: string[];

    try {
      entries = readdirSync(current);
    } catch {
      return;
    }

    for (const entry of entries) {
      const full = join(current, entry);

      if (entry === "node_modules" || entry === ".next") continue;

      let stat;
      try {
        stat = statSync(full);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        walk(full);
      } else if (ext.some((e) => entry.endsWith(e))) {
        results.push(full);
      }
    }
  }

  walk(resolve(process.cwd(), dir));
  return results;
}

// ---------------------------------------------------------------------------
// 1. NEXT_LINK_IMPORTS=0 y LINK_TAGS=0 — contrato de navegación pública
// ---------------------------------------------------------------------------

test("Navbar does not import next/link — NEXT_LINK_IMPORTS=0 contract", () => {
  const source = read("frontend/src/components/layout/Navbar.tsx");

  assert.equal(
    source.includes("next/link"),
    false,
    "Navbar must not import next/link — use useRouter/PublicRouteControl per navigation contract",
  );
  assert.equal(
    /<Link\b/.test(source),
    false,
    "Navbar must not use <Link> JSX tags — LINK_TAGS must stay 0",
  );
});

test("Footer does not import next/link — NEXT_LINK_IMPORTS=0 contract", () => {
  const source = read("frontend/src/components/layout/Footer.tsx");

  assert.equal(
    source.includes("next/link"),
    false,
    "Footer must not import next/link — NEXT_LINK_IMPORTS must stay 0",
  );
  assert.equal(
    /<Link\b/.test(source),
    false,
    "Footer must not use <Link> JSX tags — LINK_TAGS must stay 0",
  );
});

test("layout and public components maintain NEXT_LINK_IMPORTS=0 across the board", () => {
  const layoutFiles = findFiles("frontend/src/components/layout", [".tsx", ".ts"]);
  const publicFiles = findFiles("frontend/src/components/public", [".tsx", ".ts"]);
  const files = [...layoutFiles, ...publicFiles];
  const violations: string[] = [];

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    if (source.includes("next/link")) violations.push(file);
  }

  assert.deepEqual(
    violations,
    [],
    `NEXT_LINK_IMPORTS must be 0. Found in: ${violations.join(", ")}`,
  );
});

// ---------------------------------------------------------------------------
// 2. Rutas públicas no importan librerías pesadas directamente
// ---------------------------------------------------------------------------

test("public pages do not directly import echarts", () => {
  const publicPages = [
    "frontend/src/app/page.tsx",
    "frontend/src/app/servicios/page.tsx",
    "frontend/src/app/precios/page.tsx",
    "frontend/src/app/profesionales/page.tsx",
    "frontend/src/app/particulares/page.tsx",
    "frontend/src/app/login/page.tsx",
    "frontend/src/app/contacto/page.tsx",
    "frontend/src/app/clinicas/page.tsx",
  ];

  for (const page of publicPages) {
    const source = read(page);

    assert.equal(
      source.includes("from 'echarts'") || source.includes('from "echarts"'),
      false,
      `${page} must not directly import echarts`,
    );
  }
});

test("layout and public components do not import echarts or @tanstack/react-table", () => {
  const layoutFiles = findFiles("frontend/src/components/layout", [".tsx", ".ts"]);
  const publicFiles = findFiles("frontend/src/components/public", [".tsx", ".ts"]);
  const files = [...layoutFiles, ...publicFiles];

  for (const file of files) {
    const source = readFileSync(file, "utf8");

    assert.equal(
      source.includes("from 'echarts'") || source.includes('from "echarts"'),
      false,
      `${file} must not import echarts`,
    );
    assert.equal(
      source.includes("from '@tanstack/react-table'") ||
        source.includes('from "@tanstack/react-table"'),
      false,
      `${file} must not import @tanstack/react-table`,
    );
  }
});

// ---------------------------------------------------------------------------
// 3. LCP — hero image
// ---------------------------------------------------------------------------

test("home hero image has priority prop for LCP optimization", () => {
  const source = read("frontend/src/app/page.tsx");

  assert.ok(
    source.includes('src="/images/hero-microscope-vetneb.webp"'),
    "hero image src must be present",
  );
  assert.ok(source.includes("priority"), "hero image must have priority prop for LCP");
  assert.ok(source.includes("fill"), "hero image must use fill for full-bleed coverage");
  assert.ok(source.includes('sizes="100vw"'), "hero image must declare sizes for responsive loading");
});

test("home hero image is outside scroll reveal for LCP correctness", () => {
  const source = read("frontend/src/app/page.tsx");

  assert.equal(
    /<PublicScrollReveal[\s\S]*?hero-microscope/.test(source),
    false,
    "hero image must not be wrapped in PublicScrollReveal — breaks LCP",
  );
});

test("hero image file stays within LCP asset budget of 100 KB", () => {
  const { size } = statSync(
    resolve(process.cwd(), "frontend/public/images/hero-microscope-vetneb.webp"),
  );

  assert.ok(
    size <= 100_000,
    `hero image must be <= 100 KB for LCP on slow connections, got ${size} bytes`,
  );
});

// ---------------------------------------------------------------------------
// 4. GSAP — dynamic import (no bloquea bundle inicial)
// ---------------------------------------------------------------------------

test("GSAP is imported dynamically inside useEffect — not in initial bundle", () => {
  const source = read(
    "frontend/src/components/public/PublicScrollReveal.tsx",
  );

  assert.ok(
    source.includes('import("gsap")'),
    "GSAP must use dynamic import() — not static import",
  );
  assert.ok(
    source.includes('import("gsap/ScrollTrigger")'),
    "ScrollTrigger must use dynamic import() — not static import",
  );
  assert.equal(
    /^import .* from ['"]gsap['"]/.test(source),
    false,
    "GSAP must not be statically imported at the top of the file",
  );
  assert.ok(
    source.includes("IntersectionObserver"),
    "GSAP init must be deferred via IntersectionObserver",
  );
  assert.ok(
    source.includes("requestIdleCallback"),
    "GSAP init must be deferred via requestIdleCallback",
  );
});

// ---------------------------------------------------------------------------
// 5. Service worker — no cachea rutas privadas
// ---------------------------------------------------------------------------

test("service worker PRIVATE_PATH_PREFIXES blocks /api/ and /dashboard", () => {
  const source = read("frontend/public/sw.js");

  assert.ok(source.includes('"/api/"'), "SW must block /api/ from cache");
  assert.ok(source.includes('"/dashboard"'), "SW must block /dashboard from cache");
  assert.ok(source.includes('"/_next/server"'), "SW must block /_next/server from cache");
});

test("service worker blocks credential requests from cache", () => {
  const source = read("frontend/public/sw.js");

  assert.ok(
    source.includes("requestHasCredentials"),
    "SW must guard against caching credentialed requests",
  );
  assert.ok(
    source.includes('credentials === "include"') ||
      source.includes("credentials === 'include'"),
    "SW must check for credentials: include",
  );
  assert.ok(
    source.includes("Set-Cookie"),
    "SW must not cache responses with Set-Cookie header",
  );
});

test("service worker PUBLIC_NAVIGATION_ALLOWLIST covers core public routes", () => {
  const source = read("frontend/public/sw.js");

  const required = ["/", "/servicios", "/profesionales", "/login", "/offline"];

  for (const route of required) {
    assert.ok(
      source.includes(`"${route}"`),
      `SW PUBLIC_NAVIGATION_ALLOWLIST must include "${route}"`,
    );
  }
});

// ---------------------------------------------------------------------------
// 6. next.config — compresión y headers críticos
// ---------------------------------------------------------------------------

test("next.config enables compress and strips powered-by header", () => {
  const source = read("frontend/next.config.ts");

  assert.ok(source.includes("compress: true"), "next.config must have compress: true");
  assert.ok(
    source.includes("poweredByHeader: false"),
    "next.config must strip X-Powered-By header",
  );
});

test("next.config sets image formats to avif and webp", () => {
  const source = read("frontend/next.config.ts");

  assert.ok(source.includes('"image/avif"'), "next.config must prefer avif format for images");
  assert.ok(source.includes('"image/webp"'), "next.config must support webp format for images");
});

test("next.config sets sw.js no-cache and Service-Worker-Allowed header", () => {
  const source = read("frontend/next.config.ts");

  assert.ok(source.includes('"/sw.js"'), "next.config must configure headers for /sw.js");
  assert.ok(
    source.includes("no-cache, no-store, must-revalidate"),
    "sw.js must have no-cache Cache-Control to force fresh SW registration",
  );
  assert.ok(
    source.includes("Service-Worker-Allowed"),
    "sw.js must have Service-Worker-Allowed header",
  );
});

test("next.config applies security headers to all routes", () => {
  const source = read("frontend/next.config.ts");

  assert.ok(source.includes("X-Content-Type-Options"), "security headers must include X-Content-Type-Options");
  assert.ok(source.includes("X-Frame-Options"), "security headers must include X-Frame-Options");
  assert.ok(source.includes("Referrer-Policy"), "security headers must include Referrer-Policy");
});

// ---------------------------------------------------------------------------
// 7. Middleware — separación de sesiones
// ---------------------------------------------------------------------------

test("middleware protects /dashboard and /dashboard/admin with correct cookies", () => {
  const source = read("frontend/src/middleware.ts");

  assert.ok(
    source.includes('app_session_id'),
    "middleware must check app_session_id for clinic sessions",
  );
  assert.ok(
    source.includes('admin_session_id'),
    "middleware must check admin_session_id for admin sessions",
  );
  assert.ok(
    source.includes('"/dashboard/:path*"'),
    "middleware matcher must cover /dashboard/:path*",
  );
  assert.ok(
    source.includes("status: 404"),
    "admin without valid session must return 404 not 401/redirect",
  );
});

// ---------------------------------------------------------------------------
// 8. PwaServiceWorkerRegistrar — no bloquea render inicial
// ---------------------------------------------------------------------------

test("PwaServiceWorkerRegistrar registers SW inside useEffect only", () => {
  const source = read(
    "frontend/src/components/pwa/PwaServiceWorkerRegistrar.tsx",
  );

  assert.ok(
    source.includes("useEffect"),
    "SW registration must happen inside useEffect — not at module level",
  );
  assert.ok(
    source.includes("return null"),
    "PwaServiceWorkerRegistrar must render nothing — no DOM output",
  );
  assert.ok(
    source.includes('"https:"'),
    "SW registration must require HTTPS protocol",
  );
});
