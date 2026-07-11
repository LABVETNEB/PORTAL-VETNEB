# VETNEB Sources of Truth

Mapa vigente de fuentes de verdad documentales del proyecto VETNEB.

## Propósito

Este documento define qué archivo debe leerse primero para cada dominio del proyecto, evita re-auditorías innecesarias y separa documentación vigente de documentación histórica.

Regla principal:

- Leer primero este archivo.
- Luego leer `docs/audit/README.md` si el trabajo se relaciona con auditorías activas.
- Luego leer únicamente la fuente vigente del dominio afectado.
- No usar documentos históricos como base de implementación salvo trazabilidad puntual.

## Fuentes vigentes principales

| Dominio | Fuente de verdad vigente | Complementos permitidos | Estado | Regla |
| --- | --- | --- | --- | --- |
| Índice de auditorías activas | `docs/audit/README.md` | Las 4 auditorías Wave 0 enlazadas desde ese índice | Vigente | Punto de entrada documental de auditorías activas |
| Visual/frontend total | `docs/audit/total-visual-engineering-audit.md` | `docs/audit/design-system-contract.md`, `docs/audit/total-engineering-roadmap.md` | Vigente | Gobierna visual/frontend, tokens, CSS, primitivas, dashboards, no-scroll y PR-VIS-* |
| Ingeniería dura total | `docs/audit/total-software-engineering-audit.md` | `docs/audit/total-engineering-roadmap.md` | Vigente | Gobierna backend, DB, seguridad, CI, testing, observabilidad y PRs ENG/SEC/OBS/LINT/COV |
| Roadmap integrado total | `docs/audit/total-engineering-roadmap.md` | `docs/audit/total-visual-engineering-audit.md`, `docs/audit/total-software-engineering-audit.md` | Vigente | Orquesta secuencia, dependencias, fases, gates y trazabilidad VIS + ENG |
| Gobernanza del design system | `docs/audit/design-system-contract.md` | `docs/audit/total-visual-engineering-audit.md`, `docs/audit/total-engineering-roadmap.md` | Vigente | Contrato operativo docs-only de PR-VIS-0 / Fase 0 / VIS-P1-001; no reemplaza auditorías rectoras |
| Orden operacional del repositorio | `docs/audit/repository-operational-ordering-audit.md` | Este archivo | Vigente | Define orden de PRs docs-only y separación de scopes |
| Readiness enterprise de ingeniería | `docs/audit/vetneb-enterprise-engineering-readiness-audit.md` | `docs/audit/vetneb-supreme-system-level-alignment-plan.md` | Vigente | Usar para gaps enterprise, testing, observabilidad, performance y arquitectura |
| Readiness multinacional extrema | `docs/audit/vetneb-extreme-multinational-enterprise-readiness-audit.md` | `docs/audit/vetneb-supreme-system-level-alignment-plan.md` | Vigente | Usar para P0/P1 de gobernanza, seguridad, SRE, datos y confianza ejecutiva |
| Alineación sistémica superior | `docs/audit/vetneb-supreme-system-level-alignment-plan.md` | Las otras 3 auditorías Wave 0 | Vigente | Usar para reconciliar prioridades, dependencias, waves y PR families |
| Enterprise control register | `docs/governance/enterprise-control-register.md` | `docs/audit/enterprise-repository-maturity-baseline.md`, `docs/audit/enterprise-repository-gap-register.md` | Vigente operativo | Fuente de verdad operativa viva para conocer el estado actual de controles enterprise con evidencia |
| Enterprise repository maturity baseline | `docs/audit/enterprise-repository-maturity-baseline.md` | `docs/governance/enterprise-control-register.md`, `docs/audit/enterprise-repository-gap-register.md` | Snapshot histórico aprobado | Baseline de auditoría aprobado por PR #1436; histórico verificable; no usar como estado operativo mutable |
| Enterprise repository gap register | `docs/audit/enterprise-repository-gap-register.md` | `docs/governance/enterprise-control-register.md`, `docs/audit/enterprise-repository-maturity-baseline.md` | Snapshot histórico aprobado | Backlog priorizado derivado del snapshot; evidencia de hallazgos a fecha de auditoría; no reescribir para simular cierres posteriores |
| Protocolo operativo de agentes | `AGENTS.md` | `docs/protocol/vetneb-ai-working-protocol.md`, `.cursor/rules/*` | Vigente | `AGENTS.md` manda; reglas derivadas no deben contradecirlo |
| Gobernanza / ADR / RFC / ownership | `docs/governance/README.md` | `docs/governance/adr-template.md`, `docs/governance/rfc-change-control-template.md`, `docs/governance/ownership-model.md`, `docs/governance/pr-readiness-review-checklist.md` | Vigente | Usar antes de cambios estructurales, mixed-scope, ownership ambiguo o decisiones duraderas |
| PR readiness / scope discipline | `docs/governance/pr-readiness-review-checklist.md` | `docs/governance/ownership-model.md`, `docs/qa/regression-strategy.md` | Vigente | Usar antes de crear PR, antes de push y antes de merge |
| QA / flaky tests / regression strategy | `docs/qa/README.md` | `docs/qa/flaky-test-policy.md`, `docs/qa/regression-strategy.md` | Vigente | Usar para clasificar fallos, elegir validaciones y evitar fixes improvisados |
| Flaky tests | `docs/qa/flaky-test-policy.md` | `docs/qa/regression-strategy.md` | Vigente | No llamar flaky a una regresión determinística; exigir evidencia, owner y plan |
| Regression strategy | `docs/qa/regression-strategy.md` | `frontend/package.json`, `package.json`, `docs/ops/CI_PR_CHECKS_RUNBOOK.md` | Vigente | Elegir validaciones por riesgo real del PR, no por costumbre |
| Release / go-no-go / deployment readiness | `docs/release/README.md` | `docs/release/release-go-no-go-policy.md`, `docs/release-readiness.md`, `docs/ops/BACKUP_RESTORE_ROLLBACK.md` | Vigente | Usar antes de releases, cambios productivos o decisiones go/no-go |
| Rollback / backup / restore operativo | `docs/ops/BACKUP_RESTORE_ROLLBACK.md` | `docs/release/release-go-no-go-policy.md`, `docs/production-readiness-evidence.md` | Vigente | Usar para rollback triggers, restore drills, evidencia sanitizada y operaciones productivas |
| CI / PR checks runbook | `docs/ops/CI_PR_CHECKS_RUNBOOK.md` | `docs/qa/regression-strategy.md`, `docs/governance/pr-readiness-review-checklist.md` | Vigente | Usar para checks de PR, merge y limpieza local |
| CI / E2E layering | `docs/audit/e2e-ci-layering-strategy-audit.md` | `frontend/package.json`, `docs/ops/CI_PR_CHECKS_RUNBOOK.md`, `docs/qa/regression-strategy.md` | Vigente parcial | PR-C1 y PR-C2 cerrados; antes de PR-C3 validar unión de capas == full |
| Dashboard Admin horizontal-nav | `docs/audit/dashboard-horizontal-navigation-information-architecture.md` | `docs/implementation/dashboard-horizontal-shell-navigation.md` | Vigente en curso | No mezclar con ordenamiento documental ni con PRs enterprise foundation |
| Dashboard mobile/admin density | `docs/audit/admin-mobile-density-closeout.md` | Closeouts y auditorías admin-mobile relacionadas | Cerrado | No re-auditar de cero salvo regresión visual nueva |
| Seguridad / sesiones / superficie pública | `docs/security/*` | Tests `security-*`, `auth-*`, matrices RBAC/endpoints/CSP | Vigente estable | Usar para invariantes; PR-S1 debe ser auditoría enfocada antes de tocar auth/API |
| Operación / production readiness | `docs/ops/*` | `docs/release/README.md`, `docs/release-readiness.md`, `docs/production-readiness-evidence.md` | Vigente | Usar para runbooks operativos; no mezclar con CI-only ni deploy changes |
| Implementaciones recientes | `docs/implementation/*` | Subconjunto histórico/secundario `IMPLEMENTATION_*` / `IMPLEMENTACION-PR-*` en el mismo árbol (ex `IMPLEMENTATION_NOTES/` + `docs/implementation-history/`, consolidados por PR-CLEAN2) | Referencia secundaria | Leer solo si el dominio lo exige; no usar como fuente primaria si hay closeout/auditoría vigente |

