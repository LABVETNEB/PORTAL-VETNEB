# Production Readiness PR Backlog Audit

## Executive summary
- **Estado general:** Base sólida y en verde. `main` (commit `01e065e`) pasa todas las validaciones nativas (2658 tests, build backend/frontend, lint, typecheck, auditoría de superficie pública, `pnpm audit --prod` sin vulnerabilidades). No hay PRs abiertos ni ramas remotas sin mergear: los "11 PR pendientes" son un backlog conceptual, no PRs vivos en GitHub.
- **Riesgo global:** Medio-bajo. Hay un único riesgo material de seguridad real (PR-2, contacto sin rate-limit → abuso de SMTP) y varios endurecimientos de UX/SEO/a11y de bajo riesgo. El resto son mejoras incrementales.
- **Bloqueadores de producción:** Ninguno duro detectado en código. PR-2 es el más cercano a bloqueador material (superficie pública mutante sin límite de tasa). PR-11 (observabilidad) no se puede cerrar sin credenciales de Render/Supabase/SMTP.
- **Restricción transversal crítica:** Existen *scope guards* que inspeccionan el `git diff --name-only` del working tree y **bloquean** cambios en `server/`, `drizzle/`, `shared/`, `frontend/src/app/api/`, middleware y archivos exactos `frontend/src/app/layout.tsx`, `frontend/src/lib/seo.ts`, `frontend/src/lib/auth.ts`, `package.json`, `frontend/next-env.d.ts`, `frontend/tsconfig.json`. Además, el contrato de superficie pública prohíbe `<a>` / `<Link>` / `next/link` en `frontend/src` (navegación vía controles centralizados). Estas dos reglas determinan el orden seguro de ejecución.
- **Recomendación:** Ejecutar primero las mejoras *guard-safe* y aditivas (PR-5 hecho en esta rama; PR-3 test-only). Tratar PR-2 como el siguiente PR prioritario pero como PR de seguridad dedicado, con alineación de guards. Diferir lo que toca archivos bloqueados o requiere credenciales/binarios/imagen aprobada.
- **PR recomendado para ejecutar primero (de los pendientes):** **PR-2 `feat(security): rate-limit public contact endpoint`** por ser el único riesgo material. **PR implementado en ESTA rama:** **PR-5 `fix(a11y): add skip to main content link`** (el de mayor relación valor/seguridad y menor riesgo de mezcla).

## Baseline
- **Commit:** `01e065e docs(public): document future image readiness (#980)`
- **Branch:** `audit/production-readiness-pr-backlog` (creada desde `main` actualizado)
- **Validaciones base (en `main`, antes de tocar código):**
  - `pnpm audit --prod` → No known vulnerabilities found.
  - `pnpm test` → tests 2658, pass 2658, fail 0.
  - `pnpm build` → OK (`dist/index.js` 859.8kb).
  - `pnpm security:public-surface` → PASS (sin hallazgos de exposición pública).
  - `pnpm --dir frontend lint` → limpio.
  - `pnpm --dir frontend typecheck` → limpio.
  - `pnpm --dir frontend build` → OK.
- **PRs abiertos:** ninguno (`gh pr list --state open` vacío).
- **Ramas no mergeadas:** ninguna (`git branch -r --no-merged origin/main` vacío).

## Skills used
- `vetneb-briefing-planificacion-diseno-desarrollo-pruebas` — recorte de scope, criterios de aceptación, no-alcance.
- `vetneb-staff-senior-full-stack-engineer` — diagnóstico multi-capa con evidencia del repo.
- `vetneb-security-production-invariants` — invariantes de sesión/rol/sanitización (PR-2, PR-9, PR-10).
- `vetneb-protocolos-comunicacion` — HTTP/CORS/cookies/credentials para contacto y reports.
- `vetneb-bugs-errores-optimizacion-rutas` — routing, 4xx/5xx, redirects, SW/caché.
- `vetneb-web-end-to-end-global` — superficies públicas/clínica/admin.
- `vetneb-admin-dashboard-operational-actions` — acciones reales del dashboard admin.
- `vetneb-pwa-end-to-end` — manifest, theme-color, iconos, cache segura.
- `vetneb-lanzamiento-mantenimiento` — readiness, staging, observabilidad, limpieza local.

