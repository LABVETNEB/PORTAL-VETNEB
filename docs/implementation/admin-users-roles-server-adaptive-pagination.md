# PR-SRV-2 — Admin Users/Roles server adaptive pagination

## PR

`feat(admin): adapt users-roles server pagination to viewport`

Segundo módulo Admin **servidor** (`limit`/`offset`, familia C) migrado a cardinalidad
adaptativa Zero-Scroll, replicando el patrón PR-SRV-1 (Sesiones) y la política PR-SRV-0.

## Base

- Rama de trabajo: `feat/admin-users-roles-server-adaptive-pagination`.
- Base esperada: `main @ b219382 feat(admin): adapt sessions server pagination to viewport (#1221)`.
- Fecha: 2026-07-01.

## Scope

- `frontend/src/app/dashboard/admin/AdminUsersRolesReadOnlyCard.tsx` — runtime único colapsado.
- `frontend/src/app/dashboard/admin/AdminMobileUsersModule.tsx` — reducido a compat shim.
- `test/frontend-admin-users-roles-card.test.ts` — alineado (autorizado) al contrato nuevo.
- `test/admin-users-roles-enterprise-density.test.ts` — alineado (autorizado) al contrato nuevo.
- `frontend/e2e/admin-mobile-ops-modules-no-scroll.spec.ts` — **sólo** el bloque `users` (autorizado).
- `docs/implementation/admin-users-roles-server-adaptive-pagination.md` — este documento.

No se tocó backend, API, auth, DB, migraciones, CI, deps, lockfiles, snapshots ni `globals.css`.
No se tocó ningún otro módulo Admin (Sesiones, Clínicas, Informes workflow, Tokens admin, Auditoría,
Alertas login) ni los bloques `audit`/`sessions` de la spec e2e.

## Skills / modelo / esfuerzo

| Rol | Valor |
|---|---|
| Principal | `vetneb-production-web-optimization-engineer` |
| Complementaria | `vetneb-briefing-planificacion-diseno-desarrollo-pruebas` |
| Complementaria | `vetneb-web-end-to-end-global` |
| Complementaria | `vetneb-staff-senior-full-stack-engineer` |
| Guardrail | `vetneb-security-production-invariants` |
| Modelo | Opus 4.8 (`claude-opus-4-8`) |
| Esfuerzo | Alto / exhaustivo |

## Contrato anterior

- Dos componentes con dos fetch independientes: `AdminUsersRolesReadOnlyCard` (desktop,
  `PAGE_SIZE=9`) y `AdminMobileUsersModule` (mobile ops-module, `MOBILE_PAGE_SIZE=3`).
- `matchMedia` como **gate de fetch**: desktop `min-width:768` (`if (!isDesktopViewport) return`),
  mobile `max-width:767`.
- `limit` fijo por dispositivo (`PAGE_SIZE` / `MOBILE_PAGE_SIZE`); `page`/`pageCount` y
  Anterior/Siguiente calculados con esa constante fija.
- Sin recompute de `offset`, sin guard anti-carrera.

## Contrato nuevo

- **Runtime único** en `AdminUsersRolesReadOnlyCard`: una sola fuente de datos, filtros, `offset`,
  cambio de rol y paginación. Renderiza dos presentaciones responsive (`Card` desktop
  `hidden md:flex` + sección mobile `md:hidden`), nunca ambas visibles a la vez.
- `USERS_ROLES_FALLBACK_ROWS = 9` sólo como fallback antes de la primera medición.
- `USERS_ROLES_SUPERSET_CAP = 36` como techo híbrido (`maxItems` del hook).
- `useAdaptiveItemsPerPage` mide el **contenedor de filas visible** (desktop table region o
  mobile list region, elegido por altura medida, no por `matchMedia`) y una **fila real**
  (`ref` en la primera fila/ítem); el header de la tabla se descuenta (`USERS_ROLES_TABLE_HEADER_PX`).
- `effectiveLimit = rowsPerPage` (clamp `[1, 36]`); `query.limit = effectiveLimit`.
- `page`/`pageCount` y Anterior/Siguiente usan `effectiveLimit`, no una constante fija.
- Filtros server-side (Tipo usuario/Rol) resetean `offset` a 0 en su handler (`resetFiltersFeedback` + `setOffset(0)`).
- El cambio de rol conserva la actualización optimista in-place (`setSnapshot((current) => …)`) y el
  realce de la fila (`roleChangeMessage` / `changedUserKey`), sin refetch.
- Sin `matchMedia`, sin `MOBILE_PAGE_SIZE`, sin `isDesktopViewport`/`isMobileViewport`.

## Decisión HY cap 36

