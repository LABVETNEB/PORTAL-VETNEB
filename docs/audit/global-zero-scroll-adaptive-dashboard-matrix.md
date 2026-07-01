# Global Zero-Scroll Adaptive Dashboard Matrix

> **PR-GLOBAL-0 — Global Zero-Scroll Adaptive Dashboard Matrix (docs-only).**
> Auditoría técnica versionada. No implementa código.

---

## 1. Estado base

| Campo | Valor |
|---|---|
| Fecha | 2026-07-01 |
| Repositorio | Portal VETNEB (`C:\PORTAL-VETNEB`) |
| HEAD base esperado | `2cc2608 docs(audit): add enterprise operational platform advisory (#1210)` |
| Rama de este PR | `docs/global-zero-scroll-adaptive-dashboard-matrix` |
| Alcance | **Docs-only.** Un único archivo Markdown. |
| Cambios de código | **Ninguno.** No toca frontend/src, backend, API, auth, DB, migrations, deps, lockfiles, snapshots, CI, workflows ni tests. |

**Relación con trabajos previos:**

- **PR-ENT-0** (`docs/audit/vetneb-enterprise-operational-platform-extreme-excellence-advisory.md`, mergeado como #1210): visión de plataforma operacional y modelo por capas. Este documento es su **complemento técnico de bajo nivel**: la matriz por módulo que operacionaliza el contrato Zero-Scroll.
- **Auditoría enterprise:** definió que el contrato adaptativo es prerequisito estructural de toda función enterprise.
- **PR-PILOT-1 (futuro, primer código):** hook adaptativo + token + Clínica Tokens. Esta matriz fija a qué módulos se extiende ese patrón y en qué orden.

Este documento **no implementa cambios**: es el mapa de migración auditable.

---

## 2. Resumen ejecutivo

- **Problema global documentado:** la cardinalidad de filas/cards es una **constante de compilación por módulo** (`PAGE_SIZE`, `MOBILE_PAGE_SIZE`, `TOKENS_PAGE_SIZE`, `REPORTS_PAGE_SIZE`, `ITEMS_PER_PAGE`, inline), no un valor derivado de la altura real del contenedor.
- **El shell/densidad no alcanza sin cardinalidad adaptativa:** el shell ya es viewport-fitted (`h-dvh overflow-hidden`) y la densidad ya se compacta con tiers `@media (max-height)`, pero **el número de filas no se adapta** → en pantallas altas sobra espacio (gap muerto), en pantallas bajas/zoom alto faltan filas (clipping por `overflow: hidden`).
- **Por qué `pageSize` fijo causa gap/clipping:** el pager está pineado abajo (`margin-top:auto`) y la región de filas es `shrink-0`/`flex-1`; si `pageSize` < filas que caben → hueco; si `pageSize` > filas que caben → recorte.
- **Admin es la superficie de mayor riesgo:** paginación de servidor `limit/offset` **más** dualidad `AdminXxxReadOnlyCard` (desktop) + `AdminMobileXxxModule` (mobile), con `matchMedia` decidiendo cardinalidad/render.
- **Clínica es el mejor terreno de pilotos:** módulos cliente (`usePagedRows`) con detalle en overlay (Tokens) o master-detail acotado (Informes).
- **Particular queda en el sub-contrato:** vista token-gated detail-only (`/particulares`), sin listas paginadas → aplica viewport-fit/no-scroll/estados/móvil, no paginación adaptativa.

---

## 3. Contrato global objetivo

**Definiciones (mismo contrato, distintos énfasis):**

| Término | Significado operativo |
|---|---|
| Zero-Scroll Adaptive Dashboard | El dashboard cabe en el viewport útil sin scroll y adapta la cantidad de datos visibles. |
| Scroll-Free Viewport-Fitted Dashboard | El shell ocupa `100dvh` sin generar scroll global. |
| Viewport-Aware Dashboard Layout | El layout reacciona al viewport real, no a etiquetas de dispositivo. |
| Zoom-Aware Layout Adaptation | El zoom (que reduce el viewport CSS) recalcula densidad y cardinalidad. |
| Container-Aware Component Sizing | Los componentes se miden contra su contenedor real, no `window`. |
| Adaptive Data Density | Padding/gap/alto de fila se compactan por tokens fluidos. |
| Dynamic Page Size Calculation | `itemsPerPage = floor(availableHeight / itemHeight)`. |
| Container-Aware Adaptive Pagination | La paginación deriva su cardinalidad de la medición del contenedor. |

**Reglas obligatorias:**

1. `body`/`document` sin scroll vertical ni horizontal.
2. Módulos sin scroll interno vertical.
3. Tablas/listas/cards sin scroll interno vertical.
4. Footer/pager siempre visible.
5. Filas/cards sin clipping.
6. No-gap cuando `dataset >= itemsPerPage`.
7. Gap aceptable sólo cuando `dataset < itemsPerPage`.
8. `pageSize` fijo únicamente como **fallback inicial**.
9. Sin `MOBILE_PAGE_SIZE` como fuente de verdad.
10. Sin `matchMedia` para cardinalidad (permitido sólo para variante de presentación).
11. Estados loading/empty/error con geometría estable.
12. Master-detail sin `overflow-y-auto` como parche.
13. Estrategia de servidor definida (PR-SRV-0) **antes** de migrar cualquier módulo Admin de servidor.

---

## 4. Matriz global de módulos

> Evidencia verificada al HEAD `2cc2608` (greps de `PAGE_SIZE`/`matchMedia`/`usePagedRows`, inventario de módulos, sidebars, `MasterDetailWorkspace`, `ParticularesContent`). Riesgo: P1 alto / P2 medio / P3 bajo. "mm"=matchMedia.

### 4.1 Admin

| Módulo | Archivo | Familia | UI | Paginación | Constante | usePagedRows | limit/offset | mm cardinalidad/gate | Scroll int. | Gap | Clip | Contenedor a medir | Fila/card | Descontar | Estrategia | Prioridad | Confirmación |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Clínicas | `admin/AdminClinicsManagementCard.tsx` | C | tabla | servidor | PAGE_SIZE=9 / MOBILE=10 | no | sí | **sí (max-767, cardinalidad)** | P2 | P1 | P2 | tabla body | `tr` | thead+toolbar | superset/híbrido | Media | Confirmado |
| Informes (workflow) | `admin/AdminReportsCard.tsx` | C | tabla | servidor | PAGE_SIZE=9 / MOBILE=10 | no | sí | **sí (max-767)** | P2 | P1 | P2 | tabla body | `tr` | thead+filtros | superset/híbrido | Media | Confirmado |
| Tokens particulares | `admin/AdminParticularTokensCard.tsx` | C | tabla | servidor | PAGE_SIZE=9 / MOBILE=10 | no | sí | **sí (max-767)** | P2 | P1 | P2 | tabla body | `tr` | thead+filtros | superset/híbrido | Media | Confirmado |
| Sesiones | `admin/AdminSessionsReadOnlyCard.tsx` | C | tabla | servidor | PAGE_SIZE=8 | no | sí | **sí (min-768)** | P2 | P1 | P2 | tabla body | `tr` | thead | re-fetch debounced | Media | Confirmado |
| Roles clínica | `admin/AdminUsersRolesReadOnlyCard.tsx` | C | tabla | servidor | PAGE_SIZE=9 | no | sí | **sí (min-768)** | P2 | P1 | P2 | tabla body | `tr` | thead | re-fetch debounced | Media | Confirmado |
| Auditoría | `admin/AdminAuditCard.tsx` + `AdminAuditDenseTable.tsx` | C | tabla densa | servidor | ADMIN_AUDIT_PAGE_SIZE=9 | no | sí (page.tsx) | NO CONFIRMADO | P2 | P2 | P2 | dense table body | `tr` | thead+filtros | re-fetch (alto volumen) | Baja | Confirmado (mm: NO CONFIRMADO) |
| Alertas login | `admin/AdminFailedLoginAlertsReadOnlyCard.tsx` | C | tabla | servidor | PAGE_SIZE=5 | no | sí | NO CONFIRMADO | P2 | P2 | P2 | tabla body | `tr` | thead | re-fetch | Baja | Confirmado |
| Precios | `admin/AdminPricingEditorCard.tsx` | A | lista/editor | **cliente** | ITEMS_PER_PAGE=**1** | **sí** | no | NO CONFIRMADO | P2 | P2 | P2 | editor body | ítem precio | header+toolbar | **hook cliente** | Alta | Confirmado (1 ítem/pág = wizard) |
| Mantenimiento (dry-run) | `admin/AdminMaintenanceDryRunCard.tsx` | A | lista | **cliente** | `4` inline | **sí** | no | no | P3 | P2 | P3 | lista candidatos | fila candidato | header | **hook cliente** | Alta | Confirmado |
| Subir informe | `admin/AdminReportsUploadPanel.tsx` | E | form + fetch | ninguna (visual) | TOKEN_PAGE_SIZE=100 (fetch) | no | sí (fetch) | NO CONFIRMADO | P3 | P3 | P3 | — | — | — | detail/form (QA no-scroll) | Baja | Confirmado |
| Estado/Health | `admin/AdminSchemaHealthStatusCard.tsx` + `AdminMobileHealthModule.tsx` | D | cards resumen | ninguna | — | no | no | sí (gate, no cardinalidad) | P3 | P3 | P3 | — | — | — | QA no-scroll | Baja | Confirmado |
| Resumen/Alertas (hub tabs) | `admin/AdminCommandCenter.tsx` + `AdminSectionTabs.tsx` | D | tabs+summary | ninguna | — | no | no | NO CONFIRMADO | P3 | P3 | P3 | tabpanel | — | tablist | QA no-scroll | Baja | Confirmado |
| Mobile Auditoría | `admin/AdminMobileAuditModule.tsx` | C | tabla mobile | servidor | MOBILE_PAGE_SIZE=10 | no | sí | gate | P2 | P2 | P2 | módulo body | fila | header+pager | colapsar en variante única | Media | Confirmado |
| Mobile Command (failed-login) | `admin/AdminMobileCommandModule.tsx` | C | lista mobile | servidor | FAILED_LOGIN_PAGE_SIZE=10 | no | sí | **sí (max-767)** | P2 | P2 | P2 | módulo body | fila | header | colapsar | Media | Confirmado |
| Mobile Sesiones | `admin/AdminMobileSessionsModule.tsx` | C | lista mobile | servidor | MOBILE_PAGE_SIZE=10 | no | sí | **sí (max-767)** | P2 | P2 | P2 | módulo body | fila | header | colapsar | Media | Confirmado |
| Mobile Usuarios | `admin/AdminMobileUsersModule.tsx` | C | lista mobile | servidor | MOBILE_PAGE_SIZE=3 | no | sí | **sí (max-767)** | P2 | P2 | P2 | módulo body | fila | header | colapsar | Media | Confirmado |
| Mobile Mantenimiento | `admin/AdminMobileMaintenanceModule.tsx` | A/C | lista mobile | cliente(slice) | CANDIDATE_PAGE_SIZE=3 | no (slice) | no | **sí (max-767)** | P3 | P2 | P3 | módulo body | fila | header | colapsar | Media | Confirmado |
| Mobile Precios | `admin/AdminMobilePricingModule.tsx` | A | cards mobile | cliente(slice) | CATALOG_PAGE_SIZE=4 | no (slice) | no | **sí (max-767)** | P3 | P2 | P3 | módulo body | card | header | colapsar | Media | Confirmado |
| Notif. bell (admin) | `components/dashboard/DashboardNotificationsBell.tsx` | A | lista dropdown | cliente(slice) | ADMIN_MOBILE_PAGE_SIZE=2 | no (slice) | no | sí | P3 | P3 | P3 | dropdown body | notif | — | hook cliente (opcional) | Baja | Confirmado |

### 4.2 Clínica

| Módulo | Archivo | Familia | UI | Paginación | Constante | usePagedRows | limit/offset | mm cardinalidad | Scroll int. | Gap | Clip | Contenedor a medir | Estrategia | Prioridad | Confirmación |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Tokens particulares** | `components/dashboard/ClinicParticularTokensCard.tsx` | A | tabla+cards | **cliente** | TOKENS_PAGE_SIZE=4 (fetch cap 10) | **sí** | no (limit fijo 10) | no | P3 (hoy) | **P1** | P3 | `ParticularTokensPanelBody` (`data-clinic-access-list-body`) | **hook cliente (PILOTO)** | **Máxima** | Confirmado |
| Informes (in-shell) | `app/dashboard/ClinicInformesWorkspaceSummary.tsx` | B | master-detail | **cliente** | REPORTS_PAGE_SIZE=3 (props) | **sí** | no | NO CONFIRMADO | P2 (inline-scroll) | **P1** | P3 | región lista tras detalle | **hook cliente + MD** | Alta | Confirmado |
| Informes (full route) | `app/dashboard/informes/page.tsx` | C | tabla/MD | servidor | REPORTS_PAGE_SIZE=6 | no | sí | NO CONFIRMADO | P2 | P2 | P2 | tabla/master | superset/re-fetch | Media | Confirmado |
| Logística Visitas | `app/dashboard/ClinicLogisticaWorkspaceSummary.tsx` + `logistica/visitas/page.tsx` | B | master-detail | **ninguna** | — | no | NO CONFIRMADO | no | **P2** (`dashboard-inline-list`) | P2 | P2 | `dashboard-inline-list` | MD sin pag / QA | Media | Confirmado (summary) |
| Logística Rutas | `app/dashboard/logistica/rutas/page.tsx` | NO CONFIRMADO | NO CONFIRMADO | NO CONFIRMADO | NO CONFIRMADO | NO CONFIRMADO | NO CONFIRMADO | NO CONFIRMADO | — | — | — | — | requiere verificación | Media | **NO CONFIRMADO** |
| Logística Métricas | `app/dashboard/logistica/metricas/page.tsx` | NO CONFIRMADO | NO CONFIRMADO | NO CONFIRMADO | NO CONFIRMADO | NO CONFIRMADO | NO CONFIRMADO | NO CONFIRMADO | — | — | — | — | requiere verificación | Media | **NO CONFIRMADO** |
| Perfil público | `components/dashboard/ClinicPublicProfileCard.tsx` | E | form/detail | ninguna | — | no | no | no | P3 | P3 | P3 | — | detail/QA | Baja | Confirmado |
| Hub / Command Center | `app/dashboard/ClinicCommandCenter.tsx` + `components/dashboard/DashboardModuleHub.tsx` | D | cards resumen | ninguna | — | no | no | NO CONFIRMADO | P3 | P3 | P3 | — | QA no-scroll | Baja | Confirmado |

### 4.3 Particular

| Módulo | Archivo | Familia | UI | Paginación | Estrategia | Prioridad | Confirmación |
|---|---|---|---|---|---|---|---|
| Acceso por token / sesión | `components/public/ParticularesContent.tsx` (ruta `/particulares`) | F | detail-only token-gated | **ninguna** | viewport-fit + no-scroll + estados; **NO** paginación adaptativa | Baja | Confirmado |
| Vista pública de informe | `app/informes-veterinarios/page.tsx` | E/F | detail/marketing | ninguna | QA no-scroll | Baja | **NO CONFIRMADO** si token-gated |

**Notas de la matriz:**
- `AdminPricingEditorCard` usa `ITEMS_PER_PAGE = 1`: es un editor tipo wizard (un ítem por página), no una tabla — la migración adaptativa aquí puede no aplicar como "más filas" sino como QA no-scroll.
- Los `AdminMobile*Module` que usan `slice` no llaman `usePagedRows`; paginan en memoria con constantes propias.
- La dualidad Admin (desktop `ReadOnlyCard` + mobile `Module`) aparece como filas separadas: **ambas deben colapsar en una variante única medida**.

---

## 5. Familias arquitectónicas

### A — Cliente simple paginado
- **Descripción:** array en memoria + `usePagedRows` + pageSize local. Sustitución directa por `itemsPerPage` derivado.
- **Ejemplos reales:** `ClinicParticularTokensCard` (piloto), `AdminPricingEditorCard` (ITEMS_PER_PAGE=1), `AdminMaintenanceDryRunCard` (`usePagedRows(candidates, 4)`).
- **Riesgos:** P2 (thrashing/calibración). **Estrategia:** hook cliente + token `--dash-row-h`. **Validación:** unit hook + e2e rows-variable. **Prioridad:** Alta (candidatos tempranos).

### B — Cliente master-detail
- **Descripción:** lista + detalle; el detalle consume espacio → medir región de lista tras descontar el detalle activo.
- **Ejemplos:** `ClinicInformesWorkspaceSummary` (REPORTS_PAGE_SIZE=3), `ClinicLogisticaWorkspaceSummary` (sin paginación, `dashboard-inline-list`).
- **Riesgos:** P2 (scroll interno `dashboard-inline-scroll`; `MasterDetailWorkspace` con `xl:overflow-y-auto` + `calc(100vh-13rem)`). **Estrategia:** hook cliente + medir región de lista; eliminar overflow rígido. **Validación:** e2e no-scroll con detalle abierto. **Prioridad:** Media-Alta.

### C — Servidor limit/offset
- **Descripción:** `PAGE_SIZE` gobierna la query; cambiar cardinalidad implica re-fetch u over-fetch. Incluye la dualidad desktop/mobile.
- **Ejemplos:** todos los `AdminXxxReadOnlyCard`, `dashboard/informes/page.tsx`, `AdminAuditCard`, `AdminMobile*Module`.
- **Riesgos:** **P1** (red/race de offset + dualidad + matchMedia). **Estrategia:** PR-SRV-0 (over-fetch/híbrido) + colapsar dualidad. **Validación:** e2e admin + grep matchMedia=0. **Prioridad:** Media (tras PR-SRV-0).

### D — Cards resumen sin paginación
- **Descripción:** no rowsPerPage; necesita densidad/no-scroll, no cardinalidad.
- **Ejemplos:** hub clínica/admin, `AdminSchemaHealthStatusCard`, `StatsCards`.
- **Riesgos:** P3. **Estrategia:** QA no-scroll/no-gap. **Validación:** e2e no-scroll. **Prioridad:** Baja.

### E — Detail-only / formulario
- **Descripción:** no paginación; foco en viewport-fit y estados.
- **Ejemplos:** `AdminReportsUploadPanel`, `ClinicPublicProfileCard`, `PasswordChangePanel`, diálogos (`ModuleDialog`).
- **Riesgos:** P3. **Estrategia:** viewport-fit + estados. **Validación:** e2e no-scroll. **Prioridad:** Baja.

### F — Particular público/token-gated
- **Descripción:** rutas públicas/token-gated, detail-only; mismo sub-contrato visual sin depender de autenticación ni paginación.
- **Ejemplos:** `ParticularesContent`.
- **Riesgos:** P2 (móvil iOS/`dvh`). **Estrategia:** viewport-fit/no-scroll/estados/móvil. **Validación:** device real. **Prioridad:** Baja-Media.

---

## 6. Diagnóstico por rol

### 6.1 Admin
- **Dualidad desktop/mobile:** cada módulo de datos = `AdminXxxReadOnlyCard` (desktop) + `AdminMobileXxxModule` (mobile) → doble mantenimiento.
- **`PAGE_SIZE`/`MOBILE_PAGE_SIZE`:** constantes divergentes por variante (ej. Sessions 8, Users desktop 9 / mobile 3, Reports/Clinics/Tokens 9/10).
- **`matchMedia`:** `max-width:767` (Clinics/Reports/Tokens/mobile modules) y `min-width:768` (Sessions/Roles) deciden cardinalidad/render.
- **Servidor limit/offset:** la cardinalidad gobierna la query → migración condicionada a PR-SRV-0.
- **Módulos cliente de menor riesgo:** `AdminMaintenanceDryRunCard`, `AdminPricingEditorCard`.
- **Riesgos P1:** servidor limit/offset, dualidad, matchMedia de cardinalidad.

### 6.2 Clínica
- **Clínica Tokens (piloto):** cliente, `usePagedRows(filteredTokens, TOKENS_PAGE_SIZE)`, fetch cap 10, detalle en overlay → gap máximo, riesgo de layout mínimo.
- **Informes summary:** cliente master-detail, REPORTS_PAGE_SIZE=3.
- **Informes full route:** servidor, REPORTS_PAGE_SIZE=6.
- **Logística/master-detail:** `dashboard-inline-list`; `MasterDetailWorkspace` con `overflow-y-auto`+`calc(100vh-13rem)` → eliminar scroll rígido + `100vh`→`100dvh`.
- **Perfil/hub:** family D/E → QA no-scroll, sin paginación.

### 6.3 Particular
- **No es dashboard paginado.** Vista token-gated detail-only en `/particulares`.
- **Sub-contrato:** viewport-fit, no-scroll, estados estables, timeline simple futuro, experiencia móvil premium (`dvh`, safe-area).

---

## 7. Contrato técnico reutilizable

> Contrato conceptual, sin implementación.

| Elemento | Definición |
|---|---|
| `useAdaptiveItemsPerPage` | Hook genérico: mide contenedor real → `itemsPerPage`. Parámetros: `containerRef`, `fallbackItems`, `itemHeightPx`, `mode: table\|list\|card`, `headerHeightPx`, `safetyGapPx`, `minItems`, `maxItems`, `enabled`. Retorna `{ itemsPerPage, isMeasured }`. |
| `useAdaptiveRowsPerPage` | Especialización de tabla (`mode:"table"`); alias del piloto. |
| `AdaptivePaginatedRegion` | Primitiva body+región+pager (opcional para módulos nuevos). |
| `AdaptiveModuleSurface` | `ModuleSurface` + región medida. |
| token `--dash-row-h` | Altura de fila/card fluida (`clamp()`) integrada a la densidad existente; fuente primaria de `itemHeightPx`, medición real como fallback. |
| Fallback por módulo | La constante actual (`TOKENS_PAGE_SIZE`, `PAGE_SIZE`, etc.) pasa a `fallbackItems`; **no se elimina**, cambia de rol. |
| Medición por contenedor | `ResizeObserver` sobre el contenedor de filas más interno (`flex-1 min-h-0`), no `window`. |
| Modo table/list/card | Decide qué se descuenta (table→thead; list/card→0). |
| loading/empty/error | `enabled:false` mientras el contenedor de filas no existe; conserva fallback. |
| master-detail | `containerRef` apunta a la región de lista, no al workspace; al abrir detalle, el flex reduce la región y el observer recalcula. |
| Cliente | `itemsPerPage` → `usePagedRows(items, itemsPerPage)` (ya clampa `currentPage`). |
| Servidor | `itemsPerPage` como `limit` derivado con estrategia §8; recomputar `offset`. |

**Principio:** medir el contenedor interno hereda gratis el descuento de toolbar/filtros/header/footer vía flexbox.

---

## 8. Estrategia cliente vs servidor

### 8.1 Cliente
- `items/rows per page` derivado de medición.
- `usePagedRows(items, itemsPerPage)`; `currentPage` clampado (ya provisto).
- Fallback fijo inicial (SSR + primer paint) → cero regresión.
- Sin red.
- **Candidatos tempranos:** Clínica Tokens (piloto), Admin Maintenance dry-run, Admin Pricing, Clínica Informes summary.

### 8.2 Servidor

| Opción | Pros | Contras | Riesgos | Módulos recomendados | Cuándo aplica |
|---|---|---|---|---|---|
| **A. Re-fetch con limit derivado (debounced)** | Dataset exacto, sin sobre-transferencia | Request por resize/zoom; race de offset | Red/flicker; recomputar `offset=floor(prevFirst/newLimit)*newLimit` | Auditoría, Alertas login (alto volumen) | Datasets grandes/volátiles |
| **B. Over-fetch de superset** | Cero red en resize/zoom; reusa `usePagedRows`; UX fluida | Payload mayor; superset corto en viewports enormes | Payload; "cargar más" al agotar superset | Clínicas, Sesiones, Roles, Tokens admin, Informes | Datasets acotados, baja rotación |
| **C. Híbrido** | `limit` mínimo estable + adaptación dentro del superset; re-fetch sólo al exceder | Complejidad media | Bajo | Default admin (piden 8-10, rara vez >2-3 páginas) | Mayoría admin |

**Recomendación:** superset/híbrido para Clínicas/Sesiones/Roles/Tokens/Informes; re-fetch debounced para Auditoría/Alertas.

**Bloqueo explícito:** **Admin servidor queda bloqueado hasta PR-SRV-0** (spike que fija la política por módulo sin tocar producción).

---

## 9. QA global

| Categoría | Método | Estado |
|---|---|---|
| Source-contract tests | `pnpm test` (node --test): presencia de hook, ausencia de acoplamiento fijo, fallback preservado, prohibiciones (`overflow-y-auto`, `CompactPager` donde aplique) | **Automatizable ahora** |
| Playwright e2e | no-scroll (`assertAdaptiveNoScroll` existe en `dashboard-viewport-zoom-adaptability.spec.ts`), conteo de filas por `data-*-row`, no-gap condicional, `currentPage` clamp | **Automatizable ahora** |
| No-scroll assertions | `html/body/main scrollHeight ≤ clientHeight + tol`; `overflowY ≠ auto/scroll` | Automatizable |
| No-gap assertions | `footer.top - lastRow.bottom ≤ 1 rowHeight` cuando `dataset ≥ itemsPerPage` | Automatizable |
| Row count assertions | conteo difiere entre 1080 y 720 | Automatizable |
| currentPage clamp | página válida tras cambio de itemsPerPage | Automatizable |
| Visual regression | manual (baselines Chromium-Linux, #1205-1209) | **QA manual obligatorio antes de gate** |
| Screenshots before/after | evidencia por módulo (fuera de `test-results/`) | Manual |
| Android real | barra dinámica, touch | **QA manual obligatorio** |
| iOS real | `dvh`/safe-area quirks | **QA manual obligatorio** |
| Desktop zoom | 100/110/125/150/175% | Automatizable (viewport efectivo) + manual (chrome real) |
| Resize continuo | thrashing, estabilidad | Automatizable |

- **Automatizable ahora:** source-contract + e2e no-scroll/no-gap/row-count/clamp.
- **QA manual obligatorio:** iOS/Android real, zoom físico, percepción de regresión visual.
- **No gate todavía:** cardinalidad exacta por viewport y no-gap estricto (dependen del runner) → tests informativos.
- **Futuro gate bloqueante:** cuando ≥3 corridas consecutivas verdes y baselines visuales regenerados con autorización.

---

## 10. Criterios globales de aceptación

1. `body`/`document` sin scroll vertical ni horizontal.
2. Sin scroll interno vertical en módulos/tablas/listas/cards.
3. Paginación siempre visible.
4. Sin clipping de filas/cards.
5. No-gap cuando `dataset >= itemsPerPage`.
6. `pageSize` fijo sólo como fallback inicial.
7. `MOBILE_PAGE_SIZE` eliminado como fuente de verdad.
8. `matchMedia` eliminado como fuente de cardinalidad.
9. Estrategia cliente/servidor definida por módulo.
10. Admin/Clínica cumplen el mismo contrato; Particular cumple el sub-contrato.
11. QA documentado (source-contract + e2e + manual).
12. Roadmap aprobado por Nico.

---

## 11. Roadmap incremental por PRs chicos

| PR | Objetivo | Toca | No toca | Riesgo | Validaciones | Criterio de salida |
|---|---|---|---|---|---|---|
| **PR-GLOBAL-0** | Matriz global (este doc) | `docs/audit/*.md` | código | P3 | lectura | Matriz aprobada |
| **PR-PILOT-1** | Hook + token + Clínica Tokens | hook, `ClinicParticularTokensCard`, `ParticularTokensCardPrimitives`, `globals.css`, test+e2e, doc | backend/admin/CompactPager/limit | P1 | `pnpm test`+e2e zoom/mobile | Tokens adaptativo, contract alineado |
| **PR-PILOT-2** | QA visual/e2e piloto (mock 6→12) | `dashboard-viewport-zoom-adaptability.spec.ts` | producción | P2 | e2e ×3 | Filas varían 1080 vs 720 |
| **PR-CLIENT-1** | 2º cliente Clínica (Informes summary) | `ClinicInformesWorkspaceSummary`, test/e2e | servidor | P2 | `pnpm test`+e2e | No-scroll + cardinalidad tras detalle |
| **PR-CLIENT-2** | Cliente Admin bajo riesgo (Maintenance/Pricing) | `AdminMaintenanceDryRunCard` o `AdminPricingEditorCard` | servidor/mobile | P2 | `pnpm test`+e2e | 1er módulo admin adaptativo (cliente) |
| **PR-MD-1** | Master-detail: quitar `overflow-y-auto`+`calc(100vh)` | `MasterDetailWorkspace`, `ClinicLogisticaWorkspaceSummary` | servidor | P2 | e2e visual-contract | Sin scroll interno rígido |
| **PR-SRV-0** | Decisión servidor (spike) | doc + POC aislado | producción | P2 | N/A | Política por módulo |
| **PR-SRV-1** | 1er admin servidor (Sessions/Roles) | 1 `ReadOnlyCard` + colapsar mobile | otros admin | **P1** | `pnpm test`+e2e admin | 1 módulo servidor adaptativo, sin matchMedia cardinalidad |
| **PR-SRV-2** | Lote admin servidor (Clinics/Tokens/Informes/Reports) | cards restantes por lotes 1-2 | — | P1 | e2e admin | Dualidad colapsada |
| **PR-PART-1** | Particular token viewport-fit | `ParticularesContent` | paginación | P2 | e2e público | No-scroll/estados estables |
| **PR-CLEAN-1** | Eliminar matchMedia/MOBILE_PAGE_SIZE de cardinalidad | varios | presentación | P2 | `pnpm test` grep-guard | Cero fuente ilegítima |
| **PR-QA-1** | e2e global no-scroll/no-gap/rows-variable | specs e2e | producción | P2 | e2e suite | Cobertura global verde |
| **PR-DOCS-1** | Closeout documental global | docs | código | P3 | lectura | Contrato documentado |

---

## 12. Priorización

**Top 5 candidatos iniciales (cliente, bajo riesgo):**
1. `ClinicParticularTokensCard` — piloto: cliente, pageSize=4, gap máximo, detalle en overlay, no en snapshots.
2. `AdminMaintenanceDryRunCard` — cliente, `usePagedRows(…,4)`, admin de bajo tráfico.
3. `AdminPricingEditorCard` — cliente, `usePagedRows` (nota: ITEMS_PER_PAGE=1, wizard → QA más que "más filas").
4. `ClinicInformesWorkspaceSummary` — cliente, valida familia B (master-detail).
5. `MasterDetailWorkspace` — primitiva; desbloquea B en informes+logística.

**Top 5 más riesgosos (esperan):**
1. `AdminReportsCard` (servidor + matchMedia + dual mobile + filtros).
2. `AdminParticularTokensCard` (ídem, alta complejidad).
3. `AdminClinicsManagementCard` (servidor + matchMedia + edición/drawer).
4. `AdminAuditCard`/`AdminAuditDenseTable` (alto volumen → re-fetch).
5. `dashboard/informes/page.tsx` (ruta full servidor).

**Deben esperar:** todos los `AdminXxxReadOnlyCard` de servidor hasta PR-SRV-0.
**Sólo QA/no-scroll (sin pagination):** hub clínica/admin, `AdminSchemaHealthStatusCard`, `StatsCards`, `ClinicPublicProfileCard`, `AdminReportsUploadPanel`, Particular.
**Servidor que requiere PR-SRV-0:** Sesiones, Roles, Clínicas, Tokens admin, Reports, Auditoría, Alertas, Informes full.

---

## 13. Riesgos globales

| Riesgo | Sev | Causa | Impacto | Mitigación | Evidencia esperada |
|---|---|---|---|---|---|
| Servidor limit/offset | **P1** | Cardinalidad gobierna la query | Re-fetch/race offset | PR-SRV-0 (over-fetch/híbrido) antes | POC + política |
| currentPage inválido | **P1** | pageSize cambia, offset viejo | Página inexistente | Clamp (cliente) / recompute offset (servidor) | e2e clamp |
| Dualidad desktop/mobile admin | **P1** | 2 componentes por módulo | Doble mantenimiento, cardinalidad por dispositivo | Colapsar en variante única medida | grep MOBILE_PAGE_SIZE=0 |
| matchMedia de cardinalidad | **P1** | `matchMedia` decide itemsPerPage | Cardinalidad por dispositivo | Sólo para presentación; medición decide | grep cardinalidad=0 |
| MOBILE_PAGE_SIZE | **P1** | Constante mobile como verdad | Ídem | Eliminar como fuente | grep=0 |
| Over-fetch excesivo | P2 | superset muy grande | Payload/tiempo | Cap 30-50 + "cargar más" | tamaño respuesta |
| e2e flaky | P2 | race resize↔medición | Rojos intermitentes | `toPass`+tolerancias | 3 corridas verdes |
| Snapshots cambiantes | P2 | filas variables | Diff píxeles | Viewport determinista; manual antes de gate | baseline diff |
| rowHeight heterogéneo | P2 | contenido no uniforme | Cálculo sesgado | `--dash-row-h` + truncate/line-clamp | filas uniformes |
| Cards de altura variable | P2 | cards mobile 3 líneas | Cálculo sesgado | token por variante + medir fila más alta | captura |
| Filtros expandibles | P2 | cambian alto del contenedor | Cardinalidad desfasada | Medir contenedor interno (flex absorbe) | e2e filtros on/off |
| Master-detail | P2 | detalle consume alto | Lista mal medida | Medir región lista, no workspace | e2e detalle abierto |
| Android/iOS quirks | P2 | viewport dinámico | Fit roto | `dvh`+safe-area+device QA | captura real |
| `100vh` vs `100dvh` | P2 | `MasterDetailWorkspace` usa `calc(100vh-13rem)` | Barra móvil rompe fit | Migrar a `dvh` + cardinalidad | inspección iOS |
| overflow ocultando datos | P2 | `overflow:hidden` sin recalcular | Info perdida | hidden sólo con cardinalidad derivada | e2e no-clip |
| PR demasiado grande | P2 | lote | Review/rollback difícil | 1 módulo por PR | `git diff --stat` acotado |

---

## 14. No-alcance

Este PR (**PR-GLOBAL-0**) es **docs-only**. **No implementa**: hook, token, CSS, tests, e2e, snapshots, CI, backend, API, DB, dependencias ni cambios visuales.

Toca **un único archivo**: `docs/audit/global-zero-scroll-adaptive-dashboard-matrix.md`.

---

## 15. Recomendación final

- **PR-GLOBAL-0 recomendado como docs-only:** fija la matriz auditable por módulo/rol/familia y el orden de migración antes de escribir código.
- **PR-PILOT-1 recomendado como primer PR de código posterior:** Clínica Tokens (cliente, gap máximo, detalle en overlay, no en snapshots), con artefactos reutilizables (`useAdaptiveRowsPerPage` + `--dash-row-h`).
- **Admin servidor bloqueado hasta PR-SRV-0:** la migración de módulos `limit/offset` requiere decidir over-fetch vs re-fetch (riesgo P1 de red/race).
- **Particular dentro del sub-contrato viewport/no-scroll:** no es dashboard paginado; aplica viewport-fit/estados/móvil.
- **No mega PR:** migración por oleadas de PRs chicos, cada uno con e2e no-scroll/no-gap y rollback trivial (el fallback preserva función).

---

### Anexo — Evidencia y NO CONFIRMADO

**Constantes de cardinalidad confirmadas (HEAD `2cc2608`):** Clínica — `TOKENS_PAGE_SIZE=4` (client), `REPORTS_PAGE_SIZE=3` (client summary), `REPORTS_PAGE_SIZE=6` (server route). Admin — `PAGE_SIZE` 9/8/9/9/5, `MOBILE_PAGE_SIZE` 10/3, `ADMIN_AUDIT_PAGE_SIZE=9`, `ITEMS_PER_PAGE=1`, `FAILED_LOGIN_PAGE_SIZE=10`, `CATALOG_PAGE_SIZE=4`, `CANDIDATE_PAGE_SIZE=3`, `TOKEN_PAGE_SIZE=100` (fetch), `ADMIN_MOBILE_PAGE_SIZE=2`.

**`matchMedia` confirmado:** `max-width:767` (Clinics/Reports/Tokens/Mobile Command/Health/Maintenance/Pricing/Sessions/Users mobile), `min-width:768` (Sessions/Roles desktop `ReadOnlyCard`).

**Escape hatches de overflow confirmados:** `MasterDetailWorkspace` (`xl:max-h-[calc(100vh-13rem)] xl:overflow-y-auto`, `100vh`); `dashboard-inline-scroll { overflow-y:auto }` y `dashboard-table-scroll { overflow-x:auto }` en `globals.css`.

**NO CONFIRMADO (requiere verificación manual antes de migrar):** paginación de `logistica/rutas` y `logistica/metricas`; overflow real de cada `AdminXxxReadOnlyCard`; modelo exacto de mm en `AdminAuditCard`/`AdminFailedLoginAlertsReadOnlyCard`; si `informes-veterinarios` es token-gated.

---

*Documento generado como PR-GLOBAL-0 (docs-only). No representa implementación de código. Evidencia verificada al HEAD indicado; lo no verificable queda marcado NO CONFIRMADO.*
