# R-01 — Admin Failed-Login Alerts server adaptive pagination

## PR

`feat(admin): adapt failed-login alerts server pagination to viewport`

Tercer módulo Admin **servidor** (`limit`/`offset`, familia C) migrado a cardinalidad
adaptativa Zero-Scroll, ejecutando **R-01** del roadmap rector
(`docs/audit/final-global-vetneb-50-60-pr-roadmap.md`, Fase 1) con la política de
PR-SRV-0 y la plantilla ya probada en Sesiones (#1221) y Usuarios/Roles (#1222).

## Base

- Rama de trabajo: `feat/admin-failed-login-alerts-server-adaptive-pagination`.
- Base: `main @ 1f2dfdd feat(admin): add users jump to page (#1262)`.
- Fecha: 2026-07-02.

## Documentos usados

1. `docs/audit/final-global-vetneb-50-60-pr-roadmap.md` — R-01, Fase 1, reglas §6/§8.
2. `docs/implementation/server-adaptive-pagination-strategy.md` (PR-SRV-0) — módulo #7,
   colapso con #12, política de offset (§6), anti-race (§7), límites (§8).
3. `docs/implementation/admin-sessions-server-adaptive-pagination.md` (SRV-1) — plantilla.
4. `docs/implementation/admin-users-roles-server-adaptive-pagination.md` (SRV-2) — trato de
   contratos legacy (piso desktop) y decisión de no ampliar data-attributes.
5. `docs/implementation/clinic-logistics-master-detail-workspace.md` — sólo para confirmar
   que Logística summary está cerrada; **no se reabrió**.

## Skills / modelo / esfuerzo

| Rol | Valor |
|---|---|
| Principal | `vetneb-production-web-optimization-engineer` |
| Complementaria | `vetneb-briefing-planificacion-diseno-desarrollo-pruebas` |
| Complementaria | `vetneb-web-end-to-end-global` |
| Complementaria | `vetneb-admin-dashboard-operational-actions` |
| Guardrail | `vetneb-security-production-invariants` |
| Modelo | Claude Fable 5 (`claude-fable-5`) |
| Esfuerzo | Máximo |

El ZIP/carpeta de skills **no** fue copiado, descomprimido, editado, versionado ni
ejecutado dentro de `C:\PORTAL-VETNEB`.

## Contrato anterior

- Dos runtimes con dos fetch independientes:
  - `AdminFailedLoginAlertsReadOnlyCard` (desktop, `PAGE_SIZE=5`, filtros
    Superficie/Motivo, CSV, `total` expuesto), montada sólo en la tab desktop
    "Alertas" de `ModuleTabs` (panel activo único).
  - `AdminMobileFailedLoginSection` **interna** a `AdminMobileCommandModule`
    (chip "Alertas" de la familia status mobile), `FAILED_LOGIN_PAGE_SIZE=10`,
    `matchMedia("(max-width: 767px)")` como gate de fetch, sin filtros/CSV,
    formatters duplicados.
- `limit` fijo por dispositivo (5 vs 10); pager con constante fija.
- Sin recompute de `offset`, sin guard anti-carrera.

## Contrato nuevo

- **Runtime único** en `AdminFailedLoginAlertsReadOnlyCard`: una sola fuente de datos,
  filtros, `offset` y paginación. Renderiza dos presentaciones responsive
  (`Card` desktop `hidden md:flex` primero en el DOM + sección mobile `md:hidden`),
  nunca ambas visibles a la vez.
- `FAILED_LOGIN_FALLBACK_ROWS = 5` (ex `PAGE_SIZE`) sólo como fallback pre-medición.
- `FAILED_LOGIN_LIMIT_CAP = 25` como cota de payload del re-fetch (`maxItems` del hook).
- `useAdaptiveItemsPerPage` mide el **contenedor de filas visible** (región de tabla
  desktop o lista mobile, elegido por altura medida, no por `matchMedia`) y una
  **fila real** (`ref` en la primera fila/ítem); el header de la tabla desktop se
  descuenta (`FAILED_LOGIN_TABLE_HEADER_PX = 44`, el `h-11` por defecto de `TableHead`).
- `effectiveLimit = rowsPerPage` (clamp `[1, 25]`); `query.limit = effectiveLimit`.
- `page`/`pageCount` y Anterior/Siguiente usan `effectiveLimit`, no una constante fija.
- Filtros server-side (Superficie/Motivo) resetean `offset` a 0 en su handler;
  "Limpiar filtros" también. La cardinalidad (resize/zoom) nunca toca los filtros.
- CSV conserva su contrato: sólo filtros, sin `limit`/`offset`.
- Sin `matchMedia`, sin `FAILED_LOGIN_PAGE_SIZE`, sin `isMobileViewport`.
- **Prop `presentation` estática por punto de montaje** (`"responsive"` default /
  `"mobile"` en el chip del command module). Es señal de presentación permitida por
  PR-SRV-0 §7.4 (nunca cardinalidad, nunca `matchMedia`): evita montar la tabla
  desktop oculta (`dashboard-table-responsive`, `overflow-x: auto`) dentro del módulo
  status mobile, cuyo contrato e2e escanea el computed style de **todos** los
  descendientes en busca de overflow auto/scroll.

## Estrategia elegida: RF debounced con cap 25

PR-SRV-0 §5 daba dos opciones para Alertas login: "RF debounced (o OF cap 25 si el
volumen bajo lo justifica)", con el paso previo de confirmar volumen real (R-01).

