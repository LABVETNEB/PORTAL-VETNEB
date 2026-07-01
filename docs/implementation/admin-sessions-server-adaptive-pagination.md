# PR-SRV-1 — Admin Sessions server adaptive pagination

## PR

`feat(admin): adapt sessions server pagination to viewport`

Primer módulo Admin **servidor** (`limit`/`offset`, familia C) migrado a cardinalidad
adaptativa Zero-Scroll, ejecutando la política escrita en PR-SRV-0.

## Base

- Rama de trabajo: `feat/admin-sessions-server-adaptive-pagination`.
- Base esperada: `main @ 4cb4e47 docs(dashboard): define server adaptive pagination strategy (#1220)`.
- Fecha: 2026-07-01.

## Scope

- `frontend/src/app/dashboard/admin/AdminSessionsReadOnlyCard.tsx` — runtime único colapsado.
- `frontend/src/app/dashboard/admin/AdminMobileSessionsModule.tsx` — reducido a compat shim.
- `test/frontend-admin-sessions-read-only-card.test.ts` — source-contract del contrato nuevo (nuevo).
- `test/frontend-admin-sessions-card.test.ts` — alineado (autorizado) al contrato nuevo.
- `test/admin-sessions-enterprise-density.test.ts` — alineado (autorizado) al contrato nuevo.
- `frontend/e2e/admin-mobile-ops-modules-no-scroll.spec.ts` — **sólo** el bloque `sessions` (autorizado).
- `docs/implementation/admin-sessions-server-adaptive-pagination.md` — este documento.

No se tocó backend, API, auth, DB, migraciones, CI, deps, lockfiles, snapshots ni `globals.css`.
No se tocó ningún otro módulo Admin (Roles, Clínicas, Informes workflow, Tokens admin, Auditoría,
Alertas login) ni los bloques `audit`/`users` de la spec e2e.

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

- Dos componentes con dos fetch independientes: `AdminSessionsReadOnlyCard` (desktop,
  `PAGE_SIZE=8`) y `AdminMobileSessionsModule` (mobile, `MOBILE_PAGE_SIZE=10`).
- `matchMedia` como **gate de fetch**: desktop `min-width:768` (`if (!isDesktopViewport) return`),
  mobile `max-width:767`.
- `limit` fijo por dispositivo (`PAGE_SIZE` / `MOBILE_PAGE_SIZE`); `page`/`pageCount` y
  Anterior/Siguiente calculados con esa constante fija.
- Sin recompute de `offset`, sin guard anti-carrera.

## Contrato nuevo

- **Runtime único** en `AdminSessionsReadOnlyCard`: una sola fuente de datos, filtros, `offset`,
  `revoke` y paginación. Renderiza dos presentaciones responsive (sección mobile
  `md:hidden` + `Card` desktop `hidden md:flex`), nunca ambas visibles a la vez.
- `SESSIONS_FALLBACK_ROWS = 8` sólo como fallback antes de la primera medición.
- `SESSIONS_SUPERSET_CAP = 32` como techo híbrido (`maxItems` del hook).
- `useAdaptiveItemsPerPage` mide el **contenedor de filas visible** (desktop table region o
  mobile list region, elegido por altura medida, no por `matchMedia`) y una **fila real**
  (`ref` en la primera fila/ítem); el header de la tabla se descuenta (`SESSIONS_TABLE_HEADER_PX`).
- `effectiveLimit = rowsPerPage` (clamp `[1, 32]`); `query.limit = effectiveLimit`.
- `page`/`pageCount` y Anterior/Siguiente usan `effectiveLimit`, no una constante fija.
- Filtros server-side (Tipo/Estado) resetean `offset` a 0 en su handler.
- Revocar refresca con el `query` vigente (mismo `effectiveLimit`/`offset`/filtros).
- Sin `matchMedia`, sin `MOBILE_PAGE_SIZE`, sin `isDesktopViewport`/`isMobileViewport`.

## Decisión HY cap 32

