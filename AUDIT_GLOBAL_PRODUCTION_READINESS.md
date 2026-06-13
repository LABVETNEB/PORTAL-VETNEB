# Global Production Readiness Audit

> Portal VETNEB — auditoría senior de preparación para producción.
> Fecha: 2026-06-13 · Rama: `audit/global-production-readiness` · Base: `a9041ac` (paridad con `origin/main`).

## Executive summary

- **Estado general:** El producto está en estado **maduro y cercano a producción**. Build, tipos, lint y la suite de 2657 tests pasan en limpio; la superficie de seguridad pública no expone secretos; las fronteras admin/clínica están intactas y cubiertas por contratos.
- **Riesgo global:** **Bajo–Medio.** El único defecto funcional verificado de severidad alta es un **overflow horizontal en todas las rutas públicas en el rango 1024–1279px** (corregido en esta rama). El resto son ítems de pulido/accesibilidad/PWA de severidad media-baja, documentados como PRs diferidos.
- **Bloqueadores:** Ninguno de seguridad ni de build. El overflow 1024–1279px era el único bloqueador de calidad "premium" en producción; queda **resuelto y con guardrail e2e**.
- **Recomendación:** **Ship after fix** — apto para producción una vez integrada la corrección de overflow de esta rama (ya validada). Los ítems diferidos no bloquean el lanzamiento.

## Current baseline

- **Commit:** `a9041ac feat(ui): add dark gray theme mode (#977)`
- **Branch:** `audit/global-production-readiness` (creada desde `origin/main` para auditar el código más reciente; el `main` local estaba 5 commits atrás).
- **PRs abiertos:** ninguno (`gh pr list --state open` vacío).
- **Ramas remotas no mergeadas:** ninguna (`git branch -r --no-merged origin/main` vacío; dependabot branches purgadas).
- **Validaciones base (todas en verde antes de tocar código):**

| Validación | Resultado |
|---|---|
| `pnpm audit --prod` | PASS — *No known vulnerabilities found* |
| `pnpm test` (root) | PASS — **2657 pass / 0 fail** |
| `pnpm build` (root, esbuild) | PASS |
| `pnpm security:public-surface` | PASS — sin exposición de devtools/secretos |
| `pnpm --dir frontend lint` | PASS |
| `pnpm --dir frontend typecheck` | PASS |
| `pnpm --dir frontend build` (Next 16 / Turbopack) | PASS — 25 rutas generadas |

## Methodology

- **Skills usadas (todas las requeridas):** `vetneb-briefing-planificacion-diseno-desarrollo-pruebas`, `vetneb-web-end-to-end-global`, `vetneb-bugs-errores-optimizacion-rutas`, `vetneb-security-production-invariants`, `vetneb-admin-dashboard-operational-actions`, `vetneb-protocolos-comunicacion`, `vetneb-pwa-end-to-end`, `vetneb-lanzamiento-mantenimiento`, `vetneb-staff-senior-full-stack-engineer`.
- **Normas consideradas:** ISO/IEC 25010 (calidad de producto), 25000 SQuaRE, 5055 (debilidades de código), 27001 (seguridad), 9001 / 15504 SPICE (proceso), 14598 (evaluación). Traducidas a hallazgos prácticos abajo.
- **Herramientas:** lectura estática de fuente, `rg`/Grep, `git`, suite nativa `node --test`, Playwright (Chromium) para medición empírica de overflow y geometría de navbar.
- **Rutas auditadas (estáticas ○ / dinámicas ƒ por build):** `/`, `/clinicas`, `/servicios`, `/precios`, `/profesionales`, `/profesionales/[clinicId]` (ƒ), `/particulares`, `/contacto`, `/login`, `/offline`, `/histopatologia-veterinaria`, `/citologia-veterinaria`, `/informes-veterinarios`, `/laboratorio-patologico-veterinario`, `/manifest.webmanifest`, `/robots.txt`, `/sitemap.xml`, `/_not-found`, `/api/security/csp-report` (ƒ), `/dashboard*` (ƒ).
- **Viewports medidos (Chromium):** 375, 768, **1024**, **1180**, 1280, 1440.
- **Modos visuales:** Normal (`data-theme` por defecto) y Dark Gray (`data-theme="dark-gray"`).
- **Limitación declarada:** la verificación operativa *online* del dashboard (acciones reales contra backend) requiere staging con credenciales; queda fuera del alcance local por protocolo (no tocar producción). Se auditó vía contratos estáticos (ver Testing).