**Verificación read-only ejecutada:** `login_failed_attempts` sólo recibe inserts
(`server/db.ts` → `insert(loginFailedAttempts)`); **no existe ninguna purga, retención
ni job de limpieza** en `server/**`. El volumen crece sin cota con cada intento fallido
(incluye tormentas de fuerza bruta) → "volumen bajo" **no es confirmable** desde el
repo y puede dejar de ser cierto en cualquier incidente. Por PR-SRV-0 §8.3 (datasets de
alto volumen no usan over-fetch), se elige **RF debounced**:

- `limit` derivado exacto de la medición (`effectiveLimit = rowsPerPage`), nunca un
  superset por encima de lo visible;
- cap 25 (§8.1) como cota superior de payload;
- re-fetch sólo cuando la medición **cambia** (debounce por `requestAnimationFrame` +
  comparación de igualdad `measurementsEqual`; el hook global sólo cambia `rowsPerPage`
  si el valor derivado difiere);
- request-id anti-carrera (idéntico a SRV-1/2).

Mecánicamente es la misma plantilla que Sesiones/Usuarios; la diferencia doctrinal es
que el cap es cota RF de payload, no techo de superset OF. Backend: el endpoint
normaliza `limit` con `MAX_LIST_LIMIT=100` (`server/lib/list-pagination.ts`) → cap 25
entra sin ningún cambio de API.

## Cómo se mide `rowsPerPage`

Igual que SRV-1: refs de estado (`setDesktopBodyNode`/`setMobileBodyNode` +
`setDesktopRowNode`/`setMobileRowNode`), `ResizeObserver` agenda con
`requestAnimationFrame`, la región visible se elige por altura medida (mobile primero,
desktop después), la fila real medida reemplaza el fallback
(`FAILED_LOGIN_ROW_HEIGHT_FALLBACK_PX = 48`, celdas `p-3.5` de dos líneas), y el header
de tabla desktop se descuenta. `minItems = 1` en ambas presentaciones: **no se replica
el piso desktop de Users/Roles** porque ningún contrato legacy exige N filas exactas
para Alertas (verificado: ninguna spec e2e ni test pinnea conteos fijos desktop de esta
card; el fixture poblado ni siquiera sirve el endpoint).

## Cómo se recomputa `offset`

PR-SRV-0 §6, idéntico a SRV-1/2:

```
nextOffset = Math.floor(currentOffset / effectiveLimit) * effectiveLimit;
if (total != null) {
  lastValidOffset = Math.max(0, (Math.ceil(total / effectiveLimit) - 1) * effectiveLimit);
  nextOffset = Math.min(nextOffset, lastValidOffset);
}
nextOffset = Math.max(0, nextOffset);
```

`total` se lee de `snapshotRef` (última respuesta; el endpoint lo expone — subgrupo 1).
Los filtros resetean `offset` a 0 aparte.

## Cómo se evita la carrera

- **Request id** (`latestRequestRef`): cada carga incrementa el id; una respuesta cuyo
  id ya no es el vigente se descarta (éxito y error).
- **Debounce de medición**: rAF + `measurementsEqual`; sin ráfaga de queries en
  resize/zoom.
- **Fallback estable**: sin contenedor medido, el hook devuelve el fallback (5) y no
  re-fetchea por cardinalidad; loading/empty/error tienen geometría estable.

## Qué shim mobile queda

`AdminMobileCommandModule` **no** se reduce a `return null` (a diferencia de
`AdminMobileSessionsModule`/`AdminMobileUsersModule`): sólo su chip "Alertas" era
failed-login; Resumen y Actividad son contenido propio del command center mobile.
El colapso "si corresponde" del roadmap se resolvió así:

- eliminados de `AdminMobileCommandModule`: `AdminMobileFailedLoginSection`,
  `FAILED_LOGIN_PAGE_SIZE`, `matchMedia`, `getAdminFailedLoginAlerts`, formatters y
  tipos duplicados, `AdminMobileOpsPager` import;
- el chip "Alertas" monta `<AdminFailedLoginAlertsReadOnlyCard presentation="mobile" />`
  (lazy: `AdminMobileStatusModule` sólo monta la sección activa, y `ModuleTabs` sólo el
  panel activo → nunca hay doble fetch);
