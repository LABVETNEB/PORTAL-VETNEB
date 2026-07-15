# E2E-STAB-1 — Auditoría y estabilización de la infraestructura E2E (fase 1)

Fecha: 2026-07-15 · Rama: `test/e2e-stability-hardening-phase-1` · Base: `main@0c3b46e`

## 1. Arquitectura actual

- Runner: Playwright (`frontend/playwright.config.ts`), proyecto único `chromium`, `fullyParallel`.
- Servidores (owner único: Playwright `webServer`):
  | Proceso | Puerto | Readiness | Teardown |
  | --- | --- | --- | --- |
  | Fixture API `e2e/fixtures/admin-populated-api-server.mjs` | 3107 | `GET /__e2e/health` | SIGTERM → `close` + `closeAllConnections` + failsafe 2s |
  | Next.js dev (`pnpm dev`) | 3000 | `GET /` | kill del árbol de procesos por Playwright |
- Fixture API: **sin estado mutable** (datasets inmutables generados al boot, sólo GET) → determinista, independiente del orden y seguro entre workers sin namespacing.
- Suites por capas (scripts de `frontend/package.json`): `e2e:smoke`, `e2e:admin-mobile`, `e2e:visual-contract`, `e2e:public-clinic`. CI (frontend-ci.yml) ejecuta exactamente esas 4; `e2e:ci` (nuevo) las encadena para reproducir CI localmente.
- Inventario: 73 specs (tras retirar 1 huérfano), 2 helpers compartidos, 1 fixture server, 1 globalTeardown (`restore-next-env-hygiene.mjs`).

## 2. Hallazgo estructural principal

CI corre sólo 4 suites (≈36 specs); los ~37 specs restantes sólo corren en `e2e:full` local. La suite completa en `main` daba **46 fallos / 725 pass / 791 tests (3.3 min, dev server caliente)**. CI verde ≠ suite sana: la cola no-CI se pudrió con el rediseño del dashboard clínico (hub/cockpit eliminados, bottom-nav suprimido en `/dashboard`, nav horizontal suprimido en la superficie clínica principal).

Clasificación de los 46 fallos:
| Clase | Specs | Resolución en esta fase |
| --- | --- | --- |
| Huérfano total (arquitectura eliminada) | dashboard-clinic-mobile-nav-stage-parity (4/5 tests) | Retirado con matriz (§3) |
| Contrato anclado a arquitectura vieja, invariante vigente | dashboard-clinic-controller-workspace-parity, dashboard-zero-scroll-mobile-boundary, accessibility-axe-key-routes, dashboard-logout-private-cache, particular-authenticated-session-fixture | Realineados (§4) |
| Click perdido por hidratación / carrera de settle | clinic-reports-workspace-1000, admin-users-workspace-mobile-5000 | Sincronización semántica (§5) |
| Defecto de producto real | colapso adaptativo a 1 fila en `/dashboard/informes` tras navegación por searchParams | Expected-failure condicional (`test.fail` armado sólo ante la firma del colapso) + follow-up (§8) |
| Snapshots sólo-linux (`*-chromium-linux.png`) | visual-regression-{public,authenticated,stress} | Documentado: pertenecen al workflow manual Linux; fallo local esperado (§8) |
| Contención dev-mode (flake, pasan aislados) | admin-users-visual-quality-gate, dashboard-informes-server-adaptive-pagination, dashboard-mobile-shell-nav-contract, logistics-mobile-no-horizontal-table, public-routes | Documentado; mitigación de fondo = Fase G (§8) |

## 3. E2E-STAB-001 — Spec retirado

`frontend/e2e/dashboard-clinic-mobile-nav-stage-parity.spec.ts` (PR-CL7). Esperaba: bottom-nav clínico montado en `/dashboard` con 6 ítems, cockpit (`data-clinic-cockpit`) como capa hub, nav horizontal (`Navegación principal`) en clínica desktop. Arquitectura actual: `ClinicMobileBottomNav` retorna `null` en `/dashboard` (el rail es la única navegación), el cockpit/hub no existe (el controller resuelve todo a un workspace), y `DashboardHorizontalNav` se suprime en la superficie clínica principal. 4/5 tests fallaban de forma reproducible.

