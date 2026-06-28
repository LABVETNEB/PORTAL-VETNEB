# VETNEB Historical Documentation Classification

Clasificación vigente de documentación histórica, secundaria y superseded del proyecto VETNEB.

## Propósito

Este documento separa documentación histórica de fuentes vigentes para evitar re-auditorías, decisiones obsoletas y consumo innecesario de contexto.

Regla principal:

- Para trabajo vigente, leer primero `docs/SOURCES_OF_TRUTH.md`.
- Luego leer `docs/audit/README.md`.
- Usar este archivo solo para saber qué documentos NO deben usarse como fuente primaria.
- No mover, borrar ni renombrar archivos desde este PR.

## Actualización PR-CLEAN2 (2026-06-28) — consolidación física de carpetas

`docs/audit/final-repo-cleanup-engineering-audit.md` (§14, PR-CLEAN2) ejecutó el move-only
diferido que esta auditoría había anticipado. Las clasificaciones de este documento
(Histórico / Secundario / Vigente) **no cambian**; solo cambió la ubicación física:

| Carpeta antigua | Carpeta nueva | Qué pasó |
| --- | --- | --- |
| `docs/audits/` | `docs/audit/` | Los 10 archivos se unificaron (sin colisión de nombres) en `docs/audit/`. |
| `IMPLEMENTATION_NOTES/` (raíz) | `docs/implementation/` | Los 34 archivos se consolidaron en `docs/implementation/`. |
| `docs/implementation-history/` | `docs/implementation/` | Los 13 `IMPLEMENTACION-PR-*.md` se consolidaron en `docs/implementation/`. |
| `docs/pr-*.md` / `docs/prN-*.md` sueltos en raíz de `docs/` | `docs/pr-history/` | Los 30 archivos sueltos se movieron a `docs/pr-history/`. |

Todas las referencias de path en este documento quedan actualizadas a la ubicación nueva.
Las secciones siguientes describen el estado **anterior a PR-CLEAN2** únicamente con fines de
trazabilidad de nombre/origen (ej. "ex `docs/audits/`"); el path real hoy es el indicado en
cada tabla.

## Estado general

| Grupo | Path | Estado | Leer por defecto | Regla |
| --- | --- | --- | --- | --- |
| Auditorías vigentes | `docs/audit/README.md` y las 4 auditorías Wave 0 | Vigente | Sí | Punto de entrada activo |
| Source of Truth map | `docs/SOURCES_OF_TRUTH.md` | Vigente | Sí | Punto de entrada por dominio |
| Auditorías legacy (`AUDIT_*`, `DASHBOARD_*_PLAN`) | `docs/audit/` (ex `docs/audits/`, consolidado por PR-CLEAN2) | Histórico | No | Usar solo para trazabilidad puntual |
| Historial de PRs | `docs/pr-history/` (incluye los `pr-*.md` sueltos de la raíz, consolidados por PR-CLEAN2) | Histórico | No | No usar como base de implementación |
| Historial de implementaciones (`IMPLEMENTACION-PR-*`) | `docs/implementation/` (ex `docs/implementation-history/`, consolidado por PR-CLEAN2) | Histórico | No | No usar como plan vigente |
| Notas sueltas antiguas (resto, no PR docs) | `docs/fix-*`, `docs/audit-*`, `docs/production-*`, `docs/smoke-*`, `docs/legal-*`, `docs/entrega-*` | Histórico / pendiente de archivo futuro | No | No mover en este PR |
| Implementation notes (`IMPLEMENTATION_*` mayúsc. + kebab-case) | `docs/implementation/` (ex `IMPLEMENTATION_NOTES/`, consolidado por PR-CLEAN2) | Secundario | No por defecto | Leer solo si un dominio lo requiere |
| Implementaciones recientes | `docs/implementation/` | Secundario vigente por dominio | Solo si corresponde | Preferir closeout/auditoría vigente cuando exista |

## Auditorías legacy mayúsculas (ex `docs/audits/`, ahora en `docs/audit/`)

Estos documentos se clasifican como históricos. No deben usarse como fuente primaria para nuevas implementaciones enterprise.