## Prioritized roadmap
| Order | PR title | Priority | Severity | Impact | Risk | Blocks production | Recommendation |
|---:|---|---|---|---|---|---|---|
| 1 | feat(security): rate-limit public contact endpoint | P0 | Alta | Anti-abuso SMTP/flood | Medio (toca `server/`, guard-blocked) | Casi — riesgo material | Ejecutar como PR de seguridad dedicado, con guard-align y tests |
| 2 | fix(a11y): add skip to main content link | P1 | Media | WCAG 2.4.1; teclado | Bajo (guard-safe) | No | **Implementado en esta rama** |
| 3 | test(frontend): harden contact hydration e2e stability | P1 | Media | Estabilidad CI | Bajo (solo e2e) | No | Ejecutar pronto, en paralelo |
| 4 | fix(ui): align theme color with dark gray mode | P2 | Baja | Chrome móvil PWA | Medio (toca `layout.tsx` bloqueado + hidratación) | No | Tras guard-align; cuidar mismatch |
| 5 | feat(public): add branded not-found page | P2 | Baja | UX 404 | Bajo-Medio (archivo nuevo, sin anchors) | No | Aditivo; usar controles centralizados |
| 6 | audit(ui): extreme visual production readiness | P2 | Media | Pulido visual global | Medio-Alto (amplio) | No | Dividir en micro-PRs acotados |
| 7 | fix(dashboard): redirect to login on server-side 401 | P2 | Media | UX sesión expirada | Medio (toca middleware/auth bloqueados) | No | PR auth acotado, sin refactor masivo |
| 8 | fix(reports): unify foreign report access to 404 | P2 | Alta (seguridad) | Reduce oráculo IDOR | Alto (contratos IDOR vigentes) | No | Revisión profunda de contratos antes |
| 9 | feat(seo): add optimized OpenGraph imagery | P3 | Baja | SEO/social | Bajo (pero sin asset aprobado) | No | Solo estructura; diferir imagen real |
| 10 | perf(pwa): optimize large app icons | P3 | Baja | Peso de iconos | Bajo (requiere tooling binario) | No | Diferir: necesita herramienta de compresión |
| 11 | ops(production): verify observability and launch readiness | P1 (ops) | Media | Operación/monitoring | N/A (externo) | Sí para "launch", no para código | Auditoría/plan; requiere credenciales |

## PR details