## Consolidación documental PR-CLEAN2 (2026-06-28)

`docs/audits/` se unificó dentro de `docs/audit/`; `IMPLEMENTATION_NOTES/` (raíz del repo) y
`docs/implementation-history/` se consolidaron dentro de `docs/implementation/`; los
`pr-*.md`/`prN-*.md` sueltos en la raíz de `docs/` se recolectaron en `docs/pr-history/`. Las
carpetas viejas ya no existen; el detalle archivo-por-archivo está en
`docs/HISTORICAL_DOCUMENTATION.md` y en `docs/audit/final-repo-cleanup-engineering-audit.md` (§14).

| Path | Uso correcto | Estado | Leer por defecto |
| --- | --- | --- | --- |
| `docs/audit/` | Auditorías activas, closeouts recientes y documentos docs-only vigentes; incluye (desde PR-CLEAN2) los `AUDIT_*`/`DASHBOARD_*_PLAN` históricos ex-`docs/audits/` | Mixto, con índice vigente en `docs/audit/README.md` | Sí, pero solo a través del índice |
| `docs/pr-history/` | Historial de PRs antiguos; desde PR-CLEAN2 incluye los `pr-*.md`/`prN-*.md` ex-sueltos en la raíz de `docs/` | Histórico | No |
| `docs/implementation/` | Notas de implementación vigentes por dominio; desde PR-CLEAN2 también contiene los `IMPLEMENTACION-PR-*` ex-`docs/implementation-history/` y los `IMPLEMENTATION_*`/kebab-case ex-`IMPLEMENTATION_NOTES/` | Mixto (vigente + histórico/secundario por archivo) | Solo la fuente vigente del dominio |
| `docs/fix-*` en raíz de `docs/` | Notas antiguas sueltas (no PR docs; fuera de alcance de PR-CLEAN2) | Histórico / pendiente de clasificación | No |

