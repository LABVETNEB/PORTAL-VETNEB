# R-06 — Admin Audit server adaptive pagination

## PR

`feat(admin): adapt audit server pagination to viewport`

Sixth module of PR-SRV-0's server-adaptive migration, executing **R-06** of the
roadmap rector (`docs/audit/final-global-vetneb-50-60-pr-roadmap.md`, Fase 1),
and the only surface assigned the **RF debounced** strategy: Auditoría is
high-volume (`audit_log` has no retention job), so PR-SRV-0 §5/§8.3 forbids an
over-fetch superset here — the server pagination must re-fetch a
viewport-derived `limit`, never fetch-more-than-needed.

## Base

- Rama de trabajo: `feat/admin-audit-server-adaptive-pagination`.
- Base: `main @ 90f88ca feat(admin): adapt particular tokens server pagination to viewport (#1267)`.
- Fecha: 2026-07-03.

## Documentos usados

1. `docs/audit/final-global-vetneb-50-60-pr-roadmap.md` — R-06, Fase 1.
2. `docs/implementation/server-adaptive-pagination-strategy.md` (PR-SRV-0) —
   módulo #6/#11 (Auditoría + Mobile Auditoría): estrategia **RF debounced**,
   cap de `limit` ≤ 50 para proteger el payload (§8.3).
3. `docs/implementation/admin-reports-workflow-server-adaptive-pagination.md`
   (R-03) — patrón de colapso de segundo pipeline, piso desktop SRV-2.
4. `docs/implementation/admin-users-roles-server-adaptive-pagination.md`
   (SRV-2) — piso desktop `minItems` para módulos con
   `expectNinePopulatedRows` pinneado.

## Contrato anterior

Arquitectura **distinta** de los módulos previos (Sesiones/Usuarios/Alertas/
Clínicas/Reports): Auditoría nunca fue un client component autocontenido.

- **Desktop:** `page.tsx` (server component) leía `auditPage` desde
  `searchParams`, calculaba `offset = (auditPage - 1) * ADMIN_AUDIT_PAGE_SIZE`
  (`PAGE_SIZE` fijo = 9), llamaba `getAuditEntries` server-side, sanitizaba las
  filas (`AdminAuditRow`, sin `ipAddress`/`userAgent`/`metadata` crudo) y las
  pasaba como prop a `AdminAuditCard` (puramente presentacional). La
  paginación desktop navegaba vía `PublicRouteControl` (`href` con
  `?auditPage=N`, full page reload).
- **Mobile:** `AdminMobileAuditModule` (client component) tenía su **propio**
  pipeline: estado `offset`/`page`, `useTransition`, y un Server Action
  dedicado (`admin-audit-mobile.actions.ts` → `getAdminMobileAuditPage`) con
  `MOBILE_PAGE_SIZE` fijo = 10, filas resueltas con lógica de actor
  **distinta** a la desktop (`getMobileAuditActor` + resolución de nombre de
  clínica vía `getAdminClinics`, mientras desktop usaba el `getAuditActor`
  genérico con id).
- Los filtros (evento/actor/fecha/clínica/informe) se resolvían server-side
  desde `searchParams` y se aplicaban vía formulario GET
  (`action="/dashboard/admin"`, full page reload) — **sin JS**, ya
  compatibles con "resetear offset a 0" (una navegación de filtro nunca
  incluye `auditPage`).
- Sin medición de viewport en ningún lado: `ADMIN_AUDIT_PAGE_SIZE`/
  `MOBILE_PAGE_SIZE` eran los únicos tamaños de página posibles.

## Contrato nuevo

- **Runtime único colapsado en `AdminAuditCard`** (ahora `"use client"`): un
  solo `offset`, un solo `effectiveLimit`, un solo fetch, vía el Server Action
  generalizado `getAdminAuditPage` (`admin-audit.actions.ts`, renombrado de
  `admin-audit-mobile.actions.ts`). `AdminMobileAuditModule` deja de fetchear:
  pasa a ser **puramente presentacional**, recibe `rows`/`totalCount`/
  `loadError`/`isPending`/`offset`/`effectiveLimit`/`onPrevious`/`onNext` como
  props del padre — sin `useState`/`useTransition`/`getAdminMobileAuditPage`
  propios.
- `ADMIN_AUDIT_FALLBACK_ROWS = 9` (ex `ADMIN_AUDIT_PAGE_SIZE`) sólo como
  fallback antes de la primera medición y como **piso desktop** (ver más
  abajo).
