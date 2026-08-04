# VETNEB Sources of Truth

Mapa vigente de fuentes de verdad documentales del proyecto VETNEB.

| Campo | Valor |
| --- | --- |
| Document owner | Governance / Docs owner |
| Domain | Source-of-Truth Management |
| Lifecycle status | ACTIVE |
| Authoritative source role | Mapa primario de fuentes vigentes por dominio |
| Effective date | 2026-07-28 |
| Last verified date | 2026-08-04 |
| Review cadence | Mensual y ante cambios de autoridad documental |
| Supersedes | Ninguno |
| Superseded by | Ninguno |
| Related controls or gaps | `ERM-CTRL-004`; `ERM-DOC-002` |
| Evidence or approval reference | Árbol del repositorio y configuración GitHub verificados para `PR-AUDIT-ENTERPRISE-DOCS`; PR #1591 y closeout sanitizado de `PR-SEC-REPO-SETTINGS`; PR #1593 y closeout del bloque 03; PR #1601, canarias #1602/#1603 y PR correctiva #1605 del bloque 04; required checks efectivos, hardening de GitHub Actions y canarias #1616/#1618 del bloque 05 verificados el 2026-07-30; PR #1626 / Plan B slot 12 incorpora gobernanza de datos, recovery, incidentes y observabilidad el 2026-07-31; PR #1635 incorpora la fuente vigente de dashboard/rediseño Drive-like el 2026-08-04 |

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
| Dashboard autenticado / rediseño Drive-like | `docs/audit/AUDITORIA_GLOBAL_DASHBOARD_VETNEB_VS_DRIVE.md` | Ninguno | `ACTIVE` | Única fuente para Programa A/B/C, geometría, hallazgos P0–P4 y criterios de aceptación del rediseño del dashboard |
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
| Data classification, retention and deletion | `docs/governance/data-classification-retention-policy.md` | `docs/ops/data-recovery-objectives.md`, `docs/ops/BACKUP_RESTORE_ROLLBACK.md`, `docs/governance/enterprise-control-register.md` | Vigente normativo | Gobierna clasificación, retención, legal hold y disposición; no ejecuta borrados ni afirma aprobación legal o enforcement runtime |
| Dependency and supply-chain governance | `docs/governance/supply-chain-policy.md` | `.github/dependabot.yml`, `docs/architecture/supply-chain-sbom-rfc.md`, `scripts/governance/workflow-security-policy.mjs`, `docs/governance/enterprise-control-register.md` | Vigente normativo | Gobierna ownership, cadencia, clasificación de riesgo, separación de ecosistemas, audits, lockfile, rollback, actions SHA-pinned, prohibición de merge automático y SBOM como evidencia no bloqueante; el enforcement real vive en la configuración y los contratos, no en la política |
| Data recovery objectives | `docs/ops/data-recovery-objectives.md` | `docs/ops/BACKUP_RESTORE_ROLLBACK.md`, `docs/ops/INCIDENT_MANAGEMENT_RUNBOOK.md`, `docs/ops/METRICS_BASELINE.md` | Vigente normativo | Define RPO/RTO numéricos y criterios de drill; no demuestra capacidad de restore/rollback ni reemplaza el runbook operativo |
| Incident management | `docs/ops/INCIDENT_MANAGEMENT_RUNBOOK.md` | `docs/ops/data-recovery-objectives.md`, `docs/ops/METRICS_BASELINE.md`, `docs/release/release-go-no-go-policy.md` | Vigente normativo | Gobierna severidades S1–S4, roles, comunicaciones, timeline y postmortem; tabletop, paging y evidencia real permanecen pendientes |
| Observability metrics, SLO and alert design | `docs/ops/METRICS_BASELINE.md` | `docs/ops/INCIDENT_MANAGEMENT_RUNBOOK.md`, `docs/ops/data-recovery-objectives.md`, `docs/governance/enterprise-control-register.md` | Vigente normativo documental | Define métricas agregadas, SLIs/SLOs, error budgets y diseño de alertas/dashboard; collectors, alerts, paging y dashboards runtime siguen `NOT_IMPLEMENTED` |
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
| Rollback / backup / restore operativo | `docs/ops/BACKUP_RESTORE_ROLLBACK.md` | `docs/ops/data-recovery-objectives.md`, `docs/release/release-go-no-go-policy.md`, `docs/production-readiness-evidence.md` | Vigente | Usar para rollback triggers, restore drills, evidencia sanitizada y operaciones productivas; RPO/RTO se leen en la fuente específica |
| CI / PR checks runbook | `docs/ops/CI_PR_CHECKS_RUNBOOK.md` | `docs/qa/regression-strategy.md`, `docs/governance/pr-readiness-review-checklist.md`, `docs/audit/enterprise-repository-maturity-audit-roadmap.md` | Vigente | Usar para checks de PR, merge y limpieza local; debe alinearse con required checks reales |
| CI required checks and Actions policy | `docs/audit/pr-ci-required-checks-audit.md` | `docs/ops/CI_PR_CHECKS_RUNBOOK.md`, `docs/governance/enterprise-control-register.md`, `.github/workflows/backend-ci.yml`, `.github/workflows/frontend-ci.yml` | Closeout activo; bloque 05 `CLOSED` | Evidencia durable de los cuatro required checks con app ID, del hardening de GitHub Actions y de las canarias #1616/#1618; #1617 queda registrada como hallazgo diagnóstico, no como evidencia negativa. No reemplaza los workflows ni la configuración efectiva de GitHub como fuentes ejecutables |
| CI always-run gates | `docs/audit/pr-ci-always-run-gates-audit.md` | `docs/architecture/ci-always-run-gates-rfc.md`, `docs/ops/CI_PR_CHECKS_RUNBOOK.md`, `.github/workflows/backend-ci.yml`, `.github/workflows/frontend-ci.yml`, `docs/governance/enterprise-control-register.md` | Closeout activo; bloque 04 `CLOSED` | Evidencia durable de #1601, canarias #1602/#1603 y corrección de rango de #1605; distingue contextos siempre presentes de heavies condicionales, fija el rango merge-base → head y no declara required los checks funcionales |
| CI / E2E completeness | `docs/audit/pr-e2e-ci-completeness-audit.md` | `docs/audit/pr-e2e-ci-completeness-rfc.md`, `.github/workflows/e2e-completeness.yml`, `.github/workflows/frontend-ci.yml`, `frontend/e2e/suites/catalog.ts`, `docs/ops/CI_PR_CHECKS_RUNBOOK.md` | Closeout activo; slot 06 `CLOSED` | Fuente operativa del slot 06: preserva el gate rápido productivo `e2e:ci` y añade la ruta automática Ubuntu `e2e:full`; PR #1620, head de closeout completado `2d9eda213d2a913786d2497ae18f345011d5eec7` y run `30567587561` / job `90955867044` prueban 72 specs / 786 tests, con 782 pases directos y 4 tras retry acotado |
| Test architecture consolidation | `docs/audit/pr-test-architecture-consolidation-audit.md` | `docs/audit/pr-test-architecture-consolidation-source-coupled-inventory.md`, `test/README.md`, `docs/implementation/test-suite-enterprise-organization-convention.md`, `test/helpers/tracked-source-files.ts` | Closeout local activo; slot 07 | Fuente operativa del censo source-coupled, soporte compartido canónico, walker recursivo y contratos positivos/negativos del slot 07. La evidencia remota pertenece al body de la PR |
| Quality coverage baseline | `docs/audit/pr-quality-coverage-baseline-audit.md` | `package.json`, `test/unit/infrastructure/quality-coverage-script-contract.test.ts`, `docs/governance/enterprise-control-register.md` | Closeout local activo; slot 08 | Fuente operativa del baseline nativo de Node: 4.023 tests, 81,70% líneas, 78,55% branches y 78,74% funciones; sin thresholds, enforcement, dependencias ni cambio de `pnpm test` |
| Quality backend lint baseline | `docs/audit/pr-quality-backend-lint-baseline-audit.md` | `package.json`, `eslint.config.mjs`, `test/unit/infrastructure/backend-lint-baseline-contract.test.ts`, `docs/governance/enterprise-control-register.md` | Closeout local activo; slot 09 | Fuente operativa del baseline ESLint raíz: 253 archivos, 0 errors y 52 warnings; tres scopes explícitos, cero autofix, cero cambios runtime y sin enforcement CI |
| CI / E2E layering histórico | `docs/audit/e2e-ci-layering-strategy-audit.md` | `frontend/package.json`, `docs/ops/CI_PR_CHECKS_RUNBOOK.md`, `docs/qa/regression-strategy.md` | Vigente histórico parcial | Estrategia previa a PR-CI-3; la fuente operativa de completitud es el closeout del slot 06 y los workflows ejecutables |
| Dashboard Admin horizontal-nav | `docs/audit/dashboard-horizontal-navigation-information-architecture.md` | `docs/implementation/dashboard-horizontal-shell-navigation.md` | Vigente en curso | No mezclar con ordenamiento documental ni con PRs enterprise foundation |
| Dashboard mobile/admin density | `docs/audit/admin-mobile-density-closeout.md` | Closeouts y auditorías admin-mobile relacionadas | Cerrado | No re-auditar de cero salvo regresión visual nueva |
| Seguridad / sesiones / superficie pública | `docs/security/*` | Tests `security-*`, `auth-*`, matrices RBAC/endpoints/CSP, `docs/audit/enterprise-repository-maturity-audit-roadmap.md` | Vigente estable | Usar para invariantes; para brechas P0/P1 enterprise leer también el roadmap de madurez |
| Exposición pública de documentación de seguridad | `docs/security/public-repository-exposure-profile.md` | `docs/audit/pr-sec-repo-settings-audit.md`, `docs/security/*` | Vigente | Gobierna clasificación y sanitización para publicación; no demuestra ni reemplaza enforcement runtime |
| Secret patterns y Architecture Decision | `docs/audit/pr-sec-secret-patterns-audit.md` | `scripts/governance/pr-governance-validator.mjs`, `.github/PULL_REQUEST_TEMPLATE.md`, `docs/governance/enterprise-control-register.md` | Closeout activo; bloque 03 `CLOSED` | Evidencia técnica y canarias #1594–#1599; preserva #1596 como intento fallido por M48 y no reemplaza el validator como fuente ejecutable |
| Invariantes de regresión productiva cerradas | `docs/PRODUCTION_PROGRESS_INVARIANTS.md` | `test/progress-production-invariants.test.ts`, fuentes vigentes del dominio afectado | Vigente acotado | Preserva contratos de regresión ya cerrados; no usar como roadmap ni backlog nuevo |
| Tenant isolation / decisión arquitectónica RLS | `docs/architecture/rls-tenant-isolation-adr.md` | `docs/security/rls-enforcement-matrix.md`, `docs/governance/enterprise-control-register.md` (ERM-CTRL-018), `docs/audit/enterprise-repository-maturity-audit-roadmap.md` | Vigente | Fuente de la decisión de gobernanza RLS (Accepted): adopta RLS incremental como defensa en profundidad manteniendo el scoping aplicativo obligatorio. No afirma RLS runtime activo ni cierra evidencia cross-tenant. Diferenciar de las matrices operativas de seguridad, de las auditorías históricas, del gap register histórico, de la evidencia runtime y de `docs/security/*` como invariantes. |
| Operación / production readiness | `docs/ops/*` | `docs/release/README.md`, `docs/release-readiness.md`, `docs/production-readiness-evidence.md`, `docs/audit/enterprise-repository-maturity-audit-roadmap.md` | Vigente | Usar para runbooks operativos; no mezclar con CI-only ni deploy changes |
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
`PR-AUDIT-ENTERPRISE-DOCS` es el bloque 1 y `PR-SEC-REPO-SETTINGS`, bloque 2,
quedó cerrado el 2026-07-29. `PR-SEC-SECRET-PATTERNS`, bloque 03, también está
`CLOSED`: PR #1593 fue integrado y las canarias #1594–#1599 quedaron cerradas
sin merge. `PR-CI-ALWAYS-RUN-GATES`, bloque 04, está `CLOSED`: PR #1601 fue
integrado, las canarias #1602/#1603 quedaron cerradas sin merge ni ramas
residuales y la PR correctiva #1605 fijó el cálculo de impacto en el rango
merge-base → head. `PR-CI-REQUIRED-CHECKS`, bloque 05, está `CLOSED` desde el
2026-07-30 bajo autorización R3: branch protection exige cuatro contextos
required con `strict: true` y la política de Actions quedó en `selected` con SHA
pinning obligatorio y `GITHUB_TOKEN` predeterminado `read`; #1616 y #1618
quedaron cerradas sin merge como evidencia positiva y negativa, y #1617 se
conserva sólo como hallazgo diagnóstico. El bloque 06 está `CLOSED`: la PR
#1620 conserva el gate productivo `e2e:ci`; el head de closeout completado
`2d9eda213d2a913786d2497ae18f345011d5eec7` y el full run `30567587561`
demuestran la ruta automática de 72/72 specs con 786 tests, 782 pases directos
y 4 tras retry acotado. Los slots 08 y 09 agregan
respectivamente el baseline nativo de cobertura y el baseline ESLint backend
diagnóstico; ambos conservan enforcement y thresholds fuera de scope. Slot 10
consolida la decisión documental RLS sin habilitar runtime. Slot 11 permanece
`BLOCKED` por precondiciones de staging. Slot 12 publica la gobernanza de datos,
RPO/RTO, incidentes y observabilidad sin ejecutar capacidades operativas. Las
prioridades, dependencias, separaciones de riesgo y el detalle operativo se leen
en el plan consolidado, no reconstruyendo backlog desde el roadmap original ni
desde closeouts históricos.

## Estado

Este mapa incorpora la precedencia explícita entre auditoría global, Plan B, estado operativo vivo
y snapshots históricos. También registra el perfil público `ACTIVE` y la auditoría de closeout
`ACTIVE` de `PR-SEC-REPO-SETTINGS`, los closeouts `ACTIVE` de los bloques 03, 04 y 05,
los closeouts locales de los slots 06 a 10 y las fuentes normativas documentales del slot 12.