| Documento | Clasificación | Regla |
| --- | --- | --- |
| `AUDIT_EXTREME_VISUAL_PRODUCTION_READINESS.md` | Histórico | No leer por defecto |
| `AUDIT_GLOBAL_PRODUCTION_READINESS.md` | Histórico | No leer por defecto |
| `AUDIT_GLOBAL_ROLE_COMMUNICATION_CONTRACT_REVIEW.md` | Histórico | No leer por defecto |
| `AUDIT_PRODUCTION_FINAL_LAUNCH_READINESS_GAP_REVIEW.md` | Histórico | No leer por defecto |
| `AUDIT_PRODUCTION_READINESS_PR_BACKLOG.md` | Histórico | No leer por defecto |
| `AUDIT_ROLE_COMMUNICATION_ACTIONS.md` | Histórico | No leer por defecto |
| `AUDIT_WHITE_BOX_TOTAL_PERFORMANCE_READINESS.md` | Histórico | No leer por defecto |
| `DASHBOARD_NO_SCROLL_PREMIUM_REDESIGN_PLAN.md` | Superseded dashboard plan | Usar solo como antecedente visual |
| `DASHBOARD_PREMIUM_VISUAL_REDESIGN_PLAN.md` | Superseded dashboard plan | Usar solo como antecedente visual |
| `DASHBOARD_SINGLE_VIEWPORT_APP_SHELL_PLAN.md` | Superseded dashboard plan | Usar solo como antecedente visual |

## Dashboard plans superseded

Los planes dashboard legacy quedan clasificados como superseded por el eje vigente de navegación horizontal y arquitectura de información.

Fuente vigente para dashboard:

- `docs/audit/dashboard-horizontal-navigation-information-architecture.md`
- `docs/implementation/dashboard-horizontal-shell-navigation.md`

Fuentes históricas o superseded:

- `docs/audit/DASHBOARD_NO_SCROLL_PREMIUM_REDESIGN_PLAN.md`
- `docs/audit/DASHBOARD_PREMIUM_VISUAL_REDESIGN_PLAN.md`
- `docs/audit/DASHBOARD_SINGLE_VIEWPORT_APP_SHELL_PLAN.md`
- `docs/audit-premium-dashboard-interaction-value.md`
- `docs/pr-history/pr-1-dashboard-private-shell-foundation.md`
- `docs/pr-history/pr-2-dashboard-admin-command-center.md`
- `docs/pr-history/pr-3-dashboard-reports-master-detail.md`
- `docs/pr-history/pr-4-dashboard-clinic-command-center.md`
- `docs/pr-history/pr-5-dashboard-logistics-hub.md`
- `docs/pr-history/pr-6-dashboard-filter-drawer-sticky-filters.md`
- `docs/pr-history/pr-7-dashboard-admin-tabs.md`
- `docs/pr-history/pr-8-dashboard-accessibility-focus-aria.md`
- `docs/pr-history/pr-9-dashboard-mobile-polish-bottom-actions.md`
- `docs/pr-history/pr-10-dashboard-state-polish.md`
- `docs/pr-history/pr0-dashboard-admin-sync-reports-filters.md`
- `docs/pr-history/pr1-dashboard-interaction-foundation.md`
- `docs/pr-history/pr2-dashboard-workspace-layout-polish.md`
- `docs/pr-history/pr5-dashboard-card-navigation-shell.md`
- `docs/pr-history/pr5b-dashboard-card-module-workspaces.md`
- `docs/implementation/IMPLEMENTACION-PR-3-dashboard-master-detail-state-polish.md`
- `docs/implementation/IMPLEMENTACION-PR-4-dashboard-action-feedback-focus-polish.md`
- `docs/implementation/IMPLEMENTACION-PR-5-dashboard-responsive-touch-ergonomics-polish.md`
- `docs/implementation/IMPLEMENTACION-PR-6-dashboard-filters-forms-density-polish.md`
- `docs/implementation/IMPLEMENTACION-PR-7-dashboard-tables-cards-consistency-polish.md`
- `docs/implementation/IMPLEMENTACION-PR-8-dashboard-accessibility-keyboard-hardening.md`
- `docs/implementation/IMPLEMENTACION-PR-9-dashboard-final-premium-qa-cleanup.md`

