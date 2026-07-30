# Enterprise Control Register

| Campo | Valor |
| --- | --- |
| Document owner | Engineering governance |
| Domain | Enterprise control governance |
| Lifecycle status | ACTIVE |
| Authoritative source role | Fuente operativa viva para el estado de las 25 master capabilities |
| Effective date | 2026-07-11 |
| Last verified date | 2026-07-30 |
| Review cadence | Mensual y ante cambios de enforcement o evidencia |
| Supersedes | Ninguno |
| Superseded by | Ninguno |
| Related controls or gaps | `ERM-CTRL-001..025`; enterprise gap register |
| Evidence or approval reference | Evidencia local y configuración GitHub verificadas para `PR-AUDIT-ENTERPRISE-DOCS`; PR #1591 y doble lectura administrativa sanitizada del closeout `PR-SEC-REPO-SETTINGS`; PR #1593 y [closeout del bloque 03](../audit/pr-sec-secret-patterns-audit.md); PR #1601, canarias #1602/#1603, PR correctiva #1605 y [closeout del bloque 04](../audit/pr-ci-always-run-gates-audit.md); required checks efectivos, hardening de GitHub Actions, canarias #1616/#1618, ruta post-hardening #1619 y [closeout del bloque 05](../audit/pr-ci-required-checks-audit.md) verificados en modo lectura el 2026-07-30 |

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

`ERM-CTRL-015` Branch Protection Governance es una divergencia operativa respaldada por evidencia posterior: el baseline conserva el estado histórico `NOT_IMPLEMENTED`, mientras que este registro mantiene `IMPLEMENTED` desde 2026-07-12. La configuración administrativa sanitizada se revalidó el 2026-07-30 con `strict: true` y cuatro contextos required: `validate-pr-governance` (`app_id 15368`), `qga-workflow-security` (`app_id 4291335`), `validate-backend` (`app_id 15368`) y `validate-frontend` (`app_id 15368`). Permanecen efectivos `enforce_admins: true`, `required_linear_history: true`, `required_conversation_resolution: true`, `allow_force_pushes: false` y `allow_deletions: false`. PR #1616 prueba que docs-only alcanza `CLEAN`, PR #1618 prueba que un required funcional fallido permanece `BLOCKED` y PR #1619 prueba la ruta docs-only post-hardening; la ruta positiva original de PR #1446 y la canaria negativa PR #1447 continúan como evidencia histórica enlazada. `ERM-GOV-001` queda cerrado operativamente sin reescribir su fila histórica.

`ERM-CTRL-006` Change Control Governance también diverge justificadamente del snapshot: el contrato mínimo de PR, el workflow `validate-pr-governance`, la protección requerida de `main`, la canaria negativa PR #1447 y la ruta positiva PR #1448 demuestran enforcement observable. `ERM-CHG-001` queda cerrado operativamente desde 2026-07-12 sin modificar su registro histórico.

`ERM-CTRL-013` CI/CD Pipeline Governance diverge justificadamente del snapshot: PR #1601
implementó para `validate-backend` y `validate-frontend` un detector liviano, un heavy
condicional y un check final siempre presente; #1602 y #1603 demostraron las rutas docs-only y
backend. PR #1605 corrigió el rango de detección de impacto a merge-base → head y añadió la
evidencia stale-base ausente en esas dos canarias. Desde el bloque 05, branch protection exige
cuatro contextos: `validate-pr-governance` (`app_id 15368`), `qga-workflow-security`
(`app_id 4291335`), `validate-backend` (`app_id 15368`) y `validate-frontend` (`app_id 15368`),
con `strict: true`; la política de Actions quedó en `selected` con SHA pinning obligatorio y
`GITHUB_TOKEN` predeterminado `read`. `ERM-CI-001` queda cerrado operativamente desde 2026-07-12
sin reescribir el gap register histórico.

`ERM-CTRL-007` Single-Scope Pull Request Policy diverge justificadamente del snapshot: PR #1451 implementó clasificación automática de archivos, declaración machine-checkable de scope y excepción mixta exacta con justificación sustantiva; PR #1452 demostró el rechazo real de backend + frontend sin excepción mediante `validate-pr-governance` fallido y cierre sin merge. `ERM-CHG-002` queda cerrado operativamente desde 2026-07-12 sin reescribir el gap register histórico.

`ERM-CTRL-002` Operational Repository Architecture alcanza cierre operativo mediante evidencia posterior verificable: el layout vigente conserva responsabilidades explícitas para `server`, `frontend`, `drizzle`, `test`, `scripts`, `docs` y `.github`; las auditorías de arquitectura de dominio y ordenamiento operativo confirman que el repositorio continúa siendo navegable y coherente como monolito modular. El control no posee gap relacionado abierto y su cierre no declara completadas las iniciativas separadas de arquitectura de dominio, documentación, quality gates o maintainability.

`ERM-CTRL-009` CODEOWNERS Domain Model conserva `PARTIAL` con evidencia corregida al
2026-07-28: existe un mapa por paths en `.github/CODEOWNERS`, pero todos los paths continúan
asignados a `@LABVETNEB`, no se requieren approvals y `require_code_owner_reviews` permanece
desactivado. La brecha es segregación de funciones y review independiente, no ausencia de
clasificación por dominio.