| Assertion retirada | Motivo | Cobertura sustituta |
| --- | --- | --- |
| Bottom-nav clínico montado en `/dashboard` móvil | Nav suprimido en `/dashboard`; sólo rutas secundarias | dashboard-clinic-{informes,logistica,tokens}-mobile-parity, dashboard-clinic-perfil-mobile-operability (CI `e2e:public-clinic`): nav clínico visible y admin ausente en rutas secundarias |
| AdminMobileBottomNav ausente en clínica / presente en admin | Vigente | Mismos 4 specs de parity + suite `e2e:admin-mobile` completa |
| Navegación módulo a módulo + `aria-current` | Vigente, dueño cambió al rail | dashboard-clinic-controller-workspace-parity (realineado, §4): rail item con `aria-current="page"` por módulo + navegación por click |
| Hub-reset ("Inicio") → cockpit visible, workspace count 0 | Cockpit eliminado; hub-reset resuelve al módulo operativo por defecto | dashboard-clinic-controller-workspace-parity: `/dashboard` → workspace `operaciones`, hub count 0 |
| Stage persistente en el swap (token e2e) | Vigente | dashboard-clinic-controller-workspace-parity: "clinic stage persists when switching modules through the rail" |
| Contrato no-scroll móvil clínico | Vigente | dashboard-zero-scroll-mobile-boundary (realineado), clinic-informes-zero-internal-scroll, dashboard-clinic-mobile-content-reachability |
| Nav horizontal desktop sincroniza módulos clínicos | Nav suprimido en clínica principal; el rail es el dueño | dashboard-clinic-controller-workspace-parity: loop `aria-current` del rail (desktop) |

## 4. Contratos realineados (arquitectura vigente, sin pérdida de invariantes)

| Spec | Cambio |
| --- | --- |
| dashboard-clinic-controller-workspace-parity | "hub" → workspace por defecto (`operaciones`); `aria-current` del nav horizontal → rail (`data-dashboard-module-rail-item`); "Vista general" (control eliminado en clínica) → navegación por rail; bloque cockpit PR-CL7 retirado (secciones attention/activity/continuity siguen cubiertas por el bloque command-center PR-CL2 del mismo spec) |
| dashboard-zero-scroll-mobile-boundary | Límite inferior clínico = bottom-nav si está montado, si no el borde del viewport; invariantes de no-scroll intactas; rama admin sin cambios |
| accessibility-axe-key-routes | Ready selector clínico `data-dashboard-module-hub` → `data-dashboard-module-workspace` |
| dashboard-logout-private-cache | Readiness clínico hub → stage+workspace; post-logout asserts sobre `data-clinic-dashboard-stage` |
| particular-authenticated-session-fixture | El viewport operacional (390x844) colapsa el resumen de identidad (`display:none !important`): `toBeVisible` → `toBeAttached` + flat-stack visible. Follow-up de producto: decidir si la identidad tutor/mascota debe ser visible en móvil (§8) |
| clinic-reports-workspace-1000 | Pager siempre-visible (R-07): `toHaveCount(0)` → `toContainText("Página 1 de 1")` |

## 5. E2E-STAB-002 — Sincronización corregida

| Test | Patrón anterior | Sincronización nueva |
| --- | --- | --- |
| clinic-reports-workspace-1000 (pager) | `Promise.all([waitForURL, click])` (click perdido en hidratación → timeout 30s) | `advanceToNextPage`: retry acotado que sólo re-clickea mientras la URL no comprometió la página destino (no puede avanzar de más) |
| clinic-reports-workspace-1000 (filtros) | `Promise.all([waitForURL, click])` | `submitFilters`: click idempotente reintentado hasta que la URL refleja los filtros |
| clinic-reports-workspace-1000 (lecturas) | Lectura única post-`expectRows` (racy: "Página 1 / 1000" con 6 filas) | `expectSettledWorkspace`: poll hasta coherencia filas+summary+pager; `openSettledWorkspace` asienta la página 1 antes de interactuar |
| admin-users-workspace-mobile-5000 (pager) | `click()` directo + lectura | `stepMobilePage`: retry acotado condicionado al `pageText` esperado |