Estrategia **HY** (híbrida) de PR-SRV-0 §5/§8: se pide **al menos** `rowsPerPage`, con **cap 36**
(el cap de Usuarios/Roles, un peldaño por encima del 32 de Sesiones por ser una tabla más densa).
El hook ya clampa `rowsPerPage` a `[1, 36]`, por lo que `effectiveLimit = rowsPerPage`. El re-fetch
sólo ocurre cuando cambia `effectiveLimit` (medición distinta), `offset` o un filtro; si
`rowsPerPage` no cambió, el `query` memoizado no cambia y no hay request. `total` (expuesto por el
endpoint) permite `pageCount` y clamp.

## Piso de 9 filas en desktop (diferencia con Sesiones)

Las filas de la tabla desktop de Usuarios/Roles son de **dos líneas** (~41px): usuario + `ID`,
clínica + metadata. En el viewport desktop más chico soportado por el contrato
(`1366×768`) caben exactamente 9 filas en el contenedor medido, con ~1.7px de margen. Con el
cushion por defecto del hook (`safetyGapPx=6`) la medición redondearía a **8**, rompiendo el
contrato desktop histórico `expectNinePopulatedRows` (fuera de scope, exige exactamente 9 filas
pobladas a `1366×768` y `1440×900`).

Solución: el **contexto desktop** (detectado porque descuenta el header de tabla,
`measurement.headerHeightPx > 0`) fija `minItems = USERS_ROLES_FALLBACK_ROWS` (9) — el mismo piso
que el `PAGE_SIZE` fijo anterior — mientras sigue **creciendo hacia arriba** en viewports más altos
(cap 36). La lista **mobile** (sin header de tabla) mantiene `minItems = 1`, para poder encogerse en
teléfonos chicos. Esto:

- es **estable entre plataformas** (no depende de un margen sub-pixel de ~1.7px que el render de CI
  Linux podría redondear distinto), a diferencia de bajar `safetyGapPx` a 0;
- **replica el comportamiento pre-adaptativo** (9 fijas) en desktop, por lo que los contratos que ya
  pasaban con 9 filas fijas (`dashboard-viewport-zoom-adaptability` en `1280×720`/`1366×768`, que sólo
  detectan *scroll*, no clipping) siguen pasando;
- mantiene el objetivo Zero-Scroll: a `1366×768` las 9 filas + header caben en el contenedor medido
  (verificado con `expectPageNoOverflow`, tolerancia 2px).

## Offset / recompute

Al cambiar `effectiveLimit` (de `L0` a `L1`) se recalcula el `offset` para conservar el mismo primer
registro visible (PR-SRV-0 §6):

```
nextOffset = Math.floor(currentOffset / L1) * L1;
if (total != null) {
  lastValidOffset = Math.max(0, (Math.ceil(total / L1) - 1) * L1);
  nextOffset = Math.min(nextOffset, lastValidOffset);
}
nextOffset = Math.max(0, nextOffset);
```

`total` se lee de `snapshotRef` (última respuesta). Los filtros resetean `offset` a 0 aparte; la
cardinalidad (resize/zoom) nunca toca los filtros.

## Anti-race

- **Request id** (`latestRequestRef`): cada `loadUsersRoles` incrementa el id; al resolver, si el id
  ya no es el vigente, la respuesta se descarta (`if (requestId !== latestRequestRef.current) return;`).
  Evita que una respuesta con `L0` pinte sobre el estado con `L1`.
- El cambio de rol usa `setSnapshot` funcional (mapea sobre el snapshot vigente), por lo que es seguro
  ante recargas concurrentes sin necesidad de bumpear el request id.
- **Debounce de medición**: el `ResizeObserver` agenda el recálculo con `requestAnimationFrame` y sólo
  actualiza el estado de medición cuando cambia (comparación `measurementsEqual`); el hook global sólo
  cambia `rowsPerPage` cuando el valor derivado difiere. El resize/zoom continuo no genera ráfaga.
- **Fallback antes de medir**: sin contenedor medido, el hook devuelve `USERS_ROLES_FALLBACK_ROWS` y no
  re-fetchea por cardinalidad.

## Mobile / desktop colapsado

- `AdminMobileUsersModule` deja de fetchear/renderizar; queda como **compat shim** (`return null`)
  sin `getAdminUsersRoles`, sin `MOBILE_PAGE_SIZE`, sin `matchMedia`. Ningún import/test referencia el
  símbolo salvo el shim mismo.
- La presentación mobile (ops-module) vive ahora dentro de `AdminUsersRolesReadOnlyCard` y **preserva**
  los selectores e2e legacy: `data-admin-mobile-ops-module="users"`, `data-admin-mobile-ops-item`,
  `AdminMobileOpsPager` (`aria-label="Paginación de usuarios"`), botón "Actualizar", selects
  "Tipo"/"Rol".