- `ADMIN_AUDIT_LIMIT_CAP = 32` — techo de la estrategia **RF debounced**: el
  `limit` efectivo nunca supera este valor, protegiendo el payload (PR-SRV-0
  §8.3 sugiere ≤ 50; 32 alinea con el cap ya validado en Sesiones).
- `useAdaptiveItemsPerPage` mide el contenedor de filas visible (tabla
  desktop o lista mobile, el que esté realmente montado con altura > 0) y una
  fila real; el header de la tabla desktop se descuenta
  (`ADMIN_AUDIT_TABLE_HEADER_PX = 32`, `[&_th]:h-8`).
- `effectiveLimit = rowsPerPage`; el Server Action recibe
  `{ ...filtros, limit: effectiveLimit, offset }` y devuelve
  `{ rows, total, loadError }` — sin over-fetch, éste es el re-fetch RF
  debounced (recompute impulsado por `ResizeObserver` + `requestAnimationFrame`,
  nunca en cada pixel de resize).
- `page`/`hasPrev`/`hasNext`/rango usan `effectiveLimit`/`offset`/`total`; el
  endpoint `audit-log` sí expone `total`, así que el recompute de offset usa
  la **regla 1** de PR-SRV-0 §6 (clamp contra el último offset válido), a
  diferencia de Reports (regla 2, sin `total`).
- Filtros: **sin cambios de UX** — siguen siendo un formulario GET
  (`AdminAuditFilterBar`, `action="/dashboard/admin"`) resuelto server-side en
  `page.tsx` desde `searchParams`. Al no incluir `auditPage` en la URL de
  filtro, cada aplicación/limpieza de filtro remonta `AdminAuditCard` con
  `offset` inicial 0 — el requisito "filtros resetean offset a 0" se cumple
  sin lógica adicional.
- La paginación (Anterior/Siguiente) deja de navegar por `href`
  (`PublicRouteControl` + `?auditPage=N`) y pasa a botones `onClick` con
  `offset` en estado del cliente — el `limit` ya no es fijo, así que la
  aritmética de página por URL habría quedado inválida.
- Sin `matchMedia`, sin `MOBILE_PAGE_SIZE`, sin segundo pipeline de fetch, sin
  `auditPage`/`parseAuditPage` en `page.tsx`.

## Una sola fuente de datos para la fila (desktop = mobile)

El Server Action generalizado usa el `getAuditActor`/`getAuditEntity`
existentes (los que ya usaba el desktop, con id explícito: `"Admin #41"`) en
vez de la resolución de nombre de clínica que sólo tenía el pipeline mobile
(`getMobileAuditActor` + `buildClinicNameMap` vía `getAdminClinics`). Se
descarta la resolución de nombre de clínica (mejora cosmética mobile-only, no
documentada como contrato) a favor de una única función de fila
(`buildAuditRow`) para no romper el contrato ya probado en e2e
(`workspace.getByText("Admin #41")`, `dashboard-real-app-shell-no-scroll-contract.spec.ts`)
ni divergir entre presentaciones — cumple el requisito explícito "Desktop/
mobile deben compartir una sola fuente de datos" y además evita una llamada
extra a `getAdminClinics` por página de auditoría (mejor payload, alineado con
la estrategia RF).

## Piso desktop (excepción SRV-2)

