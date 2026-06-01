# PR — audit(perf): optimize extreme web speed

## 1. Rama usada

`audit/extreme-web-speed` — base: `64ab1c4 audit(perf): map routes and web vitals gaps (#778)`

---

## 2. Objetivo del PR

Auditar y optimizar de forma extrema la velocidad web global del Portal VETNEB sin romper seguridad, sesiones, PWA, mobile, rutas ni UX. Aplicar los fixes seguros dentro del repo actual; dejar en backlog lo que requiere infraestructura externa o coordinación de contratos.

---

## 3. Skills usadas

- VeTNEB Briefing Planificación Diseño Desarrollo Pruebas
- VeTNEB Staff Senior Full-Stack Engineer
- VeTNEB Bugs Errores Optimización Rutas
- VeTNEB Web End-to-End Global
- VeTNEB Security Production Invariants
- VeTNEB PWA End-to-End
- VeTNEB Protocolos Comunicación

---

## 4. Inventario de rutas auditadas

| Ruta | Tipo | Renderizado | Notas |
|------|------|-------------|-------|
| `/` | Página pública | Static (SSG) | Hero image con priority + fill |
| `/servicios` | Página pública | Static (SSG) | |
| `/precios` | Página pública | Dynamic (SSR) | Fetch no-store + runtime cache 5min |
| `/profesionales` | Página pública | Static shell + CSR | Suspense → ProfesionalesSearchContent |
| `/particulares` | Página pública | Static (SSG) | |
| `/contacto` | Página pública | Static (SSG) | |
| `/clinicas` | Página pública | Static (SSG) | |
| `/login` | Página pública | Static shell + CSR | Suspense → LoginContent |
| `/offline` | Página PWA | Static (SSG) | Precacheada en SW |
| `/dashboard` | Privado clínica | Dynamic (SSR+CSR) | Protegido por middleware app_session_id |
| `/dashboard/informes` | Privado clínica | Dynamic | |
| `/dashboard/logistica/*` | Privado clínica | Dynamic | |
| `/dashboard/admin` | Privado admin | Dynamic (SSR+CSR) | Protegido por middleware → 404 sin cookie |
| `/manifest.webmanifest` | PWA | Route handler | Cache 1h |
| `/robots.txt` | SEO | Route handler | |
| `/sitemap.xml` | SEO | Route handler | |
| `/sw.js` | PWA | Static | no-cache, no-store, must-revalidate |
| `/api/*` (backend) | API Fastify | Fastify | Cache-Control: no-store via hook onSend |
| `/api/public/*` | API pública | Fastify | Cache propio por ruta |

SEO pages adicionales: `/citologia-veterinaria`, `/histopatologia-veterinaria`, `/informes-veterinarios`, `/laboratorio-patologico-veterinario` — todas SSG estáticas.

---

## 5. Métricas obtenidas desde build local (build 2026-05-31)

