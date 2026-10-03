# C03 · CollectionState: estados vacío, error y carga unificados

## Base y alcance

Base: `main` / `origin/main` en `c3431b26d9965716dd2b302ccc66454a8620b51b` (C02 fusionado por #1815). Rama local `feat/dashboard-c03-collection-states`, sin worktree. C03 es el tercer slot del Programa C (§50) y depende de C01. Unifica la presentación, la API y la accesibilidad de los estados vacío, error y carga de colección en una primitiva única; no inicia C04–C05 ni migra módulos (C17+).

C03 no cambia fetch, endpoints, query params, semántica de reintento, handlers, mapeo de errores, condiciones de carga, condiciones de vacío, permisos, rutas, orden, selección, paginación, `limit`, `offset` ni altura de fila.

## Censo previo

Fuente: código ejecutable (`git grep` sobre `frontend/src`, `frontend/e2e` y `test`), con el documento rector como hipótesis.

| Componente | Sitios de render | Consumidores | Props usadas | Semántica | Retry |
|---|---|---|---|---|---|
| `EmptyState` | 15 | `ClinicCommandCenter`, `ClinicInformesWorkspaceSummary`, `ClinicLogisticaWorkspaceSummary`, `AdminClinicsManagementCard`, `AdminFailedLoginAlertsReadOnlyCard`, `InformesReportsList`, `LogisticsCommandCenter`, `ClinicParticularTokensCard` | `title`, `description`, `icon`, `size="sm"`, `className` | sin rol; `h2`; icono `aria-hidden` | — |
| `ErrorState` | 1 | `InformesReportsList` | `title`, `message` | `role="alert"`; `h2` | ningún consumidor pasa `onRetry` |
| `LoadingState` | 3 | `AdminClinicsManagementCard` (tabla y lista móvil), `AdminFailedLoginAlertsReadOnlyCard` | `variant="table"`, `compact`, `rows={3}`, `className` | `role="status"`, `aria-live="polite"`, `aria-busy="true"`, etiqueta `sr-only` | — |

Ningún consumidor usa `eyebrow`, `action`, `secondaryAction`, `supportText`, `tone` ni `onRetry`; la API se conserva completa igualmente. Las variantes de carga `cards`, `detail`, `timeline` y `list` no tienen consumidores y se conservan.

Estados manuales fuera de los tres componentes (no migrados, C17–C22): `role="alert"` en 33 archivos, `aria-busy` en 20, textos «Cargando» en 16 y «Reintentar» en 10 (banners `clinical-alert-error`, filas de tabla con texto plano, botones `Actualizar` con `aria-busy`, banners del command center con `router.refresh()`).

Tests previos: guards de fuente en `frontend-dashboard-state-polish` y `frontend-dashboard-private-shell-foundation` (literales y oráculo JSX TEST-GLOBAL-07 del retry), censos de consumidores en `frontend-dashboard-empty-states`, `frontend-dashboard-clinic-command-center`, `frontend-dashboard-logistics-hub`, `frontend-admin-failed-login-alerts-card`; E2E indirecto en `dashboard-clinic-module-state-parity` y `clinic-reports-workspace-1000`.

## Diseño

**Owner.** `CollectionState` es la única implementación. Vive en el módulo existente `components/dashboard/EmptyState.tsx` —igual que C01 vive en `ui/table.tsx` y C02 en `DashboardPager.tsx`— porque el lector canónico de la suite rechaza archivos no versionados, y se publica por `features/dashboard/presentation/surfaces`. La carpeta destino `presentation/collection/` (§47.1) no se crea en C03. El módulo owner no declara `"use client"`, de modo que los consumidores de servidor de `EmptyState` siguen renderizando en el servidor.

**API.** Unión discriminada por `variant`; cada rama acepta sólo sus props (la comprobación de props excedentes de TypeScript rechaza mezclas):

- `variant: "empty"` — `title` obligatorio, `description?`, `icon?` (por defecto `Inbox`), `eyebrow?`, `action?`, `secondaryAction?`, `size?: "sm" | "md"` (por defecto `md`), `className?`.
- `variant: "error"` — `message` obligatorio, `title?` (por defecto «No se pudo completar la acción»; cadena vacía oculta el encabezado), `supportText?`, `tone?: "warning" | "critical"` (por defecto `critical`), `onRetry?`, `className?`.
- `variant: "loading"` — `skeleton?: "table" | "cards" | "detail" | "timeline" | "list"` (por defecto `cards`), `rows?` (por defecto 3; `floor`, mínimo 1, no finito → 1), `label?` (por defecto «Cargando...»), `compact?`, `className?`.

Tipos publicados: `CollectionStateProps`, `CollectionStateEmptyProps`, `CollectionStateErrorProps`, `CollectionStateLoadingProps`, `CollectionStateSkeleton`. Se evita el nombre `CollectionEmptyState` porque los cercos C01/C02 lo reservan.

**Adaptadores.** `EmptyState` (`<CollectionState {...props} variant="empty" />`, en el mismo módulo), `ErrorState` (`<CollectionState {...props} variant="error" />`, conserva `"use client"`) y `LoadingState` (`<CollectionState {...props} variant="loading" skeleton={variant} />`) conservan nombres, rutas de import y tipos de props (`EmptyStateProps`, `ErrorStateProps`, `LoadingStateProps`); no renderizan markup propio. Los 19 sitios de render no cambian.

**Marcador.** La raíz añade `data-collection-state="empty|error|loading"`, único atributo nuevo del DOM, para que los contratos E2E prueben el owner en runtime.

**Duplicación eliminada.** Las cinco raíces de carga repetían `role`, `aria-live`, `aria-busy` y la etiqueta `sr-only`; ahora una sola raíz las declara y una tabla por esqueleto aporta sus clases (`base`, `regular`, `compact`). El cuerpo de cada esqueleto se conserva idéntico. Sin CSS nuevo: el conjunto de clases de cada nodo es el anterior.

**Fuera de la primitiva.** Sin fetch, endpoints, capacidad, `limit`/`offset`, orden, selección, hooks, estado, memoización, observadores, temporizadores ni estilos inline. El retry sólo invoca el callback del consumidor.

## Accesibilidad

| Variante | Rol | Live region | Encabezado | Acción |
|---|---|---|---|---|
| empty | ninguno (no disruptivo) | ninguna | `h2` | slots `action`/`secondaryAction` del consumidor |
| error | `alert` | implícita en `alert`; sin `aria-live` adicional | `h2` (oculto con título vacío) | `Reintentar`, `type="button"`, `focus-visible:ring-2`, sólo con `onRetry` |
| loading | `status` | `aria-live="polite"`, `aria-busy="true"` | ninguno; etiqueta `sr-only` | — |

No se añadió `role="alert"` a vacío ni a carga, ni `aria-live="assertive"`.

**Auditoría de encabezados.** El `h2` fijo no siempre encaja con el consumidor: en `ClinicCommandCenter`, `LogisticsCommandCenter`, `AdminClinicsManagementCard` y `AdminFailedLoginAlertsReadOnlyCard` el estado vive bajo un `CardTitle` (`h3`), y en `InformesReportsList` es hermano del `h2` «Lista de informes». Cambiar el nivel altera la semántica observable de 19 sitios y exige una API de nivel que hoy ningún consumidor usaría; C03 conserva `h2` sin degradarlo a `div` y deja la corrección a la migración de cada módulo (C17–C22), que puede añadir un nivel tipado explícito cuando tenga consumidor.

## Geometría

Sin cambios de CSS, tokens, reservas, hooks de capacidad, `limit` u `offset`. El DOM de cada estado es idéntico salvo el marcador: el alto, el padding, el borde y el `min-height` (`min-h-[8rem]`/`min-h-[11rem]`, `min-h-10` por fila de esqueleto) no cambian, por lo que la región de colección, la reserva del pager y el canvas adaptativo no se desplazan. `CollectionHeader`, `CollectionPager` y sus reservas no se tocan.

## Verificación

- Paridad legacy (script de sesión, fuera del repo): las fuentes de `c3431b26` frente a los adaptadores, ejecutadas contra un stub de React. `EmptyState` 432/432, `ErrorState` 108/108 y `LoadingState` 864/864 combinaciones idénticas excluyendo el marcador (incluye `rows` 0, negativo, fraccional, `NaN` e `Infinity`, etiqueta vacía, título vacío y las cinco variantes); marcador presente en la raíz en 1 404/1 404.
- Unit `frontend-dashboard-state-polish` (runtime: ejecuta `EmptyState.tsx`, `ErrorState.tsx` y `LoadingState.tsx`): 5 casos C03 — vacío, error, carga, paridad de adaptadores y mutaciones en memoria. Las siete mutaciones (quitar `role="alert"`, desconectar `onClick={onRetry}`, quitar `aria-live`, quitar `aria-busy`, fijar la etiqueta, markup propio en `ErrorState`, perder `skeleton={variant}` en `LoadingState`) invierten exactamente su bandera del contrato.
- Guards de fuente realineados al owner sin debilitar: el oráculo JSX TEST-GLOBAL-07 del retry (incluida su mutación `!onRetry`) apunta a `renderErrorState`; los literales de implementación de carga y error leen el owner y los adaptadores prueban su delegación y la conservación de `"use client"`.
- Guard de arquitectura B11/B15/B16/C01/C02/C03: 3 casos C03 (owner único y adaptadores sin markup, primitiva sólo de presentación, censo de consumidores y cerco C04+/C05). Los cercos C01 y C02 no se modificaron.
- E2E `dashboard-b11-workspace-header.spec.ts`: PASSED 24/24, incluye 4 casos C03 sobre Informes (ruta completa) a 1366 × 768 y 390 × 844. Error (sesión por defecto, 404 del entorno E2E → error SSR): un único `data-collection-state="error"` con `role="alert"`, `h2`, mensaje y sin `Reintentar` (el consumidor no pasa `onRetry`). Vacío (sesión poblada, consulta sin coincidencias): un único `data-collection-state="empty"` sin rol ni live region. En ambos el estado queda dentro del panel, sin recorte ni scroll anidado en su subárbol, sin otro estado visible y con scroll externo cero (A08).
- A02: PASSED, 21/21 superficies (273 combinaciones), baseline sin cambios.
- A03: PASSED, 16/16, 195/195 registros primarios y 234/234 hojas; fixture sin cambios, sin recaptura; `limit` invariante.
- A05: PASSED, 15/15. A08: PASSED, 21/21 superficies sobre 13 viewports.
- Contratos zero-scroll de AGENTS §10 y causales de los consumidores de estados (`dashboard-internal-no-scroll-contract`, `dashboard-real-app-shell-no-scroll-contract`, `dashboard-zero-scroll-mobile-boundary`, `dashboard-clinic-module-state-parity`, `clinic-informes-zero-internal-scroll`, `clinic-reports-workspace-1000`, `admin-mobile-core-modules-no-scroll`, `admin-mobile-ops-modules-no-scroll`): PASSED 103/103.
- Guards `test/architecture/**` + `test/unit/ui/**`: PASSED 2449/2450, 1 omitido condicional preexistente.
- Frontend lint, typecheck y build, `pnpm typecheck:test`, `pnpm security:public-surface` y `git diff --check`: PASSED.
- No seleccionados: `pnpm validate:local` y `pnpm test` completo (gates de backend; C03 no toca `server/`), cohorte visual Linux (BLOCKED en Win32).
- Carga: ningún consumidor real la expone de forma determinista (ver riesgos); su contrato se prueba en runtime y no se fabricó un E2E con esperas artificiales.

## Riesgos residuales

- **P2 · Carga inalcanzable en Clínicas e Intentos fallidos.** Ambos llaman `startTransition(() => { void (async () => { … })(); })`: la transición termina antes de la petición, `isPending` no cubre la carga y, con filas vacías, se muestra `EmptyState` durante el fetch en lugar de `LoadingState`. Es una condición de carga del consumidor, fuera de C03; corregirla exige su propio PR.
- **P3 · Alerta anidada en Informes.** `InformesReportsList` envuelve `ErrorState` (ya `role="alert"`) en otro `div role="alert"`. Preexistente; se corrige en la migración del módulo.
- **P3 · Niveles de encabezado** (ver Accesibilidad).
- El módulo owner importa ahora `Button` y `Skeleton` también para consumidores que sólo usan `EmptyState`; no hay dependencias nuevas.

## Rollback lógico

Restaurar `EmptyState.tsx`, `ErrorState.tsx` y `LoadingState.tsx` a `c3431b26`, quitar el export de `surfaces`, los casos C03 de `frontend-dashboard-state-polish` y del guard de arquitectura, la realineación de los guards de fuente, el bloque C03 del spec B11 y su descripción en el catálogo. No requiere cambios de datos ni de backend.

## No alcance

Sin backend, API, auth, DB, migraciones, dependencias, lockfile, workflows, PWA ni producción. Sin C04 (orden por columna), C05 (fila de 40 px), C06+ (selección, toolbar contextual, menús, acciones masivas), A06/A07 ni migración de módulos. Los estados manuales, los niveles de encabezado, la alerta anidada y la condición de carga de los consumidores quedan para C17–C22 o para PRs propios.