## Findings by severity

### Critical

| ID | Area | Finding | Evidence | Impact | Recommendation | Implemented |
|---|---|---|---|---|---|---|
| — | — | Sin hallazgos críticos. | Build/test/audit/security-surface en verde. | — | — | — |

### High

| ID | Area | Finding | Evidence | Impact | Recommendation | Implemented |
|---|---|---|---|---|---|---|
| H1 | UI / Responsive | **Overflow horizontal de ~123px en todas las rutas públicas en 1024–1279px.** El navbar despliega el layout desktop completo en el breakpoint `lg` (1024), pero su fila interna requiere ~1147px mientras el `container` de Tailwind queda topado en 1024px hasta `xl` (1280). Agravado por el `ThemeModeToggle` agregado en #977. | Medición Playwright: `docOverflow=123` @1024, `=45` @1180, `=0` @1280; `rowScroll(navbar)=1147` vs `rowClient=1024`. Clusters: logo 178 + nav-pill 598 + acciones 339 ≈ 1115px. El `overflow-x: clip` del `.public-perspective-stage` cubre `<main>` pero **no** el `<header>`, que es hermano. | Barra de scroll horizontal y contenido cortado en tablets-landscape y laptops pequeñas (rango muy común) en el 100% de las páginas públicas — rompe la sensación "premium". | Desplazar el navbar desktop de `lg` a `xl` (reusa el menú hamburguesa ya testeado en 1024–1279). | **Sí** (Navbar.tsx + contrato + guardrail e2e). |

### Medium

| ID | Area | Finding | Evidence | Impact | Recommendation | Implemented |
|---|---|---|---|---|---|---|
| M1 | A11y | **Falta "skip link" (saltar al contenido)** pese a existir el target `<main id="main-content">`. Hay 6+ enlaces de nav antes del contenido. | `PublicLayout.tsx` tiene `id="main-content"` pero no existe ningún `href="#main-content"` ni "Saltar al contenido" en `frontend/src`. | WCAG 2.4.1 (Bypass Blocks): usuarios de teclado/lector deben tabular toda la navegación en cada página. | PR pequeño: skip-link visually-hidden que aparece en `:focus`, apuntando a `#main-content`. | No (diferido — ver backlog PR-A). |
| M2 | Cobertura de tests | **El guardrail de overflow público solo medía 375px (mobile).** El defecto H1 vivía sin red de seguridad en 1024–1279px. | `public-navigation-footer.spec.ts` y `public-perspective-scroll.spec.ts` chequean overflow solo en mobile; ningún e2e cubría 1024/1180. | Regresiones de layout desktop/tablet pasaban inadvertidas. | Añadir guardrail e2e a 1024 y 1180px. | **Sí** (parte del fix H1). |
| M3 | PWA / Theming | **`theme_color` estático (`#0c354e`) no se adapta a Dark Gray.** El manifest y `viewport.themeColor` fijan navy; en modo oscuro la barra del navegador/PWA no concuerda. | `manifest.ts` `theme_color:"#0c354e"`; `layout.tsx` `viewport.themeColor = SITE_THEME_COLOR`. Dark Gray se aplica vía `data-theme` sin actualizar el meta. | Inconsistencia visual menor de chrome del navegador en modo oscuro instalado como PWA. | Evaluar `themeColor` con `media: '(prefers-color-scheme: dark)'` o sincronizar el meta al togglear tema. | No (diferido — ver backlog PR-B). |

### Low / Polish

