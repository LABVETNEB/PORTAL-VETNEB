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
- **CL-GAP-5** — *(mitigado en PR-CL4, ver evidencia abajo)* La navegación activa de Clínica no tiene señalización sync equivalente a `admin-hub-reset`/`admin-module-activate` para el bottom-nav mobile; depende solo de `router.push`/`searchParams`. Riesgo de flake de bottom-nav bajo carga, análogo al que Admin ya resolvió y documentó (memoria `project_admin_mobile_bottomnav_removechild_flake`). PR-CL4 hace que `aria-current="page"` sea uniformemente verificable en los 5 módulos (antes solo 3 de 5), reduciendo la superficie de inconsistencia; la señalización sync en sí (análoga a `admin-hub-reset`) sigue sin implementarse y queda diferida — no hay segunda implementación de nav mobile-only en Clínica que compita con la de desktop, así que el patrón de flake que resolvió Admin no tiene la misma superficie aquí.
- **CL-GAP-6** — *(evidenciado con precisión por módulo en PR-CL5, ver evidencia abajo; no mitigado — PR test-only)* Estados loading/empty/error/retry son inconsistentes entre módulos de Clínica: `operaciones`/`informes`/`logistica` propagan `*LoadError` explícito con `EmptyState` + alerta; `perfil` y `tokens` no tienen un contrato de loading/error de módulo visible en `page.tsx`. Admin centraliza esto vía `AdminAccessErrorState` para todos los módulos. **Matiz de PR-CL5:** la frase "`perfil` y `tokens` no tienen contrato" es parcialmente imprecisa — ambos sí tienen contrato propio (estado local del componente cliente, fetch vía `useEffect`), solo que vive a nivel de componente y no se propaga a `page.tsx` como `*LoadError`; el gap real no es "ausencia de contrato" sino **calidad/consistencia desigual** del contrato que cada módulo ya tiene (ver matriz PR-CL5).
- **CL-GAP-7** — *(cerrado en PR-CL4, ver evidencia abajo)* Dualidad de navegación: `informes` y `logistica` tenían tanto un resumen dentro de `?module=` como rutas full independientes (`/dashboard/informes`, `/dashboard/logistica/*`) fuera del sistema de módulos, y el nav horizontal apuntaba a las rutas full en vez del workspace canónico. PR-CL4 hizo que el nav resuelva los 5 módulos vía `?module=`; las rutas full se conservan como superficie extendida, accesible desde los CTAs "Abrir módulo completo" ya existentes dentro de cada `*WorkspaceSummary`.

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

### PR-CL1 evidence (test-only, sin frontend productivo)