Auditoría está pinneada por el contrato App Shell `expectNinePopulatedRows`
(`dashboard-real-app-shell-no-scroll-contract.spec.ts`, 1440×900 y 1366×768,
memoria del proyecto: *"App Shell spec pins 9 rows for tokens/reports/audit/
users-roles"*). Igual que Reports/Usuarios-Roles, el contexto desktop
(detectado por el header descontado, `isDesktopMeasurement = measurement.headerHeightPx > 0`)
mantiene `minItems = ADMIN_AUDIT_FALLBACK_ROWS (9)`; la lista mobile mantiene
`minItems = 1` para poder encoger en teléfonos cortos.

## Cómo se recomputa `offset`

PR-SRV-0 §6, **regla 1** (el endpoint expone `total`):

```
nextOffset = Math.max(0, Math.min(
  Math.floor(currentOffset / effectiveLimit) * effectiveLimit,
  (Math.ceil(total / effectiveLimit) - 1) * effectiveLimit,
));
```

Sólo corre cuando `effectiveLimit` cambia (`previousLimitRef`); la aplicación/
limpieza de filtros resetea `offset` a 0 por remount (ver arriba), no por esta
rama.

## Cómo se evita la carrera

- **Request id** (`latestRequestRef`): cada `loadAuditPage()` incrementa el
  id; una respuesta cuyo id ya no es el vigente se descarta.
- **Debounce de medición**: `ResizeObserver` + `requestAnimationFrame` +
  `measurementsEqual`, idéntico al patrón de Sesiones/Usuarios/Alertas/
  Reports — el hook sólo cambia `rowsPerPage` si el valor derivado difiere.
- **Sin doble fetch**: al colapsar el pipeline mobile, un viewport mobile ya
  no dispara dos cargas — un único efecto `[query]` reacciona a cambios de
  `{ filtros, limit, offset }`.

## Archivos tocados

- `frontend/src/app/dashboard/admin/AdminAuditCard.tsx` — runtime único
  adaptativo (`"use client"`, medición con piso desktop, anti-race,
  recompute de offset con `total`, pager por botones).
- `frontend/src/app/dashboard/admin/AdminAuditDenseTable.tsx` — refs de
  medición (`desktopBodyRef`/`desktopRowRef`); estados loadError/empty ahora
  viven dentro del contenedor medido (persistencia del nodo observado).
- `frontend/src/app/dashboard/admin/AdminMobileAuditModule.tsx` — colapsado a
  presentacional puro (sin fetch/estado propio).
- `frontend/src/app/dashboard/admin/admin-audit.actions.ts` — **nuevo**
  (renombrado de `admin-audit-mobile.actions.ts`), Server Action generalizado
  `getAdminAuditPage`, fila única (`buildAuditRow`) compartida desktop/mobile.
- `frontend/src/app/dashboard/admin/admin-audit-mobile.actions.ts` —
  eliminado.
- `frontend/src/app/dashboard/admin/page.tsx` — se retira el estado
  `auditPage`/`parseAuditPage`/`auditQuery`/`auditRows` (movido al cliente);
  se mantiene la resolución de filtros desde `searchParams` (sin cambios de
  UX) y las lecturas de resumen (overview/roleChange/notification).
- `test/admin-audit-enterprise-density.test.ts`,
  `test/frontend-dashboard-admin.test.ts`,
  `test/frontend-dashboard-admin-section-tabs.test.ts`,
  `test/frontend-admin-live-read-contract.test.ts`,
  `test/frontend-admin-metadata-guard.test.ts`,
  `test/audit-suite-completeness.test.ts` — alineados al contrato nuevo
  (constantes renombradas, ausencia de `auditQuery`/`ADMIN_AUDIT_PAGE_SIZE` en
  `page.tsx`, sanitización de fila verificada en el Server Action).
- `frontend/e2e/fixtures/admin-populated-api-server.mjs` — `AUDIT_EVENTS`
  pasa de 11 entradas fijas a 47 (cicladas sobre las 11 originales) para que
  cualquier `limit`/`offset` adaptativo dentro del cap 32 tenga filas reales
  que paginar (antes sólo alcanzaba para los 9/10 fijos).
- `frontend/e2e/admin-mobile-ops-modules-no-scroll.spec.ts` — entrada `audit`
  de `OPS_MODULES` pasa de `maxItemsPerPage: 10` (fijo) a `32` (cap RF) y se
  suma a la rama de snapshot estabilizado (mismo patrón anti-carrera que
  Sesiones/Usuarios).
- `frontend/e2e/admin-mobile-final-polish-no-scroll.spec.ts` —
  `auditModuleItems` espera un conteo de ítems estable (dos lecturas iguales)
  antes de medir geometría, evitando la misma carrera medición↔fetch para el
  módulo ahora adaptativo.
- `docs/implementation/admin-audit-server-adaptive-pagination.md` — este
  documento.

## Validaciones ejecutadas

PNPM 10.8.1.

- `pnpm test` — 2944/2944.
- `pnpm typecheck:test` — OK.
- `pnpm security:public-surface` — PASS (sólo marcadores server-only
  esperados en `frontend/src/proxy.ts`).
- `pnpm --dir frontend lint` — OK.
- `pnpm --dir frontend typecheck` — OK.
- `pnpm --dir frontend build` — OK.
- `pnpm --dir frontend exec playwright test e2e/admin-mobile-ops-modules-no-scroll.spec.ts --grep "audit|Auditor"` — 4/4.
- `pnpm --dir frontend exec playwright test e2e/dashboard-internal-no-scroll-contract.spec.ts` — 8/8.
- `pnpm --dir frontend exec playwright test e2e/dashboard-global-masked-master-detail.spec.ts` — 16/16.
- `pnpm --dir frontend exec playwright test e2e/dashboard-real-app-shell-no-scroll-contract.spec.ts` — 37/37 (incluye "admin audit populated" con `expectNinePopulatedRows`/"47 coincidencias" preservado por el piso desktop=9, y el filtro mobile de auditoría hydration-safe).
- `pnpm --dir frontend exec playwright test e2e/admin-mobile-final-polish-no-scroll.spec.ts e2e/admin-mobile-module-layer-isolation.spec.ts e2e/admin-mobile-hub-launcher-no-scroll.spec.ts e2e/dashboard-mobile-shell-nav-contract.spec.ts e2e/dashboard-card-navigation-shell.spec.ts e2e/dashboard-single-viewport-app-shell.spec.ts` — 128/128 (tras el fix de estabilización en `auditModuleItems`).
- `e2e/admin-mobile-status-modules-no-scroll.spec.ts --grep "audit|Auditor"`
  no aplica: ese spec no incluye Auditoría (cubre otros módulos "status"); se
  ejecutó el equivalente real encontrado en `admin-mobile-ops-modules-no-scroll.spec.ts`.

`frontend/next-env.d.ts` y las capturas de
`docs/audit/evidence/dashboard-runtime-post-ux1/` fueron regeneradas por
Playwright/Next durante los e2e y se restauraron (`git checkout --`) antes del
diff review, por estar fuera de scope.

## Riesgos residuales

- **Flake medición↔fetch (P2):** el primer paint puede usar el fallback (9)
  antes de que la fila real se mida, disparando un segundo fetch con el
  `effectiveLimit` asentado. Mismo riesgo documentado en Sesiones/Usuarios/
  Alertas/Reports; mitigado en e2e con espera de conteo estable.
- **Pérdida de resolución de nombre de clínica en mobile:** el pipeline
  mobile anterior mostraba el nombre real de la clínica para actores
  `clinic_user` (best-effort, vía `getAdminClinics`); la fila unificada usa
  el formato genérico `"Clínica #{userId}"` que ya usaba desktop. Es una
  regresión cosmética menor, aceptada para cumplir "una sola fuente de
  datos" sin romper el contrato e2e ya fijado en desktop.
- **Sin salto a última página:** el pager sólo avanza/retrocede de a una
  página (igual que el resto de los módulos migrados); no hay "ir a última".
- **QA manual pendiente:** iOS/Android real y zoom físico 100–175 % siguen
  siendo obligatorios antes de cualquier gate bloqueante (PR-SRV-0 §10.5).

## Fuera de scope (no tocado)

- Backend/API/auth/DB/migrations (verificación del endpoint fue sólo
  lectura; no se pidió nada nuevo — `audit-log` ya aceptaba `limit`/`offset`
  y expone `total`).
- CI/workflows, deps/lockfiles, snapshots, `globals.css`.
- Otros módulos Admin (Clínicas, Tokens particulares, Reports, Alertas,
  Sesiones, Usuarios/Roles).
- Rutas Clínica/Particular/Público.
- R-07 (`/dashboard/informes` full route) — no adelantado.
- R-08/R-09 (cleanup de shims residuales `return null` y grep-guard) — no
  adelantados; `AdminMobileAuditModule.tsx` se mantiene como componente
  presentacional (no era un shim `return null`, así que no aplica a R-09).

## Confirmaciones

- Un solo módulo Admin tocado: Auditoría.
- Estrategia RF debounced ejecutada (no over-fetch); `AdminMobileAuditModule`
  colapsado a presentacional (sin segundo pipeline de fetch); `MOBILE_PAGE_SIZE`
  y `ADMIN_AUDIT_PAGE_SIZE` (fijo, URL-driven) eliminados; sin `matchMedia`;
  offset recomputado con `total`; anti-race por request-id; filtros
  preservados (misma UX de formulario GET) y siguen reseteando offset a 0.
- No se hizo `git add`/`commit`/`push`/`gh pr create`.