## Orden de lectura enterprise control

Para controles enterprise, leer en este orden:

1. `docs/SOURCES_OF_TRUTH.md`
2. `docs/governance/enterprise-control-register.md`
3. `docs/audit/enterprise-repository-maturity-baseline.md` y `docs/audit/enterprise-repository-gap-register.md` para trazabilidad histórica
4. Evidencia específica del control, dominio o configuración

El orden de lectura no reemplaza las fuentes rectoras existentes de frontend, backend, seguridad,
datos, release u operación. El baseline es un snapshot de auditoría aprobado e histórico verificable;
el gap register es un backlog priorizado derivado del snapshot; el control register es la fuente viva
para el estado operativo vigente de controles enterprise.

## Reglas de lectura para futuras auditorías

Antes de auditar o implementar:

1. Confirmar `main` limpio.
2. Leer este mapa.
3. Leer `docs/audit/README.md` si el trabajo toca auditorías activas o planes enterprise.
4. Identificar el dominio afectado.
5. Leer solo la fuente vigente de ese dominio.
6. Clasificar cualquier documento histórico como contexto, no como instrucción vigente.
7. No mezclar documentación con frontend, backend, API, auth, DB, migraciones, dependencias, lockfiles, CI, scripts de package ni configuración Playwright.
8. No permitir que Claude, Codex u otra IA elija prioridades sin matriz P0/P1/P2/P3 explícita.
9. Separar docs-only, scripts-only, CI-only, test-only, backend-only y frontend-only en PRs distintos.
10. No tocar Dependabot dentro de PRs funcionales, documentales o de ordenamiento.
11. Usar `docs/governance/pr-readiness-review-checklist.md` antes de crear PR, antes de push y antes de merge.
12. Usar `docs/qa/regression-strategy.md` para elegir validaciones por riesgo.
13. Usar `docs/release/release-go-no-go-policy.md` antes de cualquier release, deploy o cambio con impacto productivo.

## Foundation docs cerrados

| PR | Tipo | Resultado |
| --- | --- | --- |
| PR-O1 | docs-only | Índice de auditorías activas en `docs/audit/README.md` |
| PR-O2 | docs-only | Mapa inicial de sources of truth |
| PR-O3 | docs-only | Clasificación de documentación histórica |
| PR-GOV1 | docs-only | Base de gobernanza en `docs/governance/*` |
| PR-QA1 | docs-only | Política QA/flaky/regression en `docs/qa/*` |
| PR-REL1 | docs-only | Política release/go-no-go en `docs/release/*` |

## Próximo orden recomendado

| Orden | PR | Tipo | Objetivo |
| --- | --- | --- | --- |
| 1 | PR-C3 | CI-only | Usar capas E2E en CI sin pérdida de cobertura, después de validación local |
| 2 | PR-S1 | docs-only | Auditoría enfocada de seguridad, sesiones, tenant isolation y RLS |
| 3 | PR-OBS1 | docs-only | Baseline de observabilidad, SLOs y runbook de incidentes |
| 4 | PR-DATA1 | docs-only | Auditoría enfocada de datos, backup/restore drills, retention y evidencia sanitizada |
| 5 | PR-DEPS1 | docs-only | Estrategia para Dependabot sin mezclar updates con cambios funcionales |

## Estado

Este mapa queda actualizado por PR-SOT1 después de PR-GOV1, PR-QA1 y PR-REL1.