## Root `docs/` loose historical documents

Los documentos sueltos de la raíz `docs/` quedan clasificados como históricos o secundarios. No se mueven en este PR (excepto los patrones `pr-*`/`prN-*`, que PR-CLEAN2 ya recolectó en `docs/pr-history/`; ver fila siguiente).

| Patrón | Estado | Regla |
| --- | --- | --- |
| `docs/pr-*`, `docs/pr0-*`, `docs/pr1-*`, `docs/pr2-*`, `docs/pr3b-*`, `docs/pr3c-*`, `docs/pr4-*`, `docs/pr5-*`, `docs/pr5b-*` | Histórico — movidos a `docs/pr-history/` por PR-CLEAN2 | No leer por defecto |
| `docs/fix-*` | Histórico | Usar solo para trazabilidad puntual |
| `docs/audit-*` | Histórico / superseded si hay fuente vigente posterior | No leer por defecto |
| `docs/production-*` | Histórico | Preferir `docs/ops/*` y auditorías Wave 0 |
| `docs/release-readiness.md` | Secundario vigente parcial | Usar como complemento hasta PR-REL1 |
| `docs/review-governance.md` | Secundario vigente parcial | Usar como complemento hasta PR-GOV1 |
| `docs/smoke-*` | Histórico / operativo puntual | Preferir `docs/ops/*` |
| `docs/legal-*` | Histórico / requiere confirmación legal | No usar como obligación vigente sin validación humana |
| `docs/entrega-*` | Histórico | No leer por defecto |

## `docs/pr-history/`

Todo `docs/pr-history/` se clasifica como histórico. Desde PR-CLEAN2 (2026-06-28) también
incluye los ~30 `pr-*.md`/`prN-*.md` que antes estaban sueltos en la raíz de `docs/`.

Reglas:

- No usar como plan vigente.
- No usar para decidir prioridades.
- Leer únicamente para trazabilidad de un PR antiguo o para investigar una regresión específica.

## Historial de implementaciones (ex `docs/implementation-history/`, ahora en `docs/implementation/`)

Los 13 `IMPLEMENTACION-PR-*.md` que vivían en `docs/implementation-history/` se consolidaron en
`docs/implementation/` por PR-CLEAN2 (2026-06-28). Se clasifican como históricos.

Reglas:

- No usar como blueprint vigente.
- No usar como criterio visual actual.
- Leer únicamente si se necesita entender por qué se implementó una decisión pasada.

## Implementation notes legacy (ex `IMPLEMENTATION_NOTES/`, ahora en `docs/implementation/`)

Los 34 archivos que vivían en `IMPLEMENTATION_NOTES/` (raíz del repo) se consolidaron en
`docs/implementation/` por PR-CLEAN2 (2026-06-28). Se clasifican como documentación secundaria.

Reglas:

- No leer por defecto.
- No usar como fuente primaria si existe una auditoría vigente, closeout o source-of-truth por dominio.
- Puede usarse como evidencia de implementación previa cuando el dominio afectado lo requiera.
- No volver a mover, borrar ni reconsolidar sin un PR move-only nuevo (ya consolidado por PR-CLEAN2).

## Regla anti-regresión documental

Antes de una auditoría futura:

1. Leer `docs/SOURCES_OF_TRUTH.md`.
2. Leer `docs/audit/README.md`.
3. Verificar este archivo si aparece documentación antigua o ambigua.
4. No usar planes dashboard superseded como instrucción vigente.
5. No reabrir bloques cerrados por closeout salvo evidencia nueva.
6. No mover archivos históricos sin un PR move-only posterior (PR-CLEAN2 ya ejecutó el move-only de `docs/audits/`, `IMPLEMENTATION_NOTES/`, `docs/implementation-history/` y los `pr-*.md` sueltos; no repetirlo).
7. No mezclar clasificación documental con frontend, backend, API, auth, DB, migraciones, dependencias, lockfiles, CI, scripts de package ni configuración Playwright.

## Próximo paso recomendado

Después de PR-O3, avanzar a PR-GOV1 docs-only para base de gobernanza:

- ADR template.
- RFC / change-control template.
- Ownership model documentado.
- PR readiness review checklist.
