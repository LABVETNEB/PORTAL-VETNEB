# PROPUESTA — EVOLUCIÓN DEL DASHBOARD VETNEB A PARTIR DE LA REFERENCIA GOOGLE DRIVE

**Tipo:** auditoría comparativa de caja blanca y propuesta de evolución (sólo propositiva).
**Repositorio:** LABVETNEB/PORTAL-VETNEB
**Baseline de código:** `main@9dfb5024319e3d6747b9c659a83a60525fb9392c` (= `origin/main` al iniciar; C23b PR5, #1897).
**Naturaleza del cambio:** docs-only. No modifica código, tests, fixtures, tokens, configuración, dependencias ni documentos rectores.

| Campo | Valor |
| --- | --- |
| Document owner | Dashboard / Frontend domain owner |
| Domain | Dashboard autenticado: comparación con la referencia Google Drive y propuesta de evolución |
| Lifecycle status | PROPOSED |
| Authoritative source role | Ninguno. Propuesta para revisión y autorización. **No** es fuente de implementación |
| Fuente rectora | [AUDITORIA_GLOBAL_DASHBOARD_VETNEB_VS_DRIVE.md](./AUDITORIA_GLOBAL_DASHBOARD_VETNEB_VS_DRIVE.md) (sin cambios) |
| Evidencia externa | [GOOGLE_DRIVE_REFERENCIA_UI_CONSOLIDADA.md](./GOOGLE_DRIVE_REFERENCIA_UI_CONSOLIDADA.md) (sin cambios) |
| Effective date | 2026-10-20 |
| Last verified date | 2026-10-20 |
| Review cadence | Única; se reemplaza por las decisiones de Nico sobre §19 |
| Supersedes | Ninguno |
| Superseded by | Ninguno |
| Related controls or gaps | Hallazgos P0–P4 de la fuente rectora; deuda D4–D8 y F-T1..F-T7 de C25; PR-BUG-03; B3 |
| Evidence or approval reference | Ninguna PR. Rama local `docs/dashboard-drive-evolution-proposal` sin commit |
| Revisión | v2 (2026-10-20): revisión crítica contra código, tests y GitHub; cambios en §0 |

> **Autoridad.** Este documento no fija destinos, no modifica la geometría canónica de §46, no abre un Programa D y no altera el roadmap A/B/C. Toda divergencia con la fuente rectora se registra con ambas procedencias y se eleva a decisión (§19). Las contradicciones originales entre la referencia Drive y la fuente rectora (§XIV.4 de la referencia) **siguen sin resolver**.

---

## 0. Registro de revisión v1 → v2

La v1 se redactó en la misma fecha. La v2 la revisa contra el código de `main@9dfb5024`, los tests ejecutables y el estado real de las PRs (`gh pr view`). Cada cambio conserva el ID original para mantener la trazabilidad.

| # | Sección | v1 | v2 | Evidencia que motivó el cambio |
| --- | --- | --- | --- | --- |
| R-01 | §15, §19 | PR-DRV-01, ID nuevo | **PR-BUG-03**, el correctivo del rector (§55) que C10–C12 no absorbieron. Alcance verificado: `role="search"` en S1–S7 y el `aria-label` sobre `div` de S5. Sin elementos nuevos | `AdminUsersRolesReadOnlyCard.tsx:418-421`; las 4 `FilterBar` S2/S3/S6/S7 sin `role` ni `aria-label`; S4 ya tiene un contenedor propio |
| R-02 | §10 DRV-05, §13 | «S4/S5 añaden un contenedor: verificar A02» | El atributo va sobre elementos existentes: no hay cambio geométrico | Lectura de S4 (`AdminClinicsManagementCard.tsx:538-551`) y S5 (`:418`) |
| R-03 | §10 DRV-05 | Incluía P2-05 (anuncio de conteo) como pendiente | P2-05 está **parcialmente resuelto** por las live regions de los pagers. Se excluye de la PR y queda para verificar en C26 | `DashboardPager.tsx:197,229`; `AdminUsersRolesReadOnlyCard.tsx:655`; `AdminAuditCard.tsx:356`; `ClinicInformesWorkspaceSummary.tsx:531`; `ClinicParticularTokensCard.tsx:1143` |
| R-04 | §10 DRV-08, §15 | Enlace de salto nuevo | **Reutilizar `SkipToContent`**, que ya es un `<button>` (cumple la regla «sin `<a>`» de AGENTS §10) y ya tiene CSS fuera de flujo. Basta con `id="main-content"` en los dos `<main>` del dashboard | `components/public/SkipToContent.tsx`; `globals.css:1973-2001`; `admin/page.tsx:756`; `ClinicDashboardShell.tsx:92` |
| R-05 | §15 | PR-DRV-02 en el tramo «antes de C26» sin distinguir | **Conveniente, no obligatorio**: WCAG 2.4.1 ya se satisface con el landmark `main` | ARIA11 |
| R-06 | §10 DRV-09, §15 | Migrar los overlays a `dashboardScopedPortal` | **Regla `@media (forced-colors: active)` sin capa**, acotada a los overlays portados a `body`. El defecto sólo existe en forced-colors (en modo normal el anillo de `box-shadow` es visible). Migrar portales cambia el apilamiento y la contención: más riesgo sin más beneficio | Tailwind `^4.3.3` (`outline-none` = `outline-style: none`); `globals.css:192` (`@layer base`, perdida contra utilidades); portales a `body` en `DashboardNotificationsBell.tsx:512,552`, `ModuleCard.tsx:261`, `UploadReportModal.tsx:862`, `ClinicEditDrawer.tsx:210`, y los `ModuleDialog` sin `dashboardScopedPortal` (3 de 22 sitios lo usan) |
| R-07 | §15 | PR-DRV-03 sin base rectora explícita | **Obligatorio antes de C26**: §56.6 del rector incluye «foco visible bajo `forced-colors`» en la validación de accesibilidad que ejecuta C26 | rector §56.6 |
| R-08 | §15 | PR-DRV-04 (sonda) en el tramo previo a C26 | **Diferida y no como PR independiente**: sólo alimenta decisiones del tramo posterior. Pasa a ser el paso de evidencia previo de la primera PR que la necesite | Ningún ítem anterior a C26 depende de ella |
| R-09 | §10 DRV-07, §15 | F-T1 «riesgo bajo», tramo previo | **Riesgo medio, diferible**: exponer `FieldVisitDetailDialog` en escritorio exige una 8.ª columna o un disparador dentro de una celda, en una tabla consumidora de A03 | `logistica/visitas/page.tsx:195-245` |
| R-10 | §5.3, §10 DRV-03, §16 | «En < 768 los chips sólo están dentro del sheet» (S2 y S3) | Sólo S3 tiene sheet. **S2 no muestra el estado aplicado en ningún viewport < 1280** | `AdminParticularTokensCard.tsx:1378-1382`; acta C12 (S2 sin filtro avanzado móvil, contrato B05) |
| R-11 | §5.2 | `useCollectionSelection`: «Auditoría (+ uso por C17)» | Auditoría e Informes admin | `AdminReportsCard.tsx:45,309` |
| R-12 | §17, §19 | D-01(b): enmienda docs-only de §62 con excepciones | **D-01(b) rechazada**. Sustituida por D-01(c): C26 se cierra contra §58 con estados canónicos y §62 se evalúa en un acta de cierre de programa, **sin reescribir criterios** | §54 (cierre de C26 = «Gates de §58 verdes»), §58, §62 |
| R-13 | §19 | D-09 genérica | Registros concretos y separados por tipo (metadato, histórico, con impacto en decisiones) | `gh pr view` 1892, 1825, 1864–1897 |
| R-14 | §19 | — | Nuevas decisiones D-11 (iniciar C26 con C25 PARTIAL) y D-12 (G12 de staging es R3) | rector §50 (C26 depende de C25), §58 G12, AGENTS §3.1 |
| R-15 | §4.2 | «#181x» | #1813 | `git log 4009ca77` |

---

## Índice

0. [Registro de revisión v1 → v2](#0-registro-de-revisión-v1--v2)
1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Objetivo, alcance y exclusiones](#2-objetivo-alcance-y-exclusiones)
3. [Jerarquía documental y procedencia](#3-jerarquía-documental-y-procedencia)
4. [Baseline técnico real](#4-baseline-técnico-real)
5. [Inventario de componentes y superficies](#5-inventario-de-componentes-y-superficies)
6. [Metodología de comparación](#6-metodología-de-comparación)
7. [Matriz Drive ↔ VETNEB](#7-matriz-drive--vetneb)
8. [Diferencias intencionales](#8-diferencias-intencionales)
9. [Funcionalidades existentes y deuda de adopción](#9-funcionalidades-existentes-y-deuda-de-adopción)
10. [Hallazgos de alto valor](#10-hallazgos-de-alto-valor)
11. [Propuestas detalladas](#11-propuestas-detalladas)
12. [Alternativas rechazadas](#12-alternativas-rechazadas)
13. [Riesgos y compatibilidad con contratos](#13-riesgos-y-compatibilidad-con-contratos)
14. [Priorización técnica](#14-priorización-técnica)
15. [Roadmap propuesto de PRs](#15-roadmap-propuesto-de-prs)
16. [Plan de validación](#16-plan-de-validación)
17. [Dependencias de C25 y C26](#17-dependencias-de-c25-y-c26)
18. [Evidencia faltante y limitaciones](#18-evidencia-faltante-y-limitaciones)
19. [Decisiones pendientes de autorización](#19-decisiones-pendientes-de-autorización)
20. [Conclusión y recomendación](#20-conclusión-y-recomendación)

---

## 1. Resumen ejecutivo

**El dashboard ya superó a Drive en lo que la fuente rectora identificó como problema principal.** Con la geometría renderizada congelada en A02 (Win32, `main@9dfb5024`), la primera fila de datos empieza en y = 151–238 px según la superficie a 1920 × 1080, frente a y = 223 px en Drive (175 de `main` + 48 de cabecera sticky; derivado de §II.1 y §IV.3 de la referencia). El ledger C23b quedó vacío en #1897: ninguna celda de 768–1366 px supera el 32 % de chrome. Por eso la nueva referencia **no** justifica otro programa de reducción de chrome.

**Lo que la referencia Drive aporta y VETNEB todavía no tiene** son tres cosas concretas y verificables:

1. **Responsive gobernado por el contenedor** (§VI.4 de la referencia, prueba controlada A8). VETNEB no tiene ninguna `@container` en `frontend/src` y revela columnas por *viewport* (`lg:`/`xl:table-cell`) en cinco tablas admin. A 1280 px esa revelación coincide con el cambio rail 80 → drawer 256, que **reduce** `main` en 175 px (1200 → 1025, derivado de A02). El problema que Drive resuelve con container queries existe en VETNEB, pero su magnitud de truncado **no está medida** (§18).
2. **Navegación de salto** (§II.1, §X.2). El dashboard no tiene enlace de salto: `SkipToContent` sólo se monta en `PublicLayout`.
3. **Filtros activos visibles en todo el rango de escritorio.** En S2/S3 los chips C11 sólo se muestran en línea desde `xl` (1280 px). Entre 768 y 1279 px el usuario ve los campos del *draft*, no los filtros *aplicados*.

**La mayor parte del valor pendiente no requiere copiar Drive: requiere adoptar o completar lo que VETNEB ya construyó.** Las primitivas C08–C16 existen y están validadas, pero tienen uso productivo bajo o nulo (§9): `BulkActionMenu`, `ContextMenu`, `OverflowMenu`, `SubMenu`, `DetailsTabs`, `DetailsActionDock` y `UtilitySidePanel` (como panel de detalle) tienen **0** consumidores productivos; `SuperSearchField` y `ActiveFilterChips`, 2; `DocumentViewer`, 1 (Informes admin, con el contrato documental R2 de C17). Casi todas las no-adopciones tienen una causa documentada y legítima: neutralidad A02/A03, protección §7.8 o ausencia de contrato backend.

**Recomendación (v2).** Antes de C26 hacen falta **dos PRs obligatorias y una conveniente**, las tres neutras para A02/A03 y sin R13 (§15):

- **Obligatoria:** PR-BUG-03, el correctivo del rector que sigue abierto.
- **Obligatoria:** PR-DRV-03, foco visible en forced-colors para los overlays portados a `body`, que exige §56.6.
- **Conveniente:** PR-DRV-02, que reutiliza el enlace de salto ya existente.

La sonda (ex PR-DRV-04), F-T1, el responsive por contenedor, la cuadrícula y la deuda D5–D7 quedan **diferidos** hasta tener evidencia medida y, cuando corresponda, autorización R13. C26 no debe cerrarse reescribiendo §62 (la D-01(b) de la v1 queda rechazada): se cierra contra los gates de §58 con estados canónicos, y la deuda queda visible (§17.2).

---

## 2. Objetivo, alcance y exclusiones

**Objetivo.** Identificar mejoras verificables del dashboard a partir de la referencia Drive, sin duplicar funcionalidad existente, sin regresiones y sin tocar contratos protegidos.

**Incluido.** Lectura completa de la referencia Drive (§I–§XIV) y de la fuente rectora (§1–§64, con foco en §7, §20–§26 y §45–§63); actas C01–C25 y C23b PR1–PR5; inventario de caja blanca de `frontend/src/features/dashboard/presentation/`, `frontend/src/components/dashboard/`, `frontend/src/app/dashboard/` y `frontend/src/styles/dashboard/`; extracción de solo lectura del baseline A02 congelado.

**Excluido (no-alcance explícito).**

- Implementación funcional, CSS, tokens, tests, fixtures A02/A03/A05/A08, ledgers, tolerancias, thresholds, backend, dependencias, CI y configuración.
- Nuevas mediciones runtime con Playwright o CDP: no se levantó `next dev` ni se ejecutó ninguna sonda (§6.3).
- Edición de la referencia Drive, de la fuente rectora, de `docs/audit/README.md` y de `docs/SOURCES_OF_TRUTH.md`.
- Resolver las contradicciones 834 vs 722 px (buscador) y 728 vs 616 px (input) de §XIV.4 de la referencia.
- B3 (app bar 68.11 px a 1280 × 720): se describe y se deja como correctivo separado (§10, DRV-12).
- Commits, pushes, PRs y cualquier escritura remota.

---

## 3. Jerarquía documental y procedencia

| Nivel | Documento | Rol en esta propuesta |
| --- | --- | --- |
| Contrato operativo | `AGENTS.md` (raíz; sin `AGENTS.md` anidados tracked) | Riesgo R0–R3, actor, validación por impacto |
| Fuente rectora | `AUDITORIA_GLOBAL_DASHBOARD_VETNEB_VS_DRIVE.md` (`ACTIVE`) | Destinos (§45–§46), roadmap (§48–§55), aceptación (§62) |
| Registros de implementación | `docs/implementation/dashboard-c01…c25*.md`, `dashboard-c23b-pr1…pr5*.md`, `dashboard-b06*.md` | Estado real de cada slot, causas de no-adopción |
| Evidencia externa | `GOOGLE_DRIVE_REFERENCIA_UI_CONSOLIDADA.md` (`PROPOSED`) | Mediciones de Drive con estado OBSERVADO/DERIVADO/INFERIDO/NO RESUELTO |
| Evidencia VETNEB renderizada | `frontend/e2e/fixtures/dashboard-geometry-baseline.ts` (A02, schema `a02-geometry-baseline/1`) | Geometría medida por Playwright, congelada y revalidada por el gate A02 |
| Código | `frontend/src/**` en `9dfb5024` | Inventario y análisis estático |

**Reglas de procedencia en este documento.** Cada cifra de Drive cita su sección de la referencia (`Drive §X`). Cada cifra de VETNEB indica si es **A02** (renderizada, congelada), **acta** (medición registrada en un documento de implementación), **DERIVADO** (aritmética sobre valores A02, verificada en los anchos citados) o **estático** (clase o regla CSS declarada). El CSS declarado nunca se presenta como geometría renderizada.

**Observación de metadatos (no corregida).** La referencia Drive declara `PR #1892 (abierta)` como evidencia; en `main` esa PR ya está fusionada (`d1283a4f`). No se edita aquí; se propone en §19 (D-09).

---

## 4. Baseline técnico real

### 4.1 Git (capturado antes de analizar)

| Campo | Valor |
| --- | --- |
| Rama al iniciar / HEAD | `main` / `9dfb5024319e3d6747b9c659a83a60525fb9392c` |
| `origin/main` tras `git fetch --prune` | `9dfb5024…` (sin avance) |
| Árbol | limpio: sin modificados, sin untracked, sin stashes |
| Worktrees ajenos (preservados) | `C:/PORTAL-VETNEB-C17` (`feat/dashboard-c17-admin-reports-pilot`), `C:/PORTAL-VETNEB-D10` (`codex/c17-unblock-d10`) |
| `AGENTS.md` tracked | sólo el raíz |
| PRs abiertas | #1874 y #1869 (Dependabot, fuera de scope) |
| Rama de trabajo | `docs/dashboard-drive-evolution-proposal` (local, creada desde `main`) |

### 4.2 Estado del roadmap en `main` (por commits y actas, no por el texto histórico de §50)

| Slot | Estado efectivo | Evidencia |
| --- | --- | --- |
| A01–A08, B01–B16 | Fusionados | commits #1658–#1671, #1813 (B15/B16); actas `dashboard-b0*`/`b1*` |
| C01–C03, C06–C16 | Fusionados como primitivas; adopción parcial (§9) | #1864–#1878 y actas |
| C04 | Completo: orden server-side en Clínicas (`aria-sort`) | #1822, #1825 |
| C05 | **BLOCKED** (R13): fila 36 px | rector §26 nota, §60 |
| C17–C22 | Fusionados (piloto y lotes) | #1881–#1887 |
| C23 | C23a #1888; C23b PR1–PR5 #1893–#1897; **ledger C23b vacío** | acta PR5 «Ledger C23b: 2 → 0» |
| C24 | Fusionado (3 superficies con cuadrícula) | #1889 |
| C25 | **PARTIAL** (D1, D2 corregidos; D4–D7 abiertos; D8 BLOCKED) | #1891, acta C25 §9–§10 |
| C26 | NOT_STARTED | sin acta |
| PR-BUG-01 | Fusionado | #1885 |
| PR-BUG-02 | Absorbido en C25 (dos buscadores de Usuarios y roles) | acta C25 G2 |
| PR-BUG-03 | **Abierto en lo esencial** (§10, DRV-05) | `role="search"` sólo en 2 formularios |
| B3 | Abierto, correctivo separado | acta C23 §B3 |

> La tabla de §50 de la fuente rectora todavía describe C08–C26 sin estado y C04 como `READY_FOR_IMPLEMENTATION`. Esa desactualización documental se reporta (§19, D-09) y no se corrige aquí.

---

## 5. Inventario de componentes y superficies

Censo estático: consumidores productivos fuera del propio archivo, de los barriles, de `e2e/` y de arneses (`grep` de JSX/llamada en `frontend/src`, a `9dfb5024`). «Adopción» significa uso por una superficie productiva, no existencia de la primitiva.

### 5.1 Shell y navegación

| Componente | Owner / archivo | Consumidores productivos | Estado |
| --- | --- | --- | --- |
| `WorkspaceAppBar` | `components/dashboard/WorkspaceAppBar.tsx` (B06) | `DashboardTopbar` → admin `page.tsx`, `ClinicDashboardShell` | IMPLEMENTADA_Y_ADOPTADA |
| `WorkspaceModuleSearch` (interno) | idem; combobox «Buscar modulo del dashboard», `md:w-44 lg:w-60`, `h-9` | app bar | IMPLEMENTADA_Y_ADOPTADA (busca módulos, no contenido) |
| `NavigationDrawer` / `NavigationRail` | B07; `--dash-nav-drawer-w: 256px`, `--dash-nav-rail-w: 80px` | `DashboardNavigationFrame` (admin y clínica) | IMPLEMENTADA_Y_ADOPTADA; drawer ≥ 1280, rail 768–1279 (`navigation.css:247,253`) |
| `DashboardMobileNav` | B09 | `DashboardShellRouter` | IMPLEMENTADA_Y_ADOPTADA |
| `WorkspaceHeader` | B11 | `ModuleSurface` | IMPLEMENTADA_Y_ADOPTADA |
| `WorkspaceScaffold` | B15 | `ModuleSurface`, `DashboardPageHeader`, `ClinicMobileModuleFrame` | IMPLEMENTADA_Y_ADOPTADA |
| `UtilitySidePanel` (slot `details`) | B16, `ModuleSurface.tsx:42-99` | **0** superficies pasan `details=` | IMPLEMENTADA_NO_ADOPTADA |
| `DashboardModuleHub` | legacy | `ClinicModuleHub` | PARCIAL (hub admin retirado, B13) |
| Enlace de salto | — | `SkipToContent` sólo en `components/layout/PublicLayout.tsx` | **AUSENTE en el dashboard** |

### 5.2 Colecciones

| Componente | Consumidores productivos | Estado |
| --- | --- | --- |
| `CollectionWorkspace` / `CollectionHeader` / `ContentList` / `ContentListItem` (C01) | 1 / 9 / 16 / 12 archivos | IMPLEMENTADA_Y_ADOPTADA (amplia) |
| `CollectionPager` (C02) | 9 archivos + 2 adaptadores (`DashboardPager`, `CompactPager` con 0 usos directos) | IMPLEMENTADA_Y_ADOPTADA |
| `CollectionState` (C03) | 4 directos + adaptadores | IMPLEMENTADA_Y_ADOPTADA |
| Orden por columna (C04) | Clínicas admin | IMPLEMENTADA_Y_ADOPTADA en 1 colección (las demás no tienen contrato server-side) |
| Fila 40 px (C05) | — | **BLOQUEADA** (R13) |
| `ContentGrid` / `CollectionViewToggle` / `useCollectionView` (C24) | Informes admin (3 col.), Clínicas admin (3 col.), Informes clínica (2 col.) | IMPLEMENTADA_Y_ADOPTADA; columnas **fijas por consumidor** |
| `useCollectionSelection` (C06) | Auditoría e Informes admin (`AdminReportsCard.tsx:309`) | PARCIAL |
| `SelectionToolbar` (C07) | Auditoría (tabla y móvil), Informes admin | PARCIAL |

### 5.3 Filtros (S1–S7)

| Componente | Consumidores productivos | Estado |
| --- | --- | --- |
| `FilterBar` | S1, S2, S3, S6, S7 + ruta completa de Informes | IMPLEMENTADA_Y_ADOPTADA |
| `SuperSearchField` (C10) | S3 (Informes admin, ≥ `md`), S2 (buscador móvil de clínica) | PARCIAL |
| `FilterChip` / `FilterOverflow` / `ActiveFilterChips` (C11) | S2 y S3, chips en línea **sólo `xl:flex`**; S3 los repite dentro de su `AdvancedFilterSheet`; S2 no tiene sheet, así que bajo 1280 px no muestra los filtros aplicados en ningún lugar; retirada individual definida por C17/C18 | PARCIAL |
| `AdvancedFilterSheet` (C12) | S3 y S1 (aloja el mismo `FilterForm` GET) | PARCIAL |
| `role="search"` | `app/dashboard/informes/page.tsx:176`, `AdminReportsUploadPanel.tsx:254` | PARCIAL: ninguna de las barras S1–S7. S1 tiene `aria-label` en el `<form>`; S2/S3/S6/S7 no tienen ni rol ni nombre; S5 tiene `aria-label` sobre un `div` sin rol (P2-04, `AdminUsersRolesReadOnlyCard.tsx:418-421`) |

### 5.4 Interacciones, detalle y visor

| Componente | Consumidores productivos | Estado |
| --- | --- | --- |
| `ActionMenu` / `ActionMenuItem` (C08) | Informes admin: un menú por fila (tabla, `AdminReportsCard.tsx:896`) y por tarjeta (`:800`) con **un único ítem**, «Ver detalle», que duplica el botón «Ver» contiguo | PARCIAL (adopción sin acción secundaria) |
| `ContextMenu` / `OverflowMenu` / `SubMenu` (C08) | 0 | IMPLEMENTADA_NO_ADOPTADA; `ContextMenu` además en conflicto con el guard que prohíbe `onContextMenu` (acta C08) |
| `BulkActionMenu` (C09) | 0: no hay endpoint de acción masiva | IMPLEMENTADA_NO_ADOPTADA (bloqueo de backend) |
| `DetailsPane` / `DetailsMetadata` / `DetailsHeader` (C13) | 6 / 1+ / 1, dentro de `ModuleDialog` | PARCIAL |
| `DetailsTabs`, `DetailsActionDock` (C13/C14) | 0 | IMPLEMENTADA_NO_ADOPTADA |
| `DetailsActivity` (C14) | `StudyTimeline` | IMPLEMENTADA_Y_ADOPTADA |
| `DocumentViewer` / `ViewerToolbar` / `ViewerThumbnails` (C15/C16) | Informes admin: conectado tras la continuación R2 de C17 (`preview-url?viewer=1` con `mimeType` y `trustedOrigin`; `AdminReportsCard.tsx:515,1085-1090`). Clínica: no adoptado (acta C21: cambiaría el flujo y su frontera de seguridad) | IMPLEMENTADA_Y_ADOPTADA en admin · **BLOQUEADA** en clínica por contrato documental |
| `ModuleDialog` | 16 archivos | IMPLEMENTADA_Y_ADOPTADA |
| Tooltip propio | no existe primitiva (`components/ui` sin tooltip); se usa `title` nativo en botones de icono | AUSENTE (decisión de §12) |

### 5.5 Superficies

Las 21 superficies de A02 (11 admin + 10 clínica): `admin-hub`, `admin-resumen`, `admin-informes`, `admin-tokens`, `admin-clinicas`, `admin-auditoria`, `admin-usuarios`, `admin-sesiones`, `admin-precios`, `admin-mantenimiento`, `admin-estado`, `clinic-informes`, `clinic-informes-full`, `clinic-tokens`, `clinic-logistica`, `clinic-logistica-full`, `clinic-log-rutas`, `clinic-log-visitas`, `clinic-log-metricas`, `clinic-operaciones`, `clinic-perfil`. Su adopción por slot está en las tablas «Adoptado / No adoptado y causa» de las actas C17–C22, que este documento resume en §9 y no repite.

---

## 6. Metodología de comparación

### 6.1 Procedimiento (referencia Drive §XIII)

1. Mapeo de cada métrica de Drive a un componente VETNEB, o `NO_COMPARABLE`.
2. Clasificación de la comparación: `IGUAL` (dentro de la tolerancia de Drive §XIII.2), `DIFERENTE`, `AUSENTE`, `NO_COMPARABLE`. Un valor Drive `INFERIDO` o `NO RESUELTO` sólo admite `NO_COMPARABLE` (Drive §XIII.1.4).
3. Conclusión independiente: `MEJORA_JUSTIFICADA`, `DIFERENCIA_INTENCIONAL`, `YA_RESUELTO`, `REQUIERE_EVIDENCIA`, `NO_ADOPTAR`.
4. Agregación por categoría, **sin porcentaje global de similitud**: las condiciones de medición no son homogéneas (§6.4).

### 6.2 Resoluciones

| Resolución Drive §XIII.1 | Registro VETNEB disponible | Estado |
| --- | --- | --- |
| 1920 × 945 | Ninguno (A02 mide 1920 × 1080) | **Pendiente**; para valores de eje x y posiciones superiores se usa 1920 × 1080 con esa salvedad |
| 1920 × 1080 | A02 `w1920x1080` | Comparable |
| 1440 × 900 | A02 `w1440x900` | Comparable |
| 1366 × 768 | A02 `w1366x768` | Comparable |
| 1280 × 800 | Ninguno (A02 mide 1280 × 720) | **Pendiente**; 1280 × 720 activa el escalón `max-height: 760px` y **no** es sustituto |
| 1024 × 768 | A02 `w1024x768` | Comparable |

### 6.3 Por qué no se ejecutaron mediciones nuevas

El método de la referencia (CDP sobre una pestaña) y el de VETNEB (Playwright + fixture en 3107) no comparten herramienta. Medir 1920 × 945 y 1280 × 800 requiere una sonda temporal sobre los helpers A02 (patrón de la sonda C25) y una corrida E2E pesada; no es proporcional para un entregable docs-only (AGENTS §6, §8). Esa sonda queda como paso de evidencia previo de las PRs del tramo C (ex PR-DRV-04, §15). Lo que aquí se compara procede de registros A02 ya congelados y revalidados por el gate A02 en los últimos PR (acta C23b PR5: A02 Linux 42/42; acta C25: A02 21/21).

### 6.4 Límites de homogeneidad

- Drive mide **una** vista (Mi unidad, 37 elementos, tema claro, cuenta real); A02 mide 21 superficies con fixture sintético. Los recuentos no son comparables.
- Drive fija `body { min-width: 1000px }`; VETNEB no tiene ancho mínimo de documento.
- Las posiciones y del contenido dependen del alto del viewport en VETNEB (escalones `max-height` en `responsive.css:94-121` y `zero-scroll.css:396`); en Drive el header y la toolbar son invariantes en 11 resoluciones (Drive §II.4).

---

## 7. Matriz Drive ↔ VETNEB

Columnas: **C** = comparación (IGUAL · DIFERENTE · AUSENTE · NO_COMPARABLE); **Conclusión** según §6.1.

### 7.1 Arquitectura y geometría

| ID | Métrica | Drive (sección, estado) | VETNEB (fuente) | C | Conclusión |
| --- | --- | --- | --- | --- | --- |
| M-01 | Alto del header | 64 px (§II.1, OBSERVADO) | 55.33 px en 1920/1440/1366/1024 (A02); **68.11 px a 1280 × 720** (A02, B06 acta) | DIFERENTE | 55.33: DIFERENCIA_INTENCIONAL (§46: 56 ±2). 68.11: REQUIERE_EVIDENCIA → B3 (DRV-12) |
| M-02 | Navegación lateral | Sidebar 224 px en x = 16, no colapsa (§II.4) | Drawer 256 ≥ 1280; rail 80 en 768–1279; nav móvil < 768 (tokens.css:467-468, navigation.css:247-253) | DIFERENTE | DIFERENCIA_INTENCIONAL (§46) |
| M-03 | Origen x de `main` | 257 (§II.1) | 255 en ≥ 1280; 79 a 1024 (A02) | DIFERENTE (Δ 2 px > ±1) | YA_RESUELTO (equivalente funcional) |
| M-04 | Ancho de `main` | `viewport − 313` con rail (§II.4, DERIVADO) | `viewport − 255` (1280–1920) y `viewport − 79` (1024) (DERIVADO de A02, verificado en 1920/1600/1440/1366/1280/1024) | DIFERENTE | DIFERENCIA_INTENCIONAL: VETNEB tiene 58 px más en ≥ 1280 y 234 px más a 1024 (945 vs 711) |
| M-05 | Rail derecho | 56 px (§II.1) | No existe | AUSENTE | NO_ADOPTAR (§12) |
| M-06 | y de la primera fila | 223 = 175 + 48 de cabecera sticky (DERIVADO de §II.1 y §IV.3, a 1920 × 945) | 1920 × 1080 (A02): `admin-clinicas` 151.28 · `admin-auditoria` 163.78 · `admin-informes` 190.28 · `clinic-informes` 210.73 · `admin-tokens` 221.78 · `clinic-informes-full` 238.23 | DIFERENTE | YA_RESUELTO: 5 de 6 superficies muestreadas empiezan antes que Drive; ledger C23b vacío |
| M-07 | Chrome máximo en 768–1366 | sin dato equivalente | máximo muestreado 0.32 (`admin-tokens` 1280 × 720); presupuesto 0.32 (guard C23) | NO_COMPARABLE | YA_RESUELTO |
| M-08 | Alto de fila | 48 (§IV.4) | 36 (`--dash-row-pitch-compact`) | DIFERENTE | DIFERENCIA_INTENCIONAL; C05 BLOCKED (R13) |
| M-09 | Inset lateral de la colección | 20 px (§II.4) | 26.39 px (`workspace.x − main.x` a 1920, A02) | DIFERENTE | NO_ADOPTAR (sin valor de usuario; mueve A02) |
| M-10 | Desbordamiento horizontal bajo 1000 px | Sí: documento fijo en 1000 (§VI.5, §X.5) | 0 en 273 combinaciones (A08) | DIFERENTE | YA_RESUELTO; NO_ADOPTAR el `min-width` |
| M-11 | Contenedores de scroll | 1 (§II.2) | Contrato zero-scroll A08 + owner sancionado por superficie | NO_COMPARABLE | YA_RESUELTO |

### 7.2 Responsive

| ID | Métrica | Drive | VETNEB | C | Conclusión |
| --- | --- | --- | --- | --- | --- |
| M-12 | Mecanismo de columnas de tabla | Container queries a 744/832/1126 px del contenedor, demostradas con viewport fijo (§VI.1, §VI.4) | 0 `@container` en `frontend/src`; columnas `lg:`/`xl:table-cell` por viewport en Auditoría, Tokens admin, Informes admin, Sesiones (2 + 2) y Usuarios (2) (estático) | DIFERENTE | REQUIERE_EVIDENCIA → MEJORA_JUSTIFICADA condicional (DRV-01) |
| M-13 | Discontinuidad de ancho en 1279 → 1280 | — | `main` 1200 → 1025 (−175 px, DERIVADO), justo cuando aparecen las columnas `xl:` | NO_COMPARABLE | REQUIERE_EVIDENCIA (DRV-01) |
| M-14 | Columnas de la cuadrícula | `floor((w + 16) / 236)`, gap 16, 7/7 anchos (§V.3, DERIVADO) | Fijas: 3 (Informes admin, Clínicas), 2 (Informes clínica); `gap-2` = 8 px; filas = `ceil(limit / columnas)` (`ContentGrid.tsx`, `collection-view.ts`) | DIFERENTE | REQUIERE_EVIDENCIA (DRV-02) |
| M-15 | Régimen de cuadrícula | Sin régimen móvil (`mobile: false`) | Sólo ≥ 768 px; < 768 fuerza lista (`COLLECTION_GRID_REGIME`) | NO_COMPARABLE | YA_RESUELTO |
| M-16 | Acciones por fila según ancho | 6 / 2 / 1 botones por contenedor (§IV.5) | Informes admin: «Ver» siempre + `ActionMenu` `xl:inline-flex` | DIFERENTE | MEJORA_JUSTIFICADA sólo junto a DRV-06 |

### 7.3 Filtros, búsqueda y menús

| ID | Métrica | Drive | VETNEB | C | Conclusión |
| --- | --- | --- | --- | --- | --- |
| M-17 | Buscador del header | 722 × 48 (lab) vs 834 × 48 (rector) — **contradicción NO RESUELTA** (§XIV.4) | Combobox de **módulos** 176 / 240 px, 36 px de alto; la búsqueda de contenido es `SuperSearchField` por módulo | NO_COMPARABLE (función distinta) | NO_ADOPTAR un redimensionado; la contradicción no bloquea ninguna decisión de esta propuesta |
| M-18 | Chips de filtro | 32 px, radio 8, gap 8 (§IV.7) | `FilterChip` C11 en S2/S3; geometría renderizada no registrada en A02 | NO_COMPARABLE | REQUIERE_EVIDENCIA (sólo si se adopta DRV-03) |
| M-19 | Filtros activos visibles | Chips persistentes en la toolbar (§II.1) | S2/S3: en línea sólo desde `xl`; en móvil sólo dentro del sheet; S1, S4–S7: no | DIFERENTE | MEJORA_JUSTIFICADA (DRV-03), condicionada a A01 |
| M-20 | Menús: anclaje, Escape, foco inicial | Bajo el disparador, alineados a la derecha cerca del borde (INFERIDO), Escape cierra 5/5 (§VIII.3) | C08 con un único owner de superficie, teclado y retorno de foco (acta C08) | IGUAL en Escape/foco; anclaje NO_COMPARABLE | YA_RESUELTO |
| M-21 | Altura de ítem de menú | 32 / 40 px (§III.5) | §46: 32 px; no medido en A02 | NO_COMPARABLE | REQUIERE_EVIDENCIA (sin valor de usuario demostrado) |
| M-22 | Menú contextual (clic derecho) | A3 NO RESUELTO (§XII.3) | `ContextMenu` sin consumidor; guard prohíbe `onContextMenu` | NO_COMPARABLE | NO_ADOPTAR mientras dure la contradicción C08 |
| M-23 | Selección y toolbar contextual | A2 NO RESUELTO (§IV.8) | C06/C07 en Auditoría e Informes admin | NO_COMPARABLE | YA_RESUELTO donde hay valor |
| M-24 | Panel de detalle | A4 NO RESUELTO; rector: 336 derivado | `UtilitySidePanel` 336 ±2 sin consumidor de detalle; detalle en `ModuleDialog` | NO_COMPARABLE | REQUIERE_EVIDENCIA (depende de DRV-01) |

### 7.4 Sistema visual y tipografía

| ID | Métrica | Drive | VETNEB | C | Conclusión |
| --- | --- | --- | --- | --- | --- |
| M-25 | Familia tipográfica | «Google Sans Text», Roboto (§III.6) | `--dash-text-family: var(--font-ui)` | DIFERENTE | NO_ADOPTAR (fuente propietaria) |
| M-26 | Texto base | 14 / 400 / 20 (§III.6) | `--dash-text-body-size: 0.8125rem` (13 px), leading 1.25 (estático); rector §45.2 body-sm 13/20 | DIFERENTE | DIFERENCIA_INTENCIONAL en tamaño; leading: REQUIERE_EVIDENCIA (DRV-11) |
| M-27 | Capa de hover | 8 % (§III.1) | `--dash-state-hover-opacity: 0.06` claro / 0.10 oscuro (tokens.css:135,228); rector §45.2: 8 % | DIFERENTE | REQUIERE_EVIDENCIA; divergencia interna con §45.2 (D-08) |
| M-28 | Sombra en chrome persistente | Ninguna (§III.4) | Retirada por B04 (gate G6) | IGUAL | YA_RESUELTO |
| M-29 | Truncado | Ellipsis en celdas, sin mecanismo de valor completo evaluado (§III.6) | PR-TRUNC: truncar sólo con detalle que lleve el valor; 7 casos sin mecanismo (C25 F-T1..F-T7) | DIFERENTE | MEJORA_JUSTIFICADA (DRV-07); NO_ADOPTAR el modelo Drive |
| M-30 | Tooltips | Propios, 12/16, z-index 6000, retardo NO RESUELTO (§VII.2) | `title` nativo en botones de icono; sin primitiva | DIFERENTE | NO_ADOPTAR un tooltip hover-only (§12) |
| M-31 | Conmutador de vista | `radiogroup` 32 px, una parada de Tab (§II.1, §VIII.1) | `role="group"` con 2 botones `aria-pressed`, `h-6 w-7` (24 × 28, estático), dos paradas de Tab | DIFERENTE | DIFERENCIA_INTENCIONAL (ambos patrones son válidos; 24 px cumple WCAG 2.5.8) |

### 7.5 Accesibilidad

| ID | Métrica | Drive | VETNEB | C | Conclusión |
| --- | --- | --- | --- | --- | --- |
| M-32 | Navegación de salto | 3 botones visibles al recibir foco (§X.2) | Ninguna en el dashboard | AUSENTE | MEJORA_JUSTIFICADA (DRV-08) |
| M-33 | Landmark `search` | 1 (§X.1) | 2 formularios; ninguna barra S1–S7 | DIFERENTE | MEJORA_JUSTIFICADA (DRV-05, = PR-BUG-03) |
| M-34 | Foco visible | `:focus-visible` 60/60; outline 36/60 (§X.2) | Outline 2 px en 5 872/5 872 controles del shell (acta C25, 13 vp); portales a `body` sin indicador en forced-colors (acta C25 §8) | DIFERENTE | MEJORA_JUSTIFICADA (DRV-09) |
| M-35 | Contraste | 20/21 grupos AA (§X.3) | No medido sobre las 21 superficies × 2 temas (rector §63); axe en 2 rutas de entrada y en specs C17–C22 | NO_COMPARABLE | REQUIERE_EVIDENCIA (gate G11, C26) |
| M-36 | Objetivos táctiles | 223 de 322 controles entre 24 y 43 px, escritorio (§X.4) | 1 151 controles < 44 px en teléfonos (C25 D7) | NO_COMPARABLE (Drive no tiene modo móvil) | REQUIERE_EVIDENCIA + R13 (DRV-13) |
| M-37 | Semántica de tabla | `role=grid` sin `columnheader` ni `aria-sort` (§IV.1) | `table` nativo; `aria-sort` en Clínicas (C04) | DIFERENTE | NO_ADOPTAR el patrón Drive |
| M-38 | Encabezados en `main` | Ninguno (§X.1) | No medido | NO_COMPARABLE | NO_ADOPTAR; verificar en C26 |
| M-39 | `prefers-reduced-motion` / `forced-colors` | Reglas presentes, efecto no evaluado (§X.5) | Reglas en 4 / 2 archivos de `styles/dashboard` | NO_COMPARABLE | REQUIERE_EVIDENCIA (C26) |

---

## 8. Diferencias intencionales

Se mantienen y **no** deben converger hacia Drive:

1. **Fila de 36 px y densidad.** Con 36 px VETNEB muestra 19 filas a 1920 × 1080 frente a 14–16 en Drive (rector §1.2; Drive §IV.9). Subirla mueve el `limit` (C05: 15/26 hojas con drift).
2. **Drawer 256 / rail 80 / nav móvil** en lugar de sidebar fija de 224 px y `min-width: 1000px`. VETNEB conserva 0 overflow horizontal en 273 combinaciones; Drive desborda bajo 1000 px (Drive §X.5, indicio contra WCAG 1.4.10).
3. **Sin rail derecho de aplicaciones.** Libera 56 px de ancho en ≥ 1280.
4. **Paginación adaptativa en lugar de scroll continuo.** Es el contrato A03/A05/A08; Drive no ofrece equivalente medible.
5. **Detalle en diálogo** (`ModuleDialog` + `DetailsPane`) en lugar de panel lateral persistente, hasta que exista evidencia de que el panel no degrada las columnas (DRV-01).
6. **Tabla semántica** (`table`, `aria-sort`) frente al `role=grid` de Drive sin cabeceras de columna.
7. **Identidad visual VETNEB** (paleta, familia tipográfica, `--md-sys-*` derivados de `globals.css`, rector §45.1).
8. **Buscador del header = navegador de módulos.** La búsqueda de contenido es por módulo porque cada colección tiene dimensiones y contratos distintos (rector §25.3.1).

---

## 9. Funcionalidades existentes y deuda de adopción

| Capacidad | Primitiva | Adopción | Causa de la no-adopción (acta) | ¿Desbloqueable sin R2/R13? |
| --- | --- | --- | --- | --- |
| Acciones masivas | C09 `BulkActionMenu` | 0 | No hay endpoint de ejecución masiva (C09) | No: requiere contrato backend (R2) y decisión de producto |
| Menú contextual | C08 `ContextMenu` | 0 | Guard `frontend-visual-consistency` prohíbe `onContextMenu` (C08) | No: requiere resolver la contradicción de fuentes |
| Overflow / submenús | C08 `OverflowMenu`, `SubMenu` | 0 | Sin consumidor designado | Sí, por superficie, si hay acciones secundarias reales |
| Pestañas y dock de detalle | C13 `DetailsTabs`, C14 `DetailsActionDock` | 0 | Geometría o semántica (C21: tablist propio; `ReportFileActions` no es lista `onClick`) | Parcial |
| Panel de detalle lateral | B16 `UtilitySidePanel` | 0 como detalle | Detalle en diálogo para no crear un segundo scroll | Sí, pero cambia el ancho de la colección (DRV-01) |
| Visor documental | C15/C16 | Informes admin | Clínica: el descriptor verificado (MIME por bytes, origen exacto) sólo existe para la ruta admin (acta C17, continuación R2) | No: replicar el contrato en la ruta de clínica es R2 |
| Campo de búsqueda primario | C10 | S2 (móvil), S3 | S1 no tiene texto libre; S4/S5 cambiarían A02 `filters` (C18, C19) | Parcial, con medición A02 |
| Chips activos | C11 | S2, S3 (≥ `xl`) | S1: URL protegida §7.8; S4/S5: sin estado «aplicado» | S6/S7: sí, si Nico define la retirada individual (D-03) |
| Sheet avanzado | C12 | S1, S3 | S2: contrato B05 | — |
| Pager unificado | C02 | 9 | Landmarks `nav` anclados por E2E; `compact` exige `total` | Fuera del interés de esta propuesta |

**Lectura.** La deuda de adopción **no** es negligencia: las actas C18–C22 aplicaron un criterio explícito («sólo se adopta una primitiva si es geométricamente neutra frente a A02 y A03»). Cerrarla exige, en cada caso, autorización R13, contrato backend o una decisión semántica de Nico. Por eso este documento no propone «adoptar todo», sino los pocos casos con valor de usuario demostrable (§10).

---

## 10. Hallazgos de alto valor

Formato de la matriz de valor exigida. Los campos **Complejidad** y **Riesgo** usan la rúbrica de §14.

### DRV-01 · Columnas de tabla gobernadas por el viewport, no por el contenedor

| Campo | Contenido |
| --- | --- |
| Componente | Tablas de `AdminAuditDenseTable`, `AdminParticularTokensCard`, `AdminReportsCard`, `AdminSessionsReadOnlyCard`, `AdminUsersRolesReadOnlyCard` (owners C18/C19, C17) |
| Evidencia Drive | §VI.1 y §VI.4: umbrales 744/832/1126 px del contenedor, demostrados con viewport fijo al ocultar el rail (DERIVADO por prueba controlada) |
| Evidencia VETNEB | 0 `@container`; `hidden lg:table-cell` y `hidden xl:table-cell` (estático). `main` = 1200 px a 1279 y 1025 px a 1280 (DERIVADO de A02) |
| Estado actual | AUSENTE (mecanismo); columnas revelan por viewport |
| Diferencia | En 1024–1279 px (rail) el contenedor es más ancho que en 1280–1439 px (drawer), pero muestra **menos** columnas |
| Problema real | Hipótesis: a 1280–1366 px las celdas truncan más que a 1200–1279 px con el mismo dato, y en 1024–1279 px se ocultan columnas para las que hay espacio. **No medido** |
| Propuesta | Primero medir (sonda, ex PR-DRV-04). Si el truncado o el espacio ocioso es significativo, sustituir `lg:`/`xl:table-cell` por `@container` en **una** tabla piloto (Informes admin) |
| Beneficio | Columnas coherentes con el espacio real; base para un futuro panel lateral (DRV-10). Métrica: elementos truncados por superficie y viewport (sonda C25) y ancho ocioso por columna |
| Complejidad | Media |
| Riesgo | Medio: A02 mide regiones, no celdas, pero un cambio de contenido de celda puede alterar alturas de fila de dos líneas (Informes admin «Caso / paciente») |
| Dependencias | Sonda (ex PR-DRV-04); guards C17/C18/C19; PR-TRUNC; A02/A03 |
| Validación | Sonda de truncado antes/después; A02 21/21; A03 sin drift; A08; cohorte `visual-contract` |
| Decisión | **Investigar** (medir antes de adoptar) |

### DRV-02 · Columnas fijas en la cuadrícula C24

| Campo | Contenido |
| --- | --- |
| Componente | `ContentGrid` (C24) y sus tres consumidores |
| Evidencia Drive | §V.3: `floor((w + 16) / 236)`, gap 16 px, tarjetas cuadradas de ≈ 247 px a 1920 |
| Evidencia VETNEB | `columns={3}` en `AdminReportsCard.tsx:777` y `AdminClinicsManagementCard.tsx:760`; 2 en `InformesReportsList.tsx:738-740`; filas = `collectionGridRows(effectiveLimit, columnas)`; gap 8 px |
| Estado actual | IMPLEMENTADA_Y_ADOPTADA con columnas por consumidor |
| Diferencia | A 1920 × 1080, con ≈ 1 578 px de ancho interior (`filters.width` A02 de `admin-informes`), la fórmula de Drive daría 6 columnas; VETNEB usa 3 (≈ 520 px por tarjeta, aritmética no medida) |
| Problema real | Tarjetas muy anchas a 1920 y muy bajas cuando `limit` es alto (19 → 7 filas). Altura de tarjeta **no medida**: el `collectionCanvasHeight` de A02 para `admin-informes` refleja el fixture y no sirve para calcularla |
| Propuesta | Alternativas en §11.2. Ninguna sustituye columnas fijas por `auto-fit` |
| Beneficio | Proporción de tarjeta legible en todos los anchos; menos espacio horizontal ocioso |
| Complejidad | Media |
| Riesgo | Bajo para A03 (filas = f(`limit`), la cuadrícula no pide capacidad) · medio para clipping de contenido |
| Dependencias | Sonda, ex PR-DRV-04 (medir alto/ancho de tarjeta por viewport); guard C24 |
| Validación | Spec C24 (13 vp: «todas dentro del canvas, sin overflow»); A03 sin drift; nueva aserción de alto mínimo de tarjeta |
| Decisión | **Investigar**; diferible después de C26 |

### DRV-03 · Filtros aplicados invisibles en 768–1279 px y en móvil

| Campo | Contenido |
| --- | --- |
| Componente | S3 `AdminReportsCard.tsx:696-698`; S2 `AdminParticularTokensCard.tsx:1378-1382` |
| Evidencia Drive | §II.1, §IV.7: chips de filtro persistentes; §VIII.4 diálogos de filtro |
| Evidencia VETNEB | `ActiveFilterChips` envuelto en `hidden … xl:flex`. En < 768 px, S3 los muestra sólo dentro del `AdvancedFilterSheet` y su disparador «Filtros» no indica cuántos hay aplicados; S2 no tiene sheet y no los muestra en ningún lugar (corrección R-10) |
| Estado actual | PARCIAL |
| Diferencia | Entre 768 y 1279 px la barra muestra los campos del *draft*: si el usuario edita sin aplicar, la colección y los campos divergen sin señal |
| Problema real | Riesgo de interpretar resultados filtrados como completos (rector P2-11) en el rango de portátil y tablet |
| Propuesta | Opción mínima: recuento de filtros aplicados en el nombre accesible y en el texto del disparador móvil («Filtros · 3»). Opción completa: chips en 768–1279 px en una fila existente. Ambas usan el `activeFilters` ya derivado de `appliedFilters`; sin semántica nueva |
| Beneficio | El estado aplicado es visible siempre. Métrica: presencia del recuento/chips en los 13 viewports con filtros aplicados (E2E) |
| Complejidad | Baja (recuento) · Media (chips) |
| Riesgo | Bajo (recuento, si el ancho del botón no fuerza salto de línea) · Alto (chips en 768–1279: posible segunda fila → A02/A03, R13) |
| Dependencias | A01 (`dashboard-operational-contract-baseline`), guards C17/C18, ADMIN-DT |
| Validación | A01 idéntico; A02/A03 sin drift; E2E C17 con filtros aplicados en 834 × 1194 y 1024 × 768 |
| Decisión | **Diferir** después de C26 (PR-DRV-06): opción mínima tras la sonda; chips en 768–1279 rechazados sin medición (§15.5) |

### DRV-04 · Filtros activos en S6/S7

| Campo | Contenido |
| --- | --- |
| Componente | `ClinicInformesWorkspaceSummary` (S6), `ClinicParticularTokensCard` (S7) |
| Evidencia Drive | §IV.7 |
| Evidencia VETNEB | S6/S7 tienen `filterDraft`/`appliedFilters` y Aplicar explícito (rector §7.2; acta C12) pero ningún chip |
| Estado actual | AUSENTE |
| Problema real | Mismo que DRV-03 en el rol clínica |
| Propuesta | Aplicar el patrón S2/S3 **sólo** si Nico define la retirada individual (qué campo se vacía, si se resetea la página) |
| Riesgo | Alto: §7.8 y A01 S6 (`desktopVisibility: FilterBar from md: up`, acta C23b PR5) |
| Decisión | **Diferir**; requiere decisión D-03 |

### DRV-05 · `role="search"` ausente en S1–S7 y `aria-label` sobre `div` en S5 (PR-BUG-03 pendiente)

| Campo | Contenido |
| --- | --- |
| Componente | Los `<form>` de S1 (`AdminAuditFilterBar.tsx:58`), S2 (`AdminParticularTokensCard.tsx:988`), S3 (`AdminReportsCard.tsx:549`), S6 (`ClinicInformesWorkspaceSummary.tsx:220`) y S7 (`ClinicParticularTokensCard.tsx:748`); el contenedor existente de S4 (`AdminClinicsManagementCard.tsx:538-551`, y su gemelo móvil en `:698`) y el `div` de S5 (`AdminUsersRolesReadOnlyCard.tsx:418-421`) |
| Evidencia Drive | §X.1: landmark `search` 1 |
| Evidencia VETNEB | `role="search"` sólo en `informes/page.tsx:176` y `AdminReportsUploadPanel.tsx:254`. S5 nombra un `div` sin rol: ARIA 1.2 prohíbe nombrar el rol `generic`, así que el nombre se ignora (rector P2-04). Que axe lo detecte en la spec C19 **no está verificado**. El rector asigna esto a PR-BUG-03 (§55, «absorbible en C10–C12»), pero C10–C12 publicaron sólo primitivas y no lo absorbieron |
| Estado actual | PARCIAL |
| Propuesta | `role="search"` y `aria-label` en los cinco `<form>` (S1 ya tiene nombre). En S4 y S5, `role="search"` sobre los **elementos existentes**: no se agrega ningún nodo. Sin cambios de eventos, submit, parámetros ni clases. P2-05 (anuncio de conteo) queda **fuera**: ya está cubierto por las live regions de los pagers (R-03) y se verifica en C26 |
| Beneficio | Un landmark `search` nombrado por superficie y el fin del ARIA inválido de S5. Métrica: landmarks `search` visibles por superficie = 1 en los 13 viewports |
| Complejidad | Baja · **Riesgo** Bajo: sólo atributos, ninguna caja nueva |
| R13 | No |
| Validación | A01 idéntico; A02 21/21 sin drift; guards que anclan el JSX de cada barra realineados en la misma PR, sin debilitarlos; aserción nueva del árbol de accesibilidad en las specs C17–C22 existentes |
| Decisión | **Adoptar antes de C26** como PR-BUG-03 (no como PR nueva) |

### DRV-06 · `ActionMenu` de un solo ítem que duplica «Ver»

| Campo | Contenido |
| --- | --- |
| Componente | `AdminReportsCard.tsx:896` (tabla) y `:800` (tarjeta de cuadrícula) |
| Evidencia Drive | §IV.5: el menú de fila agrupa acciones secundarias que no caben |
| Evidencia VETNEB | Desde `xl`, cada fila tiene «Ver» y un menú `⋮` cuyo único ítem es «Ver detalle», que llama al mismo `openReportDetail` |
| Estado actual | PARCIAL (adopción sin acción secundaria) |
| Problema real | Una parada de Tab extra por fila (19 filas a 1920 × 1080) sin capacidad nueva |
| Propuesta | Opción A: poblar el menú con acciones **ya existentes** del detalle (vista previa con `DocumentViewer`, descarga), reutilizando los descriptores validados y sin cambiar endpoints. Opción B: retirarlo y realinear el guard C17 |
| Riesgo | Bajo (B, la celda tiene ancho fijo `w-[8%]`) · Medio (A: semántica de acciones y descriptores firmados) |
| Dependencias | Guard C17 (§52.3 «menús»); acta C17 sobre `ReportFileActions` |
| Decisión | **Decisión de Nico** (D-04); diferible después de C26 |

### DRV-07 · Truncados sin acceso al valor completo (C25 D4: F-T1..F-T7)

| Campo | Contenido |
| --- | --- |
| Evidencia Drive | §III.6: Drive sólo trunca y no ofrece un mecanismo de valor completo medido; **no es modelo** |
| Evidencia VETNEB | Acta C25 §2.1: 7 superficies sin mecanismo; `title` rechazado por PR-TRUNC |
| Propuesta | F-T1 (Visitas, escritorio): montar el `FieldVisitDetailDialog` que ya usa la lista móvil. F-T2/F-T3: detalle C13. F-T5/F-T6/F-T7: ajuste de línea donde la altura no es contractual, con A02/A03 re-medidos |
| Beneficio | Información recuperable en todos los viewports. Métrica: hallazgos PR-TRUNC sin mecanismo 7 → 0 |
| Riesgo | Medio (F-T1: la tabla de escritorio de Visitas, `logistica/visitas/page.tsx:195-245`, no tiene columna de acciones; montar el disparador exige una 8.ª columna o ubicarlo dentro de la celda «ID», en una superficie consumidora de A03, y debe medirse) · Medio (F-T2/F-T3, cambio funcional) · Alto (F-T4, cruza el chrome de C23b; F-T5–F-T7, posible R13) |
| Decisión | **Diferir** después de C26, con D-06 (v1 lo situaba antes de C26; corrección R-09) |

### DRV-08 · Enlace de salto ausente en el dashboard

| Campo | Contenido |
| --- | --- |
| Evidencia Drive | §II.1, §X.2: 3 botones fuera de pantalla que aparecen con foco |
| Evidencia VETNEB | `SkipToContent` sólo en `PublicLayout.tsx:17`; el ciclo de Tab del dashboard recorre app bar y hasta 11 ítems de drawer/rail antes del contenido |
| Propuesta | **Reutilizar `SkipToContent`** (`components/public/SkipToContent.tsx`). Es un `<button>` que enfoca `#main-content` con `tabindex="-1"` temporal, cumple la regla «sin `<a>` ni `next/link`» y su CSS (`globals.css:1973-2001`) es `position: fixed` desplazado fuera del viewport hasta recibir foco. Sólo hace falta montarlo como primera parada del shell y agregar `id="main-content"` a los dos `<main>` del dashboard (`admin/page.tsx:756`, `ClinicDashboardShell.tsx:92`). Sin CSS nuevo |
| Beneficio | Menos pulsaciones hasta el contenido. WCAG 2.4.1 ya se satisface con el landmark `main` (técnica ARIA11): es una mejora, no la corrección de un incumplimiento |
| Riesgo | Bajo: el desplazamiento negativo de un elemento `fixed` no extiende el área desplazable (A08); `main` no cambia de caja (A02); el `tabindex="-1"` queda excluido del outline de C25 por diseño. El contrato `frontend-public-skip-link-contract.test.ts` sólo ancla `PublicLayout` y no se ve afectado |
| Validación | Guard nuevo análogo al público (botón, `aria-controls`, id en ambos `main`); E2E: primera parada de Tab = enlace, Enter enfoca `main`, A08 con el enlace enfocado en 1366 × 768 y 390 × 844 |
| Decisión | **Adoptar como conveniente** antes de C26 (no obligatorio; corrección R-05) |

### DRV-09 · Foco invisible en forced-colors dentro de portales a `body`

| Campo | Contenido |
| --- | --- |
| Evidencia Drive | §X.2: `:focus-visible` 60/60 |
| Evidencia VETNEB | Acta C25 §8: `DashboardNotificationsBell`, portal de `ModuleCard`, `UploadReportModal` y los `ModuleDialog` sin `dashboardScopedPortal` conservan sólo el anillo de `box-shadow`, que forced-colors descarta |
| Problema real | Probable incumplimiento de WCAG 2.4.7 en forced-colors, **deducido estáticamente**: Tailwind `^4.3.3` convierte `focus-visible:outline-none` en `outline-style: none`, y la regla base `:focus-visible` de `globals.css:192` está en `@layer base`, que pierde contra las utilidades. En modo normal el anillo de `box-shadow` es visible, así que el defecto se limita a forced-colors. Los overlays afectados son `DashboardNotificationsBell.tsx:512,552`, `ModuleCard.tsx:261`, `UploadReportModal.tsx:862`, `ClinicEditDrawer.tsx:210` y los `ModuleDialog` sin `dashboardScopedPortal` (19 de 22 sitios) |
| Propuesta | **RED primero**: un E2E con `forcedColors: "active"` que abra cada overlay y mida `outline-style` en sus controles enfocables. Si reproduce el defecto, agregar una regla `@media (forced-colors: active)` **sin capa** (mismo motivo que C25 G1), acotada a los contenedores de esos overlays por sus anclas `data-*` existentes (o un `data-*` neutro nuevo, sin lexemas sensibles), con `outline: 2px solid CanvasText`. **No** se migran portales (corrección R-06). Si el RED no reproduce, se cierra con el acta y sin cambio de runtime |
| Riesgo | Bajo: la regla sólo actúa en forced-colors, no cambia ninguna captura en modo normal y `outline` no ocupa layout |
| R13 | No |
| Base rectora | §56.6: la validación de accesibilidad de C26 incluye «foco visible bajo `forced-colors`» |
| Decisión | **Adoptar como obligatorio** antes de C26 (cierra el residual de C25 §8) |

### DRV-10 · Panel de detalle lateral (B16) sin consumidor

| Campo | Contenido |
| --- | --- |
| Evidencia Drive | A4 NO RESUELTO; el rector deriva 336 px |
| Evidencia VETNEB | `UtilitySidePanel` sin `details=` productivo |
| Propuesta | No adoptar hasta que DRV-01 demuestre que las tablas resisten −336 px de contenedor en ≥ 1280 |
| Decisión | **Diferir** |

### DRV-11 · Interlineado del texto base y capa de hover respecto de §45.2

| Campo | Contenido |
| --- | --- |
| Evidencia | Tokens 13 px / 1.25 y hover 6 % frente a §45.2 (13/20 y 8 %) y Drive (14/20 y 8 %) |
| Problema real | Ninguno demostrado. Es una divergencia interna entre tokens vigentes y §45.2 |
| Propuesta | Registrar la divergencia (D-08); no tocar tokens en esta fase. Cambiar el interlineado dentro de filas de 36 px puede recortar celdas de dos líneas |
| Decisión | **Diferir**; sólo con evidencia visual y C25 abierto |

### DRV-12 · App bar de 68.11 px a 1280 × 720 (B3)

| Campo | Contenido |
| --- | --- |
| Evidencia VETNEB | A02: 68.11 px en las 21 superficies a 1280 × 720; causa: el escalón `@media (max-height: 760px)` añade `padding-block: 0.4rem` al `<header>` (acta B06 §3) |
| Diferencia con el destino | +12.11 px sobre §46 (56 ±2) |
| Propuesta | Mantenerlo como correctivo separado (acta C23 «B3»). No forma parte de esta propuesta |
| Riesgo | Alto en A03 (B06: holgura de 0.016 px) |
| Decisión | **Correctivo separado** (D-05) |

### DRV-13 · Deuda geométrica C25 (D5, D6, D7, D8)

Sin novedad respecto del acta C25: D5 (etiqueta 9.6/9.6 de la barra móvil), D6 (gaps de 6 px), D7 (1 151 controles móviles < 44 px) y D8 (fila 40, BLOCKED) mueven A02/A03. La referencia Drive **no** aporta evidencia móvil (todas sus anchuras ≤ 768 son escritorio estrecho, Drive §I.4), así que no cambia su prioridad. **Decisión:** diferir; D7 es la única con impacto de accesibilidad y la candidata a una R13 propia (D-07).

---

## 11. Propuestas detalladas

### 11.1 P1 — Responsive por contenedor (DRV-01)

**Hechos.** VETNEB tiene tres regímenes de navegación por viewport (rail 768–1279, drawer ≥ 1280, nav móvil < 768) y cinco tablas con columnas por viewport. `main.width` es discontinuo en 1280 (DERIVADO). Ningún componente responde al contenedor.

**Inferencia.** Las columnas `xl:` aparecen justo cuando el contenedor pierde 175 px, y en 1024–1279 px hay entre 945 y 1200 px de contenedor con las columnas `xl:` ocultas.

**Viabilidad técnica.** Las container queries son CSS puro y no generan `ResizeObserver` (R11 no aplica). El contenedor lógico sería el `CollectionWorkspace` o el `Table` de cada superficie. El guard C01 prohíbe geometría en los primitivos de `ui/table.tsx` (acta C24), así que la declaración de contenedor tendría que vivir en la superficie o en el CSS del dashboard.

**Propuesta en dos pasos.**

1. **Paso de evidencia (ex PR-DRV-04, sin PR propia).** Sonda temporal sobre los helpers A02, como la de C25: por superficie y viewport, `getBoundingClientRect` del contenedor de la tabla, columnas visibles, elementos con `scrollWidth > clientWidth` y ancho ocioso por columna. Viewports: los 13 canónicos más 1279 × 800, 1280 × 800 y 1920 × 945. La sonda se borra y su resultado se adjunta como acta **a la PR que la use**.
2. **PR-DRV-07 (sólo si el paso 1 muestra beneficio).** Una tabla piloto (Informes admin) con `container-type: inline-size` y umbrales derivados de sus propias columnas, no de los de Drive. Hasta entonces DRV-01 es **hipótesis**, no defecto confirmado.

**No se hace:** copiar los umbrales 744/832/1126 de Drive; tocar `ui/table.tsx`; cambiar el pitch de fila.

### 11.2 P2 — Cuadrícula adaptativa (DRV-02)

| Alternativa | Regla | Owner de capacidad | Riesgo principal | Valoración |
| --- | --- | --- | --- | --- |
| A · Mantener columnas fijas | Igual que hoy | Ninguno nuevo | Tarjetas desproporcionadas a 1920 | Statu quo aceptable |
| B · Columnas por contenedor con mínimo de ancho | `c = clamp(floor((w + gap) / (minW + gap)), cMin, cMax)`; filas = `ceil(limit / c)` | Ninguno: `limit` sigue siendo una entrada | Con `limit` bajo y `c` alto, filas altas y vacías | Viable |
| C · Como B con restricción de alto mínimo | Elegir el mayor `c` que cumpla `w / c ≥ minW` **y** `canvas / ceil(limit / c) ≥ minH`; si ninguno cumple, lista | Ninguno | Requiere leer el alto del canvas ya medido por el owner único (lectura, no medición nueva) | **Recomendada para investigar** |
| D · `auto-fit` CSS | `repeat(auto-fit, minmax(220px, 1fr))` | Ninguno | Filas no controladas: páginas incompletas, tarjetas recortadas, rompe `gridTemplateRows` | **Rechazada** (§12) |

La alternativa C preserva `effectiveLimit`, `offset`, página y selección (la cuadrícula sólo dibuja la página recibida), no crea un segundo owner de capacidad (el canvas lo mide `useDashboardCanvasCapacity`) y no introduce scroll horizontal. Antes de elegir `minW` y `minH` por superficie hace falta la medición de la sonda (ex PR-DRV-04): hoy no hay datos de alto de tarjeta.

### 11.3 P3 — Filtros progresivos (DRV-03, DRV-04, DRV-05)

- **S1 (Auditoría):** no adoptar chips. Quitar un chip exigiría reescribir la URL desde el cliente (acta C18, §7.3 rector).
- **S2/S3:** recuento visible de filtros aplicados en 768–1279 px y en el disparador móvil (DRV-03, opción mínima).
- **S4/S5:** sin estado «aplicado» (filtran en `onChange`): no hay chips que mostrar.
- **S6/S7:** sólo con la decisión D-03.
- **Todas:** `role="search"` (DRV-05).
- **No se inventa:** retirada individual, reset de paginación ni parámetros nuevos.

### 11.4 P4 — Acciones contextuales (DRV-06)

La infraestructura (C06–C09) existe. Lo que falta son **acciones secundarias reales**. La propuesta se limita a decidir el menú de Informes admin (D-04). No se propone `ContextMenu` mientras el guard de copia/selección lo prohíba, ni `BulkActionMenu` sin contrato backend.

### 11.5 P5 — Microgeometría y tipografía

La referencia Drive no cambia las prioridades de C25: recuperar información truncada (DRV-07) y accesibilidad (DRV-09, DRV-13) antes que ajustes ornamentales. No se trasladan fuentes ni colores de Google (M-25). El 8 % de hover de Drive coincide con §45.2 y no con el token vigente (6 %); se registra para decisión (D-08), no se propone cambiarlo.

### 11.6 P6 — Shell, buscador y navegación

- No se modifican `WorkspaceAppBar`, `SuperSearchField`, drawer, rail, nav móvil ni paneles.
- El buscador de la app bar es un navegador de módulos: la contradicción 722 vs 834 px de Drive no tiene consecuencia para él y queda **NO RESUELTA**.
- B3 se trata como correctivo separado (DRV-12).
- Se propone el enlace de salto (DRV-08), que es la única mejora de shell con valor demostrable y sin efecto geométrico.

### 11.7 P7 — Accesibilidad y microinteracciones

Adoptar: DRV-05, DRV-08 y DRV-09. Medir en C26: contraste en ambos temas (gate G11), efecto de `prefers-reduced-motion` y `forced-colors`, encabezados por superficie. No copiar de Drive: input de búsqueda sin nombre accesible, `role=grid` sin `columnheader`, `min-width: 1000px` y el contraste 3.89 del texto auxiliar del buscador (Drive §X.3).

### 11.8 P8 — Diferenciales clínicos

Ver §12, filas «Explorador de archivos», «Miniaturas por registro», «Árbol jerárquico» y «Acciones masivas sin contrato». La productividad clínica sale de densidad de datos, orden server-side, detalle completo y filtros aplicados visibles, no de una metáfora de archivos.

---

## 12. Alternativas rechazadas

| Alternativa | Motivo |
| --- | --- |
| Fila de 48 px como Drive | Reduce el `limit` (rector §26 nota); 36 px ya muestra más filas que Drive |
| Copiar los umbrales 744/832/1126 de Drive | Dependen de las columnas de Drive; los de VETNEB deben derivarse de sus propias columnas |
| `grid-template-columns: repeat(auto-fit, …)` | No controla filas: páginas incompletas y tarjetas recortadas; rompe `collectionGridRows` |
| Rail derecho de aplicaciones | Sin función en VETNEB; consume 56 px de ancho |
| `body { min-width: 1000px }` | Produce overflow horizontal (Drive §VI.5); rompe A08 |
| Tooltips propios hover-only | Invisibles al tacto y al teclado salvo implementación completa de WCAG 1.4.13; PR-TRUNC ya rechaza `title` para valores |
| Fuentes «Google Sans» / Roboto y hex de Drive | Propietarios; la identidad VETNEB está en §45.1 |
| `role=grid` con una única parada de Tab para toda la tabla | Drive no expone `columnheader` ni `aria-sort`; cambiaría el contrato de teclado de C06 (checkbox por fila) |
| Explorador de archivos / colección documental genérica | Convierte flujos clínicos (informes, estudios, logística) en navegación de archivos; exige análisis de privacidad, backend y rendimiento no autorizado |
| Miniaturas por registro | Cada miniatura exigiría una URL firmada y verificación de MIME por bytes por fila (el descriptor de C17 es por informe abierto); coste de privacidad, de Storage y de red |
| Árbol jerárquico en la navegación | Los módulos son planos; un árbol añade expansión sin profundidad real |
| Acciones masivas sin contrato backend | Inventaría negocio (acta C09) |
| Unificar los mecanismos de consulta de S1–S7 | Operativa protegida (rector §47.3, §7.8) |
| Redimensionar el buscador de la app bar a 722 u 834 px | Función distinta (módulos); contradicción de fuentes sin resolver |

---

## 13. Riesgos y compatibilidad con contratos

Contratos verificados contra sus fuentes actuales (guards en `test/architecture/` y specs en `frontend/e2e/`), no por semejanza de nombre.

| Contrato | Fuente ejecutable | PR-BUG-03 (DRV-05) | PR-DRV-02 skip | PR-DRV-03 foco forced-colors | DRV-07 F-T1 | DRV-03 recuento | DRV-01 contenedor | DRV-02 cuadrícula |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A01 operativa S1–S7 | `dashboard-operational-contract-baseline.test.ts` | Atributos, sin eventos | — | — | — | Sin cambio de handlers | — | — |
| A02 geometría | `dashboard-geometry-baseline.ts` | Ninguno (atributos sobre elementos existentes) | `fixed` fuera de flujo; `main` sin cambio de caja | Sólo en forced-colors; no ocupa layout | 8.ª columna o disparador en celda de Visitas | Ancho del botón | Contenido de celdas | Interior del canvas |
| A03 `limit`/`offset` | `dashboard-adaptive-limit-baseline.ts` | No | No | No | Sólo si cambia la altura de fila | Sólo si salta de línea | Sólo si cambia la altura de fila | No (filas = f(`limit`)) |
| A05 reservas | spec de invariancia | No | No | No | No | No | No | No |
| A08 zero-scroll | `dashboard-*-no-scroll-contract` | No | **Verificar** (el enlace oculto no debe crear overflow) | No | Diálogo existente | No | Overflow interno | «Sin overflow» C24 |
| B15/B16 composición | guards B15/B16 | No | Shell | Portales | No | No | No | No |
| C01–C12 | guards C01–C12, C17–C22 | `FilterBar` | No | Overlays | Guard C22 (Logística) | Guards C17/C18 | Guard C01 (sin geometría en `ui/table`) | Guard C24 |
| C23/C23b | `dashboard-c23-responsive-integral.test.ts` (ledger vacío) | No | No | No | No | **Sí** si añade chrome | No | No |
| C25 | sección C25 de `dashboard-b11-workspace-header.test.ts`, `dashboard-truncation-integrity.test.ts` | No | Foco | **Sí** (extiende G1) | **Sí** (PR-TRUNC) | No | PR-TRUNC | No |
| C26 | — | Reduce violaciones axe | Mejora teclado | Gate G11 | Criterio §62.17 | §62.8 | — | — |

**Riesgos residuales nuevos** (se suman a R1–R15 del rector):

| # | Riesgo | Mitigación |
| --- | --- | --- |
| RD-1 | Container queries reabren la discontinuidad de 1280 en otra dirección (columnas que aparecen y desaparecen al abrir un panel) | Umbrales con histéresis de una columna; medir con y sin panel en la sonda (ex PR-DRV-04) |
| RD-2 | El enlace de salto crea overflow al recibir foco | `position: fixed` dentro del viewport; A08 con foco en el enlace |
| RD-3 | El recuento de filtros cambia el ancho del disparador y provoca salto de línea | Medir a 360 y 768 px; si salta, sólo en el nombre accesible |
| RD-4 | Reinterpretar la referencia Drive como destino | Este documento es `PROPOSED`; los destinos siguen en §46 |

---

## 14. Priorización técnica

**Rúbrica explícita** (sin puntuaciones numéricas):

- **Valor:** V1 = recupera información o accesibilidad perdida (indicio o incumplimiento WCAG 2.x A/AA, PR-TRUNC) · V2 = reduce un coste de interacción observable (paradas de Tab, ambigüedad de estado) · V3 = coherencia visual sin efecto funcional demostrado.
- **Riesgo:** Bajo = no toca A01/A02/A03 · Medio = puede tocar A02 sin A03 · Alto = puede tocar A03 o §7.8 (R13 o decisión de Nico) · Crítico = backend o contrato protegido.
- **Complejidad:** Baja = un owner, sin estado nuevo · Media = varios owners o medición previa · Alta = varias superficies o contrato nuevo.
- **Evidencia:** E1 medida (A02/acta) · E2 derivada · E3 estática.

| Hallazgo | Valor | Riesgo | Complejidad | Evidencia | Prioridad | Antes de C26 |
| --- | --- | --- | --- | --- | --- | --- |
| DRV-09 foco forced-colors (PR-DRV-03) | V1 | Bajo | Baja | E1 (acta C25 §8) + E3 (cascada Tailwind v4) | **1** | Sí, obligatorio (§56.6) |
| DRV-05 / PR-BUG-03 | V1 (ARIA inválido en S5) · V2 (landmarks) | Bajo | Baja | E3 | **1** | Sí, obligatorio (correctivo del rector abierto) |
| DRV-08 enlace de salto (PR-DRV-02) | V2 | Bajo | Baja (reutiliza) | E3 | **2** | Conveniente |
| DRV-07 F-T1 | V1 | Medio | Baja–Media | E1 (acta C25) | 3 | No (R-09) |
| Sonda (ex PR-DRV-04) | habilita DRV-01/02/03 | Bajo (temporal) | Media | — | 3 | No; paso previo de la primera PR que la necesite |
| DRV-03 recuento | V2 | Bajo–Medio | Baja | E3 | 3 | Opcional |
| DRV-06 menú | V2 | Bajo–Medio | Baja | E3 | 3 | No |
| DRV-01 contenedor | V2 | Medio | Media | E2 | 4 | No |
| DRV-02 cuadrícula | V3 | Bajo–Medio | Media | E3 | 5 | No |
| DRV-07 F-T2…F-T7 | V1 | Medio–Alto | Media | E1 | 4 | No (decisión D-06) |
| DRV-13 D7 táctiles | V1 | Alto (R13) | Alta | E1 | 4 | No (decisión D-07) |
| DRV-04 S6/S7 | V2 | Alto | Media | E3 | 6 | No (D-03) |
| DRV-10, DRV-11 | V3 | Medio | Media | E3 | 7 | No |

---

## 15. Roadmap propuesto de PRs

Los identificadores son propuestos: **no** son números de GitHub y **no** están aprobados. No forman un Programa D. PR-BUG-03 es un correctivo que ya existe en el rector (§55); el resto se presenta como correctivos junto al roadmap A/B/C vigente, a la manera de §55.

### 15.1 Dictamen sobre las PRs de la v1

| PR v1 | Dictamen | Justificación |
| --- | --- | --- |
| PR-DRV-01 | **MODIFICAR** → PR-BUG-03 | Duplicaba con un ID nuevo un correctivo del rector. El alcance verificado incluye el `aria-label` inválido de S5 y excluye P2-05, ya cubierto por los pagers (R-01 a R-03) |
| PR-DRV-02 | **MODIFICAR** | Reutiliza `SkipToContent` en lugar de crear un enlace y pasa de obligatorio a conveniente (R-04, R-05) |
| PR-DRV-03 | **MODIFICAR** | RED primero y una regla sólo para forced-colors en lugar de migrar portales. Se vuelve obligatorio por §56.6 (R-06, R-07) |
| PR-DRV-04 | **DIFERIR** (no como PR independiente) | Ningún ítem anterior a C26 depende de la sonda. Pasa a ser el paso de evidencia de la primera PR del tramo C que la necesite (R-08) |
| PR-DRV-05 (F-T1, opcional en v1) | **DIFERIR** | Exige una columna o un disparador nuevo en una superficie consumidora de A03: no es neutro (R-09) |

**Unificación evaluada y descartada.** PR-BUG-03 (filtros: S1–S7), PR-DRV-02 (shell) y PR-DRV-03 (overlays) tocan owners distintos, tienen causas distintas y se revierten por separado. Unirlas no reduce riesgo y mezcla scopes (AGENTS §4).

### 15.2 A — Obligatorio antes de C26

| Campo | PR-BUG-03 | PR-DRV-03 |
| --- | --- | --- |
| Objetivo | Un landmark `search` nombrado por barra S1–S7 y el fin del `aria-label` inválido de S5 | Foco visible en forced-colors dentro de los overlays portados a `body` |
| Beneficio | Navegación por landmarks; cierra P2-04 y P2-18 del rector | Cierra el residual de C25 §8 y la verificación de §56.6 |
| Owners y archivos | `AdminAuditFilterBar.tsx`, `AdminParticularTokensCard.tsx`, `AdminReportsCard.tsx`, `AdminClinicsManagementCard.tsx`, `AdminUsersRolesReadOnlyCard.tsx`, `ClinicInformesWorkspaceSummary.tsx`, `ClinicParticularTokensCard.tsx`; guards que anclan ese JSX | `styles/dashboard/interactions.css` (bloque sin capa); anclas `data-*` de los overlays si faltan; spec E2E nueva; sección del guard C25 |
| Dependencias reales | Ninguna | Ninguna (C25 G1 ya está en `main`) |
| Complejidad / Riesgo | Baja / Bajo | Baja / Bajo |
| R13 | No | No |
| Tests | Guards realineados sin debilitar; A01; A02 21/21; aserción del árbol de accesibilidad (1 `search` visible por superficie) en las specs C17–C22 | RED → GREEN en E2E con `forcedColors: "active"` abriendo campana, `ModuleCard`, `UploadReportModal`, `ClinicEditDrawer` y un `ModuleDialog` no acotado; guard C25 ampliado (sin capa, sólo `outline`, sólo forced-colors) |
| Aceptación | A01 idéntico; A02 sin drift; 7/7 barras con `role="search"` y nombre; 0 `aria-label` sobre `div` sin rol en S5 | 0 controles enfocables sin indicador en forced-colors en esos overlays; 0 cambios en capturas de modo normal |
| Rollback | `git revert` si A01/A02 o una spec C17–C22 regresiona | `git revert` si cambia alguna captura en modo normal o aparece overflow |

### 15.3 B — Conveniente antes de C26

| Campo | PR-DRV-02 |
| --- | --- |
| Objetivo | Enlace de salto al contenido en admin y clínica |
| Beneficio | Primer control de `main` a ≤ 2 pulsaciones de Tab |
| Owners y archivos | `DashboardShellRouter.tsx` o los dos shells; `admin/page.tsx:756` y `ClinicDashboardShell.tsx:92` (`id="main-content"`); guard nuevo análogo a `frontend-public-skip-link-contract.test.ts` |
| Dependencias reales | Ninguna |
| Complejidad / Riesgo | Baja / Bajo |
| R13 | No |
| Tests | Guard (botón, `aria-controls`, id en ambos `main`); E2E de primera parada de Tab y foco en `main`; A08 con el enlace enfocado en 1366 × 768 y 390 × 844; A02 21/21 |
| Aceptación | Primera parada = enlace; Enter → foco en `main`; A02/A08 sin cambios |
| Rollback | `git revert` si aparece scroll de documento o drift A02 |

### 15.4 C — Diferible después de C26

| ID | Objetivo | Dependencia real | Riesgo | R13 |
| --- | --- | --- | --- | --- |
| PR-DRV-05 | F-T1: detalle de Visitas en escritorio | D-06; medición A02/A03 de la tabla de Visitas | Medio | Posible |
| PR-DRV-06 | Estado de filtros aplicados en S2/S3 bajo 1280 px (recuento; chips sólo si no hay salto de línea) | Sonda (paso previo) | Bajo–Medio | Sólo si hay salto de línea |
| PR-DRV-07 | Container queries en la tabla piloto de Informes admin | Sonda con beneficio demostrado | Medio | Posible |
| PR-DRV-08 | Columnas de `ContentGrid` por contenedor con alto mínimo (alternativa C de §11.2) | Sonda | Bajo–Medio | No esperado (filas = f(`limit`)) |
| PR-DRV-09 | `ActionMenu` de Informes admin | D-04 | Bajo–Medio | No |
| PR-DRV-10 | F-T2 a F-T7 | D-06 | Medio–Alto | Posible |
| B3 (existente) | App bar 56 px a 1280 × 720 | D-05 | Alto | Sí |
| D7 (C25, existente) | Objetivos táctiles ≥ 44 px en móvil | D-07 | Alto | Sí |

### 15.5 D — Rechazado

| Propuesta | Motivo |
| --- | --- |
| Sonda como PR independiente (ex PR-DRV-04) | Una PR que sólo agrega un acta, sin decisión inmediata que la consuma; se integra en la PR que la necesite |
| Migrar los overlays a `dashboardScopedPortal` para resolver el foco | Cambia apilamiento y contención con más riesgo que la regla de forced-colors y el mismo beneficio |
| Chips de filtros en línea entre 768 y 1279 px sin medición | Probable segunda fila → A02/A03 (R13) para un beneficio que el recuento obtiene sin geometría |
| Las de §12 | Ver §12 |

### 15.6 Secuencia y cantidad

Total antes de C26: **3 PRs** (2 obligatorias y 1 conveniente), frente a 4–5 en la v1. Las tres son independientes y se pueden revisar en cualquier orden. Como cada una ejecuta su cohorte E2E y AGENTS §8 permite una tarea pesada a la vez, el orden recomendado es:

1. PR-DRV-03, porque su RED puede cerrar sin cambio de runtime.
2. PR-BUG-03.
3. PR-DRV-02.

---

## 16. Plan de validación

**Cómo se demostraría que el dashboard mejoró**, con métricas medibles y sin estimaciones inventadas:

| Mejora | Métrica | Antes (fuente) | Objetivo |
| --- | --- | --- | --- |
| Landmarks de búsqueda | Barras S1–S7 con `role="search"` y nombre | 0 de 7 (estático) | 7 de 7 |
| ARIA válido en S5 | `aria-label` sobre `div` sin rol | 1 (`AdminUsersRolesReadOnlyCard.tsx:418-421`) | 0 |
| Foco en forced-colors | Controles sin indicador en overlays portados a `body` | Deducido > 0, sin medir (acta C25 §8) | 0, medido por el RED/GREEN de PR-DRV-03 |
| Enlace de salto | Pulsaciones de Tab hasta el primer control de `main` | Sin medir | ≤ 2 (enlace + primer control) |
| Información truncada (tramo C) | Hallazgos PR-TRUNC sin mecanismo | 7 (acta C25) | Según D-06 |
| Estado de filtros (tramo C) | Viewports en los que el estado aplicado es visible sin abrir un diálogo | S3: 5 de 13 (≥ `xl`); S2: 5 de 13, y ningún mecanismo bajo 1280 (estático) | 13 de 13 |
| Columnas por contenedor (tramo C) | Elementos truncados por viewport en la tabla piloto | Sin medir | Hipótesis: reducir en 1280–1366 sin aumentar en otros |
| Invariantes | A01, A02 21/21, A03 195/195 + 234/234, A05 15/15, A08 21/21 | PASSED (actas C25/C23b PR5) | Sin cambios |

**Gates por PR** (AGENTS §6, frontend): test dirigido → `pnpm --dir frontend lint` → `pnpm --dir frontend typecheck` → `pnpm --dir frontend build` → `pnpm security:public-surface` (obligatorio: PR-DRV-03 puede agregar `data-*`) → cohorte E2E mínima (verificando antes la pertenencia en `frontend/e2e/suites/catalog.ts`): `e2e:visual-contract` para A02/A08 y specs C17–C22; `e2e:admin-mobile` si se toca el móvil admin. `e2e:full` sólo con pedido explícito. Higiene: `frontend/next-env.d.ts` y los artefactos de Playwright fuera del diff.

---

## 17. Dependencias de C25 y C26

### 17.1 Cierre de C25

C25 está **PARTIAL** (acta C25 §10). PR-DRV-03 cierra su único residual sin geometría (portales, §8). Después de esa PR, C25 queda con:

- D4/F-T1..F-T7: decisión funcional (D-06).
- D5, D6 y D7: R13.
- D8: BLOCKED por C05.

Ninguno se resuelve antes de C26 sin una autorización que hoy no existe. El rector declara que C26 depende de C25 (§50), así que iniciar C26 con C25 PARTIAL es la decisión D-11.

### 17.2 C26: qué cierra y qué no

El rector separa dos cierres que la v1 confundía:

- **Cierre de C26** (§54, fila C26): «Gates de §58 verdes». Su contenido es regresión visual, accesibilidad (§56.6), rendimiento y gates.
- **Cierre del programa** (§62): veinte criterios simultáneos.

**Gates de §58 relevantes para C26:**

| Gate | Condición | Estado en `main@9dfb5024` |
| --- | --- | --- |
| G9 | Chrome ≤ 240 px a 1920 y ≤ 32 % en 768–1366 | PASSED (ledger C23b vacío; guard C23) |
| G10 | Piloto cerrado | Registrado como cerrado en el acta C17 (#1881), con los límites que declara: C14 no adoptado; suite completa sólo en Linux/CI |
| G11 | axe sin violaciones críticas ni serias en ambos temas | NOT_RUN en 21 superficies × 2 temas |
| G12 | Staging con tenants de prueba, evidencia sanitizada, 48 h sin incremento de 4xx/5xx | NOT_RUN; es **R3** y exige delegación específica (D-12) |

**Criterios de §62 con evidencia de incumplimiento o sin verificar:**

| §62 | Criterio | Estado | Fuente |
| --- | --- | --- | --- |
| 7 | Selección coherente en las 12 colecciones | FAILED si «coherente» significa «presente en las 12»; ambiguo si significa «coherente donde existe» | Actas C09, C18–C22 |
| 8 | Filtros progresivos | PARCIAL: S2/S3 | §5.3 |
| 9 | Un `DetailsPane` | PARCIAL: 6 consumidores en diálogos; panel lateral sin uso | §5.4 |
| 15 | axe en ambos temas | NOT_RUN | = G11 |
| 16 | Táctiles ≥ 44 px | FAILED: 1 151 controles | C25 D7 |
| 17 | Tolerancias de §46 | FAILED: fila 36 (C05 BLOCKED) y app bar 68.11 a 1280 × 720 (B3) | rector §26; A02 |

**Consecuencia.** C26 puede cerrarse honestamente contra §58 si G11 y G12 se ejecutan. El programa (§62) **no** puede declararse cerrado con la evidencia actual. Ningún cierre debe ocultar esta brecha; la vía correcta es la D-01(c) (§19).

---

## 18. Evidencia faltante y limitaciones

| Dato | Estado | Medición que lo resolvería |
| --- | --- | --- |
| Geometría VETNEB a 1920 × 945 y 1280 × 800 | Pendiente | Sonda (ex PR-DRV-04) |
| Truncado y ancho ocioso por columna en 1024–1440 px y en 1279/1280 | Pendiente | Sonda (ex PR-DRV-04) (reutiliza la regla de truncado de la sonda C25) |
| Alto y ancho de tarjeta de `ContentGrid` por viewport | Pendiente | Sonda (ex PR-DRV-04) |
| Ancho y alto renderizados de `FilterChip` | No registrado en A02 | Sonda (ex PR-DRV-04) o spec C11 |
| Foco en overlays bajo forced-colors | No medido (C25 no abrió overlays) | PR-DRV-03 |
| Contraste y axe en 21 superficies × 2 temas | No medido | C26 (G11) |
| Tema oscuro (VETNEB y Drive) | No medido | C26 |
| Selección, menú contextual y panel de detalle de Drive | NO RESUELTO en la referencia (A2–A4) | Nueva ejecución del laboratorio Drive |
| Retardo de tooltips, virtualización y estados pressed/loading de Drive | NO RESUELTO | Idem |
| Contradicción 834/722 px y 728/616 px del buscador | NO RESUELTA | Medición Drive en las mismas condiciones que §25.1 del rector |

**Limitaciones de este documento.** No ejecutó mediciones nuevas; los valores A02 son Win32 (los Linux se consultan sólo en las actas); el censo de consumidores es estático y puede no detectar usos indirectos (por ejemplo, componentes pasados como props); no evalúa rendimiento ni comportamiento con lector de pantalla.

---

## 19. Decisiones pendientes de autorización

### 19.1 D-01 — Tratamiento de C26 y §62 (revisado en la v2)

**Definición exacta de la v1:** «(b) enmienda docs-only con excepciones medidas» de los criterios de §62, recomendada «más el tramo 1».

| Pregunta | Respuesta |
| --- | --- |
| Qué autorizaba | Reescribir §62 para registrar como excepción los criterios 7, 8, 9, 16 y 17, y así poder declarar el programa cerrado |
| Qué excluía | La ejecución de D7, B3 y C05 |
| Qué problema resolvía | Que C26 no pudiera cerrarse mientras §62 siguiera incumplido |
| Evidencia que la respaldaba | Las causas documentadas de cada no-adopción (actas C09, C18–C22) y los bloqueos R13 (C05, C25) |
| Deuda que dejaba | D7 (accesibilidad móvil), B3, C05/D8, la adopción parcial de filtros y de detalle |
| ¿Cumple los criterios rectores de C26? | **No es necesaria para C26**: el cierre de C26 se mide contra §58 (§54), no contra §62. La v1 confundía ambos cierres |
| ¿Puede producir un cierre falso? | **Sí**: redefinir el criterio 16 (táctiles) o el 17 (tolerancias) hace que una deuda de accesibilidad y geometría medida desaparezca del estado del programa sin haberse resuelto |
| Alternativa superior | D-01(c), abajo |

**Dictamen: RECHAZAR D-01(b).**

**D-01(c), propuesta:**

1. C26 se ejecuta y cierra contra §58, con estado canónico por gate. G11 debe estar PASSED. G12 es R3 y requiere delegación propia (D-12); sin ella queda BLOCKED y C26 no se declara completo.
2. Un acta de cierre de programa evalúa los 20 criterios de §62 con PASSED / FAILED / BLOCKED / NOT_RUN y la fuente de cada uno, **sin modificar el texto de §62**.
3. Cada criterio que no esté en PASSED queda en un registro de deuda con un owner y una salida concreta: R13, correctivo o decisión de producto.
4. Sólo el criterio 7 admite una aclaración interpretativa («coherente donde existe operación»), y debe ser una decisión explícita de Nico registrada como tal, no una excepción encubierta.

### 19.2 Resto de decisiones

| ID | Decisión | Opciones | Recomendación |
| --- | --- | --- | --- |
| D-01 | Ver §19.1 | (b) rechazada · (c) | **(c)** |
| D-02 | Autorizar las PRs anteriores a C26 | A (PR-BUG-03, PR-DRV-03) · A + B (PR-DRV-02) | A + B, una PR por vez (§15.6) |
| D-03 | Retirada individual de chips en S6/S7 | Definir la semántica (campo, draft, página) · No adoptar | No adoptar hasta tener evidencia de uso |
| D-04 | `ActionMenu` de Informes admin | Poblarlo con acciones existentes (vista previa, descarga) · Retirarlo y realinear el guard C17 | Poblarlo sólo si hay una acción secundaria real; si no, retirarlo |
| D-05 | B3 (app bar 68.11 px a 1280 × 720) | PR correctiva con R13 propia · Mantener abierto | PR correctiva separada, después de C26 |
| D-06 | F-T1 a F-T7 | Autorizar F-T1 · Autorizar el lote · Diferir | Diferir; F-T1 primero cuando se autorice |
| D-07 | D7 (táctiles < 44 px) | R13 propia · Dejarlo como FAILED en el acta de §62 | R13 propia después de C26 |
| D-08 | Divergencia tokens ↔ §45.2 (hover 6 % vs 8 %; interlineado 1.25 vs 13/20) | Enmendar §45.2 · Ajustar los tokens con evidencia visual | Enmendar §45.2 para reflejar los tokens vigentes, salvo evidencia en contra |
| D-09 | Corrección documental | Ver §19.3 | Una PR docs-only propia |
| D-10 | Contradicción C08 (`ContextMenu` exigido vs `onContextMenu` prohibido) | Enmendar el rector · Excepción acotada en el guard | Enmendar el rector |
| D-11 | Iniciar C26 con C25 en PARTIAL (el rector declara C26 → C25) | Iniciar con el estado de C25 registrado en el acta · Esperar las R13 de C25 | Iniciar después de PR-DRV-03, con D5–D8 registrados como deuda |
| D-12 | G12 (staging, 48 h) | Delegar la ejecución R3 nombrando el entorno · Dejarlo BLOCKED | Delegación explícita con entorno y tenants de prueba nombrados (AGENTS §17) |

### 19.3 D-09 — Registros concretos

| # | Registro | Tipo | Verificación | Corrección mínima propuesta |
| --- | --- | --- | --- | --- |
| 1 | `GOOGLE_DRIVE_REFERENCIA_UI_CONSOLIDADA.md:21`: «PR #1892 (abierta)» | Metadato | #1892 MERGED el 2026-10-19T13:40:48Z, `d1283a4f` | «PR #1892 (MERGED, `d1283a4f`)» |
| 2 | `AUDITORIA_GLOBAL_DASHBOARD_VETNEB_VS_DRIVE.md:1833` (§50, C04): `IN_PROGRESS_PREREQUISITE_COMPLETE … C04_FRONTEND = READY_FOR_IMPLEMENTATION … NEXT_SLOT = C04 frontend`; repetido en §54 (fila C01–C05, «(b) READY_FOR_IMPLEMENTATION») | **Afecta decisiones**: invita a reimplementar C04, que ya está completo | #1825 MERGED 2026-10-06, `26b5a7c1` | `COMPLETE (#1822 backend, #1825 frontend)` |
| 3 | Rector §50, filas C08–C26 (`:1837-1855`) sin estado; §49 B01–B14 (`:1805-1818`) sin estado | Histórico | C08 #1864, C09 #1865, C10 #1866, C11 #1867, C12 #1868, C13 #1873, C14 #1875, C15 #1877, C16 #1878, C17 #1881, C18–C22 #1882–#1887, C23a #1888, C23b #1893–#1897, C24 #1889, C25 #1891, B01–B08 #1658–#1671, B15/B16 #1813; B09–B14 no verificados en esta revisión | Columna de estado: COMPLETE con su PR; C25 = **PARTIAL** (afecta a D-11); C26 = NOT_STARTED |
| 4 | Rector, bloques «Actualización …» (`:26-46`): terminan en C04 | Histórico | — | Un único bloque de actualización que remita a la tabla §50 corregida, sin reescribir los anteriores |
| 5 | `docs/audit/README.md`: no indexa la referencia Drive ni esta propuesta | Índice (la propia referencia lo declara en su §XIV.6) | `grep` del índice | Dos filas `PROPOSED`, sin rol rector |

Tocar los registros 2 a 4 modifica la fuente rectora y el 5 el índice: la PR docs-only necesita autorización explícita. Ninguno se corrige en esta revisión.

---

## 20. Conclusión y recomendación

**Respuestas al criterio definitivo:**

1. **¿Qué aporta la referencia Drive que VETNEB no tiene?** La demostración de responsive por contenedor (DRV-01/02, hoy **hipótesis** sin medir en VETNEB), la navegación de salto (DRV-08) y el estado de filtros siempre visible (DRV-03). Por contraste, confirma que VETNEB ya resolvió densidad, chrome y reflow mejor que Drive (M-06, M-08, M-10).
2. **¿Qué existe y sólo necesita adopción?** `SkipToContent` (sólo montarlo en el dashboard), `ActiveFilterChips` (S6/S7), `OverflowMenu`/`SubMenu`, `DetailsTabs`/`DetailsActionDock` y `UtilitySidePanel`. Salvo el primero, su no-adopción tiene causas documentadas (§9).
3. **¿Qué diferencias son intencionales?** Las ocho de §8.
4. **¿Qué mejoras dan beneficio verificable?** PR-BUG-03, PR-DRV-03 y PR-DRV-02, con las métricas de §16.
5. **¿Qué cambios arriesgan A02, A03, zero-scroll o accesibilidad?** Chips en 768–1279 px, container queries, F-T1 (columna nueva), D5–D7, B3, F-T4 y cualquier cambio de pitch.
6. **¿PRs mínimas?** Tres antes de C26 (§15.6).
7. **¿Qué antes de C26 y qué diferir?** Antes: PR-BUG-03 y PR-DRV-03 (obligatorias), PR-DRV-02 (conveniente), y las decisiones D-01(c), D-11 y D-12. Diferir: el tramo C.
8. **¿Cómo demostrar la mejora?** Con las métricas de §16 y los gates A01–A08 sin cambios.

**Limitaciones de la v2.** Sigue sin mediciones runtime nuevas: el defecto de PR-DRV-03 está deducido de la cascada CSS y se confirma con su RED, y DRV-01/02/03 siguen siendo hipótesis. La detección por axe del `aria-label` de S5 no está verificada. El censo de consumidores es estático.

**Recomendación final.** No abrir un programa de convergencia con Drive. Ejecutar las tres PRs de §15 en el orden de §15.6, cerrar C26 contra §58 con la D-01(c), no reescribir §62, y tratar el responsive por contenedor como una línea de investigación con medición previa.