| ID | Area | Finding | Evidence | Impact | Recommendation | Implemented |
|---|---|---|---|---|---|---|
| L1 | UX / Errores | **Sin `not-found.tsx` personalizado.** Usa la 404 por defecto de Next. | No existe `frontend/src/app/not-found.tsx`; el build lista `/_not-found` (default). | 404 genérica sin marca ni navegación de retorno. | Página 404 con marca VETNEB + enlaces a Inicio/Servicios/Contacto. | No (diferido — PR-C). |
| L2 | SEO | **`robots.ts` enumera un `allow` parcial** que no lista las landings de servicio (`/histopatologia-veterinaria`, etc.), aunque sí están en `sitemap.xml`. Funcionalmente son indexables (allow `/` cubre todo lo no `disallow`), pero la lista explícita es inconsistente. | `robots.ts` allow: `/,/servicios,/clinicas,/profesionales,/contacto,/precios`; sitemap incluye las 4 landings de servicio. | Cosmético/mantenibilidad; sin impacto real de indexación. | Alinear `allow` con sitemap o remover el `allow` explícito redundante. | No (diferido — PR-C). |
| L3 | Observabilidad | `console.warn` de fallback "endpoint no disponible" en `lib/api.ts` no siempre está bajo `NODE_ENV==='development'`. | `frontend/src/lib/api.ts:127–148`. | Ruido potencial en consola de producción; sin fuga de secretos (cubierto por `api-error-no-secrets`/`devtools-exposure`). | Unificar gating dev-only de estos warnings. | No (diferido — PR-C). |
| L4 | Endurecimiento JSON-LD | `dangerouslySetInnerHTML` con `JSON.stringify(jsonLd)` sin escape de `<`. Contenido 100% estático/controlado (sin input de usuario), por lo que el riesgo es teórico. | 9 páginas + `layout.tsx`. | Defensa en profundidad; hoy no explotable. | Opcional: helper que reemplace `<` por `<` al serializar JSON-LD. | No (diferido — PR-B, opcional). |

## Public web audit

- **Home (`/`):** Renderiza, `<h1>` presente vía `PublicHero`. Sin overflow tras fix (medido 0 en 375/768/1024/1180/1280/1440). JSON-LD de organización en `layout.tsx`.
- **Clínicas (`/clinicas`):** Estática, JSON-LD `WebPage`+breadcrumb. OK; overflow resuelto.
- **Servicios (`/servicios`):** Estática, JSON-LD `Service`/`OfferCatalog`. Landings de servicio (histopatología/citología/informes/laboratorio) presentes con JSON-LD `Service`+breadcrumb y en sitemap.
- **Precios (`/precios`):** Estática + caché runtime de precios públicos (`public-pricing-cache.ts`); contrato `frontend-public-pricing-*` en verde.
- **Profesionales (`/profesionales`, `/profesionales/[clinicId]`):** Búsqueda + detalle dinámico; JSON-LD `SearchResultsPage` con `SearchAction`. Amplia batería de invariantes (`public-professionals-*`).
- **Particulares (`/particulares`):** Acceso por token; `disallow` en robots y fuera de sitemap (correcto: superficie no indexable).
- **Contacto (`/contacto`):** Formulario + JSON-LD `ContactPage`. Datos reales de laboratorio (dirección, horario, WhatsApp, email) verificados por e2e.
- **Login (`/login`):** Estática; contrato de hidratación y redirect `next` acotado.
- **SEO:** `metadataBase`, `title` template, `description`, `canonical` por ruta, OpenGraph + Twitter, robots index/follow, sitemap con prioridades, JSON-LD por tipo de página. Muy completo. (Ver L2.)
- **Navigation:** Navbar/Footer con rutas centralizadas (`ROUTES`), landmarks `banner`/`navigation`/`contentinfo`, sin rutas privadas ni copy demo (contrato lo bloquea).
- **Responsive:** Tras H1, sin overflow horizontal en 375→1440 en las rutas medidas.
- **Theme Normal / Dark Gray:** Init pre-paint (`theme-init.js`) sin FOUC; toggle persistente en `localStorage` con `try/catch`; tokens dark-gray definidos en `globals.css` (CTAs, alertas, KPIs). Pendiente menor: `theme_color` meta (M3).