Estrategia **HY** (híbrida) de PR-SRV-0 §5/§8: se pide **al menos** `rowsPerPage`, con **cap 32**.
El hook ya clampa `rowsPerPage` a `[1, 32]`, por lo que `effectiveLimit = rowsPerPage`. El re-fetch
sólo ocurre cuando cambia `effectiveLimit` (medición distinta), `offset` o un filtro; si
`rowsPerPage` no cambió, el `query` memoizado no cambia y no hay request. `total` (expuesto por el
endpoint) permite `pageCount` y clamp.

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

- **Request id** (`latestRequestRef`): cada carga incrementa el id; al resolver, si el id ya no es el
  vigente, la respuesta se descarta (`if (requestId !== latestRequestRef.current) return;`). Evita que
  una respuesta con `L0` pinte sobre el estado con `L1`.
- **Debounce de medición**: el `ResizeObserver` agenda el recálculo con `requestAnimationFrame` y sólo
  actualiza el estado de medición cuando cambia (comparación `measurementsEqual`); el hook global sólo
  cambia `rowsPerPage` cuando el valor derivado difiere. El resize/zoom continuo no genera ráfaga.
- **Fallback antes de medir**: sin contenedor medido, el hook devuelve `SESSIONS_FALLBACK_ROWS` y no
  re-fetchea por cardinalidad.

## Mobile / desktop colapsado

- `AdminMobileSessionsModule` deja de fetchear/renderizar; queda como **compat shim** (`return null`)
  sin `getAdminSessions`, sin `MOBILE_PAGE_SIZE`, sin `matchMedia`. Ningún import/test referencia el
  símbolo salvo el shim mismo.
- La presentación mobile (ops-module) vive ahora dentro de `AdminSessionsReadOnlyCard` y **preserva**
  los selectores e2e legacy: `data-admin-mobile-ops-module="sessions"`, `data-admin-mobile-ops-item`,
  `AdminMobileOpsPager` (`aria-label="Paginación de sesiones"`), botón "Actualizar", selects
  "Tipo"/"Estado".
- Data attributes nuevos (aditivos): `data-admin-sesiones-card`, `data-admin-sesiones-list-body`,
  `data-admin-sesiones-row`, `data-admin-sesiones-pagination`, `data-admin-sesiones-page-size`.
  Se usa el stem `sesiones` (no `sessions`) para respetar el invariante de seguridad
  `sensitive-data-attribute-name` (el auditor `security:public-surface` prohíbe el token `session`
  en nombres `data-*`); así no se toca la herramienta de seguridad ni su whitelist.
- No-scroll preservado: footer/pager siempre visible (`shrink-0`), lista/table body en región
  `min-h-0 flex-1`.

## Cambio autorizado en e2e (sólo sessions)

La spec `admin-mobile-ops-modules-no-scroll.spec.ts` fijaba `maxItemsPerPage: 10` para sessions
(contrato mobile viejo). Con cardinalidad medida (cap 32), el número visible por página es
"cabe-en-viewport", no un fijo de 10. Cambios acotados a sessions (audit/users intactos):

- `maxItemsPerPage` de sessions: `10 → 32` (techo = superset cap; la garantía real es el fit por ítem).
- `MOCK_SESSIONS`: `13 → 40`, para que la página 2 exista con cualquier `effectiveLimit ≤ 32`.
- El test de selects Tipo/Estado deja de exigir `≤ 10` y valida `≤ 32`.
- Se conservan intactas las aserciones de no-scroll, ítems dentro del viewport, pager, acción primaria
  y navegación a página 2.

## Fix post-CI: orden DOM mobile/desktop

CI reportó `frontend/e2e/dashboard-real-app-shell-no-scroll-contract.spec.ts` en rojo:
`page.getByText("#5000").first()` (búsqueda global desktop) pasaba a resolver contra la sección
mobile (`md:hidden`), porque el JSX renderizaba primero `<section data-admin-mobile-ops-module=
"sessions">` y luego el `<Card>` desktop — ambos con el mismo contenido de datos, así que
`.first()` en un locator sin scope ve el nodo mobile aunque esté oculto por CSS.