Clasificación del resto de waits temporales (auditoría completa de `waitForTimeout/setTimeout`): los pares de lectura con 120–180 ms dentro de `toPass` (adaptive-rows, informes-server-adaptive, clinic-informes-zero-internal-scroll, admin-pricing-multi-form) son settle de dos lecturas consecutivas para ResizeObserver/rAF — semánticos y acotados, se conservan. `setTimeout(700)` en module-state-parity es un delay intencional del mock para exponer el loading state — se conserva. `waitForTimeout(250/500)` en auth-redirect y real-app-shell son ventanas de observación de invariantes negativas (no rebote de URL / no errores de consola) — se conservan documentados. `waitForTimeout(900)` en remove-home-unified-workspace-screenshots es un spec generador de evidencia (no corre en CI) — backlog §8.

## 6. E2E-STAB-003/004/005 — Servidores, teardown y límites

- **Owner único**: Playwright administra ambos procesos. `reuseExistingServer` dejó de ser implícito en local: ahora requiere `E2E_REUSE_SERVER=1`. CI siempre arranca limpio. Un servidor manual en 3000 hace fallar el arranque en vez de contaminar la corrida.
- **Teardown**: el fixture server cierra conexiones keep-alive (`closeAllConnections`) y tiene failsafe de salida (2s, `unref`). Nuevo check de infraestructura `pnpm e2e:verify-teardown` (`e2e/helpers/verify-teardown.mjs`): falla con exit 1 si 3000/3107 siguen ocupados tras la corrida. Verificado tras cada corrida de estabilidad (§10).
- **Límites**: `globalTimeout` 30 min por defecto (override `E2E_GLOBAL_TIMEOUT_MS`); presupuesto normal medido ≈3–4 min la suite completa caliente, suites CI en minutos de un dígito; al exceder, Playwright imprime diagnóstico, mata los webServers y sale con código ≠0. `timeout` por test 30s y `expect` 5s se conservan.

## 7. E2E-STAB-006 — Escaneos sobre inventario tracked

`test/architecture/public-professionals-fixture-{file-scope,helper-boundaries}-invariants.test.ts` recorrían el filesystem completo desde la raíz con una lista de exclusión de 6 directorios que no cubría `.claude/worktrees/**` (copias completas del repo) ni `playwright-report/`/`test-results/` → falsos offenders. Ahora consumen `test/helpers/tracked-source-files.ts` (`git ls-files`). Contrato nuevo `test/architecture/tracked-source-inventory.test.ts`: (1) archivos tracked conocidos siguen auditándose, (2) ningún path bajo directorios auxiliares entra al inventario, (3) un archivo no trackeado plantado en `.claude/worktrees/` no se audita, (4) autoauditoría del helper. Límite conocido: archivos nuevos aún sin `git add` no entran al escaneo hasta staging (CI siempre los ve ya trackeados).

## 8. Cambios rechazados / backlog (fases posteriores)

