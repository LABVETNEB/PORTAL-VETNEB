# Clinic Dashboard Admin-Structure Parity Audit

Fecha: 2026-06-25
Rama: `audit/clinic-dashboard-admin-structure-parity`
Base: `main` @ `f6864ac` (docs(particulares): close product ux block #1134)
Tipo: docs-only audit. No se modificó frontend productivo, tests, backend, API, auth, DB, deps, lockfiles ni CI.

## Scope

Este documento cubre exclusivamente el **dashboard privado de Clínica**:

- `/dashboard`
- `/dashboard?module=operaciones`
- `/dashboard?module=informes`
- `/dashboard?module=logistica`
- `/dashboard?module=perfil`
- `/dashboard?module=tokens`

**Fuera de scope explícito:** la página pública `/clinicas` (landing/catálogo público de clínicas) no forma parte de este bloque y no debe modificarse en ningún PR derivado de esta auditoría. Tampoco está en scope el dashboard Admin productivo (`/dashboard/admin`) — se usa únicamente como benchmark de lectura.

## Objective

Llevar la estructura del dashboard de Clínica al mismo nivel de madurez arquitectónica que ya tiene Admin, sin copiar permisos, datos ni funciones admin-only. Paridad estructural, no paridad de capacidades:

- controller/workspace explícito y documentado
- command center operativo (no solo launcher de tarjetas)
- operación module-first con navegación activa protegida
- densidad operativa mobile con módulos dedicados donde aporte valor
- no-scroll a nivel dashboard (scroll solo dentro de listas/tablas internas)
- estados loading/empty/error/retry uniformes
- evidencia desktop/mobile comparable en formato y rigor a la de Admin

## Current Clinic structure

| Pieza | Archivo |
|---|---|
| Entry route (server) | [frontend/src/app/dashboard/page.tsx](../../frontend/src/app/dashboard/page.tsx) |
| Controller (client) | [frontend/src/components/dashboard/ClinicDashboardWorkspaceController.tsx](../../frontend/src/components/dashboard/ClinicDashboardWorkspaceController.tsx) |
| Command center (módulo `operaciones`) | [frontend/src/app/dashboard/ClinicCommandCenter.tsx](../../frontend/src/app/dashboard/ClinicCommandCenter.tsx) |
| Resumen módulo `informes` | [frontend/src/app/dashboard/ClinicInformesWorkspaceSummary.tsx](../../frontend/src/app/dashboard/ClinicInformesWorkspaceSummary.tsx) |
| Resumen módulo `logistica` | [frontend/src/app/dashboard/ClinicLogisticaWorkspaceSummary.tsx](../../frontend/src/app/dashboard/ClinicLogisticaWorkspaceSummary.tsx) |
| Módulo `perfil` | `ModuleTabs` inline en `page.tsx` con `PasswordChangePanel` + `ClinicPublicProfileCard` |
| Módulo `tokens` | `ClinicParticularTokensCard` (sin wrapper de módulo propio) |

Observaciones de la estructura actual:

- El controller (`ClinicDashboardWorkspaceController`) ya existe y sigue el mismo patrón base que `AdminDashboardWorkspaceController`: estado `activeModule`, sincronización con `searchParams`, `activateModule`/`backToHub`, restauración de último módulo vía `dashboard-last-module`. Es la pieza más cercana a paridad real hoy.
- A diferencia de Admin, el controller de Clínica **no** está envuelto en un "stage" persistente, opaco e isolado (`data-dashboard-module-stage`) para el swap hub↔módulo. Admin lo introdujo específicamente para resolver bleed-through en mobile (ver `project_admin_mobile_hub_stage` en memoria). Clínica no tiene ese contrato, ni necesidad confirmada de él, pero tampoco está descartado.
- `ClinicCommandCenter` ya usa `ModuleSurface` + `ModuleTabs` (Métricas / Recientes) — estructuralmente alineado con el patrón de superficie operativa de Admin, pero sin las cards de "Atención requerida" / "Actividad reciente" / "Alertas y estados" que sí tiene `AdminCommandCenter`.
- `informes` y `logistica` son **resúmenes** (`*WorkspaceSummary`) con master-detail inline y un link "Abrir módulo completo" hacia rutas full (`/dashboard/informes`, `/dashboard/logistica/...`) que existen fuera del sistema de módulos `?module=`. Esto es una dualidad: parte de la navegación vive en `?module=` (hub) y parte en rutas full independientes. Admin no tiene esta dualidad — todos sus módulos viven dentro del mismo controller.
- `perfil` y `tokens` no tienen wrapper de "workspace summary" propio: `perfil` resuelve vía `ModuleTabs` inline en `page.tsx`, `tokens` renderiza directamente la card. Sin metadatos de loading/error explícitos a nivel módulo (a diferencia de `operaciones`/`informes`/`logistica`, que sí propagan `*LoadError`).
- **No existe ningún módulo mobile dedicado para Clínica** (no hay `Clinic*Mobile*.tsx`). Toda la densidad mobile depende de los mismos componentes compartidos (`ModuleSurface`, `DashboardModuleHub`, `DashboardModuleWorkspace`) sin una capa de adaptación mobile-específica como sí tiene Admin.
- Existe un componente legacy `ClinicDashboardSidebar.tsx` en `frontend/src/components/dashboard/` que **no está importado por ningún archivo de `frontend/src/app`** (confirmado por grep) — es código muerto de una iteración de navegación previa (sidebar), reemplazada por el hub horizontal actual. No se modifica en este audit; se documenta como hallazgo para un PR de limpieza futuro fuera de este bloque.
- Rutas full fuera del sistema `?module=` detectadas bajo `frontend/src/app/dashboard/`: `informes/page.tsx`, `logistica/page.tsx`, `logistica/metricas/page.tsx`, `logistica/rutas/page.tsx`, `logistica/visitas/page.tsx`, con `LogisticsCommandCenter.tsx` propio. Admin no tiene un patrón equivalente de rutas full paralelas a sus módulos.

## Admin benchmark

| Pieza | Archivo |
|---|---|
| Controller (client) | [frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx](../../frontend/src/app/dashboard/admin/AdminDashboardWorkspaceController.tsx) |
| Command center (módulo `admin`) | [frontend/src/app/dashboard/admin/AdminCommandCenter.tsx](../../frontend/src/app/dashboard/admin/AdminCommandCenter.tsx) |
| Entry route (server) | [frontend/src/app/dashboard/admin/page.tsx](../../frontend/src/app/dashboard/admin/page.tsx) |

10 módulos canónicos: `admin`, `admin-report-upload`, `admin-health`, `admin-clinics`, `admin-particular-tokens`, `admin-pricing`, `admin-sessions`, `admin-users-roles`, `audit-log`, `admin-maintenance`.

Módulos mobile dedicados (`frontend/src/app/dashboard/admin/`):

`AdminMobileCommandModule`, `AdminMobileStatusModule` (health/system), `AdminMobileHealthModule`, `AdminMobileConfigModule`, `AdminMobileMaintenanceModule`, `AdminMobilePricingModule`, `AdminMobileOpsPager`, `AdminMobileUsersModule`, `AdminMobileAuditModule`, `AdminMobileSessionsModule`.

Características estructurales clave del benchmark Admin:

- **Stage persistente**: `data-dashboard-module-stage` envuelve el swap hub↔módulo en un único nodo opaco/isolado que nunca se desmonta (solo sus hijos), evitando recreación de stacking context — fix documentado para bleed-through mobile (memoria `project_admin_mobile_hub_stage`).
- **Señalización sync para mobile nav**: `subscribeAdminHubReset` / `subscribeAdminModuleActivate` (`@/lib/admin-hub-reset`) permiten que el bottom-nav mobile fuerce el swap de módulo de forma síncrona, sin esperar la navegación async de `router.push`, evitando flake de bottom-nav bajo carga (memoria `project_admin_mobile_bottomnav_removechild_flake`).
- **Manejo de error de acceso unificado**: `AdminAccessErrorState` + `admin-access-error` store, consumido tanto en el hub como dentro de cada módulo activo.
- **Métricas de header inyectadas en el hero** (`auditEntriesCount`, `eventTypesCount`, `systemStatus*`) consistentes entre hero, cards y `AdminCommandCenter`.
- **Restauración de último módulo** vía `dashboard-last-module` (mismo mecanismo que Clínica ya usa — paridad ya alcanzada en este punto).
- **Evidencia poblada**: existe un cuerpo extenso de auditorías mobile en `docs/audit/admin-mobile-*.md` (densidad de filas visibles, paginación anclada, overlap, whitebox) que no tiene equivalente documental para Clínica más allá de los specs de mobile-parity de `informes`/`logistica`/`tokens`/`perfil`.

## Parity gaps

- **CL-GAP-1** — Falta contrato explícito controller/workspace equivalente al stage de Admin. `ClinicDashboardWorkspaceController` hace swap hub↔módulo sin el stage persistente opaco/isolado (`data-dashboard-module-stage`) que Admin usa para evitar bleed-through mobile. No confirmado que Clínica sufra el mismo bug, pero el contrato estructural no existe para prevenirlo.
- **CL-GAP-2** — El hub de Clínica (`ClinicDashboardWorkspaceController` en modo hub) es funcionalmente un launcher de cards + hero, mientras que el módulo `operaciones` (`ClinicCommandCenter`) ya es un cockpit razonable pero más liviano que `AdminCommandCenter` (sin bloques de "atención requerida", "actividad reciente" ni "alertas y estados" equivalentes).
- **CL-GAP-3** — No existe taxonomía de módulos mobile dedicados para Clínica (cero archivos `Clinic*Mobile*.tsx`), mientras Admin tiene 10 módulos con wrapper mobile propio. La densidad mobile de Clínica depende enteramente de componentes genéricos compartidos.
- **CL-GAP-4** — La evidencia poblada de Clínica (specs `dashboard-clinic-*-mobile-parity.spec.ts`) no tiene un cuerpo de auditoría documental equivalente al de `docs/audit/admin-mobile-*.md` (10+ documentos de densidad, paginación, overlap). No hay comparación formal admin↔clínica de evidencia.
- **CL-GAP-5** — La navegación activa de Clínica no tiene señalización sync equivalente a `admin-hub-reset`/`admin-module-activate` para el bottom-nav mobile; depende solo de `router.push`/`searchParams`. Riesgo de flake de bottom-nav bajo carga, análogo al que Admin ya resolvió y documentó (memoria `project_admin_mobile_bottomnav_removechild_flake`), no verificado todavía para Clínica.
- **CL-GAP-6** — Estados loading/empty/error/retry son inconsistentes entre módulos de Clínica: `operaciones`/`informes`/`logistica` propagan `*LoadError` explícito con `EmptyState` + alerta; `perfil` y `tokens` no tienen un contrato de loading/error de módulo visible en `page.tsx`. Admin centraliza esto vía `AdminAccessErrorState` para todos los módulos.
- **CL-GAP-7** *(adicional, no solicitado explícitamente pero detectado)* — Dualidad de navegación: `informes` y `logistica` tienen tanto un resumen dentro de `?module=` como rutas full independientes (`/dashboard/informes`, `/dashboard/logistica/*`) fuera del sistema de módulos. Admin no tiene este patrón dual. Se documenta como gap estructural a resolver o a justificar explícitamente en el roadmap.

## Target architecture

Sin implementar — propuesta de referencia para PRs futuros:

- Mantener `ClinicDashboardWorkspaceController` (no se propone reemplazarlo por un nuevo `ClinicDashboardWorkspaceController` ya que el actual ya cumple el rol; se propone **extenderlo**, no recrearlo) para incorporar:
  - Stage persistente opaco/isolado análogo a `data-dashboard-module-stage`, condicionado a evidencia real de necesidad (verificar primero si Clínica sufre bleed-through mobile antes de portar el fix).
  - Señalización sync mobile-nav análoga a `admin-hub-reset` (`clinic-hub-reset` o reuso del mismo módulo si es agnóstico de superficie), solo si se confirma el mismo patrón de flake bajo carga.
- `ClinicCommandCenter` como cockpit operativo: agregar bloques equivalentes a "atención requerida" / "actividad reciente" si el negocio de clínica tiene una fuente de datos análoga (sin inventar datos ni copiar de Admin sin justificación).
- Wrappers mobile dedicados **solo donde aporten valor medible** (no calcar los 10 módulos de Admin 1:1): evaluar candidatos en orden de prioridad por densidad de uso — `operaciones` (ya tiene `ModuleTabs`, candidato a wrapper mobile dedicado), `informes`, `logistica`, dejando `perfil`/`tokens` para evaluación posterior si la densidad de contenido lo justifica.
- Resolver la dualidad de navegación de `informes`/`logistica` (CL-GAP-7): decidir explícitamente si las rutas full (`/dashboard/informes`, `/dashboard/logistica/*`) se mantienen como "vista extendida" intencional (documentando el contrato) o se consolidan dentro de `?module=`.
- Preservar intacto:
  - El shell no-scroll a nivel dashboard.
  - Los module ids canónicos: `operaciones`, `informes`, `logistica`, `perfil`, `tokens`.
  - El mecanismo `dashboard-last-module` ya compartido con Admin.

## PR roadmap

- **PR-CL1** — Docs/test contract para controller/workspace clinic-admin parity. Declarar formalmente el contrato esperado del controller (stage, señalización, estados de error) como spec/documento antes de tocar código de implementación. Sin cambios de UI.
  - Scope: `docs/` + posible nuevo contrato e2e *declarativo* (sin asserts de implementación todavía).
  - No-goals: no tocar `ClinicDashboardWorkspaceController.tsx` ni ningún componente de render.
  - Validaciones: revisión de consistencia con contratos existentes de Admin (`dashboard-mobile-shell-nav-contract.spec.ts`, `dashboard-real-app-shell-no-scroll-contract.spec.ts`).
  - Evidencia esperada: documento de contrato aprobado, sin capturas (no hay UI nueva).

- **PR-CL2** — Clinic hub command center parity. Evaluar e implementar (si se justifica con datos reales disponibles) bloques adicionales en `ClinicCommandCenter` análogos a "atención requerida"/"actividad reciente".
  - Scope: `frontend/src/app/dashboard/ClinicCommandCenter.tsx`.
  - No-goals: no agregar datos mock ni endpoints nuevos; usar solo datos ya disponibles via `getDashboardStats`/`getReports`/`getLogisticsFieldVisits`.
  - Validaciones: `pnpm test` (scope tests), e2e de no-scroll y mobile-parity existentes deben seguir pasando.
  - Evidencia esperada: capturas desktop/mobile antes/después del módulo `operaciones`.

- **PR-CL3** — Clinic mobile nav/module density parity. Implementar señalización sync mobile-nav (CL-GAP-5) solo si PR-CL1 confirma la necesidad, y/o stage persistente (CL-GAP-1) solo si se reproduce bleed-through.
  - Scope: posible nuevo `frontend/src/lib/clinic-hub-reset.ts` o extensión agnóstica del existente de Admin; cambios en `ClinicDashboardWorkspaceController.tsx`.
  - No-goals: no modificar `admin-hub-reset.ts` de forma que afecte a Admin sin un PR separado y explícito.
  - Validaciones: e2e de bottom-nav mobile bajo carga (replicar metodología de `dashboard-mobile-shell-nav-contract.spec.ts`).
  - Evidencia esperada: e2e run estable repetido (mismo patrón que el cierre de flake de Admin).

- **PR-CL4** — Clinic operaciones workspace mobile module parity. Crear wrapper mobile dedicado para `operaciones` si la densidad de `ModuleTabs` (Métricas/Recientes) lo justifica en viewports chicos.
  - Scope: nuevo componente mobile-específico bajo `frontend/src/app/dashboard/` o `frontend/src/components/dashboard/`.
  - No-goals: no replicar literalmente componentes de Admin; mantener semántica clínica.
  - Validaciones: `dashboard-clinic-*-mobile-parity.spec.ts` existentes + nuevo spec si aplica.
  - Evidencia esperada: capturas mobile en los 3 viewports usados por specs existentes (360x740, 390x844, 430x932).

- **PR-CL5** — Refinamientos de `informes`/`logistica`/`tokens`/`perfil`: resolver dualidad de navegación (CL-GAP-7), uniformar estados loading/error/empty (CL-GAP-6) en `perfil` y `tokens`. Puede dividirse en sub-PRs por módulo si el diff crece.
  - Scope: `ClinicInformesWorkspaceSummary.tsx`, `ClinicLogisticaWorkspaceSummary.tsx`, `page.tsx` (sección `perfil`/`tokens`), rutas full de `informes`/`logistica` si se decide consolidar.
  - No-goals: no eliminar rutas full sin decisión explícita documentada en PR-CL1.
  - Validaciones: suite completa de mobile-parity de Clínica + scope tests legacy (`test/frontend-dashboard-clinic-tokens.test.ts` y equivalentes).
  - Evidencia esperada: matriz de estados (loading/empty/error/retry) por módulo, desktop + mobile.

- **PR-CLX** — Closeout documental: actualizar este audit con el estado final de cada gap (resuelto / diferido con justificación / descartado) y registrar evidencia consolidada.
  - Scope: `docs/audit/clinic-dashboard-admin-structure-parity-audit.md` (este archivo, actualizado) + posible doc de closeout nuevo siguiendo convención `*-closeout.md`.
  - No-goals: ningún cambio de código.
  - Validaciones: `git diff --check` sobre el PR.
  - Evidencia esperada: tabla resumen de gaps con estado final.

## Non-goals

Explícitamente prohibido en todos los PRs de este bloque (PR-CL1 a PR-CLX) salvo autorización separada y explícita:

- Modificar backend, API, auth, DB, migrations, dependencias o lockfiles.
- Modificar configuración de CI.
- Cambiar permisos o roles de Clínica/Admin.
- Copiar controles admin-only (precios, sesiones, usuarios/roles, auditoría, mantenimiento) hacia Clínica.
- Tocar la página pública `/clinicas`.
- Introducir scroll a nivel dashboard (el shell debe permanecer no-scroll; scroll solo dentro de listas/tablas internas ya contempladas por los componentes existentes).
- Agregar nuevas dependencias.
- Cambiar el manejo de sesiones, tokens o cookies.
- Modificar `AdminDashboardWorkspaceController.tsx` ni ningún archivo bajo `frontend/src/app/dashboard/admin/` salvo que un gap requiera extraer un módulo verdaderamente agnóstico de superficie (debe declararse explícitamente en el PR correspondiente, nunca de forma implícita).

## Acceptance

Este documento (PR-CL0) se considera completo si:

- Es el único archivo creado o modificado en el PR.
- No introduce cambios en frontend productivo, tests, backend, API ni configuración.
- Declara explícitamente el roadmap PR-CL1 en adelante con scope, archivos probables, no-goals, validaciones y evidencia esperada por PR.
- Deja la rama lista para que PR-CL1 comience sin trabajo de research adicional.

### Validaciones ejecutadas para PR-CL0

- `git status` — working tree limpio antes de empezar, rama correcta confirmada (`audit/clinic-dashboard-admin-structure-parity`), base `main` en `f6864ac`.
- Lectura íntegra de los 7 archivos de estructura Clínica/Admin solicitados + descubrimiento adicional de `ClinicDashboardWorkspaceController.tsx` (controller real, vive en `components/dashboard/`, no en `app/dashboard/`) y rutas full de `informes`/`logistica`.
- Revisión de specs e2e listados (estructura de `dashboard-clinic-*-mobile-parity.spec.ts` y `dashboard-mobile-shell-nav-contract.spec.ts` confirmando que ya cubren ambas superficies clinic/admin con rutas y selectores distintos).
- Confirmado que `/clinicas` pública no aparece en ningún archivo tocado ni referenciado como dependencia de este bloque.
- `git diff --check` — pendiente de ejecutar post-commit; este documento es texto plano sin código, no se esperan conflictos de whitespace.