Fix acotado a `AdminSessionsReadOnlyCard.tsx`: se invirtió el orden del JSX dentro del fragmento
raíz para que el `<Card>` desktop (`hidden md:flex`) preceda en el DOM a la `<section>` mobile
(`md:hidden`). Es un movimiento de bloque puro (mismo JSX, mismas props, mismos data attributes);
no se tocó lógica adaptive, `SESSIONS_FALLBACK_ROWS`, `SESSIONS_SUPERSET_CAP`,
`AdminMobileSessionsModule` ni ningún otro archivo. Los 33 tests de source-contract de Sesiones
pasaron sin cambios (ninguno depende del orden DOM, sólo de `includes`), por lo que no fue
necesario tocar tests.

Validado con:

- `pnpm -C frontend typecheck`
- `node --test` (33/33 Sesiones) + `pnpm test` (2919/2919)
- `pnpm typecheck:test`, `pnpm security:public-surface`, `pnpm -C frontend lint`, `pnpm -C frontend build`
- `pnpm -C frontend exec playwright test e2e/dashboard-real-app-shell-no-scroll-contract.spec.ts` — 37/37
- Las 4 specs e2e de PR-SRV-1 — 95/95 (sin regresión)

## Archivos modificados

- `frontend/src/app/dashboard/admin/AdminSessionsReadOnlyCard.tsx`
- `frontend/src/app/dashboard/admin/AdminMobileSessionsModule.tsx`
- `test/frontend-admin-sessions-read-only-card.test.ts` (nuevo)
- `test/frontend-admin-sessions-card.test.ts` (alineado)
- `test/admin-sessions-enterprise-density.test.ts` (alineado)
- `frontend/e2e/admin-mobile-ops-modules-no-scroll.spec.ts` (sólo bloque sessions)
- `docs/implementation/admin-sessions-server-adaptive-pagination.md` (este documento)

## Validaciones ejecutadas

PNPM 10.8.1 explícito (`C:\Program Files\nodejs\pnpm.CMD`) porque el PNPM del PATH es 11.x y el repo
declara `packageManager: pnpm@10.8.1`. Para e2e se antepuso `C:\Program Files\nodejs` al PATH para que
el `webServer` de Playwright resolviera el PNPM correcto.

- `node --test` dirigido a los 3 tests de Sesiones — pasó: 33/33.
- `pnpm test` — pasó: 2919/2919.
- `pnpm typecheck:test` — pasó.
- `pnpm security:public-surface` — pasó; sólo marcadores server-only esperados en `frontend/src/proxy.ts`.
- `pnpm -C frontend lint` — pasó.
- `pnpm -C frontend typecheck` — pasó.
- `pnpm -C frontend build` — pasó.
- `pnpm -C frontend exec playwright test e2e/admin-mobile-ops-modules-no-scroll.spec.ts e2e/admin-mobile-core-modules-no-scroll.spec.ts e2e/dashboard-internal-no-scroll-contract.spec.ts e2e/dashboard-viewport-zoom-adaptability.spec.ts` — pasó: 95/95.

`frontend/next-env.d.ts` fue regenerado por Next/Playwright durante los e2e y se restauró
(`git checkout --`) antes del diff review, por estar fuera de scope.

## Riesgos residuales

- **Flake medición↔fetch (P2):** el primer paint usa fallback 8; en todos los viewports mobile
  probados (740/844/932) caben ≥8 filas, así que no hay overflow antes de que la medición ajuste.
  Mitigado con `toPass`/tolerancias del contrato e2e.
- **Altura de fila representativa:** se mide la primera fila; filas con contenido heterogéneo pueden
  dejar la medición levemente conservadora hasta el próximo tick de `ResizeObserver` (riesgo aceptado,
  igual que en módulos cliente ya migrados). `safetyGap` del hook sesga a subestimar (seguro).
- **QA manual pendiente:** iOS/Android real y zoom físico 100–175 % siguen siendo obligatorios antes de
  cualquier gate bloqueante (PR-SRV-0 §10.5).

## Confirmaciones

- No se tocó backend, API, auth, DB, migraciones, CI, deps, lockfiles, snapshots ni `globals.css`.
- No se tocó ningún otro módulo Admin ni los bloques `audit`/`users` de la spec e2e.
- No se hizo `git add`/`commit`/`push`/`gh pr create`.
- El ZIP/carpeta de skills **no** fue copiado, descomprimido, editado, versionado ni ejecutado dentro
  de `C:\PORTAL-VETNEB`. Sólo se observaron nombres/descripciones desde la lista de skills disponible.