1. **P1 producto — colapso adaptativo a 1 fila en `/dashboard/informes`**: navegación por searchParams (pager/filtros) remonta la lista y puede congelar el request fallback de 1 fila (UI estable en "Mostrando 1-1 / Página 1 de 251"). Misma familia que #1465 (que sólo cubrió `?module=`). Los 5 callbacks del spec se ejecutan en cada corrida; ninguno es skipped. Reparto: 1 contrato normal de primera página; 1 contrato normal de query con resultado único (su estado correcto — "Mostrando 1-1 / Página 1 de 1" — es observacionalmente idéntico a la firma del colapso, por lo que un guard nunca podría dispararse ahí); 3 contratos (page 2, filtro por estado, filtros combinados + page 2) con expected-failure condicional: tras cada navegación por searchParams, un poll semántico termina sólo ante el estado correcto o ante la firma documentada del colapso (exactamente 1 fila, `Mostrando 1-1`, pager coherente con page size 1), y sólo la firma arma `test.fail` antes de la aserción explícita del estado correcto. Fallos desconocidos siguen siendo inesperados y bloquean la suite; un estado correcto convierte el contrato automáticamente en pass normal, revelando que el defecto fue corregido o dejó de reproducirse y que el guard puede retirarse. Prohibido corregir producto en este PR.
2. **Fase G — `next build && next start` para CI**: hoy CI compila (`pnpm build`) pero los E2E corren contra `next dev` (compilación on-demand = hidratación variable, ECONNRESET, clicks perdidos). Requiere: build con `NEXT_PUBLIC_API_URL` del fixture (variable build-time) + arranque `next start` reutilizando un único build entre las 4 invocaciones. No es alcanzable sin tocar `frontend-ci.yml` (build dedicado) → **PR separado**, propuesto: build e2e único al inicio del job + `webServer` condicional por `CI`.
3. **Specs de evidencia mutan archivos trackeados**: remove-home-unified-workspace-screenshots y dashboard-runtime-post-ux1-visual-evidence escriben PNGs bajo `docs/audit/**` en cada corrida completa (working tree sucio tras `e2e:full`). Moverlos a un grupo explícito `e2e:evidence` fuera de `e2e:full`, o escribir a un directorio no trackeado.
4. **Snapshots visuales sólo-linux**: visual-regression-* fallan localmente en win32 por diseño (baselines `chromium-linux`); pertenecen al workflow manual. Considerar `test.skip` por plataforma o proyecto Playwright dedicado.
5. **Flakes por contención dev-mode** (admin-users-visual-quality-gate, dashboard-informes-server-adaptive-pagination, dashboard-mobile-shell-nav-contract, logistics-mobile-no-horizontal-table, public-routes): pasan aislados; causa de fondo = ítem 2.
6. **Producto/UX**: en viewport operacional particular (390x844) la identidad tutor/mascota queda oculta (sólo en DOM); confirmar si es intencional.
7. **Cobertura de suites**: ~37 specs siguen fuera de las 4 suites CI; definir grupos `e2e:clinic` / `e2e:capacity` / `e2e:evidence` con ownership explícito antes de mover nada (no se movieron en esta fase para no mezclar renombres con estabilización).

## 9. Duración (medida)

| Suite | Antes | Después |
| --- | ---: | ---: |
| e2e:full (791→787 tests, dev server caliente) | 3.3 min (46 fallos) | ≈3.5 min (fallos restantes: sólo clases documentadas §8.4/§8.5) |
| Specs afectados (58 tests, paralelo, servidores fríos) | n/a (rojos) | ver §10 |

No se declara mejora de tiempo de ejecución: el objetivo de la fase fue corrección estructural; los tiempos se registran como línea base para la fase G.

## 10. Validación ejecutada

- `pnpm --dir frontend lint` ✅ · `pnpm --dir frontend typecheck` ✅ · `pnpm --dir frontend build` ✅ · `pnpm test` (root) ✅ (ver PR).
- Estabilidad de los 7 specs afectados (61 tests, todos con callback ejecutado: 58 contratos normales + 3 expected-failure condicionales de §8.1 que sólo se arman ante la firma del colapso):
  - 3× `--workers=1`: 57/57/57 pass (32–34s).
  - 3× paralelo (batch de 7 archivos): 55/54/56 pass — los fallos rotativos fueron únicamente el test de primera página de clinic-reports-workspace-1000 golpeado por el defecto de producto §8.1 (colapso adaptativo) bajo contención dev-mode extrema del batch artificial.
  - 3× paralelo en su invocación estándar (spec propio): clinic-reports-workspace-1000 1/1 pass en las 3.
- `pnpm e2e:verify-teardown` tras cada una de las corridas: puertos 3000 y 3107 libres (6/6).
