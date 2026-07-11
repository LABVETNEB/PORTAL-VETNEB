# Enterprise Control Register

## 1. Propósito

Este documento es la fuente de verdad operativa viva para los controles enterprise del repositorio VETNEB.

Su objetivo es convertir el baseline y el gap register aprobados en PR #1436 en un registro mantenible, verificable y machine-checkable. El registro permite conocer el estado operativo vigente de cada control, su owner, evidencia, prioridad, gaps relacionados, fecha de verificación y criterio de cierre.

Este archivo no sustituye los snapshots históricos de auditoría y no es evidencia suficiente por sí solo para declarar un control implementado. Un control solo puede declararse `IMPLEMENTED` cuando existe implementación observable, evidencia verificable, owner y fecha de verificación.

## 2. Alcance

Incluye exactamente una fila por cada una de las 25 master enterprise capabilities definidas en [Enterprise Repository Maturity Baseline](../audit/enterprise-repository-maturity-baseline.md).

Este registro cubre:

- controles de gobernanza de repositorio;
- source-of-truth y documentación;
- change control y PR governance;
- ownership;
- arquitectura;
- backend, frontend, testing, CI/CD y quality gates;
- seguridad, tenant isolation y RLS;
- datos, backup, restore y disaster recovery;
- observabilidad, incidentes, release readiness, dependencias y maintainability.

Fuera de alcance:

- modificar el baseline histórico;
- modificar el gap register histórico;
- implementar controles técnicos;
- cambiar GitHub, branch protection, rulesets, workflows, CODEOWNERS, dependencias, backend, frontend, DB, migraciones o runtime.

## 3. Relación con baseline y gap register

El registro deriva de:

- [Enterprise Repository Maturity Baseline](../audit/enterprise-repository-maturity-baseline.md): snapshot histórico de madurez aprobado por PR #1436, observado el 2026-07-10.
- [Enterprise Repository Gap Register](../audit/enterprise-repository-gap-register.md): backlog priorizado de brechas derivado del snapshot, aprobado por PR #1436.

El baseline y el gap register son evidencia histórica y no deben reescribirse para reflejar cambios posteriores. Este registro sí puede divergir justificadamente del snapshot cuando exista evidencia posterior verificable.

La divergencia inicial registrada es `ERM-CTRL-015` Branch Protection Governance: el baseline conserva el estado histórico `NOT_IMPLEMENTED`, mientras que este registro operativo mantiene `PARTIAL` por verificación administrativa fechada 2026-07-11 posterior a PR-ERM-2. La nota administrativa registra implementación técnica observable, pero no cierra el gap histórico `ERM-GOV-001` hasta que exista closure evidence durable enlazada desde el repositorio.

## 4. Jerarquía documental

Orden de lectura para controles enterprise:

1. [VETNEB Sources of Truth](../SOURCES_OF_TRUTH.md)
2. [Enterprise Control Register](./enterprise-control-register.md)
3. [Enterprise Repository Maturity Baseline](../audit/enterprise-repository-maturity-baseline.md) y [Enterprise Repository Gap Register](../audit/enterprise-repository-gap-register.md)
4. Evidencia específica del control, dominio o configuración.

La jerarquía indica orden de lectura. No reemplaza la autoridad técnica de las fuentes rectoras de frontend, backend, seguridad, datos, release u operación.

## 5. Vocabulario normativo

- `MUST`: requisito obligatorio para declarar, cambiar o cerrar un control.
- `SHOULD`: regla esperada salvo justificación explícita.
- `MAY`: acción permitida cuando no contradice el scope del PR.
- `EVIDENCE`: prueba verificable, enlazada o descrita con fecha, que permite auditar un estado.
- `CLOSURE EVIDENCE`: evidencia suficiente para cerrar un gap o transicionar un control a `IMPLEMENTED`.
- `AUTHORITATIVE SOURCE`: documento, configuración, implementación o evidencia operativa reconocida como fuente válida para el control.