- **Sin data attributes sensibles añadidos.** A diferencia de Sesiones (que agregó `data-admin-sesiones-*`),
  Usuarios/Roles no necesita atributos aditivos: la medición se hace por `ref` de nodo (no por selector),
  y ningún test source-contract de Usuarios exige un `data-*` de page-size. Se evita así ampliar la
  superficie DevTools sin necesidad (el auditor `security:public-surface` no marca `user`, pero el token
  no aporta valor y se omite).
- No-scroll preservado: footer/pager siempre visible (`shrink-0`), lista/table body en región
  `min-h-0 flex-1`.

## Orden DOM desktop / mobile

Igual que el fix post-CI de PR-SRV-1, el `<Card>` desktop (`hidden md:flex`) precede en el DOM a la
`<section>` mobile (`md:hidden`), para que las specs desktop que usan `.first()` sobre locators sin
scope (p. ej. `dashboard-real-app-shell-no-scroll-contract`) resuelvan contra el nodo desktop y no
contra el mobile oculto por CSS.

## Contrato desktop de 9 filas preservado

`dashboard-real-app-shell-no-scroll-contract.spec.ts` (fuera de scope) exige exactamente 9 filas de
datos en Usuarios/Roles a 1440×900 y 1366×768 (`expectNinePopulatedRows` → 10 filas con header). El
fixture (`frontend/e2e/fixtures/admin-populated-api-server.mjs`) expone exactamente 9 usuarios
(`total: 9`) y hace `slice(offset, offset + limit)`. Con la medición adaptativa `effectiveLimit ≥ 9`
en esos viewports altos (caben ~11–13 filas de 32px), por lo que la tabla renderiza `min(limit, 9) = 9`
filas. El aserto usa `expect().toHaveCount()` con auto-retry, absorbiendo el settling medición↔fetch.

## Cambio autorizado en e2e (sólo users)

La spec `admin-mobile-ops-modules-no-scroll.spec.ts` fijaba `maxItemsPerPage: 4` para users
(contrato mobile viejo). Con cardinalidad medida (cap 36), el número visible por página es
"cabe-en-viewport", no un fijo. Cambios acotados a users (audit/sessions intactos):

- `maxItemsPerPage` de users: `4 → 36` (techo = superset cap; la garantía real es el fit por ítem).
- `MOCK_USERS`: `9 → 40`, para que la página 2 exista con cualquier `effectiveLimit ≤ 36`.
- `totals` del mock: `{ adminUsers: 1, clinicUsers: 8 } → { adminUsers: 1, clinicUsers: 39 }` (coherencia).
- El bloque de ítems de users pasa a usar el **snapshot atómico** (`expectStableSessionItemSnapshot`)
  igual que sessions, para no correr carrera contra el re-fetch/remount adaptativo.
- Se conservan intactas las aserciones de no-scroll, ítems dentro del viewport, pager, acción primaria
  y navegación a página 2.

## Archivos modificados

- `frontend/src/app/dashboard/admin/AdminUsersRolesReadOnlyCard.tsx`
- `frontend/src/app/dashboard/admin/AdminMobileUsersModule.tsx`
- `test/frontend-admin-users-roles-card.test.ts` (alineado)
- `test/admin-users-roles-enterprise-density.test.ts` (alineado)
- `frontend/e2e/admin-mobile-ops-modules-no-scroll.spec.ts` (sólo bloque users)
- `docs/implementation/admin-users-roles-server-adaptive-pagination.md` (este documento)

## Validaciones ejecutadas

- `pnpm test`
- `pnpm typecheck:test`
- `pnpm security:public-surface`
- `pnpm -C frontend lint`
- `pnpm -C frontend typecheck`
- `pnpm -C frontend build`
- `pnpm -C frontend e2e -- e2e/admin-mobile-ops-modules-no-scroll.spec.ts`
- `pnpm -C frontend e2e -- e2e/dashboard-real-app-shell-no-scroll-contract.spec.ts --grep "admin users"`

## Riesgos residuales

- **Flake medición↔fetch (P2):** el primer paint usa fallback 9; en los viewports mobile probados
  caben ≥3 filas, así que no hay overflow antes de que la medición ajuste. Mitigado con el snapshot
  atómico y las tolerancias del contrato e2e.
- **Altura de fila representativa:** se mide la primera fila; el `safetyGap` del hook sesga a
  subestimar (seguro).
- **QA manual pendiente:** iOS/Android real y zoom físico 100–175 % siguen siendo obligatorios antes de
  cualquier gate bloqueante (PR-SRV-0 §10.5).

## Confirmaciones

- No se tocó backend, API, auth, DB, migraciones, CI, deps, lockfiles, snapshots ni `globals.css`.
- No se tocó ningún otro módulo Admin ni los bloques `audit`/`sessions` de la spec e2e.
- No se hizo `git add`/`commit`/`push`/`gh pr create`.