`ERM-CTRL-010` Architecture Boundary Enforcement alcanza cierre operativo
mediante PR #1593 y sus canarias. El gate exige `Architecture Decision` cuando
la clasificación de paths lo activa; #1597 demuestra la ruta positiva, #1598
el rechazo negativo exacto y #1599 el no-trigger. El intento #1596 permanece
visible porque PR Governance pasó y un contrato M48 independiente rechazó el
diseño de canaria antes de su rediseño.

`ERM-CTRL-014` Quality Gate Architecture transiciona a `IMPLEMENTED` el 2026-07-30: la policy y
el validador de impacto existen, están integrados en `pr-governance-validator.mjs`, y
`qga-workflow-security` aplica `workflow-security-validator.mjs` como required check.
`validate-backend` y `validate-frontend` están presentes en todos los PR hacia `main`, con heavy
condicional calculado desde el merge base común hacia el head candidato y propagación
fail-closed, y desde el bloque 05 son required checks efectivos con `app_id 15368`. La canaria
#1616 demuestra que un PR docs-only alcanza `mergeStateStatus: CLEAN` sin quedar bloqueado; la
canaria #1618 demuestra que un backend gate fallido deja el PR en `BLOCKED` aun con
`mergeable: MERGEABLE`. La canaria #1617 no es evidencia negativa válida: su archivo quedó fuera
de la suite efectiva y se conserva como hallazgo diagnóstico de descubrimiento de tests. La
política de Actions es `selected` con `sha_pinning_required: true`, `verified_allowed: false`,
patrón `pnpm/action-setup@*` y `default_workflow_permissions: read`; QGA continúa operando con
la app `4291335`.

`ERM-CTRL-024` Dependency Governance conserva `PARTIAL`: los seis workflows usan actions
pinneadas a SHA y el required check `qga-workflow-security` aplica enforcement parser-backed.
Permanecen abiertas y separadas la desactivación de Dependabot security updates, la ausencia de
una entrada Dependabot explícita para `/frontend` y la ausencia de SBOM.

`ERM-CTRL-016` Security Hardening Program conserva `PARTIAL`: la lectura administrativa
sanitizada del 2026-07-29 conserva la baseline histórica con los cuatro settings en `disabled`.
Después de la habilitación R2, dos lecturas administrativas independientes coincidentes confirman
secret scanning y repository push protection en `enabled`; validity checks y non-provider
patterns permanecen `disabled` y `NOT_AVAILABLE` bajo titularidad y producto actuales. El perfil
público y la auditoría del bloque están `ACTIVE`, los seis archivos `docs/security/**` permanecen
`PUBLIC_SANITIZED` y `PR-SEC-REPO-SETTINGS` está cerrado. Esta evidencia no cierra
`ERM-SEC-001`, `ERM-SEC-002`, tenant/session runtime, evidencia cross-tenant, RLS runtime,
staging ni producción.

## 4. Jerarquía documental

Orden de lectura para controles enterprise:

1. [VETNEB Sources of Truth](../SOURCES_OF_TRUTH.md)
2. [Enterprise Repository Maturity Audit and Roadmap](../audit/enterprise-repository-maturity-audit-roadmap.md) para diagnóstico y roadmap original.
3. [Enterprise Roadmap Consolidation Plan](../audit/enterprise-roadmap-consolidation-plan.md) para la secuencia ejecutable del Plan B.
4. [Enterprise Control Register](./enterprise-control-register.md) para el estado operativo vivo.
5. [Enterprise Repository Maturity Baseline](../audit/enterprise-repository-maturity-baseline.md) y [Enterprise Repository Gap Register](../audit/enterprise-repository-gap-register.md) para trazabilidad histórica.
6. Evidencia específica del control, dominio o configuración.

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
| ERM-CTRL-002 | Enterprise Repository Governance | Operational Repository Architecture | IMPLEMENTED | 3 | NONE | Engineering governance | [baseline](../audit/enterprise-repository-maturity-baseline.md); [domain architecture audit](../audit/repository-domain-architecture-audit.md); [operational ordering audit](../audit/repository-operational-ordering-audit.md); [ownership model](./ownership-model.md); [implementation closeout](../implementation/operational-repository-architecture-closeout.md); [closeout audit](../audit/operational-repository-architecture-closeout-audit.md) | Current evidence verifies stable top-level responsibilities for backend, frontend, schema/migrations, tests, scripts, documentation and GitHub governance at `main@1ae80f53931188bdc8accdc709cf0b24817a372d`. The repository remains an intentionally documented modular monolith; adjacent domain-architecture and quality initiatives remain governed separately. | NONE | 2026-07-12 | Trimestral y ante reestructuraciones top-level | Revalidate the repository tree and authoritative architecture sources after material top-level moves; reopen when a responsibility becomes ambiguous or a related enterprise gap is created. | Control remains implemented while the top-level layout is documented, navigable, role-owned, aligned with current sources and free of open enterprise gaps against operational repository architecture. |
| ERM-CTRL-003 | Enterprise Repository Governance | Repository Maturity Model | DOCUMENTED_ONLY | 2 | P2 | Engineering governance | [baseline](../audit/enterprise-repository-maturity-baseline.md); [gap register](../audit/enterprise-repository-gap-register.md); [enterprise readiness audit](../audit/vetneb-enterprise-engineering-readiness-audit.md); [roadmap](../audit/total-engineering-roadmap.md) | Previous audits and roadmaps exist; baseline did not verify automated maturity measurement. | ERM-GOV-002 | 2026-07-11 | Trimestral | Keep this register as the operational maturity map and add review calendar evidence. | Maturity model is versioned, reviewed, owner-assigned and linked to evidence per control. |
| ERM-CTRL-004 | Source-of-Truth and Documentation Governance | Source-of-Truth Management | PARTIAL | 3 | P2 | Governance / Docs owner | [baseline](../audit/enterprise-repository-maturity-baseline.md); [gap register](../audit/enterprise-repository-gap-register.md); [sources of truth](../SOURCES_OF_TRUTH.md) | `docs/SOURCES_OF_TRUTH.md` maps current domain sources; baseline observed that mixed documentation still requires human discipline. | ERM-DOC-002 | 2026-07-11 | Trimestral | Maintain this control register as machine-checkable SoT for enterprise controls and add automated validation in a future PR. | Each enterprise control has allowed status, owner, evidence, date and validated links. |
| ERM-CTRL-005 | Source-of-Truth and Documentation Governance | Documentation Governance | PARTIAL | 3 | P2 | Docs owner | [baseline](../audit/enterprise-repository-maturity-baseline.md); [gap register](../audit/enterprise-repository-gap-register.md); [historical documentation](../HISTORICAL_DOCUMENTATION.md); [documentation lifecycle policy](./documentation-lifecycle-policy.md); [governance README](./README.md) | Historical classification exists in `docs/HISTORICAL_DOCUMENTATION.md`; the documentation lifecycle policy now defines lifecycle governance; automatic enforcement does not yet exist; `ERM-DOC-001` is not closed. | ERM-DOC-001 | 2026-07-11 | Mensual | Implement a docs-only SoT/lifecycle guard in a separate scoped PR to validate required metadata, lifecycle state, links, índices and normative references to historical or superseded documents. | Automatic guard is active; canary PR evidence exists; references to non-current sources are validated; durable evidence is linked; this register is updated; `ERM-DOC-001` is closed or reclassified with supporting evidence. |
| ERM-CTRL-006 | Change Control and Pull Request Governance | Change Control Governance | IMPLEMENTED | 3 | NONE | CI owner | [baseline](../audit/enterprise-repository-maturity-baseline.md); [gap register](../audit/enterprise-repository-gap-register.md); [PR checklist](./pr-readiness-review-checklist.md); [review governance](../review-governance.md); [implementation closeout](../implementation/change-control-governance-closeout.md); [closeout audit](../audit/change-control-governance-closeout-audit.md) | The PR template defines the minimum change contract and `validate-pr-governance` enforces metadata, scope, diff integrity, sensitive-file, secret and Markdown checks on pull requests to `main`. PR #1447 / run `29212530876` provides the failing negative path closed without merge; PR #1448 / run `29212737354` provides the successful docs-only path merged through the required gate. | ERM-CHG-001 (closed operationally 2026-07-12; historical snapshot retained) | 2026-07-12 | Mensual y ante cambios de template, workflow, checks o branch protection | Revalidate the minimum PR contract and required check after governance changes; reopen on merge bypass, job-name drift or reduced validation coverage. | Control remains implemented while pull requests to `main` require the governed contract and `validate-pr-governance`, invalid metadata produces a failing required check, valid scope can pass, and periodic evidence is maintained. |
| ERM-CTRL-007 | Change Control and Pull Request Governance | Single-Scope Pull Request Policy | IMPLEMENTED | 3 | NONE | Engineering governance / CI owner | [baseline](../audit/enterprise-repository-maturity-baseline.md); [gap register](../audit/enterprise-repository-gap-register.md); [PR checklist](./pr-readiness-review-checklist.md); [technical enforcement](../implementation/single-scope-pr-policy-enforcement.md); [implementation closeout](../implementation/single-scope-pr-policy-closeout.md); [closeout audit](../audit/single-scope-pr-policy-closeout-audit.md) | `validate-pr-governance` classifies changed files and verifies declared scope. PR #1451 / PR Governance run `29213900805` and Backend CI run `29213900803` provide the successful mixed-scope exception path. PR #1452 / run `29214006955` provides the failed undeclared backend + frontend path, closed without merge; exact-SHA cleanup removed both delivery and canary branches. | ERM-CHG-002 (closed operationally 2026-07-12; historical snapshot retained) | 2026-07-12 | Mensual y ante cambios de template, classifier, scope labels, exception rules, workflow job name o branch protection | Revalidate positive and negative paths after governance changes; reopen on undeclared mixed-scope pass, placeholder bypass, declared/detected mismatch, required-check drift or merge bypass. | Control remains implemented while declared scope matches detected scope, multiple primary scopes fail by default, exceptions enumerate every affected scope with substantive justification, placeholder text cannot satisfy the contract, tests remain green and `validate-pr-governance` remains required. |
| ERM-CTRL-008 | Code and Operational Ownership | Code Ownership Governance | PARTIAL | 2 | P2 | Tech lead / Domain owners | [baseline](../audit/enterprise-repository-maturity-baseline.md); [gap register](../audit/enterprise-repository-gap-register.md); [ownership model](./ownership-model.md) | `.github/CODEOWNERS` existed globally and ownership by domain was documented, but GitHub-effective domain ownership was incomplete. | ERM-OWN-001 | 2026-07-11 | Trimestral | Keep role ownership visible and define CODEOWNERS/domain review mapping in a future PR. | Ownership is effective by domain through CODEOWNERS or equivalent required review controls. |
| ERM-CTRL-009 | Code and Operational Ownership | CODEOWNERS Domain Model | PARTIAL | 1 | P2 | Tech lead / Domain owners | [baseline](../audit/enterprise-repository-maturity-baseline.md); [gap register](../audit/enterprise-repository-gap-register.md); [CODEOWNERS](../../.github/CODEOWNERS); [ownership model](./ownership-model.md) | `.github/CODEOWNERS` defines a fallback plus path mappings for governance, docs, backend, frontend, schema, tests, scripts and manifests. Every mapping resolves to `@LABVETNEB`; branch protection requires zero approvals and does not require CODEOWNER review. The model provides accountability but no independent review or segregation of functions. | ERM-OWN-001 | 2026-07-28 | Trimestral y ante cambios de maintainers, CODEOWNERS o approvals | Reevaluate the single-maintainer model on the objective triggers defined in the ownership model; do not add fictional teams or treat path mapping as independent review. | A real independent maintainer or reviewer exists, representative path changes request the intended reviewer, required approval or CODEOWNER review is evidenced when adopted, canaries pass, and the ownership model plus branch-protection evidence are updated. |
| ERM-CTRL-010 | Software Architecture Governance | Architecture Boundary Enforcement | IMPLEMENTED | 3 | NONE | Architecture owner | [baseline](../audit/enterprise-repository-maturity-baseline.md); [gap register](../audit/enterprise-repository-gap-register.md); [ADR template](./adr-template.md); [RFC template](./rfc-change-control-template.md); [PR governance validator](../../scripts/governance/pr-governance-validator.mjs); [block 03 closeout](../audit/pr-sec-secret-patterns-audit.md) | PR #1593 implements the path-based `Architecture Decision` contract. PR #1597 demonstrates the positive declaration path; #1598 fails with the exact missing-section error while Backend CI and QGA pass; #1599 proves a nested backend modification does not trigger the gate. #1596 remains historical evidence of a canary design rejected independently by M48 before the file/LOC-preserving redesign. | ERM-ARC-001 (closed operationally 2026-07-29; historical snapshot retained) | 2026-07-29 | Trimestral y ante cambios del validator, template, path classifier o workflows | Revalidate positive, negative and non-trigger paths after governance changes; preserve the independent M48 census contract and reopen on trigger drift, declaration bypass or false positive. | Control remains implemented while architectural paths require an ADR/RFC link or substantive not-applicable justification, missing declarations fail, non-triggering paths remain exempt, and canary evidence is maintained. |
| ERM-CTRL-011 | Enterprise Test Architecture | Enterprise Test Architecture | IMPLEMENTED | 3 | P1 | QA / Backend owner | [baseline](../audit/enterprise-repository-maturity-baseline.md); [gap register](../audit/enterprise-repository-gap-register.md); [E2E catalog](../../frontend/e2e/suites/catalog.ts); [catalog contract](../../test/architecture/e2e-suite-catalog-completeness.test.ts); [slot 06 audit](../audit/pr-e2e-ci-completeness-audit.md); [slot 08 coverage audit](../audit/pr-quality-coverage-baseline-audit.md) | The typed E2E catalog and automatic full-suite route remain enforced. Slot 08 adds a separate native Node coverage command while preserving `pnpm test` literally. Its single local run passes 4,023 tests with 81.70% line, 78.55% branch and 78.74% function coverage; the contract rejects missing or duplicated flags, changed glob/test script, thresholds, external tools, pipes and redirections. No threshold or enforcement exists, and mutation strength remains a separate quality gap. | ERM-TST-001 (closed operationally 2026-07-30); GAP-TEST-1 (closed operationally 2026-07-30) | 2026-07-30 | Mensual y ante cambios de catálogo, runners, workflows E2E o script de cobertura | Revalidate catalog inventory, automatic workflow union and the separate coverage contract after runner or test-tooling changes; treat baseline drift as diagnostic until a separately approved policy exists. | Control remains implemented while test execution stays stable, tracked E2E specs retain automatic coverage, native coverage remains reproducible and its negative contract fails closed without silently adding enforcement. |
| ERM-CTRL-012 | Enterprise Test Architecture | Test Suite Taxonomy | IMPLEMENTED | 3 | P3 | QA owner | [baseline](../audit/enterprise-repository-maturity-baseline.md); [gap register](../audit/enterprise-repository-gap-register.md); [slot 07 audit](../audit/pr-test-architecture-consolidation-audit.md); [test convention](../implementation/test-suite-enterprise-organization-convention.md) | The adopted taxonomy keeps zero tests in `test/` root and now separates shared fixtures, factories and behavioral mocks. The source-coupled baseline was recalculated as 370/517, with an exhaustive path inventory; two tree censuses migrated to the canonical recursive helper with positive and negative local contracts. Mutation strength remains a separate quality gap. | ERM-TST-002 | 2026-07-30 | Semestral y ante cambios de taxonomía o helper de censos | Preserve canonical support paths and recursive census contracts; run a scoped mutation-testing pilot only after coverage baseline is stable. | Canonical support paths and recursive census contracts remain enforced; mutation pilot later records a baseline score without weakening this taxonomy. |
| ERM-CTRL-013 | CI/CD and Quality Gate Governance | CI/CD Pipeline Governance | IMPLEMENTED | 3 | NONE | CI owner | [baseline](../audit/enterprise-repository-maturity-baseline.md); [gap register](../audit/enterprise-repository-gap-register.md); [CI checks runbook](../ops/CI_PR_CHECKS_RUNBOOK.md); [Frontend CI workflow](../../.github/workflows/frontend-ci.yml); [E2E completeness workflow](../../.github/workflows/e2e-completeness.yml); [block 04 closeout](../audit/pr-ci-always-run-gates-audit.md); [block 05 closeout](../audit/pr-ci-required-checks-audit.md); [slot 06 audit](../audit/pr-e2e-ci-completeness-audit.md) | Branch protection keeps the four strict required contexts. `Frontend CI` remains the fast 43-spec `e2e:ci` production-bundle gate. Slot 06 adds a separate non-required Ubuntu route with focused PR, dispatch and schedule triggers that executes one catalog-derived `e2e:full` invocation for all 72 specs; closeout head `2d9eda213d2a913786d2497ae18f345011d5eec7`, run `30567587561` / job `90955867044`, completed 786 tests successfully with 782 direct passes and 4 bounded-retry passes. No required check, Actions setting or branch-protection rule changed. | ERM-CI-001 (closed); GAP-TEST-1 (closed operationally 2026-07-30) | 2026-07-30 | Mensual y ante cambios de workflows, E2E cohorts, job names, impact detection, branch protection o Actions permissions | Revalidate the four required contexts, fast frontend gate and full-suite automatic route after CI changes; reopen on context absence, cohort coverage drift, merge bypass or weakened triggers. | Control remains implemented while required contexts stay enforced, `validate-frontend` remains fail-closed and every cataloged E2E spec has a durable automatic workflow route. |
| ERM-CTRL-014 | CI/CD and Quality Gate Governance | Quality Gate Architecture | IMPLEMENTED | 3 | NONE | CI / Security owner | [baseline](../audit/enterprise-repository-maturity-baseline.md); [gap register](../audit/enterprise-repository-gap-register.md); [workflow security validator](../../scripts/governance/workflow-security-validator.mjs); [QGA workflow](../../.github/workflows/qga-governance.yml); [E2E completeness RFC](../audit/pr-e2e-ci-completeness-rfc.md); [E2E workflow contract](../../test/unit/infrastructure/e2e-completeness-workflow.test.ts); [slot 06 audit](../audit/pr-e2e-ci-completeness-audit.md) | Required checks and minimum workflow security remain unchanged. The slot 06 contract parses workflow YAML, discovers automatic cohort commands, resolves them through the typed catalog and requires their union to equal `full`. In-memory mutations prove missing full coverage, residual cohort loss and a cataloged spec without a route fail deterministically. The production runner remains scoped to `Frontend CI`; completeness uses the dev runner required by immutable Linux baselines, two workers and bounded retries that require callbacks to pass without omitting assertions. Closeout head `2d9eda213d2a913786d2497ae18f345011d5eec7`, run `30567587561` / job `90955867044`, proves the positive path. | ERM-CI-002 (closed); GAP-TEST-1 (closed operationally 2026-07-30) | 2026-07-30 | Mensual y ante cambios de workflows, catalog, policy, validators, branch protection o Actions permissions | Revalidate parser-backed workflow coverage, minimum permissions, SHA pinning, runner isolation and the four required contexts after CI changes. | Control remains implemented while workflow security and impact gates stay enforced, automatic E2E coverage equals `full`, negative mutations fail closed and minimum permissions remain enforced. |
| ERM-CTRL-015 | Enterprise Repository Governance | Branch Protection Governance | IMPLEMENTED | 3 | NONE | Repository admin / Tech lead | [baseline](../audit/enterprise-repository-maturity-baseline.md); [gap register](../audit/enterprise-repository-gap-register.md); [CI checks runbook](../ops/CI_PR_CHECKS_RUNBOOK.md); [review governance](../review-governance.md); [implementation closeout](../implementation/branch-protection-governance-closeout.md); [closeout audit](../audit/branch-protection-governance-closeout-audit.md); [block 05 required-checks audit](../audit/pr-ci-required-checks-audit.md) | Baseline snapshot recorded `NOT_IMPLEMENTED`. Read-only verification on 2026-07-30 confirms protected PR flow on `main` with `strict: true` and four required contexts: `validate-pr-governance` (`app_id 15368`), `qga-workflow-security` (`app_id 4291335`), `validate-backend` (`app_id 15368`) and `validate-frontend` (`app_id 15368`). Protection invariants remain `enforce_admins: true`, `required_linear_history: true`, `required_conversation_resolution: true`, `allow_force_pushes: false` and `allow_deletions: false`. PR #1616 proves the docs-only route reaches `CLEAN`; PR #1618 proves a failed functional required gate remains `BLOCKED`; PR #1619 proves the post-hardening docs-only route with all four required contexts successful and both heavy validations skipped. PR #1446 and PR #1447 / run `29212530876` remain linked as the original positive and failed-governance evidence. | ERM-GOV-001 (closed operationally 2026-07-12; historical snapshot retained) | 2026-07-30 | Mensual y ante cambios de branch protection, workflows, required context names or app IDs, administrator enforcement or repository plan | Revalidate the four required contexts with their app IDs and `strict: true`, plus `enforce_admins`, linear history, conversation resolution, force-push and deletion invariants after any branch-protection, workflow, administrator or repository-plan change; reopen on context or protection drift. | Control remains implemented while protected PR flow enforces all four strict required contexts (`validate-pr-governance` with `app_id 15368`, `qga-workflow-security` with `app_id 4291335`, `validate-backend` with `app_id 15368`, `validate-frontend` with `app_id 15368`), `enforce_admins: true`, `required_linear_history: true`, `required_conversation_resolution: true`, `allow_force_pushes: false` and `allow_deletions: false`, with periodic positive and negative evidence maintained. |
| ERM-CTRL-016 | Security Governance and Hardening | Security Hardening Program | PARTIAL | 3 | P1 | Security / Backend owner | [baseline](../audit/enterprise-repository-maturity-baseline.md); [gap register](../audit/enterprise-repository-gap-register.md); [enterprise audit roadmap](../audit/enterprise-repository-maturity-audit-roadmap.md); [public repository exposure profile](../security/public-repository-exposure-profile.md); [PR-SEC-REPO-SETTINGS audit](../audit/pr-sec-repo-settings-audit.md); [block 03 closeout](../audit/pr-sec-secret-patterns-audit.md) | PR #1591 closed repository settings and public exposure governance. PR #1593 extends the required PR validator to stack-specific secret patterns; #1594 proves the clean path and #1595 proves isolated SMTP rejection without exposing the synthetic value. `GAP-P0-3` is closed operationally. Secret scanning and repository push protection remain `enabled`; validity checks and non-provider patterns remain `NOT_AVAILABLE` under current ownership/product. Runtime tenant/session and cross-tenant evidence, RLS runtime, staging and production remain pending. | ERM-SEC-001; ERM-SEC-002; GAP-P0-1; GAP-P0-3 (closed operationally 2026-07-29) | 2026-07-29 | Por release, trimestral y ante cambios de GitHub security settings, secret patterns, ownership o visibilidad | Obtain sanitized runtime cross-tenant and tenant/session evidence; advance RLS or approved compensating controls under their separate scopes; periodically revalidate repository secret protection and stack-specific PR patterns; perform restricted alert triage when appropriate without exposing alert or secret data. | Eligible repository secret protection remains enabled and independently verified; stack-specific secret patterns retain positive and negative canary evidence without value exposure; the public exposure profile remains `ACTIVE`; tenant/session/public-private controls have sanitized runtime evidence; RLS governance or compensating-control evidence remains linked without treating unavailable features as failures. |
| ERM-CTRL-017 | Security Governance and Hardening | Tenant Isolation Governance | PARTIAL | 3 | P1 | Security / Backend owner | [baseline](../audit/enterprise-repository-maturity-baseline.md); [gap register](../audit/enterprise-repository-gap-register.md) | Matrices and tests document tenant isolation; baseline observed staging/runtime smoke A/B evidence pending. | ERM-SEC-001 | 2026-07-11 | Por release y trimestral | Execute CT-01 through CT-16 smoke runbook in controlled environment with sanitized evidence. | Cross-tenant smoke record includes timestamp, commit/deploy, result and responsible role without secrets. |
| ERM-CTRL-018 | Security Governance and Hardening | RLS Governance | IMPLEMENTED | 3 | P1 | Security / Backend owner | [baseline](../audit/enterprise-repository-maturity-baseline.md); [gap register](../audit/enterprise-repository-gap-register.md); [RLS tenant isolation ADR](../architecture/rls-tenant-isolation-adr.md); [RLS enforcement matrix](../security/rls-enforcement-matrix.md) | RLS Governance: IMPLEMENTED — the accepted [RLS tenant isolation ADR](../architecture/rls-tenant-isolation-adr.md) records the governance decision (Alternative D: incremental native RLS as defense-in-depth while application-level tenant scoping stays mandatory), defines owners, phases, pilot entry/exit criteria, rollback strategy, verification plan and reopen triggers. Native RLS runtime: NOT_IMPLEMENTED — the ADR does not implement policies, roles, migrations or SQL; the RLS matrix keeps NO-GO and pending runtime evidence, and `ERM-SEC-002` stays open. | ERM-SEC-002 (governance decision recorded via ADR 2026-07-14; native RLS runtime and cross-tenant evidence remain open) | 2026-07-14 | Trimestral y por release | Execute Phase 1 external verification (effective DB role, `rolsuper`, `rolbypassrls`, ownership, pooler, transactions, external policies) before designing policies or roles; keep native RLS runtime and cross-tenant evidence tracked under `ERM-SEC-002`, `ERM-CTRL-016` and `ERM-CTRL-017`. | Control remains implemented while the RLS governance decision is recorded in an approved ADR with owners, phases, verification plan and reopen triggers; reopen if the decision is superseded, if external verification contradicts its assumptions, or if the connection/pooler/deployment model changes. Native RLS runtime closure is out of scope for this control and tracked separately. |
| ERM-CTRL-019 | Database and Data Governance | Data Governance Framework | PARTIAL | 2 | P2 | DBA / DevOps | [baseline](../audit/enterprise-repository-maturity-baseline.md); [gap register](../audit/enterprise-repository-gap-register.md) | Schema, migrations and `schema:verify` exist; lifecycle, retention and classification remain incomplete. | ERM-DATA-002 | 2026-07-11 | Semestral | Create data classification, retention and lifecycle policy in a dedicated docs-only PR. | Policy is approved, linked from SoT and includes owners, retention, deletion and evidence requirements. |
| ERM-CTRL-020 | Backup, Restore and Disaster Recovery | Backup/Restore Drill Program | PARTIAL | 2 | P1 | DBA / DevOps | [baseline](../audit/enterprise-repository-maturity-baseline.md); [gap register](../audit/enterprise-repository-gap-register.md) | Backup/export runbook exists; baseline observed restore drill, RPO/RTO and sanitized recovery evidence pending. | ERM-DATA-001; ERM-DR-001 | 2026-07-11 | Trimestral y antes de cambios DB | Execute non-production restore drill and record RPO/RTO evidence without secrets. | Restore drill completes with schema/smoke validation, timestamp, result and responsible roles. |
| ERM-CTRL-021 | Observability and Operations | Observability Baseline | PARTIAL | 2 | P2 | DevOps / Backend owner | [baseline](../audit/enterprise-repository-maturity-baseline.md); [gap register](../audit/enterprise-repository-gap-register.md) | Request IDs and sanitized logging exist; metrics baseline was docs-only without collectors, alerts, dashboards or tracing. | ERM-OBS-001 | 2026-07-11 | Mensual | Implement minimal uptime, 5xx, latency, error-rate metrics and alert evidence in a future PR. | Alerts and dashboard exist with documented thresholds and sanitized evidence. |
| ERM-CTRL-022 | Observability and Operations | Incident Management Runbook | DOCUMENTED_ONLY | 2 | P2 | DevOps / Tech lead | [baseline](../audit/enterprise-repository-maturity-baseline.md); [gap register](../audit/enterprise-repository-gap-register.md) | Rollback/runbook docs exist; baseline did not verify dedicated incident severity, comms, timeline or postmortem process. | ERM-OBS-002 | 2026-07-11 | Semestral | Create incident management runbook and postmortem template. | Runbook is linked from SoT and exercised through first tabletop or process canary. |
| ERM-CTRL-023 | Release and Production Readiness | Release Readiness Review | PARTIAL | 2 | P2 | Release / Ops owner | [baseline](../audit/enterprise-repository-maturity-baseline.md); [gap register](../audit/enterprise-repository-gap-register.md) | Release docs, smoke scripts and app-version workflow exist; baseline observed no GitHub environments. | ERM-REL-001 | 2026-07-11 | Por release | Define GitHub environments/deployment protection or document equivalent external control. | Environment controls or approved equivalent are evidenced and linked to release go/no-go. |
| ERM-CTRL-024 | Dependency and Supply Chain Governance | Dependency Governance | PARTIAL | 2 | P2 | Security / Dependency owner | [baseline](../audit/enterprise-repository-maturity-baseline.md); [gap register](../audit/enterprise-repository-gap-register.md); [Dependabot config](../../.github/dependabot.yml); [workflow security policy](../../scripts/governance/workflow-security-policy.mjs); [workflow security validator](../../scripts/governance/workflow-security-validator.mjs); [QGA workflow](../../.github/workflows/qga-governance.yml) | The six workflows pin external actions to lowercase 40-character SHAs and declare `contents: read`; `qga-workflow-security` enforces parser-backed action, permission and container policy as a required check. Dependabot security updates remain disabled, `.github/dependabot.yml` has no explicit `/frontend` npm entry, and no executable SBOM generation was observed. | ERM-DEP-001 | 2026-07-28 | Mensual para deps, trimestral para policy | Track separately: enable Dependabot security updates; decide and verify frontend workspace coverage; add a non-blocking SBOM artifact. Preserve SHA pinning and required QGA enforcement. | Security updates are enabled, frontend dependency coverage is verified or explicitly configured, SBOM evidence exists, SHA pinning/QGA enforcement remain effective, and supply-chain policy plus owners are approved. |
| ERM-CTRL-025 | Quality Engineering and Maintainability | Quality Engineering System | PARTIAL | 2 | P1 | QA / Tech lead | [baseline](../audit/enterprise-repository-maturity-baseline.md); [gap register](../audit/enterprise-repository-gap-register.md); [technical debt register](./technical-debt-register.md); [slot 08 coverage audit](../audit/pr-quality-coverage-baseline-audit.md) | Tests and frontend lint exist. Slot 08 adds a reproducible native Node coverage baseline without thresholds or enforcement: 81.70% lines, 78.55% branches and 78.74% functions over 4,023 tests. Backend lint, enabled frontend rules, mutation, complexity, duplication and dead-code gates remain unimplemented, so the capability stays `PARTIAL`. | ERM-BE-001; ERM-TST-001 (closed operationally 2026-07-30); ERM-QLT-001 | 2026-07-30 | Mensual hasta baseline estable | Preserve the diagnostic coverage command and review drift without treating it as enforcement; establish backend-lint and remaining maintainability baselines in their separately authorized scopes. | Executable reports exist for coverage and maintainability with owners and no degraded existing gates; any future thresholds policy is separately evidenced and approved; remaining debt entries meet their closure criteria. |

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
| 2026-07-12 | Cierre operativo de Branch Protection Governance | PR #1446; PR #1447; implementation closeout; closeout audit | `ERM-CTRL-015` transicionado a `IMPLEMENTED`; `ERM-GOV-001` cerrado operativamente; snapshot histórico conservado |
| 2026-07-12 | Cierre operativo de Change Control Governance | PR #1447; PR #1448; implementation closeout; closeout audit | `ERM-CTRL-006` transicionado a `IMPLEMENTED`; `ERM-CHG-001` cerrado operativamente; snapshot histórico conservado |
| 2026-07-12 | Cierre operativo de CI/CD Pipeline Governance | PR #1447; PR #1448; PR #1449; implementation closeout; closeout audit | `ERM-CTRL-013` transicionado a `IMPLEMENTED`; `ERM-CI-001` cerrado operativamente; snapshot histórico conservado |
| 2026-07-12 | Cierre operativo de Single-Scope Pull Request Policy | PR #1451; PR #1452; implementation closeout; closeout audit | `ERM-CTRL-007` transicionado a `IMPLEMENTED`; `ERM-CHG-002` cerrado operativamente; snapshot histórico conservado |
| 2026-07-12 | Cierre operativo de Operational Repository Architecture | Domain architecture audit; operational ordering audit; implementation closeout; closeout audit | `ERM-CTRL-002` transicionado a `IMPLEMENTED`; prioridad `NONE` y ausencia de gaps relacionados conservadas; snapshot histórico conservado |
| 2026-07-14 | Registro de la decisión de gobernanza RLS | [RLS tenant isolation ADR](../architecture/rls-tenant-isolation-adr.md); [RLS enforcement matrix](../security/rls-enforcement-matrix.md) | `ERM-CTRL-018` transicionado a `IMPLEMENTED` sólo para RLS Governance; native RLS runtime permanece `NOT_IMPLEMENTED`; `ERM-SEC-002` y la evidencia cross-tenant siguen abiertos; snapshot histórico conservado |
| 2026-07-28 | Reconciliación de ownership, quality gates y supply chain | CODEOWNERS; branch protection de solo lectura; impact/workflow validators; workflows y Dependabot config | `ERM-CTRL-009`, `ERM-CTRL-014` y `ERM-CTRL-024` conservan `PARTIAL` con evidencia vigente; `ERM-CTRL-013` registra ambos required checks; se mantienen exactamente 25 capabilities y los snapshots históricos intactos |
| 2026-07-29 | Closeout de secret protection y perfil de exposición pública | PR #1591; habilitación R2; dos lecturas administrativas independientes sanitizadas; auditoría `PR-SEC-REPO-SETTINGS`; revisión de `docs/security/**` | `ERM-CTRL-016` conserva `PARTIAL`; secret scanning y push protection están `enabled`; validity checks y non-provider patterns permanecen `NOT_AVAILABLE`; `PR-SEC-REPO-SETTINGS` queda cerrado; los gaps runtime permanecen abiertos |
| 2026-07-29 | Closeout de secret patterns y Architecture Decision | PR #1593; canarias #1594–#1599; [auditoría del bloque 03](../audit/pr-sec-secret-patterns-audit.md) | `ERM-CTRL-010` transiciona a `IMPLEMENTED`; `ERM-ARC-001` y `GAP-P0-3` quedan cerrados operativamente; `ERM-CTRL-016` conserva `PARTIAL`; #1596 permanece como intento de diseño fallido por M48; snapshots históricos intactos |
| 2026-07-29 | Closeout de CI always-run gates | PR #1601; canarias #1602/#1603; [auditoría del bloque 04](../audit/pr-ci-always-run-gates-audit.md); runbook actualizado | `ERM-CTRL-013` conserva `IMPLEMENTED`; `ERM-CTRL-014` conserva `PARTIAL`; los contextos funcionales quedan siempre presentes pero no required; `ERM-CI-002` y el bloque 05 permanecen abiertos |
| 2026-07-30 | Corrección de rango de impacto y validación stale-base del bloque 04 | PR #1605 (head `8ba8b1c`, squash `f0d1da6`); revisión `P2` del runbook resuelta; rerun exitoso de Frontend CI; validación stale-base sobre rama desactualizada | `ERM-CTRL-013` conserva `IMPLEMENTED`; `ERM-CTRL-014` conserva `PARTIAL`; el impacto se calcula desde el merge base común; branch protection y required checks sin cambios |
| 2026-07-30 | Closeout de required checks y hardening de GitHub Actions | Branch protection con cuatro contextos required; Actions `selected` + SHA pinning + token `read`; canarias #1616 y #1618; canaria #1617 clasificada como diagnóstico; [auditoría del bloque 05](../audit/pr-ci-required-checks-audit.md); runbook actualizado | `ERM-CTRL-014` transiciona a `IMPLEMENTED` con maturity 3 y priority `NONE`; `ERM-CTRL-013` conserva `IMPLEMENTED` con evidencia del bloque 05; `ERM-CI-002` queda cerrado operativamente conservando su snapshot histórico; se mantienen exactamente 25 capabilities |
| 2026-07-30 | Closeout de E2E CI completeness | PR #1620; workflow automático `e2e:full`; head de closeout completado `2d9eda213d2a913786d2497ae18f345011d5eec7`; run `30567587561` / job `90955867044`; contrato parser-backed; [RFC](../audit/pr-e2e-ci-completeness-rfc.md); [auditoría del slot 06](../audit/pr-e2e-ci-completeness-audit.md) | `ERM-CTRL-011`, `ERM-CTRL-013` y `ERM-CTRL-014` conservan `IMPLEMENTED`; `GAP-TEST-1` y `PR-CI-3` quedan cerrados operacionalmente; se mantienen exactamente 25 capabilities |
| 2026-07-30 | Baseline nativo de cobertura del slot 08 | Script separado `test:coverage`; contrato positivo y mutaciones negativas; [auditoría del slot 08](../audit/pr-quality-coverage-baseline-audit.md) | `ERM-CTRL-011` conserva `IMPLEMENTED`; `ERM-CTRL-025` conserva `PARTIAL`; `ERM-TST-001` queda cerrado operacionalmente sin threshold ni enforcement; snapshots históricos intactos |

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