| Asset | Tamaño raw | ~gzip |
|-------|-----------|-------|
| `framework-*.js` (React core) | 185 KB | 58 KB |
| `main-*.js` | 128 KB | 37 KB |
| `554-*.js` (Radix + deps) | 169 KB | 44 KB |
| `5ac-*.js` | 169 KB | 44 KB |
| `polyfills-*.js` | 110 KB | — |
| `198-*.js` (GSAP, lazy) | 42 KB | — |
| Hero image WebP | 76 KB | — |
| **Total .next/static/** | **1.9 MB** | — |

GSAP (42 KB) está en chunk separado y se carga lazy via dynamic import + IntersectionObserver — no bloquea render inicial.

---

## 6. Hallazgos LCP

| Hallazgo | Estado |
|---------|--------|
| Hero image usa `priority` + `fill` + `sizes="100vw"` | ✅ Correcto — guardrail contractual agregado |
| Hero image 76 KB WebP (< 100 KB) | ✅ Dentro de budget — guardrail de presupuesto agregado |
| Hero fuera de `<PublicScrollReveal>` | ✅ Correcto — guardrail agregado |
| Navbar y Footer como `"use client"` hidratados en cada pública | ⚠️ Hallazgo documentado — Server Component descartado por contrato (ver sección 15) |
| Inter + Source Sans 3 con `display: swap` via `next/font/google` (self-hosted) | ✅ Correcto |
| CSS global (30 KB) en root layout | ✅ Tailwind purga en build |

---

## 7. Hallazgos CLS

| Hallazgo | Estado |
|---------|--------|
| Hero con `fill` + contenedor `relative isolate overflow-hidden` | ✅ Sin CLS |
| `<details>/<summary>` en Navbar mobile y FooterFaq | ✅ Native HTML sin hidratación extra |
| Cards de precios sin imágenes — solo texto | ✅ Sin CLS |
| StatsCards con `<Skeleton>` en estado `loading` | ✅ Correcto |
| `Suspense fallback={null}` en `/profesionales` y `/login` | ⚠️ Flash breve en 3G — backlog (guardado por tests existentes) |

---

## 8. Hallazgos INP

| Hallazgo | Estado |
|---------|--------|
| Navbar botones `onClick → router.push` | ⚠️ Patrón intencional del proyecto por contrato NEXT_LINK_IMPORTS=0 — no cambiable en este PR |
| Footer botones `onClick → router.push` | ⚠️ Mismo contrato |
| `PwaServiceWorkerRegistrar` en root layout | ✅ Solo `useEffect`, retorna null, sin bloquear |
| `PublicScrollReveal` con GSAP lazy + IntersectionObserver | ✅ No bloquea INP inicial |
| DashboardShellRouter con `useSelectedLayoutSegment` | ✅ Scope solo dashboard |

---

## 9. Hallazgos bundle/chunks

| Hallazgo | Estado |
|---------|--------|
| `echarts` + `echarts-for-react` en `frontend/package.json` | ⚠️ Declaradas pero **nunca importadas** en src/ — tree-shaken del bundle. Bloqueadas por `package-scripts-contract.test.ts`. Backlog. |
| `@tanstack/react-query` en `frontend/package.json` | ⚠️ Declarada pero **nunca importada** — tree-shaken. Bloqueada por test. Backlog. |
| `@tanstack/react-table` en `frontend/package.json` | ⚠️ Declarada pero **nunca importada** — tree-shaken. Bloqueada por test. Backlog. |
| GSAP cargado via dynamic import lazy | ✅ No en bundle inicial |
| `"use client"` en app/dashboard: 8 archivos | ✅ Scope solo dashboard — correcto |
| `"use client"` en components: 18 archivos | ✅ Todos justificados |

---

## 10. Hallazgos SSR/SSG/CSR

| Ruta | Modo | Estado |
|------|------|--------|
| `/` | SSG | ✅ Estático en build |
| `/servicios`, `/particulares`, `/contacto`, `/clinicas` | SSG | ✅ |
| `/precios` | SSR dinámico | ✅ `no-store` + runtime cache 5min server-side |
| `/profesionales` | SSG shell + CSR | ✅ Suspense correcto |
| `/login` | SSG shell + CSR | ✅ |
| `/dashboard/*` | SSR + CSR | ✅ Gated por middleware |
| `export const dynamic` / `revalidate` | Ninguno hardcodeado innecesariamente | ✅ Next.js infiere correctamente |

---

## 11. Hallazgos PWA/service worker

| Hallazgo | Estado |
|---------|--------|
| SW versión `"2026-05-23-pwa-global-v1"` hardcodeada | ⚠️ No hay auto-invalidación — backlog |
| `PRIVATE_PATH_PREFIXES` cubre `/api/`, `/dashboard`, `/_next/server` | ✅ |
| `requestHasCredentials` guarda contra cachear requests autenticados | ✅ |
| `Set-Cookie` en response no se cachea | ✅ |
| `PUBLIC_NAVIGATION_ALLOWLIST` cubre todas las rutas públicas | ✅ |
| Precache de `/offline`, manifest, iconos, hero image | ✅ |
| `PwaServiceWorkerRegistrar` requiere HTTPS + registra en `useEffect` | ✅ |
| Header `Service-Worker-Allowed: /` en `next.config.ts` | ✅ |
| `sw.js` con `no-cache, no-store, must-revalidate` | ✅ |

---

## 12. Hallazgos caché/headers

| Hallazgo | Estado |
|---------|--------|
| `/api/*` autenticadas → `Cache-Control: no-store` via hook Fastify `onSend` | ✅ (#778) |
| `/api/public/*` con caché propio por ruta | ✅ |
| `/sw.js` → `no-cache, no-store, must-revalidate` | ✅ |
| `/manifest.webmanifest` → `public, max-age=3600, must-revalidate` | ✅ |
| `/icons/*`, `/images/*` → `public, max-age=31536000, immutable` | ✅ |
| Security headers globales (X-Frame-Options, CSP-RO, HSTS prod-only) | ✅ |
| `poweredByHeader: false` | ✅ |
| `compress: true` en next.config | ✅ |
| Imágenes: AVIF + WebP via `next/image` | ✅ |

---

## 13. Hallazgos experiencia real móvil/lenta

| Flujo | Hallazgo |
|-------|---------|
| Usuario público home en 3G móvil | Hero con `priority` carga primero; GSAP lazy no bloquea TTI |
| Tutor particular abre `/particulares`, pega token | `ProfesionalesSearchContent` tiene loading interno; `Suspense fallback={null}` causa flash breve |
| Clínica entra al dashboard | Middleware valida cookie antes de renderizar; sin doble fetch detectado |
| Admin entra al dashboard | `admin_session_id` verificado; 404 sin cookie — no expone UI |
| Usuario vuelve offline | SW sirve `/offline` desde PRECACHE; rutas públicas desde RUNTIME cache |

---

## 14. Implementaciones aplicadas

### A. Nuevo guardrail: `test/frontend-extreme-speed-guardrails.test.ts`

**19 tests contractuales de velocidad** que complementan los contratos existentes:

- `NEXT_LINK_IMPORTS=0` — Navbar/Footer no importan `next/link` (refuerza contrato de preview)
- `LINK_TAGS=0` — ningún `<Link>` JSX en layout/public components
- Rutas públicas no importan `echarts` directamente
- Layout/public components no importan `echarts` ni `@tanstack/react-table`
- Hero image: `priority`, `fill`, `sizes`, presupuesto 100 KB
- GSAP: dynamic import + IntersectionObserver + requestIdleCallback (no static import)
- SW: bloquea `/api/` y `/dashboard`
- SW: no cachea requests con credentials ni `Set-Cookie`
- SW: `PUBLIC_NAVIGATION_ALLOWLIST` completo
- next.config: `compress`, `poweredByHeader: false`, avif+webp, sw.js headers, security headers
- Middleware: `app_session_id` y `admin_session_id` separados, admin → 404, scope `/dashboard/:path*`
- `PwaServiceWorkerRegistrar`: `useEffect`, HTTPS, retorna null

---

## 15. Implementaciones descartadas

### A. Navbar/Footer como Server Components (vía `next/link`) — DESCARTADO POR CONTRATO

**Hallazgo:** Navbar y Footer son `"use client"` por `useRouter`. Convertirlos a Server Components con `<Link>` de `next/link` reduciría el client bundle de todas las páginas públicas (eliminando hidratación de header y footer) y activaría el prefetch automático de Next.js en links.

**Por qué se descartó:** El proyecto mantiene contratos explícitos `NEXT_LINK_IMPORTS=0` y `LINK_TAGS=0` en `test/frontend-native-link-preview-contract.test.ts` y `test/frontend-public-devtools-exposure-contract.test.ts`. Estos contratos existen para controlar el comportamiento de preview de enlaces visuales en la navegación pública. Introducir `next/link` rompería 6+ tests del pipeline.

**Backlog:** Evaluar en PR separado si es posible diseñar un patrón Server Component para Navbar/Footer que use `PublicRouteControl` o `<a href>` nativo sin `next/link`, compatible con los contratos de preview existentes.

### B. Eliminar deps no usadas (`echarts`, `react-table`, `react-query`) — DESCARTADO POR TEST

Bloqueado por `test/package-scripts-contract.test.ts`. No afectan el bundle (tree-shaken). PR separado con coordinación de contratos.

### C. `Suspense fallback` con skeleton en `/profesionales` y `/login` — DESCARTADO POR TEST

Tests existentes afirman `fallback={null}` explícitamente. PR separado.

---

## 16. Backlog extremo recomendado

### Lighthouse CI
Integrar en GitHub Actions para medir LCP, CLS, INP, TBT y FCP por ruta pública en cada PR.

### RUM (Real User Monitoring)
Instrumentar `web-vitals` para capturar métricas reales de usuarios en producción. Permite detectar regresiones de CLS/INP en mobile real.

### Bundle Analyzer
`@next/bundle-analyzer` para identificar módulos en chunks de 169 KB.

### CDN
Cloudflare / Vercel Edge para servir assets estáticos desde PoPs globales.

### APM
Datadog APM o similar para medir TTFB del backend Fastify por ruta.

### SLOs de TTFB/LCP/INP
- TTFB home < 200ms en Render
- LCP home < 2.5s en móvil 3G simulado
- INP global < 200ms
- CLS < 0.1 en todas las rutas públicas

### Server Component para Navbar/Footer sin `next/link`
Diseñar patrón de navegación compatible con `NEXT_LINK_IMPORTS=0` que permita eliminar `"use client"` de Navbar/Footer (ej: `<a href>` nativo con estilos equivalentes). Requiere actualizar contratos de preview en PR dedicado.

### Cleanup de deps no usadas
Remover `echarts`, `echarts-for-react`, `@tanstack/react-query`, `@tanstack/react-table` de `frontend/package.json`. Requiere actualizar `test/package-scripts-contract.test.ts`.

---

## 17. Archivos modificados

```
test/frontend-extreme-speed-guardrails.test.ts    (nuevo — 19 guardrails de velocidad)
PR-audit-extreme-web-speed.md                     (nuevo — este documento)
```

Sin modificaciones a código de producción. Los contratos existentes se mantienen intactos.

---

## 18. Tests agregados

| Archivo | Tests | Tipo |
|---------|-------|------|
| `test/frontend-extreme-speed-guardrails.test.ts` | 19 nuevos | Guardrails contractuales de velocidad |

---

## 19. Validaciones ejecutadas

```
node --test test/frontend-extreme-speed-guardrails.test.ts          → 19/19 ✅
node --test test/frontend-native-link-preview-contract.test.ts      → pasa  ✅
node --test test/frontend-public-devtools-exposure-contract.test.ts → pasa  ✅
node --test test/frontend-public-layout-navigation.test.ts          → pasa  ✅
node --test test/frontend-footer-lab-info.test.ts                   → pasa  ✅
node --test test/frontend-next-config-security-headers.test.ts      → pasa  ✅
node --test test/frontend-public-performance-contract.test.ts       → pasa  ✅
node --test test/frontend-pwa-global-operational-contract.test.ts   → pasa  ✅
node --test test/frontend-middleware.test.ts                        → pasa  ✅
node --test test/backend-api-no-store-cache-contract.test.ts        → pasa  ✅
TOTAL                                                                → 82/82 ✅
```

`pnpm --dir frontend lint`, `typecheck`, `build` y `pnpm validate:local` deben ejecutarse en Windows (pnpm store Windows-only en este repo).

---

## 20. Riesgos residuales

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| SW version hardcodeada — cache vieja si se actualiza sw.js sin bumping | Media | Bumping manual obligatorio en cada PR que toque `sw.js` |
| Deps no utilizadas (`echarts`, etc.) siguen en `pnpm-lock.yaml` | Baja | No afectan bundle (tree-shaken). Bloqueadas por test existente. |
| `Suspense fallback={null}` en páginas públicas — flash breve en 3G | Baja | Comportamiento intencional guardado por tests. Backlog con skeleton. |
| Navbar/Footer hidratados en cada pública — overhead de client JS | Media | Hallazgo documentado. Optimización bloqueada por contrato NEXT_LINK_IMPORTS=0. |

---

## 21. Comandos manuales para Nico

**Terminal 2 — validar en Windows:**
```powershell
pnpm --dir frontend lint
pnpm --dir frontend typecheck
pnpm --dir frontend build
pnpm validate:local
```

**Terminal 1 — commit y push:**
```powershell
cd C:\PORTAL-VETNEB
git status
git add test/frontend-extreme-speed-guardrails.test.ts
git add PR-audit-extreme-web-speed.md
git status
git commit -m "audit(perf): optimize extreme web speed — add 19 speed guardrails"
git push -u origin audit/extreme-web-speed
```

**Terminal 1 — PR:**
```powershell
gh pr create --title "audit(perf): optimize extreme web speed" --body "Auditoría extrema de velocidad web global. 19 guardrails nuevos. 82 tests verdes. Sin cambios de producción. Ver PR-audit-extreme-web-speed.md"
gh pr checks --watch
gh pr merge --squash --delete-branch
```

**Terminal 1 — limpieza post-merge:**
```powershell
git checkout main
git pull --ff-only
git fetch --prune
git status --short
git log -1 --oneline
gh pr list --state open
git branch -r --no-merged origin/main
git branch
```