Rama: `test/clinic-controller-workspace-parity-contract`. Base: `main` @ `5caccae` (docs(clinic): audit admin structure parity #1135).

Entregado: `frontend/e2e/dashboard-clinic-controller-workspace-parity.spec.ts` (nuevo). Declara el contrato controller/workspace mínimo que Clínica ya cumple respecto a Admin, sin tocar ningún componente de render:

- `/dashboard` y `/dashboard?module={operaciones,informes,logistica,perfil,tokens}` resuelven hub/workspace vía los mismos selectores `data-dashboard-module-hub`/`data-dashboard-module-workspace` que usa Admin.
- Baseline Admin no se rompe: `/dashboard/admin` (hub) y `/dashboard/admin?module=admin-clinics` (workspace) siguen resolviendo.
- "Vista general" (mismo `DashboardModuleWorkspace` compartido con Admin) vuelve al hub en un solo click, sin URL con `module=` residual.
- `aria-current="page"` se mantiene verificable en el nav horizontal de Clínica para `operaciones`, `tokens`, `perfil` (cuyo href de nav resuelve a `?module=` exacto). Para `informes`/`logistica` no es verificable porque el nav apunta a las rutas full `/dashboard/informes` y `/dashboard/logistica` (dualidad ya documentada como **CL-GAP-7**) en vez de a `?module=`; se documenta como hallazgo, no se fuerza un assert que no aplica a la implementación actual.
- 390x844: sin overflow horizontal en `documentElement`/`body` y `main.dashboard-main` no se convierte en scroll container, en los 5 módulos de Clínica + hub.

No se confirma ni se descarta en este PR ningún otro gap (CL-GAP-1 a CL-GAP-6); este contrato es deliberadamente el subconjunto mínimo pedido, no una auditoría ampliada.

Validaciones ejecutadas:

- `pnpm --dir frontend exec playwright test e2e/dashboard-clinic-controller-workspace-parity.spec.ts` — 18 passed.
- `pnpm --dir frontend lint` — sin errores.
- `pnpm typecheck:test` — sin errores.
- `git diff --check` — sin conflictos de whitespace.
- `next-env.d.ts` revertido a su estado de `main` tras la corrida e2e (regenerado por el dev server de Playwright; no es parte del diff de este PR).

### PR-CL2 evidence (clinic hub command center parity)

Rama: `feat/clinic-command-center-parity`. Base: `main` @ `3d25d28` (test(clinic): add controller workspace parity contract #1136).

Archivos tocados:

- `frontend/src/app/dashboard/ClinicCommandCenter.tsx`
- `frontend/e2e/dashboard-clinic-controller-workspace-parity.spec.ts`
- `docs/audit/clinic-dashboard-admin-structure-parity-audit.md` (este archivo)

Mejora agregada (cierra parcialmente **CL-GAP-2**): se agregó una tercera pestaña "Estado" dentro del `ModuleTabs` ya existente en `ClinicCommandCenter` (junto a "Métricas" y "Recientes"), con tres bloques estructurales análogos a los de `AdminCommandCenter` — pero derivados exclusivamente de los props ya disponibles (`stats`, `recentReports`, `recentVisits`, `*LoadError`), sin nuevos fetches ni endpoints:

- **Atención requerida** (`data-clinic-command-attention="true"`): lista informes pendientes y visitas activas con conteo > 0, o el mensaje de error de métricas si `statsLoadError`. Estado vacío seguro ("Sin pendientes operativos detectados.") cuando no hay nada que atender.
- **Actividad reciente** (`data-clinic-command-activity="true"`): selecciona el ítem más reciente entre el primer informe y la primera visita ya cargados (comparando fecha), sin inventar datos. Estado vacío seguro si ambas listas están vacías.
- **Continuidad operativa** (`data-clinic-command-continuity="true"`): mensaje binario operativo/degradado derivado de `statsLoadError || reportsLoadError || visitsLoadError`, sin exponer detalles sensibles.

El componente raíz quedó envuelto en `<section data-clinic-command-center="true">` para dar un selector estable de evidencia equivalente al patrón Admin.

Límites preservados:

- No se tocó `fetch`/API ni `frontend/src/app/dashboard/page.tsx` (los props que ya se pasaban a `ClinicCommandCenter` fueron suficientes).
- No se copiaron controles admin-only (precios, sesiones, usuarios/roles, auditoría, mantenimiento).
- No se tocó `/clinicas` pública ni `frontend/src/app/dashboard/admin/**`.
- Se mantuvo `ModuleSurface` + `ModuleTabs` y el contrato no-scroll (cada tab renderiza solo su panel activo, igual que "Métricas"/"Recientes").
- No se agregaron dependencias nuevas.

Validaciones ejecutadas:

- `pnpm --dir frontend exec playwright test e2e/dashboard-clinic-controller-workspace-parity.spec.ts` — 21 passed (18 del contrato PR-CL1 + 3 nuevos del cockpit PR-CL2, incluyendo verificación 390x844 sin overflow horizontal ni scroll en `main.dashboard-main` con la pestaña "Estado" activa).
- `pnpm --dir frontend lint` — sin errores.
- `pnpm typecheck:test` — sin errores.
- `pnpm test` — 2839 passed, 0 failed (suite completa, incluye contratos de estructura existentes sobre `ClinicCommandCenter.tsx`).
- `git diff --check` — sin conflictos de whitespace.
- `next-env.d.ts` revertido a su estado de `main` tras la corrida e2e.

### PR-CL3 evidence (clinic mobile nav/stage parity — CL-GAP-1, CL-GAP-5, CL-GAP-7)

Rama: `test/clinic-mobile-nav-stage-parity-evidence`. Base: `main` @ `50c2ac0` (feat(clinic): improve command center parity #1137). Tipo: test-only + docs. Ningún archivo de frontend productivo, backend, API, auth, DB, deps, lockfiles ni CI fue tocado.

Archivo nuevo: [frontend/e2e/dashboard-clinic-mobile-nav-stage-parity.spec.ts](../../frontend/e2e/dashboard-clinic-mobile-nav-stage-parity.spec.ts) — 4 tests, 390x844, sesión `app_session_id=e2e_test_clinic_session`.

**Hallazgo de código (no de comportamiento observado en runtime):** `frontend/src/app/globals.css`, bloques `admin-mobile-real-device-layer-isolation` (línea ~2996) y `admin-mobile-stage-layer` (línea ~3019), declaran explícitamente en sus propios comentarios que el forzado de ancestros opacos y el stage persistente promovido a capa GPU (`transform: translateZ(0)`) que Admin usa para evitar bleed-through/ghosting en mobile están **scoped exclusivamente a `[data-vetneb-app-shell-surface="admin"]`**:

> "Scoped to Admin mobile only (<=767px + surface="admin"); desktop, **Clinic** and the data/layout of every module stay untouched."
> "Scoped to Admin mobile (<=767px); desktop **and Clinic** keep the stage as a transparent flex passthrough."

`ClinicDashboardWorkspaceController.tsx` confirma esto a nivel de componente: hace `if (activeModule) return <DashboardModuleWorkspace>...</DashboardModuleWorkspace>; return <DashboardModuleHub ... />` — dos ramas de tipo distinto que se reemplazan directamente, sin ningún wrapper `[data-dashboard-module-stage]` (ese atributo solo existe en `AdminDashboardWorkspaceController.tsx`, confirmado por grep). Es la misma forma estructural que tenía Admin **antes** del fix que cerró CL-GAP-1 para Admin.

**Lo que el spec sí puede probar headless (igual limitación documentada en los specs de Admin: la recreación de stacking context por GPU en dispositivo real no es reproducible en Chromium headless):**

- `frame` (`[data-vetneb-app-shell-frame="true"]`) y `main.dashboard-main` **conservan identidad de nodo** (mismo DOM node, vía técnica de stamping) a través de un round trip real hub→operaciones→tokens→perfil→hub usando la navegación horizontal real (no `goto` directo). Esto es una buena noticia parcial: el árbol persistente alrededor del swap no se desmonta — pero esto **ya era cierto en Admin antes de su fix** y no impidió el bug real; el fix de Admin fue específicamente la promoción a capa GPU + opacidad forzada del punto exacto de swap, que Clinic no tiene.
- En cada paso del round trip: exactamente un `[data-dashboard-module-workspace]` o un `[data-dashboard-module-hub]` montado, nunca ambos ni el módulo anterior residual (sin "stale layer" a nivel DOM).
- Sin overflow horizontal en `documentElement`/`body` y `main.dashboard-main` no se vuelve scroll container en ningún paso del round trip (extiende la cobertura per-route de PR-CL1 a una secuencia real de swaps, no solo `goto` aislados).
- El ítem activo de la navegación horizontal (`aria-current="page"`) permanece visible dentro del viewport 390x844 en cada paso para `operaciones`/`tokens`/`perfil`.
- `informes`/`logistica`: al no ser alcanzables por click de nav (CL-GAP-7, el nav apunta a rutas full), se verifican vía `goto` directo a `?module=`; confirmado que no dejan residuo del módulo anterior ni overflow. No se afirma `aria-current` ahí porque la navegación actual no lo produce.

**Resultado: CL-GAP-1 confirmado estructuralmente (por evidencia directa del código, no inferido), no reproducido como bug real** — no hay reporte de ghosting visible en Clínica y el límite de Playwright headless para reproducir recycling de GPU es el mismo que ya reconoce la suite de Admin. La ausencia de implementación no es un descuido: el código de Admin la excluye a propósito ("desktop and Clinic keep the stage as a transparent flex passthrough"), consistente con `## Target architecture` de este documento ("Stage persistente... condicionado a evidencia real de necesidad"). Recomendación: diferir el port del stage a PR-CL4 y construirlo solo si se reporta bleed-through real en Clínica, en vez de adelantarlo preventivamente sin evidencia de dispositivo real.

**CL-GAP-5** — no mitigado ni descartado por este PR. Se confirma que `ClinicDashboardWorkspaceController.activateModule` hace `setActiveModule` (optimista) seguido de `router.push`, pero los ítems de la navegación horizontal (`DashboardHorizontalNav` vía `PublicRouteControl`) **no llaman a `activateModule`** — navegan solo por `router.push(href)`, y el controller deriva `activeModule` de `searchParams` vía `useEffect`, igual que el bottom-nav de Admin antes de su fix de sync. La diferencia estructural real: Clínica no tiene una segunda implementación de navegación mobile-only compitiendo con la de desktop (a diferencia de Admin, que tiene `AdminMobileBottomNav` como componente separado de `DashboardHorizontalNav`), así que la superficie específica de flake que resolvió `admin-hub-reset` (dos implementaciones de nav corriendo en paralelo) no existe en Clínica. Esto reduce el riesgo pero no lo descarta: un único nav async-only podría flakear bajo carga igual. No se intentó reproducir flake bajo carga en este PR (fuera de scope test-only de bajo riesgo); si se quiere cerrar CL-GAP-5 con evidencia, un PR futuro debería instrumentar clicks rápidos repetidos (10+) sobre la navegación horizontal real, análogo a la metodología que cerró el flake de Admin.

**CL-GAP-7** — reconfirmado sin cambios: el spec documenta explícitamente (comentarios + lógica de test) que `informes`/`logistica` solo son alcanzables por `goto` directo a `?module=`, no por click de nav.

Validaciones ejecutadas:

- `pnpm --dir frontend exec playwright test e2e/dashboard-clinic-mobile-nav-stage-parity.spec.ts` — 4 passed.
- `pnpm --dir frontend exec playwright test e2e/dashboard-mobile-shell-nav-contract.spec.ts` — 25 passed.
- `pnpm --dir frontend lint` — sin errores.
- `pnpm typecheck:test` — sin errores.
- `git diff --check` — sin conflictos de whitespace.
- `next-env.d.ts` revertido a su estado de `main` tras las corridas e2e.

No producción, backend, API, auth, DB, deps, lockfiles, CI ni `/clinicas` tocados. `frontend/src/app/dashboard/admin/**` no modificado (solo leído como referencia/cita).

### PR-CL4 evidence (clinic canonical module nav parity — CL-GAP-7, CL-GAP-5)

Rama: `fix/clinic-canonical-module-nav-parity`. Base: `main` @ `4b70d74` (test(clinic): add mobile nav stage parity evidence #1138). Nota: este PR resuelve CL-GAP-7/CL-GAP-5 directamente en vez de seguir el orden original del roadmap (que asignaba el wrapper mobile de `operaciones` a "PR-CL4"); ese ítem de roadmap queda pendiente para un PR futuro sin numeración reasignada todavía.

Archivos tocados:

- `frontend/src/components/dashboard/DashboardHorizontalNav.tsx`
- `frontend/e2e/dashboard-clinic-controller-workspace-parity.spec.ts`
- `frontend/e2e/dashboard-clinic-mobile-nav-stage-parity.spec.ts`
- `test/frontend-dashboard-horizontal-nav.test.ts` (scope test legacy que pinneaba el source de `DashboardHorizontalNav.tsx`; alineado al nuevo contrato, mismo patrón que precedente #958 documentado en memoria)
- `docs/audit/clinic-dashboard-admin-structure-parity-audit.md` (este archivo)

Cambio productivo (el único de este PR): en `CLINIC_NAV_ITEMS` de `DashboardHorizontalNav.tsx`, los ítems "Informes" y "Logística" pasan de apuntar a las rutas full (`ROUTES.dashboardInformes`/`ROUTES.dashboardLogistica` con `routePrefix: true`) a apuntar a `${ROUTES.dashboard}?module=informes` / `?module=logistica`, igual que los otros 3 módulos. Como ningún ítem usaba ya `routePrefix`, se eliminó ese campo del tipo y su rama en `isItemActive` (código muerto, no había otro consumidor — confirmado por grep).

Las rutas full (`/dashboard/informes`, `/dashboard/logistica`, `/dashboard/logistica/{metricas,rutas,visitas}`) **no se tocaron ni se eliminaron**: siguen montadas en `frontend/src/app/dashboard/{informes,logistica}/`, y siguen siendo alcanzables desde los CTAs "Abrir módulo completo" ya existentes dentro de `ClinicInformesWorkspaceSummary`/`ClinicLogisticaWorkspaceSummary` (sin cambios en esos componentes).

**CL-GAP-7 — cerrado.** Los 5 módulos de Clínica (`operaciones`, `informes`, `logistica`, `perfil`, `tokens`) ahora resuelven de forma canónica vía nav horizontal a `?module=`, sin dualidad. `aria-current="page"` es uniformemente verificable en los 5 (antes solo en 3: `operaciones`/`perfil`/`tokens`).

**CL-GAP-5 — mitigado, no cerrado.** La señalización sync mobile-nav (análoga a `admin-hub-reset`) sigue sin implementarse — `activateModule` del controller sigue siendo `setActiveModule` optimista + `router.push`, y el nav horizontal sigue navegando solo por `router.push(href)` vía `PublicRouteControl`, derivando `activeModule` de `searchParams`. Lo que cambia es que ahora los 5 módulos comparten exactamente el mismo patrón de navegación (antes 2 de 5 navegaban por ruta full), reduciendo la superficie de inconsistencia que motivaba el gap. Cerrar CL-GAP-5 por completo seguiría requiriendo la instrumentación de clicks repetidos bajo carga descrita en la evidencia de PR-CL3.

Tests actualizados:

- `dashboard-clinic-controller-workspace-parity.spec.ts`: `CLINIC_MODULES_WITH_VERIFIABLE_NAV` ahora incluye `informes: "Informes"` y `logistica: "Logística"` (antes `null`), extendiendo el assert de `aria-current="page"` a los 5 módulos. Se agregaron 2 tests nuevos (`clinic /dashboard/informes full route still loads`, `clinic /dashboard/logistica full route still loads`) que confirman que las rutas full siguen cargando tras el cambio de nav.
- `dashboard-clinic-mobile-nav-stage-parity.spec.ts`: el test de "active horizontal nav item stays visible through the round trip" ahora recorre los 5 módulos (se agregaron "Informes"/"Logística" al loop, antes solo Resumen/Tokens/Perfil). Los tests de "no stale previous module mounted" para `informes`/`logistica` pasaron de `page.goto` directo a click real sobre el nav horizontal (`navItem(page, label).click()`), con assert adicional de `aria-current="page"`, ya que ahora son alcanzables por nav igual que el resto. Comentarios que documentaban CL-GAP-7 como abierto se actualizaron para reflejar el cierre.

Validaciones ejecutadas:

- `pnpm --dir frontend exec playwright test e2e/dashboard-clinic-controller-workspace-parity.spec.ts` — ver resultado en el resumen de entrega.
- `pnpm --dir frontend exec playwright test e2e/dashboard-clinic-mobile-nav-stage-parity.spec.ts` — ver resultado en el resumen de entrega.
- `pnpm --dir frontend exec playwright test e2e/dashboard-mobile-shell-nav-contract.spec.ts` — ver resultado en el resumen de entrega.
- `pnpm --dir frontend lint` — ver resultado en el resumen de entrega.
- `pnpm typecheck:test` — ver resultado en el resumen de entrega.
- `pnpm --dir frontend build` — ver resultado en el resumen de entrega (cambia frontend productivo).
- `git diff --check` — ver resultado en el resumen de entrega.
- `next-env.d.ts` revertido a su estado de `main` tras las corridas e2e.

No producción ajena al nav horizontal de Clínica, backend, API, auth, DB, deps, lockfiles, CI ni `/clinicas` tocados. `frontend/src/app/dashboard/admin/**` no modificado. No se implementó stage persistente (CL-GAP-1) en este PR.

### PR-CL5 evidence (clinic module loading/empty/error/retry parity — CL-GAP-6)

Rama: `test/clinic-module-state-parity-evidence`. Base: `main` @ `1f13332` (fix(clinic): canonicalize module navigation #1139). Tipo: test-only + docs. Ningún archivo de frontend productivo, backend, API, auth, DB, deps, lockfiles ni CI fue tocado.

Archivo nuevo: [frontend/e2e/dashboard-clinic-module-state-parity.spec.ts](../../frontend/e2e/dashboard-clinic-module-state-parity.spec.ts) — 13 tests.

**Hallazgo arquitectónico previo (condiciona todo el resto de la evidencia):** `operaciones`/`informes`/`logistica` reciben sus datos (`stats`, `recentReports`, `recentVisits`, `*LoadError`) desde `page.tsx`, un Server Component — el fetch ocurre en el proceso de Next.js, no en el navegador, así que `page.route` de Playwright **no puede interceptarlo**. Sus estados solo son alcanzables a través de las dos sesiones que ya reconoce `frontend/e2e/fixtures/admin-populated-api-server.mjs` (`e2e_test_clinic_session` / `e2e_populated_clinic_session`). `tokens` y `perfil` (`ClinicParticularTokensCard`, `ClinicPublicProfileCard`, `PasswordChangePanel`) en cambio hacen fetch client-side vía `useEffect`, así que sus estados sí son interceptables con `page.route` y el spec los fuerza directamente (datos sintéticos, no sensibles).

#### Matriz de evidencia por módulo

| Módulo | Loading | Empty | Error | Retry |
|---|---|---|---|---|
| `operaciones` | No alcanzable como estado aislado vía SSR/fixture (no hay loading skeleton; solo el resultado final éxito/error) | **No alcanzable** en el fixture actual (ver hallazgo de sesión abajo) | ✅ Evidenciado: alerta `role="alert"` para stats (siempre) e informes/visitas (sesión default) | ❌ Confirmado ausente — ningún botón asociado a las alertas |
| `informes` (resumen) | No alcanzable como estado aislado vía SSR/fixture | **No alcanzable** en el fixture actual | ✅ Evidenciado: `role="alert"` con `EmptyState` correctamente suprimido mientras hay error | ❌ Confirmado ausente |
| `logistica` (resumen) | No alcanzable como estado aislado vía SSR/fixture | **No alcanzable** en el fixture actual | ✅ Evidenciado: `role="alert"` con `EmptyState` correctamente suprimido mientras hay error | ❌ Confirmado ausente |
| `tokens` | ✅ Evidenciado: botón "Actualizar"→"Actualizando..." + `disabled` + texto "Cargando tokens particulares..." | ✅ Evidenciado: párrafo plano "No hay tokens particulares generados por esta clínica." (**no** usa el componente `EmptyState` compartido) | ✅ Evidenciado: `role="alert"` con `clinical-alert-error`, botón "Actualizar" sigue habilitado | ⚠️ Existe el botón, pero **no limpia el error previo** en un reintento exitoso (bug real, ver abajo) |
| `perfil` → Perfil público | ⚠️ Sin señal dedicada: solo el badge "Sin cargar" (ambiguo, ver abajo), sin spinner/texto | N/A estructural (editor de un recurso único, no lista); "sin configurar" es el mismo success path con campos vacíos | ✅ Evidenciado: `role="alert"` al pie de la card | ❌ Confirmado ausente — ni botón ni mecanismo de reintento, recargar la página es la única salida |
| `perfil` → Acceso (password) | N/A (form puro, sin GET) | N/A (no es lista) | ✅ Evidenciado: validación local + error genérico de backend (`GENERIC_ERROR_MESSAGE` no enumerativo, deliberado) | ✅ Evidenciado: reenviar el formulario limpia el error previo de forma confiable |

#### Hallazgos detallados

**Sesión por defecto (`e2e_test_clinic_session`) — `operaciones`/`informes`/`logistica` muestran error, no vacío.** Bajo esta sesión, `/api/reports` y `/api/logistics/field-visits` responden 404 (`hasPopulatedClinicSession` es `false` en el fixture), así que `reportsLoadError`/`visitsLoadError` quedan en `true` con `reports`/`visits` en `[]`. El componente prioriza la rama de error sobre la de `EmptyState` (`reportsLoadError ? <alert> : recentReports.length ? <rows> : <EmptyState>`), así que el `EmptyState` que ya existe en el código (`ClinicInformesWorkspaceSummary`, `ClinicLogisticaWorkspaceSummary`, y los dos bloques de "Recientes" dentro de `ClinicCommandCenter`) **nunca se renderiza en el fixture e2e actual**, con ninguna de las dos sesiones disponibles.

**`statsLoadError` es incondicional en el fixture e2e, independientemente de la sesión.** `getDashboardStats()` llama a `getReports`, `getLogisticsFieldVisits` y `getRoutePlans` con `throwOnError: true`. El fixture (`admin-populated-api-server.mjs`) no implementa **ningún** handler para `/api/logistics/route-plans` — ni siquiera bajo `e2e_populated_clinic_session` — así que esa promesa siempre rechaza y `page.tsx` cae siempre en `statsLoadError = true`. Confirmado con el test "populated session": con `e2e_populated_clinic_session`, `informes`/`visitas` cargan 3 filas reales cada uno (sin alerta), pero la alerta de "métricas operativas" sigue visible arriba, y la pestaña "Estado" sigue mostrando "Estado degradado..." porque `hasAnyError = statsLoadError || reportsLoadError || visitsLoadError` queda en `true` solo por `statsLoadError`. **Consecuencia documentada, no corregida:** la copy "Operativo: informes y logística sincronizados sin incidentes detectados." de `ClinicCommandCenter` no tiene ninguna evidencia e2e que pruebe que renderiza, porque ninguna combinación de sesión disponible hoy permite que las tres cargas (stats, reports, visits) tengan éxito simultáneamente.

**No existe sesión ni combinación de fixture que produzca un `EmptyState` genuino (cero filas, sin error) para `operaciones`/`informes`/`logistica`.** Las dos sesiones clínicas disponibles solo cubren error (default) o 3 filas fijas (`e2e_populated_clinic_session`, arrays `CLINIC_REPORTS`/`CLINIC_FIELD_VISITS` de longitud fija en el fixture). Producir un tercer estado (éxito + cero filas) requeriría modificar `admin-populated-api-server.mjs` — un archivo de fixture compartido por ~15 specs más (admin y clínica) — lo cual está fuera del scope test-only de bajo riesgo de este PR. Se documenta como gap explícito en lugar de forzar un selector o inventar una rama de fixture nueva (instrucción de scope de este PR), y en lugar de eso el spec nuevo deja constancia explícita (comentario + esta sección) de qué es y no es alcanzable hoy.

**Ningún módulo SSR (`operaciones`/`informes`/`logistica`) tiene un control de retry.** Las alertas de error son texto puro (`<p role="alert">`); no hay botón "Reintentar" en ningún punto. El spec confirma la ausencia con `page.getByRole("button", { name: /reintentar|recargar/i })` → 0 elementos. La única recuperación es recargar la página completa.

**`tokens` tiene loading/empty/error/retry explícitos, pero el retry tiene un bug real.** `ClinicParticularTokensCard.loadTokens()` nunca llama `setErrorMessage(null)` en su rama de éxito. El spec lo demuestra de punta a punta: fuerza un primer fetch fallido (alerta visible), mockea un segundo fetch exitoso con 1 token, hace click en "Actualizar", y confirma que el token nuevo se renderiza **mientras la alerta de error del primer intento permanece visible sin cambios**. No se corrige en este PR (test-only); queda como hallazgo concreto y reproducible para una implementación futura. Adicionalmente, el estado vacío de `tokens` ("No hay tokens particulares generados por esta clínica.") es un párrafo simple — no usa el componente `EmptyState` compartido que sí usan `operaciones`/`informes`/`logistica` — una inconsistencia adicional dentro del mismo CL-GAP-6.

**`perfil` → Perfil público tiene la señal de loading más débil de los cinco módulos.** No hay spinner ni texto "Cargando..."; el único indicio visible es el badge de la pestaña "Estado", que muestra "Sin cargar" tanto durante la carga **como tras un fallo de carga** (en ambos casos `profile` queda en `null`) — el spec confirma que ese badge no distingue "cargando" de "falló". Peor aún, **no existe ningún control de reintento**: a diferencia de `tokens` (que al menos tiene "Actualizar"), no hay botón que vuelva a invocar `loadProfile()`; el spec confirma 0 botones con nombre `/actualizar|recargar|reintentar/i` dentro de la card. La única recuperación es recargar la página completa — el mismo límite que `operaciones`/`informes`/`logistica`, pero aquí sin la justificación de ser SSR (este componente es client-side y técnicamente podría tener un botón de reintento).

**`perfil` → Acceso (password) es, paradójicamente, el contrato más sólido de los cinco.** No tiene loading/empty (no aplica: es un formulario puro sin GET), pero su error+retry es correcto: `handleSubmit` limpia `errorMessage` al inicio de cada intento, así que reenviar el formulario después de un fallo deja la UI limpia si el segundo intento tiene éxito — contraste directo con el bug de `tokens`. El spec lo prueba con dos sesiones de mock (`401` luego `200`) sobre `/api/auth/change-password`.

**Conclusión para CL-GAP-6: confirmado y evidenciado con precisión por módulo — no mitigado (PR test-only, sin frontend productivo).** El enunciado original del gap ("`perfil` y `tokens` no tienen contrato... visible") se refina: ambos sí tienen contrato propio a nivel de componente cliente: el problema real no es ausencia de contrato sino **inconsistencia de calidad** entre módulos (tokens con retry roto, perfil-público sin retry, password con retry correcto, EmptyState compartido usado en 3 módulos pero no en `tokens`) y **cobertura e2e incompleta** para los módulos SSR (ni `EmptyState` ni el estado "Operativo" sano son alcanzables con el fixture actual). Queda listo para una implementación futura con scope ya acotado por la matriz de arriba: (1) limpiar `errorMessage` en el success path de `loadTokens()`, (2) agregar un control de reintento a `ClinicPublicProfileCard`, (3) decidir si `tokens` debe migrar su empty-state al componente `EmptyState` compartido, (4) si se quiere evidencia e2e del `EmptyState`/estado sano de los módulos SSR, extender `admin-populated-api-server.mjs` con una tercera variante de sesión en un PR explícito (fuera de scope aquí).

Validaciones ejecutadas:

- `pnpm --dir frontend exec playwright test e2e/dashboard-clinic-module-state-parity.spec.ts` — 13 passed (corrida adicional con `--repeat-each=2` → 26 passed, sin flakiness).
- `pnpm --dir frontend exec playwright test e2e/dashboard-clinic-controller-workspace-parity.spec.ts` — 25 passed (sin regresión).
- `pnpm --dir frontend lint` — sin errores.
- `pnpm typecheck:test` — sin errores.
- `git diff --check` — sin conflictos de whitespace (incluyendo el archivo nuevo, vía `git add -N`).
- `next-env.d.ts` revertido a su estado de `main` tras las corridas e2e.

No producción, backend, API, auth, DB, deps, lockfiles, CI ni `/clinicas` tocados. `frontend/src/app/dashboard/admin/**` no modificado. No se modificó `frontend/e2e/fixtures/admin-populated-api-server.mjs` (deliberado — ver hallazgo de sesión arriba). No se cambió ningún componente productivo de Clínica; los bugs de retry y las ambigüedades de loading documentados arriba quedan sin corregir a propósito (test-only).