## 6. Estados permitidos

Los únicos estados permitidos en este registro son:

| Status | Definición |
| --- | --- |
| `IMPLEMENTED` | El control tiene implementación observable, evidencia verificable, verification date y owner. No puede basarse únicamente en narrativa. |
| `PARTIAL` | Existe implementación incompleta, enforcement parcial o control compensatorio parcial. Debe declarar qué falta, next action y closure criteria. |
| `DOCUMENTED_ONLY` | Existe política, ADR, RFC, runbook o documentación, pero no hay evidencia suficiente de enforcement o ejecución. Nunca equivale a `IMPLEMENTED`. |
| `NOT_IMPLEMENTED` | El control requerido no existe. Debe contener priority, owner esperado, next action y closure criteria. |
| `NOT_APPLICABLE` | El control no aplica por justificación explícita, owner y fecha de revisión. No puede usarse para ocultar deuda. |

No se permiten sinónimos ni estados heredados fuera de este vocabulario.

## 7. Reglas de transición de estado

- Todo cambio de `Status` MUST incluir evidencia verificable.
- Todo cambio de `Status` MUST actualizar `Verification date`.
- Todo cambio MUST conservar el `Control ID`.
- Una transición a `IMPLEMENTED` MUST incluir closure evidence.
- Una transición a `NOT_APPLICABLE` MUST incluir justificación explícita, owner y fecha de revisión.
- Cambios de `Priority` MUST citar el gap relacionado o declarar `NONE` cuando no exista gap abierto relacionado.
- Controles reabiertos MUST conservar trazabilidad del estado anterior, evidencia previa y motivo de reapertura.
- La eliminación de filas está prohibida.
- Capabilities nuevas requieren un PR independiente y actualización del modelo de madurez.
- Los snapshots históricos nunca se reescriben para reflejar cambios posteriores.

## 8. Reglas de evidencia

- Una recomendación no es evidencia de implementación.
- Un documento no prueba enforcement técnico por sí solo.
- Una auditoría histórica prueba el estado observado en su fecha, no el estado operativo actual.
- Una configuración externa debe registrarse con fecha, owner, alcance y evidencia verificable o nota administrativa explícita.
- Un control `IMPLEMENTED` requiere evidencia observable de ejecución, enforcement, configuración efectiva o implementación técnica.
- La falta de evidencia debe quedar visible como `PARTIAL`, `DOCUMENTED_ONLY`, `NOT_IMPLEMENTED` o `UNASSIGNED`, según corresponda.
- Los enlaces deben usar rutas Markdown relativas válidas y no rutas Windows.

## 9. Reglas de ownership

- Los owners son roles, no personas inventadas.
- Los roles se derivan de [Ownership Model](./ownership-model.md), del baseline y del gap register.
- Cuando la evidencia no define un owner exacto, el owner debe ser `UNASSIGNED` y el `Next action` debe explicar el mecanismo de asignación.
- El ownership pendiente no puede ocultarse mediante roles genéricos sin trazabilidad.
- Cambios en owner deben citar fuente, motivo y fecha.

## 10. Reglas de revisión

- Cada control debe tener `Review cadence`.
- Los controles `P1` se revisan al menos mensual o ante cambios del dominio.
- Los controles de seguridad, datos, release, CI y operación se revisan también ante cambios productivos o incidentes relacionados.
- Los controles `DOCUMENTED_ONLY` no pueden permanecer indefinidamente sin next action revisable.
- Las revisiones deben actualizar evidencia, fecha, gaps relacionados y closure criteria cuando corresponda.

## 11. Enterprise Control Register

