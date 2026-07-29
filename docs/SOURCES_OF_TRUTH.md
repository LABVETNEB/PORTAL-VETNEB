# VETNEB Sources of Truth

Mapa vigente de fuentes de verdad documentales del proyecto VETNEB.

| Campo | Valor |
| --- | --- |
| Document owner | Governance / Docs owner |
| Domain | Source-of-Truth Management |
| Lifecycle status | ACTIVE |
| Authoritative source role | Mapa primario de fuentes vigentes por dominio |
| Effective date | 2026-07-28 |
| Last verified date | 2026-07-29 |
| Review cadence | Mensual y ante cambios de autoridad documental |
| Supersedes | Ninguno |
| Superseded by | Ninguno |
| Related controls or gaps | `ERM-CTRL-004`; `ERM-DOC-002` |
| Evidence or approval reference | Árbol del repositorio y configuración GitHub verificados para `PR-AUDIT-ENTERPRISE-DOCS`; fuentes propuestas de `PR-SEC-REPO-SETTINGS` verificadas localmente el 2026-07-29 |

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
| Índice de auditorías activas | `docs/audit/README.md` | Las 4 auditorías Wave 0 enlazadas desde ese índice y documentos rectores enterprise vigentes | Vigente | Punto de entrada documental de auditorías activas |
| Visual/frontend total | `docs/audit/total-visual-engineering-audit.md` | `docs/audit/design-system-contract.md`, `docs/audit/total-engineering-roadmap.md` | Vigente | Gobierna visual/frontend, tokens, CSS, primitivas, dashboards, no-scroll y PR-VIS-* |
| Ingeniería dura total | `docs/audit/total-software-engineering-audit.md` | `docs/audit/total-engineering-roadmap.md` | Vigente | Gobierna backend, DB, seguridad, CI, testing, observabilidad y PRs ENG/SEC/OBS/LINT/COV |
| Roadmap integrado total | `docs/audit/total-engineering-roadmap.md` | `docs/audit/total-visual-engineering-audit.md`, `docs/audit/total-software-engineering-audit.md` | Vigente | Orquesta secuencia, dependencias, fases, gates y trazabilidad VIS + ENG |
| Gobernanza del design system | `docs/audit/design-system-contract.md` | `docs/audit/total-visual-engineering-audit.md`, `docs/audit/total-engineering-roadmap.md` | Vigente | Contrato operativo docs-only de PR-VIS-0 / Fase 0 / VIS-P1-001; no reemplaza auditorías rectoras |
| Orden operacional del repositorio | `docs/audit/repository-operational-ordering-audit.md` | Este archivo | Vigente | Define orden de PRs docs-only y separación de scopes |
| Readiness enterprise de ingeniería | `docs/audit/vetneb-enterprise-engineering-readiness-audit.md` | `docs/audit/vetneb-supreme-system-level-alignment-plan.md` | Vigente | Usar para gaps enterprise, testing, observabilidad, performance y arquitectura |
| Readiness multinacional extrema | `docs/audit/vetneb-extreme-multinational-enterprise-readiness-audit.md` | `docs/audit/vetneb-supreme-system-level-alignment-plan.md` | Vigente | Usar para P0/P1 de gobernanza, seguridad, SRE, datos y confianza ejecutiva |
| Alineación sistémica superior | `docs/audit/vetneb-supreme-system-level-alignment-plan.md` | Las otras 3 auditorías Wave 0 | Vigente | Usar para reconciliar prioridades, dependencias, waves y PR families |
| Enterprise repository maturity audit and roadmap | `docs/audit/enterprise-repository-maturity-audit-roadmap.md` | `docs/governance/enterprise-control-register.md`, `docs/ops/CI_PR_CHECKS_RUNBOOK.md`, `docs/architecture/rls-tenant-isolation-adr.md` | Vigente rector | Auditoría global, diagnóstico, scorecard, brechas P0/P1/P2/P3 y roadmap original de 39 PRs. Preserva trazabilidad; no reemplaza la secuencia ejecutable del Plan B |
| Enterprise roadmap consolidation plan | `docs/audit/enterprise-roadmap-consolidation-plan.md` | `docs/audit/enterprise-repository-maturity-audit-roadmap.md`, `docs/governance/enterprise-control-register.md`, `docs/ops/CI_PR_CHECKS_RUNBOOK.md` | Vigente rector operativo | Secuencia ejecutable recomendada: Plan B de 18 PRs consolidados. Gobierna el orden de implementación sin reescribir el diagnóstico del roadmap global |
| Enterprise control register | `docs/governance/enterprise-control-register.md` | `docs/audit/enterprise-repository-maturity-baseline.md`, `docs/audit/enterprise-repository-gap-register.md`, `docs/audit/enterprise-repository-maturity-audit-roadmap.md` | Vigente operativo | Fuente de verdad operativa viva para conocer el estado actual de controles enterprise con evidencia |
| Enterprise technical debt | `docs/governance/technical-debt-register.md` | `docs/governance/enterprise-control-register.md`, `docs/governance/ownership-model.md`, `docs/audit/enterprise-repository-maturity-audit-roadmap.md` | Vigente operativo | Registro vivo de deuda verificable con owner, trigger y criterio de cierre; documentar deuda no cierra controles ni gaps |
| Documentation lifecycle governance | `docs/governance/documentation-lifecycle-policy.md` | `docs/SOURCES_OF_TRUTH.md`, `docs/HISTORICAL_DOCUMENTATION.md`, `docs/governance/enterprise-control-register.md` | Vigente normativo | Gobierna creación, promoción, revisión, reclasificación, supersession, cierre y conservación histórica de documentos; no reemplaza fuentes rectoras por dominio. |
| Enterprise repository maturity baseline | `docs/audit/enterprise-repository-maturity-baseline.md` | `docs/governance/enterprise-control-register.md`, `docs/audit/enterprise-repository-gap-register.md`, `docs/audit/enterprise-repository-maturity-audit-roadmap.md` | Snapshot histórico aprobado | Baseline de auditoría aprobado por PR #1436; histórico verificable; no usar como estado operativo mutable |
| Enterprise repository gap register | `docs/audit/enterprise-repository-gap-register.md` | `docs/governance/enterprise-control-register.md`, `docs/audit/enterprise-repository-maturity-baseline.md`, `docs/audit/enterprise-repository-maturity-audit-roadmap.md` | Snapshot histórico aprobado | Backlog priorizado derivado del snapshot; evidencia de hallazgos a fecha de auditoría; no reescribir para simular cierres posteriores |
| Protocolo operativo de agentes | `AGENTS.md` | `docs/protocol/vetneb-ai-working-protocol.md`, `.cursor/rules/*` | Vigente | `AGENTS.md` manda; reglas derivadas no deben contradecirlo |
| Gobernanza / ADR / RFC / ownership | `docs/governance/README.md` | `docs/governance/adr-template.md`, `docs/governance/rfc-change-control-template.md`, `docs/governance/ownership-model.md`, `docs/governance/pr-readiness-review-checklist.md` | Vigente | Usar antes de cambios estructurales, mixed-scope, ownership ambiguo o decisiones duraderas |
| PR readiness / scope discipline | `docs/governance/pr-readiness-review-checklist.md` | `docs/governance/ownership-model.md`, `docs/qa/regression-strategy.md` | Vigente | Usar antes de crear PR, antes de push y antes de merge |
| Review y merge governance | `docs/review-governance.md` | `.github/PULL_REQUEST_TEMPLATE.md`, `docs/governance/ownership-model.md`, `docs/ops/CI_PR_CHECKS_RUNBOOK.md` | Vigente complementario | Interpreta el modelo single-maintainer; la configuración efectiva de GitHub y los checks reales prevalecen para enforcement |
| QA / flaky tests / regression strategy | `docs/qa/README.md` | `docs/qa/flaky-test-policy.md`, `docs/qa/regression-strategy.md` | Vigente | Usar para clasificar fallos, elegir validaciones y evitar fixes improvisados |
| Flaky tests | `docs/qa/flaky-test-policy.md` | `docs/qa/regression-strategy.md` | Vigente | No llamar flaky a una regresión determinística; exigir evidencia, owner y plan |
| Regression strategy | `docs/qa/regression-strategy.md` | `frontend/package.json`, `package.json`, `docs/ops/CI_PR_CHECKS_RUNBOOK.md` | Vigente | Elegir validaciones por riesgo real del PR, no por costumbre |
| Release / go-no-go / deployment readiness | `docs/release/README.md` | `docs/release/release-go-no-go-policy.md`, `docs/release-readiness.md`, `docs/ops/BACKUP_RESTORE_ROLLBACK.md` | Vigente | Usar antes de releases, cambios productivos o decisiones go/no-go |
| Rollback / backup / restore operativo | `docs/ops/BACKUP_RESTORE_ROLLBACK.md` | `docs/release/release-go-no-go-policy.md`, `docs/production-readiness-evidence.md` | Vigente | Usar para rollback triggers, restore drills, evidencia sanitizada y operaciones productivas |
| CI / PR checks runbook | `docs/ops/CI_PR_CHECKS_RUNBOOK.md` | `docs/qa/regression-strategy.md`, `docs/governance/pr-readiness-review-checklist.md`, `docs/audit/enterprise-repository-maturity-audit-roadmap.md` | Vigente | Usar para checks de PR, merge y limpieza local; debe alinearse con required checks reales |
| CI / E2E layering | `docs/audit/e2e-ci-layering-strategy-audit.md` | `frontend/package.json`, `docs/ops/CI_PR_CHECKS_RUNBOOK.md`, `docs/qa/regression-strategy.md` | Vigente parcial | PR-C1 y PR-C2 cerrados; antes de PR-C3 validar unión de capas == full |
| Dashboard Admin horizontal-nav | `docs/audit/dashboard-horizontal-navigation-information-architecture.md` | `docs/implementation/dashboard-horizontal-shell-navigation.md` | Vigente en curso | No mezclar con ordenamiento documental ni con PRs enterprise foundation |
| Dashboard mobile/admin density | `docs/audit/admin-mobile-density-closeout.md` | Closeouts y auditorías admin-mobile relacionadas | Cerrado | No re-auditar de cero salvo regresión visual nueva |
| Seguridad / sesiones / superficie pública | `docs/security/*` | Tests `security-*`, `auth-*`, matrices RBAC/endpoints/CSP, `docs/audit/enterprise-repository-maturity-audit-roadmap.md` | Vigente estable | Usar para invariantes; para brechas P0/P1 enterprise leer también el roadmap de madurez |
| Invariantes de regresión productiva cerradas | `docs/PRODUCTION_PROGRESS_INVARIANTS.md` | `test/progress-production-invariants.test.ts`, fuentes vigentes del dominio afectado | Vigente acotado | Preserva contratos de regresión ya cerrados; no usar como roadmap ni backlog nuevo |
| Tenant isolation / decisión arquitectónica RLS | `docs/architecture/rls-tenant-isolation-adr.md` | `docs/security/rls-enforcement-matrix.md`, `docs/governance/enterprise-control-register.md` (ERM-CTRL-018), `docs/audit/enterprise-repository-maturity-audit-roadmap.md` | Vigente | Fuente de la decisión de gobernanza RLS (Accepted): adopta RLS incremental como defensa en profundidad manteniendo el scoping aplicativo obligatorio. No afirma RLS runtime activo ni cierra evidencia cross-tenant. Diferenciar de las matrices operativas de seguridad, de las auditorías históricas, del gap register histórico, de la evidencia runtime y de `docs/security/*` como invariantes. |
| Operación / production readiness | `docs/ops/*` | `docs/release/README.md`, `docs/release-readiness.md`, `docs/production-readiness-evidence.md`, `docs/audit/enterprise-repository-maturity-audit-roadmap.md` | Vigente | Usar para runbooks operativos; no mezclar con CI-only ni deploy changes |
| Implementaciones recientes | `docs/implementation/*` | Subconjunto histórico/secundario `IMPLEMENTATION_*` / `IMPLEMENTACION-PR-*` en el mismo árbol (ex `IMPLEMENTATION_NOTES/` + `docs/implementation-history/`, consolidados por PR-CLEAN2) | Referencia secundaria | Leer solo si el dominio lo exige; no usar como fuente primaria si hay closeout/auditoría vigente |