- selectores e2e preservados: `data-admin-mobile-status-item="true"` por fila,
  `AdminMobileOpsPager` con `aria-label="Paginación de intentos fallidos"`, botón
  "Actualizar".
- **Sin data attributes nuevos** (decisión SRV-2): la medición es por `ref` y no se
  amplía la superficie DevTools (además `login`/`failed` en nombres `data-*` no aportan).

La limpieza final de shims sigue agendada en R-09 (este módulo no deja shim `return null`).

## Archivos tocados

- `frontend/src/app/dashboard/admin/AdminFailedLoginAlertsReadOnlyCard.tsx` — runtime único.
- `frontend/src/app/dashboard/admin/AdminMobileCommandModule.tsx` — colapso de la sección
  failed-login duplicada; chip monta la card.
- `test/frontend-admin-failed-login-alerts-card.test.ts` — source-contract alineado
  (autorizado: test del módulo) al contrato adaptativo + guards de colapso.
- `frontend/e2e/admin-mobile-status-modules-no-scroll.spec.ts` — **sólo** las partes de
  Alertas: mock 13→40 (página 2 existe para cualquier fit ≤ 25) y el test dedicado pasa
  de "exactamente 10" al contrato adaptativo (fit asentado > fallback, ≤ cap, última
  fila dentro del content band, página 2 navegable). *Nota de desvío:* el roadmap
  nombraba "la spec e2e admin-mobile-ops"; el bloque real de Alertas vive en la spec
  **status** (el chip es familia status, no ops) — es el bloque e2e propio equivalente.
  Los bloques de otros módulos quedaron intactos.
- `docs/implementation/admin-failed-login-alerts-server-adaptive-pagination.md` — este doc.

## Validaciones ejecutadas

PNPM 10.8.1 (coincide con `packageManager`).

- `node --test test/frontend-admin-failed-login-alerts-card.test.ts` — 20/20.
- `pnpm test` — 2939/2939.
- `pnpm typecheck:test` — OK.
- `pnpm security:public-surface` — PASS (sólo marcadores server-only esperados en
  `frontend/src/proxy.ts`).
- `pnpm --dir frontend lint` — OK.
- `pnpm --dir frontend typecheck` — OK.
- `pnpm --dir frontend build` — OK.
- `pnpm --dir frontend exec playwright test e2e/admin-mobile-status-modules-no-scroll.spec.ts`
  — 23/23 (bloque propio de Alertas + loops de chips con el colapso).
- `pnpm --dir frontend exec playwright test e2e/admin-mobile-ops-modules-no-scroll.spec.ts
  e2e/dashboard-viewport-zoom-adaptability.spec.ts e2e/dashboard-internal-no-scroll-contract.spec.ts
  e2e/dashboard-global-masked-master-detail.spec.ts` — 97/97.

`frontend/next-env.d.ts` fue regenerado por Playwright/next dev durante los e2e y se
restauró (`git checkout --`) antes del diff review, por estar fuera de scope.

## Riesgos residuales

- **Flake medición↔fetch (P2):** primer paint con fallback 5 (menos filas que el fit
  real) → nunca overflow antes del ajuste; el test dedicado espera el asentamiento
  (conteo estable > fallback) antes de paginar. Mitigado con `toPass`/tolerancias.
- **Altura de fila representativa:** se mide la primera fila; `safetyGap` del hook
  sesga a subestimar (seguro). Filas desktop con `user agent` largo truncan (`truncate`),
  no crecen.
- **Doble instancia teórica:** la card monta una instancia por punto de montaje
  (tab desktop / chip mobile); nunca coexisten visibles ni fetchean a la vez
  (panel/sección activos únicos + CSS breakpoints). Aceptado y documentado.
- **QA manual pendiente:** iOS/Android real y zoom físico 100–175 % siguen siendo
  obligatorios antes de cualquier gate bloqueante (PR-SRV-0 §10.5).

## Fuera de scope (no tocado)

- Otros módulos Admin (`AdminClinicsManagementCard`, `AdminReportsCard`,
  `AdminParticularTokensCard`, `AdminAuditCard`, Sesiones, Usuarios/Roles).
- Backend/API/auth/DB/migrations (verificación de `limit` fue sólo lectura).
- CI/workflows, deps/lockfiles, snapshots, `globals.css`.
- Rutas Clínica/Particular/Público; Logística summary (cerrada, no reabierta).
- R-02..R-09 (no se adelantó ningún PR posterior).

## Confirmaciones

- Un solo módulo Admin tocado: Alertas login (+ su colapso mobile).
- No `matchMedia` como cardinalidad; `PAGE_SIZE` sólo fallback; offset recomputado;
  anti-race por request-id.
- No se hizo `git add`/`commit`/`push`/`gh pr create`.