| Control ID | Axis | Master capability | Status | Maturity | Priority | Owner | Authoritative source | Implementation evidence | Related gap IDs | Verification date | Review cadence | Next action | Closure criteria |
| --- | --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ERM-CTRL-001 | Enterprise Repository Governance | Enterprise Repository Governance | PARTIAL | 2 | P1 | Project / Engineering governance | [baseline](../audit/enterprise-repository-maturity-baseline.md); [gap register](../audit/enterprise-repository-gap-register.md); [AGENTS](../../AGENTS.md); [governance README](./README.md) | Baseline observed strong governance docs in `AGENTS.md` and `docs/governance/README.md`; external enforcement was incomplete at snapshot time. | ERM-GOV-001; ERM-GOV-002 | 2026-07-11 | Mensual y ante cambios CI | Keep operational state aligned with this register and ensure gaps have closure evidence before declaring enterprise-grade governance. | Governance is implemented through enforced repository controls, maturity register, owners, evidence and recurring review. |
| ERM-CTRL-002 | Enterprise Repository Governance | Operational Repository Architecture | PARTIAL | 3 | NONE | Engineering governance | [baseline](../audit/enterprise-repository-maturity-baseline.md); [ownership model](./ownership-model.md) | Baseline observed clear top-level operational architecture with `server`, `frontend`, `drizzle`, `test`, `scripts` and `docs`; `render.yaml` was absent. | NONE | 2026-07-11 | Trimestral | Assign follow-up only when a concrete operational architecture gap is opened. | Architecture layout remains documented, navigable and backed by current domain sources without new open enterprise gaps. |
| ERM-CTRL-003 | Enterprise Repository Governance | Repository Maturity Model | DOCUMENTED_ONLY | 2 | P2 | Engineering governance | [baseline](../audit/enterprise-repository-maturity-baseline.md); [gap register](../audit/enterprise-repository-gap-register.md); [enterprise readiness audit](../audit/vetneb-enterprise-engineering-readiness-audit.md); [roadmap](../audit/total-engineering-roadmap.md) | Previous audits and roadmaps exist; baseline did not verify automated maturity measurement. | ERM-GOV-002 | 2026-07-11 | Trimestral | Keep this register as the operational maturity map and add review calendar evidence. | Maturity model is versioned, reviewed, owner-assigned and linked to evidence per control. |
| ERM-CTRL-004 | Source-of-Truth and Documentation Governance | Source-of-Truth Management | PARTIAL | 3 | P2 | Governance / Docs owner | [baseline](../audit/enterprise-repository-maturity-baseline.md); [gap register](../audit/enterprise-repository-gap-register.md); [sources of truth](../SOURCES_OF_TRUTH.md) | `docs/SOURCES_OF_TRUTH.md` maps current domain sources; baseline observed that mixed documentation still requires human discipline. | ERM-DOC-002 | 2026-07-11 | Trimestral | Maintain this control register as machine-checkable SoT for enterprise controls and add automated validation in a future PR. | Each enterprise control has allowed status, owner, evidence, date and validated links. |
| ERM-CTRL-005 | Source-of-Truth and Documentation Governance | Documentation Governance | PARTIAL | 3 | P2 | Docs owner | [baseline](../audit/enterprise-repository-maturity-baseline.md); [gap register](../audit/enterprise-repository-gap-register.md); [historical documentation](../HISTORICAL_DOCUMENTATION.md); [documentation lifecycle policy](./documentation-lifecycle-policy.md); [governance README](./README.md) | Historical classification exists in `docs/HISTORICAL_DOCUMENTATION.md`; the documentation lifecycle policy now defines lifecycle governance; automatic enforcement does not yet exist; `ERM-DOC-001` is not closed. | ERM-DOC-001 | 2026-07-11 | Mensual | Implement a docs-only SoT/lifecycle guard in a separate scoped PR to validate required metadata, lifecycle state, links, índices and normative references to historical or superseded documents. | Automatic guard is active; canary PR evidence exists; references to non-current sources are validated; durable evidence is linked; this register is updated; `ERM-DOC-001` is closed or reclassified with supporting evidence. |
| ERM-CTRL-006 | Change Control and Pull Request Governance | Change Control Governance | PARTIAL | 2 | P1 | CI owner | [baseline](../audit/enterprise-repository-maturity-baseline.md); [gap register](../audit/enterprise-repository-gap-register.md); [PR checklist](./pr-readiness-review-checklist.md) | PR template and review governance existed; PR #1435 showed that checks and reviews were not externally required at snapshot time. | ERM-CHG-001 | 2026-07-11 | Por PR de CI | Add required positive docs-only check and merge gate in future CI/GitHub-scope PR. | Docs/test PR canary cannot merge until a required positive check succeeds. |
| ERM-CTRL-007 | Change Control and Pull Request Governance | Single-Scope Pull Request Policy | DOCUMENTED_ONLY | 2 | P2 | Engineering governance | [baseline](../audit/enterprise-repository-maturity-baseline.md); [gap register](../audit/enterprise-repository-gap-register.md); [PR checklist](./pr-readiness-review-checklist.md) | Scope discipline is documented in the PR template and checklist; baseline did not verify automatic enforcement. | ERM-CHG-002 | 2026-07-11 | Mensual | Add changed-file category validator in a future governance PR. | Mixed-scope PRs fail or require explicit approved declaration with affected domains. |
| ERM-CTRL-008 | Code and Operational Ownership | Code Ownership Governance | PARTIAL | 2 | P2 | Tech lead / Domain owners | [baseline](../audit/enterprise-repository-maturity-baseline.md); [gap register](../audit/enterprise-repository-gap-register.md); [ownership model](./ownership-model.md) | `.github/CODEOWNERS` existed globally and ownership by domain was documented, but GitHub-effective domain ownership was incomplete. | ERM-OWN-001 | 2026-07-11 | Trimestral | Keep role ownership visible and define CODEOWNERS/domain review mapping in a future PR. | Ownership is effective by domain through CODEOWNERS or equivalent required review controls. |
| ERM-CTRL-009 | Code and Operational Ownership | CODEOWNERS Domain Model | PARTIAL | 1 | P2 | Tech lead / Domain owners | [baseline](../audit/enterprise-repository-maturity-baseline.md); [gap register](../audit/enterprise-repository-gap-register.md); [ownership model](./ownership-model.md) | Baseline observed global `* @LABVETNEB` ownership and no path-domain model. | ERM-OWN-001 | 2026-07-11 | Trimestral | Define incremental path-based CODEOWNERS in a dedicated PR after review enforcement is available. | GitHub requests the correct domain reviewer for representative path changes. |
| ERM-CTRL-010 | Software Architecture Governance | Architecture Boundary Enforcement | PARTIAL | 3 | P2 | Architecture owner | [baseline](../audit/enterprise-repository-maturity-baseline.md); [gap register](../audit/enterprise-repository-gap-register.md); [ADR template](./adr-template.md); [RFC template](./rfc-change-control-template.md) | Architecture ADR and architecture tests exist; baseline did not verify required gate for ADR/RFC triggers. | ERM-ARC-001 | 2026-07-11 | Trimestral | Create an ADR/RFC trigger policy and check in a future architecture-governance PR. | Boundary-affecting PRs include ADR/RFC link or explicit not-applicable justification. |
| ERM-CTRL-011 | Enterprise Test Architecture | Enterprise Test Architecture | IMPLEMENTED | 3 | P1 | QA / Backend owner | [baseline](../audit/enterprise-repository-maturity-baseline.md); [gap register](../audit/enterprise-repository-gap-register.md) | Baseline observed canonical test taxonomy with `test/*.test.ts` at 0 and 420 recursive backend tests. Coverage and mutation remain separate quality gaps. | ERM-TST-001 | 2026-07-11 | Mensual hasta baseline estable | Preserve taxonomy and add coverage baseline in a future quality PR. | Test architecture remains physically enforced and coverage evidence is added without weakening existing tests. |
| ERM-CTRL-012 | Enterprise Test Architecture | Test Suite Taxonomy | IMPLEMENTED | 3 | P3 | QA owner | [baseline](../audit/enterprise-repository-maturity-baseline.md); [gap register](../audit/enterprise-repository-gap-register.md) | Baseline observed adopted test organization convention and canonical `test/README.md`; mutation strength was not measured. | ERM-TST-002 | 2026-07-11 | Semestral | Run a scoped mutation-testing pilot only after coverage baseline is stable. | Mutation pilot records baseline score for a critical module and informs expansion decision. |
| ERM-CTRL-013 | CI/CD and Quality Gate Governance | CI/CD Pipeline Governance | PARTIAL | 2 | P1 | CI owner | [baseline](../audit/enterprise-repository-maturity-baseline.md); [gap register](../audit/enterprise-repository-gap-register.md) | Workflows existed for backend, frontend, manual visual regression and app-version update; baseline observed required checks were not configured. | ERM-CI-001 | 2026-07-11 | Mensual | Map required checks by change type after branch protection/ruleset enforcement is durable. | Required checks are listed and a canary PR is blocked when required checks fail. |
| ERM-CTRL-014 | CI/CD and Quality Gate Governance | Quality Gate Architecture | PARTIAL | 2 | P2 | CI / Security owner | [baseline](../audit/enterprise-repository-maturity-baseline.md); [gap register](../audit/enterprise-repository-gap-register.md) | Backend and frontend quality scripts existed; baseline observed gates did not protect every merge and Actions permissions were broad. | ERM-FE-001; ERM-CI-002 | 2026-07-11 | Trimestral | Add impact-aware docs/test taxonomy gate and reduce Actions permissions in scoped PRs. | Quality gates cover relevant change types and workflows run with minimum necessary permissions. |
| ERM-CTRL-015 | Enterprise Repository Governance | Branch Protection Governance | PARTIAL | 3 | P1 | Repository admin / Tech lead | [baseline](../audit/enterprise-repository-maturity-baseline.md); [gap register](../audit/enterprise-repository-gap-register.md); [review governance](../review-governance.md) | Baseline snapshot recorded `NOT_IMPLEMENTED`. Operational note 2026-07-11: branch protection for `main` was administratively verified with required status check `validate-pr-governance`, strict status checks, administrator enforcement, pull request flow, linear history, conversation resolution, disabled force pushes and disabled branch deletion. Limitation: sanitized branch protection JSON and durable PR canary evidence are not yet linked from the repository, so `ERM-GOV-001` is not closed. | ERM-GOV-001 | 2026-07-11 | Mensual y ante cambios CI | Open a separate focused PR to add durable sanitized branch protection evidence, add or link PR canary evidence, verify that the required check blocks merge when absent or failing, and then update this register. | Future transition to `IMPLEMENTED` requires sanitized branch protection JSON or equivalent durable evidence, positive canary evidence, blocking evidence for absent or failing required check, a verifiable link from this register, updated date and traceability, and explicit closure or evidence-backed reclassification of `ERM-GOV-001`. |
| ERM-CTRL-016 | Security Governance and Hardening | Security Hardening Program | PARTIAL | 3 | P1 | Security / Backend owner | [baseline](../audit/enterprise-repository-maturity-baseline.md); [gap register](../audit/enterprise-repository-gap-register.md) | Security docs, security tests and server middleware controls exist; baseline observed runtime cross-tenant evidence still pending. | ERM-SEC-001; ERM-SEC-002 | 2026-07-11 | Por release y trimestral | Execute and record runtime security evidence and resolve RLS decision path. | Tenant/session/public-private controls have sanitized runtime evidence and documented RLS or compensating-control decision. |
| ERM-CTRL-017 | Security Governance and Hardening | Tenant Isolation Governance | PARTIAL | 3 | P1 | Security / Backend owner | [baseline](../audit/enterprise-repository-maturity-baseline.md); [gap register](../audit/enterprise-repository-gap-register.md) | Matrices and tests document tenant isolation; baseline observed staging/runtime smoke A/B evidence pending. | ERM-SEC-001 | 2026-07-11 | Por release y trimestral | Execute CT-01 through CT-16 smoke runbook in controlled environment with sanitized evidence. | Cross-tenant smoke record includes timestamp, commit/deploy, result and responsible role without secrets. |
| ERM-CTRL-018 | Security Governance and Hardening | RLS Governance | DOCUMENTED_ONLY | 2 | P1 | Security / Backend owner | [baseline](../audit/enterprise-repository-maturity-baseline.md); [gap register](../audit/enterprise-repository-gap-register.md) | RLS matrix exists; baseline observed no native PostgreSQL RLS policy in `drizzle`, `server` or `scripts`. | ERM-SEC-002 | 2026-07-11 | Trimestral | Create ADR deciding native RLS or accepted application-level enforcement with compensating controls. | ADR is approved and follow-up verification plan is linked to security/data owners. |
| ERM-CTRL-019 | Database and Data Governance | Data Governance Framework | PARTIAL | 2 | P2 | DBA / DevOps | [baseline](../audit/enterprise-repository-maturity-baseline.md); [gap register](../audit/enterprise-repository-gap-register.md) | Schema, migrations and `schema:verify` exist; lifecycle, retention and classification remain incomplete. | ERM-DATA-002 | 2026-07-11 | Semestral | Create data classification, retention and lifecycle policy in a dedicated docs-only PR. | Policy is approved, linked from SoT and includes owners, retention, deletion and evidence requirements. |
| ERM-CTRL-020 | Backup, Restore and Disaster Recovery | Backup/Restore Drill Program | PARTIAL | 2 | P1 | DBA / DevOps | [baseline](../audit/enterprise-repository-maturity-baseline.md); [gap register](../audit/enterprise-repository-gap-register.md) | Backup/export runbook exists; baseline observed restore drill, RPO/RTO and sanitized recovery evidence pending. | ERM-DATA-001; ERM-DR-001 | 2026-07-11 | Trimestral y antes de cambios DB | Execute non-production restore drill and record RPO/RTO evidence without secrets. | Restore drill completes with schema/smoke validation, timestamp, result and responsible roles. |
| ERM-CTRL-021 | Observability and Operations | Observability Baseline | PARTIAL | 2 | P2 | DevOps / Backend owner | [baseline](../audit/enterprise-repository-maturity-baseline.md); [gap register](../audit/enterprise-repository-gap-register.md) | Request IDs and sanitized logging exist; metrics baseline was docs-only without collectors, alerts, dashboards or tracing. | ERM-OBS-001 | 2026-07-11 | Mensual | Implement minimal uptime, 5xx, latency, error-rate metrics and alert evidence in a future PR. | Alerts and dashboard exist with documented thresholds and sanitized evidence. |
| ERM-CTRL-022 | Observability and Operations | Incident Management Runbook | DOCUMENTED_ONLY | 2 | P2 | DevOps / Tech lead | [baseline](../audit/enterprise-repository-maturity-baseline.md); [gap register](../audit/enterprise-repository-gap-register.md) | Rollback/runbook docs exist; baseline did not verify dedicated incident severity, comms, timeline or postmortem process. | ERM-OBS-002 | 2026-07-11 | Semestral | Create incident management runbook and postmortem template. | Runbook is linked from SoT and exercised through first tabletop or process canary. |
| ERM-CTRL-023 | Release and Production Readiness | Release Readiness Review | PARTIAL | 2 | P2 | Release / Ops owner | [baseline](../audit/enterprise-repository-maturity-baseline.md); [gap register](../audit/enterprise-repository-gap-register.md) | Release docs, smoke scripts and app-version workflow exist; baseline observed no GitHub environments. | ERM-REL-001 | 2026-07-11 | Por release | Define GitHub environments/deployment protection or document equivalent external control. | Environment controls or approved equivalent are evidenced and linked to release go/no-go. |
| ERM-CTRL-024 | Dependency and Supply Chain Governance | Dependency Governance | PARTIAL | 2 | P2 | Security / Dependency owner | [baseline](../audit/enterprise-repository-maturity-baseline.md); [gap register](../audit/enterprise-repository-gap-register.md) | Dependabot, lockfile and audit steps exist; baseline did not observe SBOM, provenance, license gate or full action pinning. | ERM-DEP-001 | 2026-07-11 | Mensual para deps, trimestral para policy | Add supply-chain policy and then implement SBOM/action pinning/license checks in separate PRs. | Policy and first non-blocking artifact are approved without mixing dependency updates. |
| ERM-CTRL-025 | Quality Engineering and Maintainability | Quality Engineering System | PARTIAL | 2 | P1 | QA / Tech lead | [baseline](../audit/enterprise-repository-maturity-baseline.md); [gap register](../audit/enterprise-repository-gap-register.md) | Tests and frontend lint exist; baseline observed missing coverage, backend lint, mutation, complexity, duplication and dead-code gates. | ERM-BE-001; ERM-TST-001; ERM-QLT-001 | 2026-07-11 | Mensual hasta baseline estable | Establish coverage and maintainability baselines incrementally, without mass reformatting or unrelated refactors. | Reports exist for coverage and maintainability with owners, thresholds plan and no degraded existing gates. |

