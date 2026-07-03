# R-03 — Admin Reports workflow server adaptive pagination

## PR

`feat(admin): adapt reports workflow server pagination to viewport`

Quinto módulo Admin **servidor** (`limit`/`offset`, familia C) migrado a cardinalidad
adaptativa Zero-Scroll, ejecutando **R-03** del roadmap rector
(`docs/audit/final-global-vetneb-50-60-pr-roadmap.md`, Fase 1) con la política de
PR-SRV-0 y la plantilla probada en Sesiones (#1221), Usuarios/Roles (#1222), R-01
Alertas login (#1263) y R-02 Clínicas (#1264).

Es el módulo con el **peor acoplamiento** del subgrupo 2 de PR-SRV-0: a diferencia de
Clínicas (un solo pipeline con `effectivePageSize` por `matchMedia`), Reports tenía **dos
pipelines de fetch independientes** (desktop + mobile) con `limit`/`offset` divergentes.

## Base

- Rama de trabajo: `feat/admin-reports-workflow-server-adaptive-pagination`.
- Base: `main @ 298a605 feat(admin): adapt clinics management server pagination to viewport (#1264)`.
- Fecha: 2026-07-03.

## Documentos usados

1. `docs/audit/final-global-vetneb-50-60-pr-roadmap.md` — R-03, Fase 1, reglas §5/§6/§8.
2. `docs/implementation/server-adaptive-pagination-strategy.md` (PR-SRV-0) — módulo #4
   (Informes workflow): decisión **HY cap 36 + unificar `limit`**, política de offset
   (§6, incluida la regla 2 para endpoints **sin `total`**), anti-race (§7), límites (§8).
3. `docs/implementation/admin-sessions-server-adaptive-pagination.md` (SRV-1) — plantilla
   de medición/anti-race/recompute.
4. `docs/implementation/admin-users-roles-server-adaptive-pagination.md` (SRV-2) — trato
   de contratos legacy de N filas (piso desktop `minItems`) — **replicado aquí**.
5. `docs/implementation/admin-failed-login-alerts-server-adaptive-pagination.md` (R-01) —
   patrón de filtros/búsqueda server-side.
6. `docs/implementation/admin-clinics-management-server-adaptive-pagination.md` (R-02) —
   módulo mm-cardinalidad + fix de settle en CI (patrón de conteo asentado en e2e).

## Skills / modelo / esfuerzo

| Rol | Valor |
|---|---|
| Principal | `vetneb-production-web-optimization-engineer` |
| Complementaria | `vetneb-briefing-planificacion-diseno-desarrollo-pruebas` |
| Complementaria | `vetneb-web-end-to-end-global` |
| Guardrail | `vetneb-security-production-invariants` |
| Admin operativo | `vetneb-admin-dashboard-operational-actions` |
| Modelo | Claude Opus 4.8 (`claude-opus-4-8`) |
| Esfuerzo | Alto / máximo |

El ZIP/carpeta de skills **no** fue copiado, descomprimido, editado, versionado ni
ejecutado dentro de `C:\PORTAL-VETNEB`.

## Contrato anterior

Runtime único (`AdminReportsCard`, sin módulo mobile separado) pero con **dos pipelines
de fetch reales y divergentes**:

- **Desktop:** estado `reports`/`page`/`hasMore`/`isLoading`, `loadReports(nextPage)` con
  `getAdminReportWorkflow({ limit: PAGE_SIZE(9), offset: nextPage * PAGE_SIZE })`.
- **Mobile:** estado `mobileReports`/`mobilePage`/`mobileHasMore`/`isMobileLoading`,
  `loadMobileReports(nextPage)` con `getAdminReportWorkflow({ limit: MOBILE_PAGE_SIZE(10),
  offset: nextPage * MOBILE_PAGE_SIZE })`.
- **`isMobileViewport`** resuelto por `window.matchMedia("(max-width: 767px)")` decidía qué
  pipeline se hidrataba/mostraba. Cuando mobile estaba activo, **ambos** pipelines corrían
  → **doble fetch** por el mismo dato.
- Modelo `page`; filtros **client-side** (`matchesAdminReportFilters` sobre la página ya
  cargada). El endpoint expone `pagination.hasMore`, **no `total`**.

## Contrato nuevo

- **Runtime único colapsado:** una sola fuente de datos (`reports`), un solo `offset`, un
  solo `loadReports`. El segundo pipeline mobile (`mobileReports`, `loadMobileReports`,
  `isMobileViewport`, `mobilePage`, `mobileHasMore`, `isMobileLoading`,
  `filteredMobileReports`) queda **eliminado** → sin doble fetch, sin `limit`/`offset`
  divergentes. Sigue renderizando dos presentaciones responsive (tabla desktop
  `hidden md:block` + lista mobile `md:hidden`, en ese orden en el DOM).
- `REPORTS_FALLBACK_ROWS = 9` (ex `PAGE_SIZE`) sólo como fallback antes de la primera
  medición y como **piso desktop**.
- `REPORTS_SUPERSET_CAP = 36` como techo híbrido (`maxItems` del hook), igual a
  Usuarios/Roles y Clínicas.
- `useAdaptiveItemsPerPage` mide el **contenedor de filas visible** (región de tabla
  desktop o lista mobile, elegido por altura medida, no por `matchMedia`) y una **fila
  real** (`ref` en la primera fila/artículo); el header de la tabla desktop se descuenta
  (`REPORTS_TABLE_HEADER_PX = 28`, el `[&_th]:h-7` existente).
- `effectiveLimit = rowsPerPage`; `getAdminReportWorkflow({ limit: query.limit, offset:
  query.offset })`.
- `page`/`hasPrev`/`hasNext`/rango usan `effectiveLimit` y `offset`; `hasNext = hasMore`
  (heurística de página llena; el endpoint no expone `total`, ver §6 regla 2 de PR-SRV-0).
- Filtros client-side (idénticos): aplicar/limpiar resetea `offset` a 0; la cardinalidad
  (resize/zoom) nunca toca los filtros.
- Sin `matchMedia`, sin `MOBILE_PAGE_SIZE`, sin `isMobileViewport`, sin
  `loadMobileReports`, sin `filteredMobileReports`.

## Divergencia anterior mobile/desktop y cómo se unificó `limit`/`offset`

| Aspecto | Antes (desktop / mobile) | Ahora (unificado) |
|---|---|---|
| Constante `limit` | `PAGE_SIZE=9` / `MOBILE_PAGE_SIZE=10` | `effectiveLimit = rowsPerPage` medido, cap 36 |
| Estado de página | `page` / `mobilePage` | `offset` único |
| Fetch | `loadReports` / `loadMobileReports` | `loadReports` único (deriva de `query = {limit, offset}`) |
| Fuente de cardinalidad | `matchMedia` elige pipeline | medición del contenedor visible |
| Nº de fetch en mobile | 2 (desktop + mobile) | 1 |

La unificación consiste en borrar el pipeline mobile completo y hacer que la lista mobile
consuma el **mismo** `reports`/`offset`/`effectiveLimit` que la tabla desktop, con el hook
midiendo la región realmente visible en cada viewport.

## Estrategia HY cap 36

Estrategia **HY** (híbrida) de PR-SRV-0 §5/§8, la asignada a Informes workflow en el
inventario: se pide **al menos** `rowsPerPage`, con **cap 36**. El hook clampa
`rowsPerPage` a `[minItems, 36]`, por lo que `effectiveLimit = rowsPerPage`. El re-fetch
sólo ocurre cuando cambia `effectiveLimit` (medición distinta) o `offset` (paginación /
filtros / upload); si `rowsPerPage` no cambió, el `query` memoizado no cambia y no hay
request.

## Evidencia de `matchMedia` / `MOBILE_PAGE_SIZE` / segundo pipeline eliminado

`grep` sobre `AdminReportsCard.tsx` tras la migración: `mobileReports`, `mobilePage`,
`mobileHasMore`, `isMobileLoading`, `isMobileViewport`, `filteredMobileReports`,
`MOBILE_PAGE_SIZE`, `PAGE_SIZE`, `setPage`, `loadMobileReports`, `window.matchMedia`
**no aparecen como código** — sólo subsisten menciones en comentarios que documentan la
migración. Fijado por los tests source-contract:

- `admin-reports-enterprise-density.test.ts`: `REPORTS_FALLBACK_ROWS`/`REPORTS_SUPERSET_CAP`
  presentes; `PAGE_SIZE`/`MOBILE_PAGE_SIZE`/`window.matchMedia`/`isMobileViewport`/
  `loadMobileReports`/`filteredMobileReports` ausentes; `useAdaptiveItemsPerPage`,
  `effectiveLimit = rowsPerPage`, request-id y recompute de offset presentes.
- `admin-mobile-core-pager-canonical-layout.test.ts`: pager mobile `Pág. {page}`; page-size
  mobile medido (no constante); pipeline único.

## Cómo se mide `rowsPerPage`

Igual que SRV-1/SRV-2/R-01/R-02: refs de estado (`setDesktopBodyNode`/`setMobileBodyNode`
+ `setDesktopRowNode`/`setMobileRowNode`), `ResizeObserver` agenda con
`requestAnimationFrame`, la región visible se elige por altura medida (mobile primero,
desktop después), la fila real medida reemplaza el fallback
(`REPORTS_ROW_HEIGHT_FALLBACK_PX = 36`), y el header de tabla desktop se descuenta.

**Piso desktop (excepción documentada, patrón SRV-2):** Reports está pinneado por el
contrato App Shell `expectNinePopulatedRows` (`dashboard-real-app-shell-no-scroll-
contract.spec.ts`, 1440×900 y 1366×768). Un `safetyGap` positivo podría bajar el fit
medido a ocho y romper ese contrato, así que el contexto desktop —detectado por el header
descontado (`isDesktopMeasurement = measurement.headerHeightPx > 0`)— mantiene
`minItems = REPORTS_FALLBACK_ROWS (9)`, mientras la lista mobile mantiene `minItems = 1`
para poder encoger en teléfonos cortos. **Clínicas (R-02) usa piso 1** porque no tiene ese
contrato; **Reports lo replica de Usuarios/Roles (SRV-2)** porque sí lo tiene.

## Cómo se recomputa `offset`

PR-SRV-0 §6, con la **regla 2** para endpoints sin `total`:

```
nextOffset = Math.max(0, Math.floor(currentOffset / effectiveLimit) * effectiveLimit);
```

No hay clamp contra `total` porque el endpoint `report-workflow` no lo expone: sólo se
clampa `offset ≥ 0` y el avance de página lo gobierna `hasMore` (página llena). Nunca se
salta a "última página" ni se computa `pageCount`. El recompute sólo corre cuando cambia
`effectiveLimit` (`previousLimitRef`); la búsqueda/filtros resetean `offset` a 0 aparte.

## Cómo se evita la carrera

- **Request id** (`latestRequestRef`): cada `loadReports()` incrementa el id; una respuesta
  cuyo id ya no es el vigente se descarta (éxito y error), y `setIsLoading(false)` sólo
  corre para la respuesta vigente. Esto evita que una respuesta con `L0` pise el estado con
  `L1`.
- **Debounce de medición**: `ResizeObserver` + `requestAnimationFrame` +
  `measurementsEqual`; el hook global sólo cambia `rowsPerPage` si el valor derivado
  difiere. El resize/zoom continuo no genera ráfaga.
- **Sin doble fetch**: al eliminar el pipeline mobile, un viewport mobile ya no dispara dos
  cargas. `loadReports()` deriva del `query` memoizado (`{limit, offset}`); un solo efecto
  `[loadReports]` reacciona a cambios de `query`.
- **Fallback estable**: sin contenedor medido, el hook devuelve el fallback (9) y no
  re-fetchea por cardinalidad; loading/empty tienen geometría estable.

## Cómo filtros server-side (client-side aquí) resetean offset

Los filtros de Reports son **client-side** (`matchesAdminReportFilters` sobre la página
cargada) — no se convierten a server-side (eso tocaría backend/API, fuera de scope). El
comportamiento previo de "aplicar/limpiar filtro vuelve a la primera página" se preserva:
`applyAdvancedFilters` y `clearAdvancedFilters` hacen `setOffset(0)` (antes `setPage(0)` +
`setMobilePage(0)`). Una cardinalidad (resize/zoom) nunca toca los filtros ni el offset por
filtro.

## Cómo se preservó `AdminReportsUploadPanel` sin tocarlo

`AdminReportsUploadPanel.tsx` **no se modificó**. Sigue montándose igual
(`<AdminReportsUploadPanel open={isUploadOpen} onOpenChange={setIsUploadOpen}
onUploaded={handleUploaded} />`). El único punto de contacto, `handleUploaded`, se simplificó
al pipeline único: tras subir un informe vuelve a la primera página sin doble fetch (si
`offset === 0` recarga directo; si no, `setOffset(0)` deja que el efecto `[loadReports]`
dispare el único fetch). El panel de subida y su contrato de API quedan intactos.

## Sin módulo mobile separado

`AdminReportsCard` nunca tuvo un archivo `AdminMobileReportsModule` independiente — la
dualidad vivía **dentro** del componente como un segundo pipeline de estado/fetch. R-03 no
crea ni elimina ningún shim de archivo; colapsa el segundo pipeline dentro del mismo
componente. Selectores e2e preservados: `data-admin-mobile-core-module="reports"`,
`data-admin-reports-mobile-list="true"`, `data-admin-mobile-core-item="true"`,
`data-admin-mobile-core-pager="true"`, `data-admin-reports-toolbar="true"`,
`aria-label="Paginación de informes admin"`.

## `total`/`hasNext` sin backend nuevo

El endpoint `GET /api/admin/report-workflow` ya aceptaba `limit`/`offset` y devuelve
`pagination.hasMore` (verificado read-only en `api.ts`: `AdminReportWorkflowSnapshot` no
tiene campo `total`). R-03 no modifica ningún contrato de backend/API; usa `hasMore` como
`hasNext` (subgrupo 3 de PR-SRV-0: sin `total`, sin `pageCount`).

## Archivos tocados

- `frontend/src/app/dashboard/admin/AdminReportsCard.tsx` — runtime único adaptativo
  (medición con piso desktop, anti-race por request-id, recompute de offset sin clamp por
  total, filtros resetean offset, colapso del segundo pipeline mobile).
- `test/admin-reports-enterprise-density.test.ts` — source-contract alineado al contrato
  adaptativo (constantes, ausencia de `matchMedia`/`MOBILE_PAGE_SIZE`/segundo pipeline,
  request-id, recompute, piso desktop, filtros client-side sin nuevo contrato API).
- `test/admin-mobile-core-pager-canonical-layout.test.ts` — **sólo** las aserciones de
  `AdminReportsCard` alineadas (pager `Pág. {page}`, page-size medido, pipeline único); las
  de Clínicas quedaron intactas.
- `frontend/e2e/admin-mobile-core-modules-no-scroll.spec.ts` — entrada `reports` de
  `MODULES` (`maxItemsPerPage: 10 → 36`, `MOCK_REPORTS: 13 → 40`) y el test de paginación
  mobile de reports pasa de "10-record pages" fijas a contrato adaptativo (conteo asentado
  > 0, ≤ cap 36, cambio de contenido en página 2); las entradas `clinics`/`tokens` quedaron
  intactas.
- `docs/implementation/admin-reports-workflow-server-adaptive-pagination.md` — este
  documento.

## Validaciones ejecutadas

PNPM 10.8.1 (coincide con `packageManager`).

- `node --test` dirigido a los 2 archivos de test de Reports — 17/17.
- `pnpm test` — 2942/2942.
- `pnpm typecheck:test` — OK.
- `pnpm security:public-surface` — PASS (sólo marcadores server-only esperados en
  `frontend/src/proxy.ts`).
- `pnpm --dir frontend lint` — OK.
- `pnpm --dir frontend typecheck` — OK.
- `pnpm --dir frontend build` — OK.
- `pnpm --dir frontend exec playwright test e2e/admin-mobile-core-modules-no-scroll.spec.ts`
  — 14/14 (bloque `reports` + `clinics`/`tokens` sin regresión; test de paginación mobile
  adaptativo).
- `pnpm --dir frontend exec playwright test e2e/dashboard-real-app-shell-no-scroll-contract.spec.ts`
  — 37/37 (`admin reports populated` con `expectNinePopulatedRows` preservado por el piso
  desktop=9).
- `pnpm --dir frontend exec playwright test e2e/admin-mobile-ops-modules-no-scroll.spec.ts
  e2e/admin-mobile-status-modules-no-scroll.spec.ts e2e/admin-mobile-final-polish-no-scroll.spec.ts
  e2e/dashboard-viewport-zoom-adaptability.spec.ts e2e/dashboard-internal-no-scroll-contract.spec.ts
  e2e/dashboard-global-masked-master-detail.spec.ts` — 124/124.

`frontend/next-env.d.ts` fue regenerado por Next/Playwright durante los e2e y se restauró
(`git checkout --`) antes del diff review, por estar fuera de scope.

## Riesgos residuales

- **Flake medición↔fetch (P2):** el primer paint puede usar el fallback (9) antes de que la
  fila real se mida, disparando un segundo fetch con el `effectiveLimit` asentado. Mismo
  riesgo documentado en Sesiones/Usuarios/Alertas/Clínicas; mitigado en e2e con espera de
  conteo estable (dos lecturas iguales) antes de aserciones de paginación.
- **Sin `total` → sin salto a última página:** el pager sólo avanza/retrocede de a una
  página vía `hasMore`; no hay `pageCount` ni "ir a última". Es la limitación conocida del
  endpoint (subgrupo 3 de PR-SRV-0), no una regresión.
- **Piso desktop = 9:** excepción de contrato legacy (igual que SRV-2); se revisa cuando se
  regeneren los contratos desktop legacy (nota en R-26 del roadmap).
- **QA manual pendiente:** iOS/Android real y zoom físico 100–175 % siguen siendo
  obligatorios antes de cualquier gate bloqueante (PR-SRV-0 §10.5).

## Fuera de scope (no tocado)

- `AdminReportsUploadPanel.tsx` (upload panel) — sin cambios.
- Otros módulos Admin (`AdminClinicsManagementCard`, `AdminParticularTokensCard`,
  `AdminAuditCard`, `AdminFailedLoginAlertsReadOnlyCard`, Sesiones, Usuarios/Roles).
- Backend/API/auth/DB/migrations (verificación del endpoint fue sólo lectura; no se pidió
  nada nuevo).
- CI/workflows, deps/lockfiles, snapshots, `globals.css`.
- Rutas Clínica/Particular/Público; ruta full `/dashboard/informes` (R-07).
- R-04..R-09 (no se adelantó ningún PR posterior).

## Confirmaciones

- Un solo módulo Admin tocado: Informes workflow.
- No `matchMedia` como cardinalidad; `MOBILE_PAGE_SIZE`/segundo pipeline eliminados;
  `PAGE_SIZE` renombrado a `REPORTS_FALLBACK_ROWS` (fallback + piso desktop); offset
  recomputado; anti-race por request-id; filtros resetean offset; `AdminReportsUploadPanel`
  preservado sin tocar.
- No se hizo `git add`/`commit`/`push`/`gh pr create`.