## Fuentes propuestas pendientes de aprobación

Estas fuentes se registran para revisión sin promoverlas antes de aprobación y
merge. Mientras mantengan lifecycle `PROPOSED`, no desplazan fuentes `ACTIVE`.

| Dominio | Fuente propuesta | Complemento | Estado | Promoción esperada |
| --- | --- | --- | --- | --- |
| Exposición pública de documentación de seguridad | `docs/security/public-repository-exposure-profile.md` | `docs/audit/pr-sec-repo-settings-audit.md`, `docs/security/*`, `docs/audit/enterprise-repository-maturity-audit-roadmap.md` | `PROPOSED` | Promover a `ACTIVE` tras aprobación y merge de la fase documental de `PR-SEC-REPO-SETTINGS` |

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
2. `docs/audit/enterprise-repository-maturity-audit-roadmap.md`
3. `docs/audit/enterprise-roadmap-consolidation-plan.md`
4. `docs/governance/enterprise-control-register.md`
5. `docs/audit/enterprise-repository-maturity-baseline.md` y `docs/audit/enterprise-repository-gap-register.md` para trazabilidad histórica
6. Evidencia específica del control, dominio o configuración

El orden de lectura no reemplaza las fuentes rectoras existentes de frontend, backend, seguridad,
datos, release u operación. El roadmap enterprise conserva el diagnóstico y el roadmap original;
el plan consolidado gobierna la ejecución por bloques del Plan B; el control register gobierna el
estado operativo vivo. El baseline y el gap register son snapshots históricos aprobados y no se
reescriben para representar cierres posteriores.