## 12. Reglas de mantenimiento

Cada PR que cierre o modifique un control enterprise debe actualizar, cuando corresponda:

- `Status`
- `Maturity`
- `Priority`
- `Implementation evidence`
- `Related gap IDs`
- `Verification date`
- `Next action`
- `Closure criteria`

No es obligatorio actualizar este registro en PRs sin relación real con controles enterprise.

Toda actualización debe:

- conservar el `Control ID`;
- mantener exactamente una fila por capability;
- usar únicamente estados permitidos;
- enlazar evidencia con rutas Markdown relativas;
- registrar fecha ISO;
- conservar trazabilidad con baseline y gap register;
- evitar declarar un gap cerrado si el gap register histórico no fue reemplazado por closure evidence posterior.

## 13. Criterios de cierre

Un control puede considerarse cerrado operativamente cuando cumple todas estas condiciones:

- `Status` es `IMPLEMENTED`;
- existe owner por rol;
- existe verification date vigente;
- existe evidencia observable y verificable;
- los gaps relacionados tienen closure evidence o una nota explícita de por qué permanecen abiertos;
- la evidencia no depende solo de narrativa;
- la revisión periódica está definida;
- el cierre no requiere modificar snapshots históricos.

Los controles `PARTIAL`, `DOCUMENTED_ONLY` y `NOT_IMPLEMENTED` deben conservar next action y closure criteria hasta su cierre.

## 14. Historial inicial del registro

| Fecha | Cambio | Fuente | Resultado |
| --- | --- | --- | --- |
| 2026-07-11 | Creación inicial del Enterprise Control Register | Baseline y gap register aprobados por PR #1436 | 25 controles creados con IDs `ERM-CTRL-001` a `ERM-CTRL-025` |
| 2026-07-11 | Registro de divergencia operativa para Branch Protection Governance | Nota administrativa posterior a PR-ERM-2 | `ERM-CTRL-015` mantenido como `PARTIAL` hasta enlazar closure evidence durable; gap histórico `ERM-GOV-001` conservado para trazabilidad |

## 15. Control de integridad

Reglas machine-checkable esperadas:

- cantidad de controles: 25;
- IDs únicos: `ERM-CTRL-001` a `ERM-CTRL-025`;
- statuses permitidos: `IMPLEMENTED`, `PARTIAL`, `DOCUMENTED_ONLY`, `NOT_IMPLEMENTED`, `NOT_APPLICABLE`;
- capabilities únicas;
- ninguna celda `Control ID` vacía;
- ningún `Status` vacío;
- baseline y gap register inmutables;
- ningún archivo fuera de scope para PR-ERM-3.