## Dashboard audit

- **Admin (`/dashboard/admin` + submódulos):** Clínicas, precios, sesiones, intentos fallidos, auditoría, system health, tokens particulares, mantenimiento (dry-run), schema health. Cobertura de contrato extensa y en verde (`admin-*`, `frontend-admin-*`, `frontend-admin-live-read-contract`, `frontend-audit-no-mock-fallback`).
- **Clinic (`/dashboard`, `/dashboard/informes`, `/dashboard/logistica/*`):** Command centers + workspaces; contratos `frontend-dashboard-*`, `frontend-logistics-*` en verde; sin mock fallback.
- **Navigation / shell:** `PrivateDashboardShell` con `h-dvh overflow-hidden` y área de contenido `overflow-y-auto` (e2e lo verifica); sin scroll global.
- **Data states / Forms / Tables:** `LoadingState`/`EmptyState`/`ErrorState`, `MasterDetailWorkspace`, `UploadReportModal`, `FilterDrawer` con tests dedicados.
- **Permissions / aislamiento:** `app_session_id` (clínica) vs `admin_session_id` (admin); middleware (`proxy.ts`) separa por path.
- **Responsive:** e2e de overflow del dashboard a 768/375/1280 en verde.
- **Theme:** tokens dark-gray específicos para tablas/KPIs/alertas del dashboard.
- **Nota:** verificación operativa *online* (persistencia real de acciones) → requiere staging (fuera de alcance local).

## Security audit

