# DASHBOARD_STAGE_MODULE · una autoridad de navegación por dashboard

## Estado base

`main@00c7ef1c` (#1833 sobre #1830), Next 16.3.8, React 19.3. Frontend-only: no toca backend, API, auth, sesiones, cookies, permisos, catálogos, rutas, geometría, dependencias ni workflows.

## Síntomas

Con un servidor lento (el caso de las grabaciones del 2026-10-07), reproducido sobre HEAD con clicks reales y payloads `_rsc` demorados 3 s:

1. **Menú ≠ workspace.** Si se elige A y luego B antes de que A comitee, el stage muestra B pero el ítem `aria-current` vuelve a A durante todo el render de B. Pasa en la banda lateral, la barra móvil y el título móvil.
2. **Historial con entradas obsoletas.** Según el timing, A→B deja `[origen, A, B]` y Back aterriza en A, un módulo que el usuario abandonó. Otras veces deja `[origen, B]`.
3. **Clic aparentemente ignorado.** «Abrir módulo completo» no cambia nada durante todo el render de la ruta completa.

## Auditoría y causas raíz

Cadena del click: `PublicRouteControl.onClick` → bus `request{Admin,Clinic}ModuleActivate` → owner del stage (`AdminDashboardWorkspaceController`, `ClinicDashboardWorkspaceController`, `ClinicFullRouteModuleStage`) → `router.push` (transición) → commit de la URL → `useSearchParams`.

- **Next no descarta navegaciones superadas de `?module=`.** Con logpoints CDP sobre el chunk de producción, cada `navigate` resuelve su acción en ~15 ms (ruta conocida, datos diferidos), así que `actionQueue.pending` nunca la retiene ni la marca `discarded`. React decide, por timing, si pliega A en el commit de B o comitea A primero. Esto último se capturó con stack: `pushState` de A desde la fase de commit.
- **Cada estado comiteado escribe una entrada de historial.** En el `HistoryUpdater` de `app-router.js` es `pushState` si `pendingPush` (`navigateType === 'push'`), `replaceState` si no. Dos pushes en vuelo dejan `[A, B]` o `[B]` según el timing; ese es el síntoma 2. Reemplazar cuando hay algo en vuelo no es seguro: si React pliega, el único estado comiteado es el replace y se pisa la entrada del origen.
- **Tres fuentes de verdad.** Los owners clasificaban el commit superado y mantenían B. La banda (`useLiveModule`) y la barra (estado local + observers) tenían su propia copia del intent y la descartaban en cada commit. El título móvil leía sólo la URL (síntoma 1).
- **Navegación entre páginas sin estado pendiente.** «Abrir módulo completo» era un `router.push` plano a otra página (síntoma 3).

PR #1833 asumía que Next descarta A al despachar B. Eso sólo vale para rutas desconocidas. Los specs de #1830/#1833 retenían todos los payloads y aseveraban el estado final con `expect` reintentante, así que no veían ni la regresión transitoria ni el historial.

## Fix

1. **Owner = autoridad.** `lib/dashboard/navigation/stageModule.ts` (sin imports) y `components/dashboard/useStageModule.ts`. El owner publica el módulo que muestra; la banda, la barra y el título móvil lo renderizan, y la URL sólo se lee sin owner montado.
2. **Single flight.**
   - Un request que llega mientras la navegación de módulo previa del owner sigue en vuelo es **reclamado**: `request*ModuleActivate` devuelve `true` y el productor no navega. Productores: drawer, rail, barra, overflow, kebab, búsqueda del app bar y accesos de Resumen.
   - Cuando la navegación en vuelo comitea (ya superada), el owner hace **un** `router.replace` al último módulo: clínica con su reconcile existente, admin con el mismo reconcile nuevo.
   - Sólo hay una navegación de módulo en vuelo y el historial queda siempre `[origen, último]`.
   - El stage de ruta completa nunca reclama: sus destinos salen de la ruta y Next sí descarta una navegación entre páginas pendiente.
   - Admin adopta la regla de intent de `clinicNavigationState`: con algo en vuelo, un intent nuevo siempre se registra. Antes A→B→A borraba el intent y el commit tardío de B se obedecía como externo.
   - **Volver al módulo comiteado con B en vuelo (A→B→A).** Reemplazar la entrada de B dejaba `[A, A]`, y el Back siguiente no cambiaba nada. Si el burst empezó con un push (`pushedFrom`), el owner vuelve a la entrada de A con `history.back()`: queda `[A]`, sin duplicado, y B queda como entrada Forward (fue visitado). Un burst que empezó con replace (restore de clínica) sigue reconciliando con replace.
3. **`FullModuleRouteControl`.** «Abrir módulo completo» hace el push dentro de `useTransition` y muestra `aria-busy` y «Abriendo módulo…» hasta que la ruta completa comitea.
4. Se retiran `observeAdminModuleActivate` y `observeClinicModuleActivate`, que quedaron sin consumidores.

Sin timers, reloads, remounts ni `router.refresh()`.

## Validaciones

- **E2E RED → GREEN** (`dashboard-real-pointer-navigation.spec.ts`, clicks reales, payloads retenidos y continuados, nunca stubbeados; HEAD FAILED 20/20, fix PASSED). Además de los grupos de la tabla, A→B→A: 4/4 FAILED en HEAD, PASSED 20/20 con el fix (×5, 8 workers):

  | Grupo | HEAD | Fix |
  |---|---|---|
  | superseded commit | FAILED 6/6 (`aria-current` = A) | PASSED 6/6 |
  | single flight | FAILED 6/6 (segundo push con A en vuelo) | PASSED 6/6, ×3: un payload por vez, `history.length +1`, Back al origen, Forward a B |
  | full-module control | FAILED 4/4 (sin `aria-busy`) | PASSED 4/4, ×3 |

- **Unit / contratos** (`frontend-dashboard-lateral-navigation`):
  - claim del bus: HEAD devuelve `undefined`, el fix `true`;
  - productores y owners;
  - store;
  - control de módulo completo: 18/18 PASSED.

  `frontend-dashboard-admin`: 16/16 PASSED.
- **Latencia real** (servidor 3 s):
  - historial: HEAD `push tokens, push logistica` y Back → tokens; fix `push tokens, replace logistica` y Back → origen;
  - A→B→C rápido, Back y Forward coherentes;
  - las dos grabaciones reproducidas paso a paso en 1600, 1024 y 390 px: contenido correcto visible ≤150 ms tras cada click y menú coincidente.
- **Spec live-sync:** 54/54 PASSED. Se realineó un único conteo: un activation reclamado y abandonado por Back tiene 0 payloads (antes 1), y la garantía anti-replay queda más estricta.
- **Gates:**
  - `pnpm --dir frontend lint`, `typecheck`, `build`, `security:public-surface`, `typecheck:test`: PASSED.
  - `pnpm test` sin stage: FAILED (47). Detalle en la sección de production runner.
  - `e2e:ci` y E2E afectados: PASSED en modo production runner de CI (ver abajo).

## Respuesta RSC fallida

Si el payload en vuelo falla (error de red o 500), Next hace una navegación de documento a la URL de ese payload. El usuario termina en A (URL, menú y stage coherentes) y la última elección B se pierde. En HEAD el resultado es idéntico, aunque HEAD sí envía el request de B.

Diagnóstico sobre Next 16.3.8:

- `fetchMissingDynamicData` (`router-reducer/ppr-navigations.js`) recibe la URL fallida de `fetchServerResponse` y devuelve `exitStatus: 2`. Eso es una navegación de documento a esa misma URL.
- Los fallos que la disparan: el `catch` de red de `fetch-server-response.js` y las respuestas no-RSC o `!res.ok`.
- No hay callback, evento ni opción pública para redirigirla.
- `experimental.useOffline` sólo reintenta errores offline (no 500).
- `experimental.appNavFailHandling` sólo cubre errores no capturados y navega a `__pendingUrl` (con single flight, A).

Conservar B exige transportar el intent a través del reload (storage) o cambiar configuración de Next (R2). Ambas requieren autorización y quedan propuestas, no implementadas.

## Validación en modo production runner de CI

El fixture local sólo es alcanzable desde el render de servidor con `CI=true` (`isE2eLocalFixtureOriginAllowed`, fail-closed). Las corridas locales sin esa variable fallaban en todo lo que depende de datos de servidor, incluido el redirect por sesión expirada. Con el mecanismo previsto (`CI=true`, `VETNEB_E2E_PRODUCTION_RUNNER=1`; Playwright levanta fixture y `next start`):

- `e2e:ci`: PASSED (exit 0; 1236 passed, 1 skipped).
- E2E afectados (17 specs + `dashboard-session-boundary-unauthorized`): PASSED (exit 0; 477 passed).

Es la configuración del runner de CI en esta máquina Windows; no sustituye a GitHub CI en Linux.

Sin `CI=true`, la misma máquina, los mismos comandos y las fuentes de HEAD dan, para referencia:

| Suite | Fix | HEAD | Sólo con el fix |
|---|---|---|---|
| E2E afectados (17 specs) | 449/24 | 417/56 | 0 |
| `e2e:ci` | 1148/88 | 1116/120 | 0 |

`pnpm test`:

- Árbol completo de HEAD: 4850/1. El fallo es `e2e-global-03b`, BLOCKED sin DB.
- Fix sin stage: 47 fallos. 46 son archivos nuevos sin trackear (306/306 con stage simulado) y 1 es el mismo `03b`.

## Decisión de arquitectura

No requiere ADR/RFC:

- El cambio no altera fronteras: todo queda en `frontend/` y no toca API, modelo de datos, composición de servicios, auth ni workflows.
- Los owners del stage ya existían. El store y el claim del bus siguen el patrón de señales entre componentes del repo (`admin-hub-reset.ts`, `admin-access-error.ts`).
- El gate de Architecture Decision de `pr-governance` se activa con `drizzle/`, workflows o `server/`, y no aplica.
- AGENTS §11 pide registrar el cambio en `docs/implementation`, que es este documento.

## Riesgo residual

- Un burst de clicks con una navegación en vuelo produce una sola entrada de historial: los módulos intermedios del burst no son destinos de Back.
- A→B→A en vuelo deja B como entrada Forward.
- En Back/Forward la URL se actualiza 12–27 ms antes que el menú; el menú se mueve junto con el stage, que en HEAD ya iba un render detrás.
- Con clicks continuos sobre un servidor lento, la URL converge una navegación detrás de la otra: el último módulo comitea después de la navegación en vuelo. Stage y menú cambian igual en el click.
- `Cerrar sesión` espera la respuesta del backend antes de redirigir. Es superficie de auth y queda fuera de este scope.

## Estado final

Implementación local, sin commit. Escrituras Git/GitHub: manuales (Nico).
