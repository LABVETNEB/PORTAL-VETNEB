# R-02 — Admin Clinics Management server adaptive pagination

## PR

`feat(admin): adapt clinics management server pagination to viewport`

Cuarto módulo Admin **servidor** (`limit`/`offset`, familia C) migrado a cardinalidad
adaptativa Zero-Scroll, ejecutando **R-02** del roadmap rector
(`docs/audit/final-global-vetneb-50-60-pr-roadmap.md`, Fase 1) con la política de
PR-SRV-0 y la plantilla probada en Sesiones (#1221), Usuarios/Roles (#1222) y R-01
Alertas login (#1263).

## Base

- Rama de trabajo: `feat/admin-clinics-management-server-adaptive-pagination`.
- Base: `main @ 173995d feat(admin): adapt failed-login alerts server pagination to viewport (#1263)`.
- Fecha: 2026-07-02.

## Documentos usados

1. `docs/audit/final-global-vetneb-50-60-pr-roadmap.md` — R-02, Fase 1, reglas §6/§8.
2. `docs/implementation/server-adaptive-pagination-strategy.md` (PR-SRV-0) — módulo #3,
   política de offset (§6), anti-race (§7), límites (§8), decisión HY cap 36 (§5).
3. `docs/implementation/admin-sessions-server-adaptive-pagination.md` (SRV-1) — plantilla
   de medición/anti-race/recompute.
4. `docs/implementation/admin-users-roles-server-adaptive-pagination.md` (SRV-2) — trato
   de contratos legacy (piso desktop) y decisión de no ampliar data-attributes.
5. `docs/implementation/admin-failed-login-alerts-server-adaptive-pagination.md` (R-01) —
   patrón más reciente, manejo de búsqueda/filtros server-side.
6. `docs/implementation/clinic-logistics-master-detail-workspace.md` — sólo para
   confirmar que Logística está cerrada; **no se reabrió**.

## Skills / modelo / esfuerzo

| Rol | Valor |
|---|---|
| Principal | `vetneb-production-web-optimization-engineer` |
| Complementaria | `vetneb-briefing-planificacion-diseno-desarrollo-pruebas` |
| Complementaria | `vetneb-web-end-to-end-global` |
| Guardrail | `vetneb-security-production-invariants` |
| Admin operativo | `vetneb-admin-dashboard-operational-actions` |
| Modelo | Claude Sonnet 5 con Extended Thinking |
| Esfuerzo | Alto / exhaustivo |

El ZIP/carpeta de skills **no** fue copiado, descomprimido, editado, versionado ni
ejecutado dentro de `C:\PORTAL-VETNEB`.

## Hallazgo de fuente relevante: `total` sí está confirmado

PR-SRV-0 §1/§4 marcaba Clínicas como "`total` NO CONFIRMADO (heurística `hasNext` por
página llena)". Verificación read-only en `server/db-admin-clinics.ts:258-310`: el
endpoint ejecuta `db.select({ total: sql\`count(*)\` }).from(clinics).where(whereClause)`
en paralelo al `select` paginado y devuelve `total: Number(totalRows[0]?.total ?? 0)` —
un conteo real, igual que Sesiones/Roles/Alertas (subgrupo 1). El componente anterior ya
usaba `snapshot?.total` para `hasPrev`/`hasNext`/`pageCount`. R-02 mantiene ese uso; no
fue necesario diseñar una heurística de página llena ni pedir backend nuevo.

## Contrato anterior

- Runtime único (`AdminClinicsManagementCard`, sin módulo mobile separado) con
  `effectivePageSize = isMobileViewport ? MOBILE_PAGE_SIZE(10) : PAGE_SIZE(9)`.
- `isMobileViewport`/`isViewportResolved` resueltos por
  `window.matchMedia("(max-width: 767px)")`: **matchMedia decidía la cardinalidad**
  del `limit` enviado a `getAdminClinics`, no sólo la presentación (peor acoplamiento
  del inventario PR-SRV-0 §4, subgrupo 2).
- `currentOffset` fijo por `loadClinics(offset, search)` imperativo; búsqueda debounced
  300 ms recargaba desde `offset=0`.
- Sin recompute de `offset` al cambiar cardinalidad (no existía, porque la cardinalidad
  sólo cambiaba en breakpoints fijos de `matchMedia`), sin guard anti-carrera.

## Contrato nuevo

- **Runtime único** (ya lo era; no había módulo mobile separado que colapsar): una sola
  fuente de datos, búsqueda, `offset`, creación/edición/credenciales/eliminación y
  paginación. Sigue renderizando dos presentaciones responsive (tabla desktop
  `hidden md:block` + sección mobile `md:hidden`, en ese orden en el DOM — ya era el
  orden correcto, sin necesidad del fix de orden que sí requirió Sesiones).
- `CLINICS_FALLBACK_ROWS = 9` (ex `PAGE_SIZE`) sólo como fallback antes de la primera
  medición.
- `CLINICS_SUPERSET_CAP = 36` como techo híbrido (`maxItems` del hook), igual al cap de
  Usuarios/Roles.
- `useAdaptiveItemsPerPage` mide el **contenedor de filas visible** (región de tabla
  desktop o lista mobile, elegido por altura medida, no por `matchMedia`) y una **fila
  real** (`ref` en la primera fila/artículo); el header de la tabla desktop se descuenta
  (`CLINICS_TABLE_HEADER_PX = 36`, el `[&_th]:h-9` existente).
- `effectiveLimit = rowsPerPage` (clamp `[1, 36]`); `query.limit = effectiveLimit`.
- `page`/`pageCount`/`hasPrev`/`hasNext` usan `effectiveLimit` y `snapshot?.total` real,
  no una constante fija.
- Búsqueda server-side (`searchQuery` → debounce 300 ms → `submittedSearch`) resetea
  `offset` a 0 en su propio efecto; la cardinalidad (resize/zoom) nunca toca la búsqueda.
- Sin `matchMedia`, sin `MOBILE_PAGE_SIZE`, sin `isMobileViewport`/`isViewportResolved`,
  sin `effectivePageSize`.

## Decisión HY cap 36

Estrategia **HY** (híbrida) de PR-SRV-0 §5/§8, la misma asignada a Clínicas en el
inventario: se pide **al menos** `rowsPerPage`, con **cap 36**. El hook ya clampa
`rowsPerPage` a `[1, 36]`, por lo que `effectiveLimit = rowsPerPage`. El re-fetch sólo
ocurre cuando cambia `effectiveLimit` (medición distinta), `offset` o la búsqueda
enviada; si `rowsPerPage` no cambió, el `query` memoizado no cambia y no hay request.
`total` (real, confirmado arriba) permite `pageCount` y clamp exactos, sin heurística.

## Cómo se mide `rowsPerPage`

Igual que SRV-1/SRV-2/R-01: refs de estado (`setDesktopBodyNode`/`setMobileBodyNode` +
`setDesktopRowNode`/`setMobileRowNode`), `ResizeObserver` agenda con
`requestAnimationFrame`, la región visible se elige por altura medida (mobile primero,
desktop después), la fila real medida reemplaza el fallback
(`CLINICS_ROW_HEIGHT_FALLBACK_PX = 36`), y el header de tabla desktop se descuenta.
`minItems = 1` en ambas presentaciones: **no se replica el piso desktop de
Usuarios/Roles** porque no existe contrato legacy de N filas exactas para Clínicas
(verificado: `dashboard-real-app-shell-no-scroll-contract.spec.ts` sólo exige que
`"Clinica Veterinaria de Prueba Numero 1"` sea visible, sin `expectNinePopulatedRows`
ni conteo fijo).

## Cómo se recomputa `offset`

PR-SRV-0 §6, idéntico a SRV-1/2/R-01:

```
nextOffset = Math.floor(currentOffset / effectiveLimit) * effectiveLimit;
if (total != null) {
  lastValidOffset = Math.max(0, (Math.ceil(total / effectiveLimit) - 1) * effectiveLimit);
  nextOffset = Math.min(nextOffset, lastValidOffset);
}
nextOffset = Math.max(0, nextOffset);
```

`total` se lee de `snapshotRef` (última respuesta). La búsqueda resetea `offset` a 0
aparte, en su propio efecto debounced; la cardinalidad (resize/zoom) nunca la toca.

## Cómo se evita la carrera

- **Request id** (`latestRequestRef`): cada `loadClinics()` incrementa el id; una
  respuesta cuyo id ya no es el vigente se descarta (éxito y error).
- **Debounce de medición**: `ResizeObserver` + `requestAnimationFrame` +
  `measurementsEqual`; el hook global sólo cambia `rowsPerPage` si el valor derivado
  difiere. El resize/zoom continuo no genera ráfaga.
- **Sin doble fetch en mutaciones**: `loadClinics()` sin argumentos siempre usa el
  `query` vigente (mismo `effectiveLimit`/`offset`/búsqueda) — usado por
  "Actualizar", `handleSaveClinic`, `handleSaveCredentials` y `handleDeleteClinic`.
  `resetToFirstPageAndReload()` (usado tras crear una clínica) evita el doble fetch
  del patrón "cambiar offset + recargar": si `offset` ya es 0 recarga directo con
  `loadClinics()`; si no, sólo cambia `offset` a 0 y deja que el efecto `[query]`
  dispare el único fetch.
- **Fallback estable**: sin contenedor medido, el hook devuelve el fallback (9) y no
  re-fetchea por cardinalidad; loading/empty/error tienen geometría estable.

## Cómo se preservó `ClinicEditDrawer`

`editingClinic` es estado independiente: guarda el objeto `AdminClinicManagementSummary`
capturado al hacer clic en "Editar", no un índice de fila ni una referencia derivada de
`rows`/`snapshot`. Ningún efecto nuevo (medición, recompute de `offset`, búsqueda,
carga) lee ni escribe `editingClinic`; sólo tres puntos lo tocan, sin cambios en R-02:

- `setEditingClinic(clinic)` al hacer clic en "Editar" (desktop o mobile).
- `onClose={() => setEditingClinic(null)}` — cierre explícito del usuario.
- `handleDeleteClinic` — cierre tras eliminación confirmada (`setEditingClinic(null)`
  antes de recargar), como exige el invariante de la eliminación.

Por diseño, un cambio de `effectiveLimit`/`offset` por resize, zoom o paginación nunca
cierra ni reapunta el drawer: la clínica en edición sigue siendo el mismo objeto en
memoria, independientemente de si sigue o no visible en la página actual del listado.
Esto se verifica con el e2e existente `admin-clinic-edit-drawer.spec.ts` (búsqueda +
apertura/cierre del drawer sin resetear estado) y se preserva sin modificaciones.

## Sin módulo mobile separado

`AdminClinicsManagementCard` nunca tuvo un `AdminMobileClinicsModule` independiente — la
dualidad desktop/mobile ya vivía dentro del mismo archivo (sección `md:hidden` con
`data-admin-mobile-core-module="clinics"`). R-02 no crea ningún shim nuevo; sólo
colapsa la fuente de cardinalidad de ambas presentaciones en la única medición.
Selectores e2e preservados: `data-admin-mobile-core-module="clinics"`,
`data-admin-mobile-core-item="true"`, `data-admin-mobile-core-pager="true"`,
`data-admin-clinics-mobile-list="true"`, `data-admin-clinic-mobile-card="true"`.

## `total`/`hasNext` sin backend nuevo

Como se documentó arriba, `total` ya era un conteo real expuesto por el endpoint
existente. R-02 no modifica `server/db-admin-clinics.ts` ni ningún contrato de API; sólo
usa el `total` ya disponible para clamp y `pageCount`, igual que Sesiones/Roles/Alertas.

## Archivos tocados

- `frontend/src/app/dashboard/admin/AdminClinicsManagementCard.tsx` — runtime único
  adaptativo (medición, anti-race, recompute de offset, búsqueda debounced).
- `test/frontend-admin-clinics-management-card.test.ts` — source-contract alineado al
  contrato nuevo (constantes, ausencia de `matchMedia`/`MOBILE_PAGE_SIZE`, guard de
  "sin módulo mobile separado").
- `test/admin-overview-clinics-enterprise-density.test.ts` — assertions de constantes
  alineadas (`CLINICS_FALLBACK_ROWS`/`CLINICS_SUPERSET_CAP`).
- `test/admin-mobile-core-pager-canonical-layout.test.ts` — **sólo** las assertions de
  Clínicas alineadas al contrato adaptativo; las de `AdminReportsCard` quedaron
  intactas (fuera de scope de R-02).
- `frontend/e2e/admin-mobile-core-modules-no-scroll.spec.ts` — **sólo** la entrada
  `clinics` de `MODULES` (`maxItemsPerPage: 10 → 36`, `MOCK_CLINICS: 13 → 40`); las
  entradas `reports`/`tokens` quedaron intactas.
- `frontend/e2e/admin-clinics-mobile-card-layout.spec.ts` — `MOCK_CLINICS: 13 → 40`;
  `assertMobileClinicsContract` pasa de "exactamente 10" a contrato adaptativo (fit
  asentado > 0, ≤ cap 36, consistencia interna); el test de paginación deriva
  `pageCount` del conteo asentado en vez de asumir 10 por página.
- `docs/implementation/admin-clinics-management-server-adaptive-pagination.md` — este
  documento.

## Validaciones ejecutadas

PNPM 10.8.1 (coincide con `packageManager`).

- `node --test` dirigido a los 3 archivos de test de Clínicas — 32/32.
- `pnpm test` — 2941/2941.
- `pnpm typecheck:test` — OK.
- `pnpm security:public-surface` — PASS (sólo marcadores server-only esperados en
  `frontend/src/proxy.ts`).
- `pnpm --dir frontend lint` — OK.
- `pnpm --dir frontend typecheck` — OK.
- `pnpm --dir frontend build` — OK.
- `pnpm --dir frontend exec playwright test e2e/admin-clinic-edit-drawer.spec.ts
  e2e/admin-clinics-mobile-card-layout.spec.ts` — 16/16.
- `pnpm --dir frontend exec playwright test e2e/admin-mobile-core-modules-no-scroll.spec.ts`
  — 14/14 (bloque `clinics` + `reports`/`tokens` sin regresión).
- `pnpm --dir frontend exec playwright test
  e2e/dashboard-viewport-zoom-adaptability.spec.ts
  e2e/dashboard-internal-no-scroll-contract.spec.ts
  e2e/dashboard-global-masked-master-detail.spec.ts` — 84/84.
- `pnpm --dir frontend exec playwright test e2e/admin-mobile-final-polish-no-scroll.spec.ts`
  (regresión extra, no mandatorio) — 4/4 en el re-run; un primer intento tuvo un fallo de
  cold-start del dev server ajeno al cambio (confirmado por el re-run limpio).

`frontend/next-env.d.ts` fue regenerado por Next/Playwright durante los e2e y se
restauró (`git checkout --`) antes del diff review, por estar fuera de scope.

## Fix post-CI: conteo asentado en `admin-mobile-core-modules-no-scroll`

CI (`validate-frontend` → `pnpm --dir frontend e2e:admin-mobile`) reportó los tres
viewports de `Admin mobile core module "clinics" is no-scroll` en rojo: el spec esperaba
`clinics item 10/13/15` (`.nth(9)/.nth(12)/.nth(14)`) que ya no existían.

**Causa raíz:** el spec leía `items.count()` **una sola vez** inmediatamente después de
que el primer ítem fuera visible, sin esperar el asentamiento medición↔fetch propio del
contrato adaptativo (riesgo ya documentado arriba): el primer paint usa el fallback, el
re-fetch con el fit medido re-renderiza la lista, y en CI Linux el conteo transitorio
capturado quedaba obsoleto cuando el loop llegaba a `.nth(count - 1)`. No es un bug de
renderizado del componente — es el spec iterando sobre un conteo de un render superado.

**Fix (sólo e2e, acotado al loop compartido):** antes de iterar, se espera un conteo
**asentado** (dos lecturas consecutivas iguales vía `expect(...).toPass`, mismo patrón
que ya usaba `admin-clinics-mobile-card-layout.spec.ts`). Las aserciones del contrato
adaptativo quedan: `renderedCount > 0`, `renderedCount ≤ maxItemsPerPage` (36 para
Clínicas), cada ítem renderizado dentro del viewport, pager visible/operable y
navegación a página 2 verificada por cambio de contenido. Sin conteos fijos por
dispositivo. La espera es inofensiva para `reports`/`tokens` (tamaño fijo 10, conteo
estable de inmediato): sus expectativas no cambiaron.

**No relacionado:** el fallo local de `theme-mode.spec.ts`
(`meta[name="theme-color"]` resuelto a 2 elementos / `removeChild`) es ajeno a R-02;
queda registrado como flake/deuda separada, no se tocó en este PR.

## Riesgos residuales

- **Flake medición↔fetch (P2):** el primer paint puede usar el fallback (9) antes de
  que la fila real se mida (la fila necesita datos ya cargados para existir en el DOM),
  lo que puede disparar un segundo fetch con el `effectiveLimit` asentado. Mismo riesgo
  documentado en Sesiones/Usuarios/Alertas; mitigado en e2e con espera de conteo
  estable (dos lecturas iguales) antes de aserciones de paginación.
- **Altura de fila representativa:** se mide la primera fila; `safetyGap` del hook
  sesga a subestimar (seguro). Filas desktop con contenido largo truncan (`truncate`),
  no crecen.
- **QA manual pendiente:** iOS/Android real y zoom físico 100–175 % siguen siendo
  obligatorios antes de cualquier gate bloqueante (PR-SRV-0 §10.5).

## Fuera de scope (no tocado)

- Otros módulos Admin (`AdminReportsCard`, `AdminParticularTokensCard`,
  `AdminAuditCard`, `AdminFailedLoginAlertsReadOnlyCard`, `AdminMobileCommandModule`,
  Sesiones, Usuarios/Roles).
- Backend/API/auth/DB/migrations (verificación de `total` fue sólo lectura; no se pidió
  nada nuevo).
- CI/workflows, deps/lockfiles, snapshots, `globals.css`.
- Rutas Clínica/Particular/Público; Logística (cerrada, no reabierta).
- R-03..R-09 (no se adelantó ningún PR posterior).

## Confirmaciones

- Un solo módulo Admin tocado: Clínicas.
- No `matchMedia` como cardinalidad; `MOBILE_PAGE_SIZE`/`effectivePageSize` eliminados;
  `PAGE_SIZE` renombrado a `CLINICS_FALLBACK_ROWS` (sólo fallback); offset recomputado;
  anti-race por request-id; búsqueda resetea offset; `ClinicEditDrawer` preservado.
- No se hizo `git add`/`commit`/`push`/`gh pr create`.