- **Auth/session:** Middleware `proxy.ts` exige cookie de sesión; admin sin sesión → **404** (no revela existencia), clínica sin sesión → **redirect a `/login?next=…`**. Validación real en backend (contratos `auth-*`, `admin-auth-*`, `clinic-permissions-*`).
- **Cookies:** Separación estricta admin/clínica; nombres marcados como `server-only` por el auditor de superficie pública.
- **CSP:** `Content-Security-Policy-Report-Only` (no enforcing por diseño, #747), con `report-uri`/`report-to` condicionados a origen canónico https; `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`. `unsafe-inline`/`unsafe-eval` temporales documentados.
- **Headers:** `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` restrictiva, HSTS en producción, `poweredByHeader:false`.
- **Sensitive data:** `pnpm security:public-surface` PASS; sin `.env` con valores filtrables; solo `NEXT_PUBLIC_SITE_URL`/`NEXT_PUBLIC_API_URL` (públicos legítimos).
- **APIs:** Rewrite `/api/:path*` → backend; CSRF/trusted-origin cubierto (`requireTrustedOrigin`, `security-csrf-*`, `security-trusted-origin-*`).
- **Storage:** Bucket privado, signed URLs con TTL por ENV, sanitización de nombres/anti path-traversal (tests de storage boundaries en verde).
- **Logs:** Errores DB mapeados a mensajes sanitizados; sin secretos en logs (`api-error-no-secrets`, `api-error-no-stack-traces`).

## PWA audit

- **Manifest:** `name`, `short_name`, `description`, `start_url`/`scope` `/`, `display: standalone`, `background_color`, `theme_color`, iconos 192/512 + maskable + apple, `shortcuts`, `categories`. Servido con `Cache-Control` adecuado.
- **Service worker (`sw.js`):** Network-first para navegación pública permitida con fallback `/offline`; cache-first para assets estáticos. **No cachea** `/api/`, `/dashboard`, `/admin`, `_next/server`, ni respuestas con `Set-Cookie`. Limpieza de caches viejos en `activate`.
- **Allowlist pública:** coincide exactamente con las 8 rutas PWA canónicas de la skill (`/`, `/servicios`, `/profesionales`, `/clinicas`, `/particulares`, `/contacto`, `/precios`, `/login`, + `/offline`). Las 4 landings de servicio **no** tienen fallback offline — **por diseño** (no son parte de la superficie PWA canónica), no es defecto.
- **Offline / Icons / Theme color:** `/offline` precacheada; iconos reales presentes en `public/icons`. `theme_color` no adapta a dark mode (M3).

## Accessibility audit

- **Keyboard:** Focus-visible rings consistentes en navbar/CTAs/toggle. **Falta skip link (M1).**
- **Focus:** Estados `focus-visible:ring-2` en controles públicos; dashboard con e2e de foco/aria.
- **Labels:** `aria-label` en navegaciones, toggle de tema (`aria-pressed`+`aria-label` dinámico), botón hamburguesa.
- **Contrast:** Contrato `frontend-public-button-contrast-contract` en verde; tokens dark-gray cuidan alertas/ámbar.
- **Landmarks:** `banner`, `navigation` (principal/mobile), `main#main-content`, `contentinfo`.
- **Headings:** `<h1>` por hero en páginas públicas.
- **Reduced motion:** Bloques `@media (prefers-reduced-motion: reduce)` para perspective scroll y dashboard; perspective desactiva `perspective`/`transform`.
- **Screen reader:** `aria-hidden` en iconos decorativos; nombres accesibles en CTAs.

## Performance audit

- **Build:** Frontend compila en ~2–4s (Turbopack); 25 rutas, mayoría estáticas (○).
- **Bundle:** Sin imports pesados evidentes en superficie pública; `echarts`/tablas concentrados en dashboard (dinámico).
- **Fonts:** `InterVariable.woff2` local con `<link rel="preload" ... crossorigin>` (woff2, #974). `font-src 'self' data:` en CSP.
- **Scripts:** `theme-init.js` síncrono pre-paint (intencional, evita FOUC); JSON-LD inline estático.
- **Images:** `next/image` formats avif/webp, `minimumCacheTTL` 7 días; hero `.webp`; `/images` y `/icons` con `Cache-Control immutable`.
- **Hydration:** Componentes públicos mayormente server; `"use client"` acotado (toggle de tema, contenidos interactivos puntuales).
- **Caching:** Headers de caché por tipo de asset bien diferenciados; SW no cachea privado.

## Testing audit

- **Existing tests:** **2657** tests nativos en verde (backend Fastify, contratos frontend, seguridad, SEO, PWA, dashboard, público). Cobertura de contrato muy alta.
- **New tests recommended:** guardrail de overflow desktop/tablet (1024/1180) — **agregado**. A futuro: e2e de skip link y de `theme_color` por modo.
- **Fragile tests:** Tripwires legacy de scope que comparan `git diff` del working tree (`frontend-dashboard-logistics-hub`, etc.) — pasan porque el fix vive en `components/layout/` (fuera de sus listas bloqueadas) y porque se revirtió `next-env.d.ts` tras el e2e. Tests de perspective scroll son estáticos (no miden magnitud de transform) — ver PR-26 diferido.
- **Missing coverage:** magnitud real del efecto perspective (unit/e2e estáticos); operatividad online del dashboard (requiere staging).

## ISO mapping (resumen)

| Norma | Característica | Evidencia en VETNEB |
|---|---|---|
| 25010 Funcionalidad | Completitud/corrección | Suite 2657 verde; sin mock fallback. |
| 25010 Fiabilidad | Madurez/recuperabilidad | Fallback offline; errores sanitizados; SW resiliente. |
| 25010 Usabilidad | Operabilidad/accesibilidad | Landmarks, focus-visible; **gap skip link (M1)**. |
| 25010 Eficiencia | Comportamiento temporal | Estáticas prerenderizadas, preload de fuente, caché de assets. |
| 25010 Mantenibilidad | Modularidad/analizabilidad | Rutas centralizadas, contratos extensos. |
| 25010 Portabilidad | Adaptabilidad | **Overflow responsive (H1) — corregido.** |
| 27001 | Seguridad | Separación de sesiones, CSP/headers, superficie pública sin secretos. |
| 5055 | Debilidades de código | Sin `eval`/`new Function`; `dangerouslySetInnerHTML` solo JSON-LD estático (L4). |
| 9001/15504 | Proceso/trazabilidad | PRs mínimos, guardrails de scope, evidencia verificable. |

## Implemented fixes in this branch

| Fix | File(s) | Reason | Validation |
|---|---|---|---|
| H1 — Eliminar overflow horizontal 1024–1279px desplazando el navbar desktop de `lg` a `xl` | `frontend/src/components/layout/Navbar.tsx` | Defecto verificado de overflow (~123px) en el 100% de rutas públicas en un rango de viewport común. | Probe Playwright: `docOverflow=0` en 375/768/1024/1180/1280/1440 × 5 rutas. |
| H1 — Alinear contrato de navbar al diseño corregido (xl) | `test/frontend-public-layout-navigation.test.ts` | El contrato fijaba `lg:flex`/`lg:hidden`; se alinea a `xl` (precedente de alineación de guards en-PR) y se añade guard `p-1 lg:flex === false`. | `pnpm test` 2657/2657 PASS. |
| M2 — Guardrail e2e de overflow desktop/tablet | `frontend/e2e/public-navigation-footer.spec.ts` | Cerrar el gap de cobertura (solo medía 375px) y prevenir regresión de H1. | e2e nuevo verde @1024 y @1180; verifica nav desktop visible @1280. |

## Deferred PR backlog

| Priority | Suggested PR title | Area | Reason | Risk | Validation |
|---|---|---|---|---|---|
| Media | **PR-A: add public skip-to-content link** | A11y | M1 — WCAG 2.4.1; target `#main-content` ya existe. | Bajo (additivo; tocar `PublicLayout.tsx` + clase CSS). | Contrato de layout + e2e teclado. |
| Media | **PR-B: adaptar theme_color a Dark Gray (+ opcional escape JSON-LD)** | PWA/SEO | M3/L4. | Bajo. | Contratos PWA/SEO + verificación de meta por modo. |
| Baja | **PR-C: pulidos varios (404 con marca, robots/sitemap allow, gating de warnings)** | UX/SEO/Obs | L1/L2/L3. | Bajo. | Contratos SEO/route-registry. |
| Media/Alta | **PR-26: perspective scroll perceptible** | UI | Efecto activo pero imperceptible en desktop; tests estáticos no validan magnitud. | Medio (requiere rediseño de amplitudes/easing + e2e que parsee `matrix3d`). Ver `project_pr24_perspective_audit`. | Unit + e2e con umbral de `rotateX`. |

## Production readiness score

| Dimensión | Score | Nota |
|---|---|---|
| Security | 9.5 / 10 | Fronteras sólidas, CSP report-only (enforcing pendiente, documentado). |
| Reliability | 9.0 / 10 | Suite extensa verde; offline resiliente. |
| Accessibility | 8.0 / 10 | Buenas bases; falta skip link (M1). |
| Performance | 9.0 / 10 | Estáticas + preload de fuente + caché por asset. |
| SEO | 9.5 / 10 | Metadata/JSON-LD/sitemap muy completos. |
| UX/UI | 9.0 / 10 | Premium; overflow H1 corregido. |
| Maintainability | 9.0 / 10 | Contratos y guardrails fuertes (algunos tripwires frágiles por diff). |
| **Overall** | **9.0 / 10** | Apto para producción tras el fix de esta rama. |

## Final recommendation

- **Ship now:** No (sin integrar el fix).
- **Ship after fixes:** **Sí** — integrar el fix de overflow H1 de esta rama (ya validado: build/lint/typecheck/test 2657 + e2e). Los ítems diferidos (PR-A/B/C/26) no bloquean el lanzamiento.
- **Must not ship because:** Nada lo impide. El único defecto de alto impacto (overflow 1024–1279px) queda resuelto y con guardrail de regresión.