## Reglas de lectura para futuras auditorías

Antes de auditar o implementar:

1. Confirmar `main` limpio.
2. Leer este mapa.
3. Leer `docs/audit/README.md` si el trabajo toca auditorías activas o planes enterprise.
4. Identificar el dominio afectado.
5. Leer solo la fuente vigente de ese dominio.
6. Clasificar cualquier documento histórico como contexto, no como instrucción vigente; toda reclasificación documental debe seguir `docs/governance/documentation-lifecycle-policy.md`.
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

## Secuencia operativa vigente

La secuencia ejecutable recomendada es el
[Plan B de 18 PRs consolidados](./audit/enterprise-roadmap-consolidation-plan.md).
`PR-AUDIT-ENTERPRISE-DOCS` es el bloque 1. Tras su cierre, el siguiente bloque es
`PR-SEC-REPO-SETTINGS`; las prioridades, dependencias y separaciones de riesgo se leen en el
plan consolidado, no reconstruyendo backlog desde el roadmap original ni desde closeouts
históricos.

## Estado

Este mapa incorpora la precedencia explícita entre auditoría global, Plan B, estado operativo vivo
y snapshots históricos. También registra, sin promoción anticipada, el perfil público y la
auditoría propuestos para `PR-SEC-REPO-SETTINGS`.