### 1. audit(ui): extreme visual production readiness
- **Objective:** Auditoría visual extrema (público + dashboards clínica/admin) en Normal y Dark Gray, mobile/tablet/desktop: overflow, contraste, spacing, focus, scroll, tablas, formularios, modales, CTAs, skeletons, empty/error.
- **Why:** Calidad percibida de producción; ya existe `AUDIT_EXTREME_VISUAL_PRODUCTION_READINESS.md` y precedentes (#977 dark gray, #975 step numbers, #978 tablet overflow). El trabajo restante es de pulido focalizado.
- **Scope:** Fixes visuales seguros y acotados. NO rediseño masivo. NO mezclar con seguridad/SEO/dashboard funcional.
- **Files likely affected:** `frontend/src/app/globals.css`, componentes en `frontend/src/components/**`, páginas públicas `frontend/src/app/*/page.tsx`. Evitar `layout.tsx` y `seo.ts` (bloqueados por scope guards).
- **Tests:** Contratos `frontend-visual-consistency.test.ts`, `frontend-dashboard-*-polish.test.ts` (assertions de clases en `globals.css`), e2e `visual-smoke.spec.ts`, `public-*-*.spec.ts`. Cada cambio de clase debe reflejarse en su test de contrato.
- **Acceptance criteria:** Sin overflow horizontal en breakpoints clave; foco visible AA; contraste AA en ambos temas; sin regresión en `visual-smoke`. `git diff --check` limpio.
- **Risk:** Medio-alto por amplitud; alto riesgo de mezcla si se hace en un solo PR. Los *scope guards* de dashboard se activan si se tocan archivos fuera de scope.
- **Recommendation:** Dividir en micro-PRs por superficie (p.ej. "public forms focus", "dashboard tables overflow"), cada uno con su test de contrato. No hacer un PR monolítico.

### 2. feat(security): rate-limit public contact endpoint
- **Objective:** Añadir rate-limit dedicado a `POST /api/contact` para prevenir flood/spam/abuso de SMTP, manteniendo mensajes sanitizados y sin romper contacto legítimo.
- **Why:** **Riesgo material.** `server/routes/contact.fastify.ts` valida origin/CORS y payload (zod) y sanitiza errores, pero **no aplica ningún límite de tasa**: cada POST válido dispara `sendContactMessageEmail`. Es la superficie pública mutante más expuesta.
- **Scope:** Reusar la infraestructura existente (`server/lib/rate-limit-store.ts`: `createMemoryRateLimitStore`, `getOrCreateRateLimitEntry`, `incrementRateLimitEntry`, store inyectable; patrón ya aplicado en `server/routes/public-professionals.fastify.ts`). Añadir un módulo `server/lib/public-contact-rate-limit.ts` con window/max/mensaje, y aplicar keyed-by-IP (hash) en el handler. Responder 429 con mensaje seguro al exceder. NO tocar pricing ni auth.
- **Files likely affected:** `server/routes/contact.fastify.ts`, nuevo `server/lib/public-contact-rate-limit.ts`, registro en `server/fastify-app.ts` (opciones inyectables para tests), nuevo `test/contact-rate-limit.fastify.test.ts`.
- **Tests:** Límite alcanzado → 429; reset por ventana; éxito bajo límite; 400 validación; 403 origin no permitido siguen intactos; sin fuga de secretos; store inyectable determinista (`now()` fijo).
- **Acceptance criteria:** N peticiones válidas en la ventana pasan, la N+1 devuelve 429 sanitizado; el contacto legítimo de baja frecuencia nunca se bloquea; tests verdes; sin secretos en logs.
- **Risk:** Medio. Toca `server/` → **bloqueado por scope guards** (debe alinearse guards en el PR, precedente #958). Riesgo de falsos positivos si la ventana/máximo son demasiado estrictos.
- **Recommendation:** **Ejecutar como el próximo PR**, dedicado y aislado (no mezclar con visual/SEO/dashboard). Revisar infraestructura existente (hecho aquí: existe y es reutilizable) antes de implementar.

### 3. test(frontend): harden contact hydration e2e stability
- **Objective:** Endurecer `frontend/e2e/contacto-hydration.spec.ts` para eliminar flakes Linux/Windows sin ocultar errores reales ni relajar la verificación de no-mismatch.
- **Why:** El test falló una vez en CI y pasó local/retry. La causa probable es timing de hydration/fill antes de que React tome control de los inputs controlados.
- **Scope:** Solo el spec e2e. Estabilizar esperas: `waitForLoadState`/`expect.toBeEnabled` antes de `fill`, esperar hidratación del `[data-contact-intent-router]`, evitar `fill` sobre inputs aún no hidratados; mantener `collectHydrationFailures` y los asserts de mismatch.
- **Files likely affected:** `frontend/e2e/contacto-hydration.spec.ts` únicamente. (Archivo no bloqueado por guards.)
- **Tests:** El propio spec, ejecutado N veces (`--repeat-each`) en chromium para confirmar estabilidad.
- **Acceptance criteria:** Spec verde de forma repetida; sigue fallando si se introduce un mismatch real; sin `waitForTimeout` arbitrarios largos.
- **Risk:** Bajo. Solo toca un test e2e; no cambia código de producto.
- **Recommendation:** Ejecutar en paralelo con PR-5; PR pequeño y de bajo riesgo.

### 4. fix(ui): align theme color with dark gray mode
- **Objective:** Que `theme-color` (chrome del navegador móvil / PWA) refleje Normal vs Dark Gray sin hydration mismatch.
- **Why:** `frontend/src/app/layout.tsx` declara `viewport.themeColor = SITE_THEME_COLOR` (`#0c354e`) estático y `frontend/src/app/manifest.ts` fija `theme_color: "#0c354e"`. El tema se aplica pre-paint con `/theme-init.js` + `data-theme` en `<html>`, así que el `meta[name=theme-color]` no sigue al modo Dark Gray.
- **Scope:** Hacer el `meta theme-color` consciente del tema (actualizar en `theme-init.js` y en el toggle de tema). NO cambiar el sistema de temas completo.
- **Files likely affected:** `frontend/public/theme-init.js`, el componente toggle de tema, y posiblemente `frontend/src/app/layout.tsx` (**bloqueado por scope guards**) y `manifest.ts`.
- **Tests:** Extender `frontend/e2e/theme-mode.spec.ts` para verificar el valor de `meta[name=theme-color]` tras el toggle; contrato de no-mismatch.
- **Acceptance criteria:** El color de chrome móvil cambia con el tema, sin warning de hydration; manifest sigue válido.
- **Risk:** Medio. Hidratación (server estático vs client dinámico) y guard-block en `layout.tsx`.
- **Recommendation:** Ejecutar tras alinear guards; preferir actualización 100% client-side en `theme-init.js` para evitar mismatch SSR.

### 5. fix(a11y): add skip to main content link
- **Objective:** Skip-link accesible que aparece al foco y mueve el foco de teclado a `#main-content`.
- **Why:** WCAG 2.4.1 (Bypass Blocks). El landmark `main#main-content` ya existe en `frontend/src/components/layout/PublicLayout.tsx` (con test de contrato).
- **Scope:** Público (todas las páginas usan `PublicLayout`). Implementado como **botón** (la superficie pública prohíbe `<a>`), con CSS theme-aware. NO tocar dashboards en este PR (su layout no tiene `#main-content`; queda como follow-up).
- **Files likely affected (implementado):** `frontend/src/components/public/SkipToContent.tsx` (nuevo), `frontend/src/components/layout/PublicLayout.tsx`, `frontend/src/app/globals.css`, `test/frontend-public-skip-link-contract.test.ts` (nuevo), `frontend/e2e/public-navigation-footer.spec.ts`.
- **Tests:** Contrato node (markup + CSS + control), e2e teclado en desktop/mobile (Tab → foco → revelado → Enter/Space → foco en `main-content`).
- **Acceptance criteria:** Primer Tab enfoca el skip-link; revelado visible con focus ring; activación mueve foco a `main` mediante `tabindex` temporal; funciona en Normal y Dark Gray (tokens `--primary`/`--ring`); sin overflow.
- **Risk:** Bajo. Guard-safe (no toca archivos bloqueados) y respeta el contrato de no-anchors.
- **Recommendation:** **Implementado y validado en esta rama.** Ver `IMPLEMENTATION_SELECTED_PRODUCTION_READINESS_PR.md`.

### 6. feat(public): add branded not-found page
- **Objective:** Reemplazar `/_not-found` por un 404 con marca VETNEB, CTA a inicio/contacto, Normal/Dark Gray, responsive, sin leak de rutas privadas.
- **Why:** No existe `frontend/src/app/not-found.tsx`; hoy se sirve el 404 por defecto de Next.
- **Scope:** Crear `frontend/src/app/not-found.tsx` con copy mínimo y CTAs vía controles centralizados (no `<a>`). Sin exponer rutas privadas ni copy demo prohibido.
- **Files likely affected:** nuevo `frontend/src/app/not-found.tsx` (no bloqueado), posiblemente `globals.css`, nuevo test de contrato `test/frontend-not-found-*.test.ts`.
- **Tests:** Contrato: usa `PublicRouteControl`/controles, contiene marca, no contiene `ROUTES.dashboard`/`/dashboard`/`admin_session_id` ni copy demo prohibido; e2e: navegar a ruta inexistente devuelve la página branded.
- **Acceptance criteria:** 404 branded en ambos temas y breakpoints; CTAs funcionales; sin leak de rutas privadas; sin `<a>` crudo.
- **Risk:** Bajo-medio (archivo nuevo aditivo). Cuidar el contrato de superficie pública.
- **Recommendation:** Buen segundo "quick win" tras PR-5; PR pequeño.

### 7. feat(seo): add optimized OpenGraph imagery
- **Objective:** OG image dedicada 1200×630 con `width`/`height`/`type` declarados y Twitter card, peso controlado.
- **Why:** `frontend/src/lib/seo.ts` apunta OG/Twitter a `/images/hero-microscope-vetneb.webp` (hero, ~75 KB, no 1200×630) y **no** declara `width`/`height`/`type`. El commit #980 ya documentó "future image readiness".
- **Scope:** Declarar `type` y, si hubiera asset aprobado 1200×630, `width`/`height` y URL dedicada. **No** introducir imágenes reales no aprobadas ni stock improvisado.
- **Files likely affected:** `frontend/src/lib/seo.ts` (**bloqueado por scope guards**), `frontend/public/images/` (asset si existe).
- **Tests:** `frontend-public-page-metadata.test.ts` (extender para `width/height/type`).
- **Acceptance criteria:** Con asset aprobado: OG 1200×630 con metadatos completos. Sin asset: dejar estructura/documentación y no tocar imágenes.
- **Risk:** Bajo técnico, pero **sin asset aprobado no se implementa**. Guard-block en `seo.ts`.
- **Recommendation:** **Diferir la imagen.** Solo declarar `type` de forma segura cuando se ejecute, junto a guard-align; el resto pendiente de asset oficial.

### 8. perf(pwa): optimize large app icons
- **Objective:** Reducir peso de iconos grandes (especialmente 512px) sin pérdida visual apreciable ni cambiar branding/dimensiones.
- **Why:** `frontend/public/icons/icon-512x512.png` ≈ 127 KB y `maskable-icon-512x512.png` ≈ 133 KB son pesados para PNGs de icono.
- **Scope:** Recompresión sin pérdida/casi sin pérdida (p.ej. oxipng/pngquant) manteniendo dimensiones y `manifest`.
- **Files likely affected:** binarios en `frontend/public/icons/`, validación de `frontend/src/app/manifest.ts`.
- **Tests:** `frontend-pwa-global-operational-contract.test.ts` (manifest/iconos), build, verificación de dimensiones.
- **Acceptance criteria:** Mismo render, menor peso, manifest válido, cache PWA intacta.
- **Risk:** Bajo en runtime, pero **requiere herramienta de compresión** (no en dependencias) y cambios de binarios → fuera del protocolo sin autorización.
- **Recommendation:** **Diferir.** Requiere tooling/binarios aprobados; no implementar ahora.

### 9. fix(dashboard): redirect to login on server-side 401
- **Objective:** Cuando la sesión clínica/admin expira y un fetch server-side devuelve 401, redirigir a `/login` (sin loops), preservando 403/404 seguros.
- **Why:** El manejo de 401 hoy es puntual (`frontend/src/lib/api.ts` mapea 401 solo en casos como admin schema health). No hay una política unificada de redirect server-side ante sesión expirada.
- **Scope:** Política acotada en el límite RSC/middleware (`frontend/src/middleware.ts`) y/o wrappers de `api.ts`. NO refactor masivo de auth; mantener separación `app_session_id`/`admin_session_id`.
- **Files likely affected:** `frontend/src/middleware.ts` (**prefijo bloqueado**), `frontend/src/lib/api.ts`, `frontend/src/lib/auth.ts` (**bloqueado**).
- **Tests:** Sesión expirada → redirect a `/login`; 403 sigue 403; 404 sigue 404; sin loop de redirect; sin mezclar cookies de rol.
- **Acceptance criteria:** UX de expiración correcta sin exponer datos; 403/404 intactos; sin bucles.
- **Risk:** Medio. Toca middleware/auth (guard-block) y es sensible a loops.
- **Recommendation:** PR auth acotado, tras PR-2; con guard-align y tests de sesión expirada.

### 10. fix(reports): unify foreign report access to 404
- **Objective:** Evaluar y, si es seguro, unificar el acceso a informe ajeno como 404 para reducir el oráculo de existencia (IDOR).
- **Why:** `server/routes/reports.fastify.ts` distingue hoy **404 "Informe no encontrado"** (no existe) de **403 "No autorizado para consultar otra clinica"** (existe pero ajeno) — un oráculo de existencia. Afecta particular/clínica/admin.
- **Scope:** Unificar a 404 donde el 403 revele existencia, sin romper flujos legítimos ni la atribución de auditoría.
- **Files likely affected:** `server/routes/reports.fastify.ts`, `server/db-report-access.ts` (**`server/` bloqueado**), tests `test/security-cross-tenant-idor-contract.test.ts`, `test/architecture/security/security-resource-ownership-boundaries.test.ts`, `test/reports.fastify.test.ts`.
- **Tests:** IDOR: informe ajeno y inexistente devuelven el **mismo** 404; el dueño legítimo sigue 200; no leakage; auditoría intacta.
- **Acceptance criteria:** Sin oráculo de existencia para terceros; sin regresión de acceso legítimo; contratos de seguridad actualizados de forma coherente (no relajados).
- **Risk:** **Alto.** Es cambio de contrato de seguridad; los tests vigentes asEVERan el 403 actual. Requiere decisión deliberada y actualización coordinada de contratos (no "relajar").
- **Recommendation:** **Diferir hasta revisión de seguridad dedicada.** Documentar la matriz exists/owned × rol antes de cambiar códigos.

### 11. ops(production): verify observability and launch readiness
- **Objective:** Verificar health checks, logs seguros, 500 sanitizados, CSP reports, monitoring, alertas, uptime, backups, storage, entrega SMTP/contacto, envs Render/Supabase.
- **Why:** Readiness de lanzamiento; varias piezas (CSP report en `frontend/src/app/api/security/csp-report/route.ts`, health en `server/routes/admin-system-health.fastify.ts`, `/health`) existen, pero su verificación end-to-end depende de infraestructura.
- **Scope:** Auditoría/plan. La verificación real requiere staging/producción y credenciales.
- **Files likely affected:** Ninguno de producto necesariamente; documentación/checklists.
- **Tests:** Smokes existentes (`scripts/smoke/*`, `pnpm smoke:staging`) ejecutados contra staging por Nico.
- **Acceptance criteria:** Checklist de observabilidad verificada en staging; 500 sanitizados; CSP reports recibidos; alertas/uptime activos.
- **Risk:** N/A en código; operativo.
- **Recommendation:** **Auditoría/plan.** No simular evidencia. Ejecutar verificación con credenciales en staging.

## Dependency map
| PR | Depends on | Should precede | Reason |
|---|---|---|---|
| PR-2 rate-limit | Infra rate-limit (ya existe) | PR-11 launch | Cierra riesgo material antes del lanzamiento |
| PR-5 skip-link | — | — | Independiente, guard-safe (hecho) |
| PR-3 hydration test | — | — | Solo e2e, independiente |
| PR-4 theme-color | Guard-align `layout.tsx` | PR-11 | Pulido PWA pre-launch |
| PR-6 not-found | Contrato no-anchors | — | Aditivo |
| PR-7 OG image | Asset aprobado 1200×630 | PR-11 | SEO social pre-launch |
| PR-8 icons | Tooling de compresión aprobado | PR-11 | Performance PWA |
| PR-9 401→login | Guard-align middleware/auth | — | UX sesión |
| PR-10 reports 404 | Revisión contratos IDOR | PR-11 | Seguridad; coordinar con tests |
| PR-1 visual | Tests de contrato por clase | — | Dividir en micro-PRs |
| PR-11 launch | PR-2 (ideal), staging/creds | — | Verificación final |

## Risk matrix
| PR | Security risk | UX risk | Regression risk | Operational risk | Notes |
|---|---|---|---|---|---|
| PR-1 visual | Bajo | Medio | Medio | Bajo | Amplitud → mezcla; usar tests de contrato CSS |
| PR-2 rate-limit | **Alto si no se hace** | Bajo (si ventana razonable) | Bajo | Medio | Falsos positivos si es muy estricto |
| PR-3 hydration test | Nulo | Bajo | Bajo | Bajo | No ocultar errores reales |
| PR-4 theme-color | Bajo | Bajo | Medio (hydration) | Bajo | Guard-block `layout.tsx` |
| PR-5 skip-link | Nulo | Bajo (positivo) | Bajo | Bajo | Guard-safe (hecho) |
| PR-6 not-found | Bajo (leak rutas) | Bajo | Bajo | Bajo | Sin anchors; sin rutas privadas |
| PR-7 OG image | Bajo | Bajo | Bajo | Bajo | No imágenes no aprobadas |
| PR-8 icons | Nulo | Bajo | Bajo | Bajo | Requiere tooling binario |
| PR-9 401→login | Medio | Medio | Medio (loops) | Bajo | Mantener 403/404 y separación de cookies |
| PR-10 reports 404 | **Alto (positivo y de regresión)** | Bajo | **Alto** | Bajo | Cambio de contrato; coordinar tests |
| PR-11 launch | Medio | Bajo | Bajo | **Alto** | Requiere credenciales/staging |

## Suggested branch names
| PR title | Branch |
|---|---|
| feat(security): rate-limit public contact endpoint | `feat/security-contact-rate-limit` |
| fix(a11y): add skip to main content link | `audit/production-readiness-pr-backlog` (esta rama) |
| test(frontend): harden contact hydration e2e stability | `test/contact-hydration-e2e-hardening` |
| fix(ui): align theme color with dark gray mode | `fix/theme-color-dark-gray` |
| feat(public): add branded not-found page | `feat/public-branded-not-found` |
| audit(ui): extreme visual production readiness | `audit/visual-production-readiness-<surface>` |
| fix(dashboard): redirect to login on server-side 401 | `fix/dashboard-401-login-redirect` |
| fix(reports): unify foreign report access to 404 | `fix/reports-foreign-access-404` |
| feat(seo): add optimized OpenGraph imagery | `feat/seo-opengraph-imagery` |
| perf(pwa): optimize large app icons | `perf/pwa-optimize-app-icons` |
| ops(production): verify observability and launch readiness | `ops/launch-readiness-verification` |

## Suggested validation matrix
| PR | Required validation |
|---|---|
| PR-2 | `pnpm test`, `pnpm build`, `pnpm security:public-surface`, nuevo `contact-rate-limit.fastify.test.ts`, guard-align tests |
| PR-3 | `pnpm --dir frontend e2e contacto-hydration.spec.ts --repeat-each=5 --project=chromium` |
| PR-4 | `pnpm --dir frontend e2e theme-mode.spec.ts`, lint/typecheck/build, guard-align |
| PR-5 | `pnpm test`, `pnpm --dir frontend lint/typecheck/build`, e2e `public-navigation-footer.spec.ts` (hecho) |
| PR-6 | `pnpm test` (contrato not-found), e2e ruta inexistente |
| PR-7 | `pnpm test` (`frontend-public-page-metadata.test.ts`), build |
| PR-8 | `pnpm --dir frontend build`, contrato PWA, verificación de dimensiones |
| PR-9 | `pnpm test` (sesión expirada), e2e dashboard 401 |
| PR-10 | `pnpm test` (IDOR/ownership), revisión de contratos |
| PR-11 | `pnpm smoke:staging`, health checks en staging (Nico, con credenciales) |

## Deferred / not safe to implement now
| PR | Reason | Required prerequisite |
|---|---|---|
| PR-2 rate-limit | Riesgo material pero es PR de seguridad dedicado que toca `server/` (guard-block) | PR aislado + guard-align + tests de límite |
| PR-7 OG image | Sin asset oficial 1200×630 aprobado | Asset aprobado |
| PR-8 icons | Requiere herramienta de compresión (no en deps) y cambios de binarios | Tooling/binarios aprobados |
| PR-9 401→login | Toca middleware/auth (guard-block) y riesgo de loops | PR auth acotado + guard-align |
| PR-10 reports 404 | Cambio de contrato de seguridad con tests vigentes en 403 | Revisión IDOR + actualización coordinada de contratos |
| PR-11 launch | Requiere Render/Supabase/SMTP y staging | Credenciales/staging |
| PR-1 visual (monolítico) | Amplitud → mezcla y guards | Dividir en micro-PRs con tests de contrato |
| PR-4 theme-color | Guard-block `layout.tsx` + hidratación | Guard-align + enfoque client-side |

## Selected implementation in this branch
- **Implemented:** PR-5 `fix(a11y): add skip to main content link`.
- **Reason:** Mayor relación valor/seguridad y menor riesgo de mezcla: aditivo, *guard-safe* (no toca ningún archivo bloqueado por los scope guards), respeta el contrato de superficie pública (botón, sin `<a>`), el target `#main-content` ya existe, y es verificable con test de contrato + e2e de teclado.
- **Files:**
  - `frontend/src/components/public/SkipToContent.tsx` (nuevo, client control).
  - `frontend/src/components/layout/PublicLayout.tsx` (render del control antes del navbar; conserva `main#main-content` sin `tabIndex` permanente).
  - `frontend/src/app/globals.css` (sección `skip-to-content` theme-aware).
  - `test/frontend-public-skip-link-contract.test.ts` (nuevo).
  - `frontend/e2e/public-navigation-footer.spec.ts` (test de teclado).
- **Validation:** `pnpm test` (2663 pass / 0 fail), `pnpm build`, `pnpm security:public-surface` (PASS), `pnpm --dir frontend lint/typecheck/build`, e2e chromium relevante (19 pass, incl. skip-link Enter/Space). `git diff --check` limpio.
- **If none, explain why:** N/A — se implementó PR-5.

## Final recommendation
- **Execute next:** PR-2 `feat(security): rate-limit public contact endpoint` (riesgo material), como PR de seguridad dedicado con guard-align; en paralelo PR-3 (test-only).
- **Do not execute yet:** PR-7 (sin asset), PR-8 (tooling binario), PR-10 (contratos IDOR), PR-9/PR-4 (guard-align + sensibilidad), PR-1 monolítico (dividir).
- **Requires staging:** PR-11 (observabilidad/launch), verificación de PR-2 anti-abuso end-to-end.
- **Production blocker:** Ninguno duro en código; PR-2 es el más cercano a bloqueador material y PR-11 es bloqueador de "launch" formal (no de build).

## Commands referenced
`pnpm audit --prod`, `pnpm test`, `pnpm build`, `pnpm security:public-surface`, `pnpm typecheck`, `pnpm typecheck:test`, `pnpm --dir frontend lint`, `pnpm --dir frontend typecheck`, `pnpm --dir frontend build`, `pnpm --dir frontend e2e ... --project=chromium`, `git diff --check`.
