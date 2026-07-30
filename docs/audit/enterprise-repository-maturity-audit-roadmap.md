# Enterprise Repository Maturity Audit and Roadmap

> Auditoría docs-only y roadmap enterprise para llevar PORTAL-VETNEB hacia madurez empresarial máxima. Este documento consolida el diagnóstico, brechas, scorecard, roadmap por fases, matriz de validación, registro de riesgos y definición de cierre 100% enterprise.

## Metadata

| Campo | Valor |
| --- | --- |
| Tipo | docs-only |
| Document owner | Engineering governance |
| Rama de trabajo | `docs/enterprise-repository-maturity-audit-roadmap` |
| Base observada por la auditoría | `main` limpio, HEAD `db1da94` |
| Lifecycle status | ACTIVE |
| Authoritative source role | Auditoría global, diagnóstico y roadmap original |
| Effective date | 2026-07-28 |
| Last verified date | 2026-07-29 |
| Review cadence | Mensual y ante cambios materiales de controles enterprise |
| Propósito | Auditoría y roadmap enterprise del repositorio |
| Alcance | Gobernanza, documentación, PRs, tests, CI/CD, seguridad, datos, observabilidad, release, dependencias, calidad y operación |
| No-scope | No modifica runtime, backend, frontend, DB, migraciones, dependencias, lockfiles, workflows ni configuración productiva |
| Related controls or gaps | `ERM-CTRL-001..025`; gaps P0/P1/P2/P3 de este documento |
| Evidence or approval reference | Auditoría original sobre `main@db1da94`; reconciliación documental `PR-AUDIT-ENTERPRISE-DOCS`; PR #1593 y [closeout del bloque 03](./pr-sec-secret-patterns-audit.md); PR #1601, canarias #1602/#1603, PR correctiva #1605 y [closeout del bloque 04](./pr-ci-always-run-gates-audit.md) |

He completado la auditoría. Baseline capturado: `main` limpio, HEAD `db1da94`, working tree sin cambios. **No modifiqué, moví ni creé ningún archivo**; solo lectura, inspección local y `gh api` de solo lectura.

## Precedencia operativa posterior a la auditoría

Este documento preserva el diagnóstico, scorecard, prioridades y roadmap original de 39 PRs.
La secuencia ejecutable recomendada vigente es el
[Plan B de 18 PRs](./enterprise-roadmap-consolidation-plan.md). El
[Enterprise Control Register](../governance/enterprise-control-register.md) gobierna el estado
operativo vivo; el baseline y el gap register permanecen snapshots históricos y no se reescriben.

## Estado operativo posterior — bloque 03

El bloque 03 del Plan B, `PR-SEC-SECRET-PATTERNS`, quedó `CLOSED` el
2026-07-29. PR #1593 integró la implementación técnica; #1594 y #1595
demostraron las rutas positiva y negativa sanitizada de secret patterns; #1597,
#1598 y #1599 demostraron las rutas positiva, negativa y no-trigger de
`Architecture Decision`.

El intento #1596 se conserva como evidencia de diseño: PR Governance pasó, pero
el censo arquitectónico M48 rechazó el archivo nuevo. La canaria fue rediseñada
en #1597 para preservar file count y LOC no vacías.

La evidencia completa, los head SHAs, run IDs, conclusiones y cierre sin merge
de todas las canarias se mantienen en
[PR-SEC-SECRET-PATTERNS Audit](./pr-sec-secret-patterns-audit.md).
`GAP-P0-3` y `ERM-ARC-001` quedan cerrados operativamente sin reescribir sus
snapshots históricos. El estado posterior del bloque 04 se registra a continuación.

## Estado operativo posterior — bloque 04

El bloque 04 del Plan B, `PR-CI-ALWAYS-RUN-GATES`, quedó `CLOSED` el
2026-07-29. PR #1601 integró la arquitectura detector liviano → heavy condicional
→ check final `if: always()`. Desde ese merge, Backend CI y Frontend CI se crean
en todos los pull requests hacia `main`; la condicionalidad aplica al heavy, no
a la presencia de los contextos finales.

Las canarias cerradas sin merge demostraron:

| PR | Detector backend | Backend heavy | `validate-backend` | Detector frontend | Frontend heavy | `validate-frontend` |
| --- | --- | --- | --- | --- | --- | --- |
| #1602 docs-only | `success` | `skipped` | `success` | `success` | `skipped` | `success` |
| #1603 backend | `success` | `success` | `success` | `success` | `skipped` | `success` |

Ambas canarias usaban base alineada. La revisión de #1604 detectó que el contrato de skip no
era verdadero para una rama desactualizada, porque ambos detectores comparaban
`pull_request.base.sha` directamente con el head e incorporaban paths existentes solo en la base
avanzada. PR #1605, mergeada como `f0d1da6b14f7fa5818eb7e9be990d35ed39be431` desde el head
`8ba8b1cacba70547afae6300b7a1522aecbcd058`, sustituyó ese rango por el merge base común hacia el
head candidato, con validación fail-closed del merge base y contratos de infraestructura que
prohíben el retorno de la forma directa. La validación stale-base se ejecutó sobre esta misma PR
documental, cuya rama conserva la divergencia previa a #1605.

El head inicial `b26f60fa08da39a08b7dfca762193b70902524d3` de #1601 fue rechazado por
PR Governance run `30484346394` con
`Architecture Decision Reference must clearly identify an ADR or RFC.`. La
referencia inicial al Plan B no satisfacía el contrato. Se agregó
[RFC: CI Always-Run Pull Request Gates](../architecture/ci-always-run-gates-rfc.md),
se corrigió el body, se enmendó el único commit y todos los checks pasaron en el
head final `a6b5ad4229daa488a84e0c5072be755ae9586502`. Esto demuestra enforcement
positivo de `Architecture Decision`, no un fallo de la arquitectura CI.

La evidencia completa se conserva en
[PR-CI-ALWAYS-RUN-GATES Audit](./pr-ci-always-run-gates-audit.md). Los contextos
funcionales `validate-backend` y `validate-frontend` permanecen no required:
branch protection no fue modificada, `ERM-CI-002` sigue abierto,
`ERM-CTRL-014` conserva `PARTIAL` y el bloque 05 `PR-CI-REQUIRED-CHECKS`
permanece `NOT_RUN`.

---

# 1. Executive Summary

**Porcentaje global ponderado: 59%** (rango 41–60 = parcial/intermedio, borde superior). Promedio simple: 59,6%.

El repositorio tiene **madurez bifurcada**, y ese es el hallazgo central:

| Capa | Madurez | Evidencia |
|---|---:|---|
| Gobernanza de proceso (docs, PR contract, scope, branch protection, test taxonomy, arquitectura) | ~84% | `validate-pr-governance` + `qga-workflow-security` required y verificados en vivo; 514 tests con taxonomía física; 25 controles con registro vivo |
| Operación runtime (seguridad efectiva, observabilidad, datos, DR, calidad medida) | ~36% | 0 policies RLS; logger = 3 wrappers de `console`; 0 restore drills; 0 cobertura; 0 environments |

El repositorio **gobierna excelentemente cómo entra el cambio, y muy poco lo que pasa después de que entra**.

### Puntos fuertes reales (verificados, no narrativos)

- **Change control ejecutable**: `scripts/governance/pr-governance-validator.mjs` (736 LOC) valida secciones obligatorias, clasificación de paths, scope declarado vs detectado, paths sensibles (7 patrones), secretos en líneas añadidas (9 patrones), links Markdown e impacto de quality gates. Verificado como **required check real** vía API.
- **Branch protection efectiva** (evidencia en vivo, 2026-07-28): `enforce_admins: true`, `strict: true`, contextos requeridos `["validate-pr-governance","qga-workflow-security"]`, `linear_history: true`, `force_push: false`, `deletions: false`, `conversation_resolution: true`.
- **Test architecture física**: 514 archivos `*.test.ts`, **0 en la raíz de `test/`**, taxonomía `unit(376)/architecture(72)/integration(57)/security(10)/helpers(8)`, con 72 guards de arquitectura incluyendo `security-cross-tenant-idor-contract.test.ts`.
- **Supply chain parcial pero seria**: los 6 workflows pinnean el 100% de las actions a SHA de 40 caracteres, todos declaran `permissions: contents: read`, `allowBuilds` todo en `false`, y existe `workflow-security-validator.mjs` con enforcement.
- **Enterprise Control Register vivo**: 25 controles `ERM-CTRL-001..025` con status machine-checkable, owner por rol, evidencia y fecha.

### Brechas críticas

**P0-1 — El repositorio es PÚBLICO con secret scanning y push protection DESACTIVADOS.**
Evidencia en vivo: `visibility: "public"`, `secret_scanning: disabled`, `secret_scanning_push_protection: disabled`, `secret_scanning_validity_checks: disabled`. Ninguna auditoría existente del repo registra esto. Para una plataforma clínica con Supabase Storage privado y credenciales de Render, es la brecha de mayor severidad/coste-de-remediación del inventario (activación gratuita en repos públicos, cambio de settings, 0 líneas de código).

**P0-2 — Los quality gates funcionales no bloquean el merge.**
Solo 2 contextos son required, y ambos validan *metadatos y workflows*, no *código*. `validate-backend` (typecheck + 514 tests + build) y `validate-frontend` (lint + typecheck + build + E2E) son condicionales y **no requeridos**. Un PR que toca `server/**` puede mergearse con Backend CI en rojo.

**P0-3 — Los patrones de secreto del validador no cubren el stack real.**
`SECRET_PATTERNS` cubre GitHub/AWS/Google/Stripe/OpenAI, pero **no** cubre Supabase `service_role` JWT (`eyJ...`), `sb_secret_*`, `RENDER_API_KEY` ni credenciales SMTP — exactamente los secretos de esta plataforma.

**P1 destacadas** — 29 de 72 specs E2E (40%) no se ejecutan en ningún workflow; 0 medición de cobertura sobre 514 tests; 0 lint backend; `dependabot_security_updates: disabled`; 0 GitHub environments; observabilidad = `console.log`; restore drill y RPO/RTO nunca ejecutados; RLS nativo con ADR aceptado pero 0 policies en la base.

**Divergencias detectadas: el Control Register está desactualizado en 4 filas** (detalle en §4.10) — reporta como pendientes controles cuya evidencia ya existe en el árbol, lo que degrada su valor como fuente de verdad viva.

---

# 2. Repository Maturity Scorecard

| # | Eje maestro | % | Estado | Evidencia observada | Riesgo empresarial | Prio |
|---:|---|---:|---|---|---|---|
| 1 | Enterprise Repository Governance | 78 | Empresarial fuerte | `AGENTS.md` (291 líneas, R0–R3); `docs/governance/enterprise-control-register.md` 25 filas | Bajo | P2 |
| 2 | Operational Repository Architecture | 88 | Empresarial fuerte | 1887 files: `docs/665 test/525 frontend/339 server/261 drizzle/38 scripts/29 .github/9`; `ERM-CTRL-002` IMPLEMENTED | Bajo | P3 |
| 3 | Source-of-Truth Management | 72 | Avanzado incompleto | `docs/SOURCES_OF_TRUTH.md` 30 dominios mapeados; sin guard automático | Medio: SoT desactualizado se cree vigente | P2 |
| 4 | Documentation Governance | 55 | Parcial | 530+ md: `implementation/313 audit/108 pr-history/62 raíz/14`; índice declara solo 10 vigentes | Medio-alto: 90% de `docs/audit` sin estado por archivo | P2 |
| 5 | Change Control Governance | 88 | Empresarial fuerte | `pr-governance-validator.mjs`; `PULL_REQUEST_TEMPLATE.md` 4 secciones obligatorias | Bajo | P3 |
| 6 | Single-Scope Pull Request Policy | 90 | Empresarial robusto | `classifyPath` + `evaluateScopeContract`; excepción mixta con justificación sustantiva | Bajo | P3 |
| 7 | Code Ownership Governance | 40 | Básico | `.github/CODEOWNERS` 9 paths, **todos `@LABVETNEB`**; API: `required_approving_review_count: 0`, `require_code_owner_reviews: false` | Alto: bus factor 1, cero review independiente | P2 |
| 8 | Architecture Boundary Enforcement | 70 | Avanzado incompleto | 72 guards en `test/architecture/`; `backend-boundary-adr.md`; sin gate ADR/RFC | Medio | P2 |
| 9 | Enterprise Test Architecture | 80 | Empresarial fuerte | 514 tests; `test/*.test.ts` = 0; `test/README.md` normativo | Bajo-medio | P1 |
| 10 | Test Suite Taxonomy | 72 | Avanzado incompleto | Sin `test/fixtures\|factories\|mocks\|setup`; 367/514 (71%) leen código fuente; 134 usos de `readdirSync` | Medio-alto: refactors legítimos rompen tests por path | P2 |
| 11 | CI/CD Pipeline Governance | 70 | Avanzado incompleto | 6 workflows, 100% SHA-pinned, `permissions: contents: read`; runbook reconciliado el 2026-07-28 con ambos required checks; gates funcionales siguen no requeridos | Medio | P1 |
| 12 | Quality Gate Architecture | 50 | Parcial | Required = solo `validate-pr-governance` + `qga-workflow-security`; backend/frontend CI **no required** | **Crítico: código sin gate de merge** | **P0** |
| 13 | Branch Protection Governance | 85 | Empresarial fuerte | API en vivo: admins, strict, linear, no force-push, no delete, conversation | Bajo | P3 |
| 14 | Security Hardening Program | 65 | Avanzado incompleto | 17 guards en `architecture/security/` + 10 en `test/security/`; **repo público con secret scanning off** | **Crítico** | **P0** |
| 15 | Tenant Isolation Governance | 62 | Avanzado incompleto | `security-cross-tenant-idor-contract.test.ts`; `CROSS_TENANT_SMOKE_EVIDENCE_RUNBOOK.md` en NO-GO, CT-01..CT-16 sin ejecutar | Alto | P1 |
| 16 | RLS Governance | 45 | Parcial | ADR Accepted (Alternativa D); **0 matches** de `CREATE POLICY\|ROW LEVEL SECURITY` en `drizzle server scripts` | Alto: aislamiento solo aplicativo | P1 |
| 17 | Data Governance Framework | 40 | Básico | 31 migraciones + `schema:verify`; sin clasificación, retención ni lifecycle | Medio-alto | P2 |
| 18 | Backup/Restore Drill Program | 35 | Básico | `BACKUP_RESTORE_ROLLBACK.md` documenta; drill nunca ejecutado; RPO/RTO no declarados | **Alto: backup no probado ≠ recuperable** | P1 |
| 19 | Observability Baseline | 30 | Básico | `server/lib/logger.ts` = 3 wrappers de `console`; `api-request-id.ts` sí existe; `METRICS_BASELINE.md` se declara docs-only | Alto: ceguera operativa | P1 |
| 20 | Incident Management Runbook | 25 | Básico | Sin runbook de incidentes, severidades, comms ni postmortem template | Medio-alto | P2 |
| 21 | Release Readiness Review | 55 | Parcial | `release-go-no-go-policy.md` + `app-version-force-update.yml`; API: **`environments: 0`** | Medio | P2 |
| 22 | Dependency Governance | 55 | Parcial | `dependabot.yml` 2 ecosistemas; **`dependabot_security_updates: disabled`**; sin `/frontend`; 0 SBOM | Alto | P1 |
| 23 | Quality Engineering System | 35 | Básico | 0 cobertura, 0 lint backend, 0 mutation, 0 complejidad; frontend con 2 reglas react-hooks desactivadas | Medio-alto | P1 |
| 24 | Production Readiness | 60 | Parcial | `verify-production-readiness.mjs` + 5 smoke scripts + version gate | Medio | P2 |
| 25 | Operational Excellence Framework | 45 | Parcial | Runbooks fuertes, ejecución/medición débil; `delete_branch_on_merge: false` | Medio | P2 |

**Ponderación aplicada** (peso 3–8): seguridad (14,15,16) = 21; datos/DR (17,18) = 11; CI/CD+gates (11,12) = 12; test arch (9,10) = 10; observabilidad (19,20) = 10; release/prod (21,24) = 10; governance (1,5,6) = 14; resto = 33. Σ pesos = 121. **Σ ponderada = 7127 → 58,9%.**

La ponderación **no rescata** el resultado porque los ejes débiles (18, 19, 23, 12) son precisamente los de mayor peso.

---

# 3. Current Repository Operating Model

## 3.1 Cómo entra un cambio hoy

```text
Nico crea rama → implementa (agente bajo AGENTS.md R0–R3)
→ validaciones locales por dominio (§6 AGENTS.md, estados canónicos PASSED/FAILED/NOT_RUN/NOT_AVAILABLE/BLOCKED)
→ [MANUAL-NICO] commit + push + gh pr create
→ PR Governance (required) + QGA Governance (required)
→ Backend CI / Frontend CI (condicionales, NO required)
→ merge con linear history + conversation resolution + enforce_admins
```

**Contrato de PR** (`.github/PULL_REQUEST_TEMPLATE.md`): 4 secciones obligatorias (`Summary`, `Scope`, `Validation`, `Rollback`), 11 checkboxes de scope, excepción mixed-scope con justificación sustantiva, checklist de seguridad/regresión. El validador rechaza texto placeholder (`PLACEHOLDER_RE`).

## 3.2 Gates efectivos por tipo de cambio

| Cambio | Backend CI | Frontend CI | PR Gov | QGA | ¿Bloquea merge si falla el gate funcional? |
|---|---|---|---|---|---|
| Solo `docs/**` o `**/*.md` | ignorado | no dispara | ✅ req | ✅ req | n/a |
| `server/**` | corre | no dispara | ✅ req | ✅ req | **NO** |
| `frontend/**` | corre | corre | ✅ req | ✅ req | **NO** |
| `test/**` | corre | no dispara | ✅ req | ✅ req | **NO** |
| `.github/workflows/**` | corre | condicional | ✅ req | ✅ req | **SÍ** (vía QGA) |
| `drizzle/**` | corre (+`db:migrate`) | no | ✅ req | ✅ req | **NO** |

Esta tabla es el modelo operativo real y explica la P0-2: **el único código cuyo fallo bloquea el merge son los workflows**.

## 3.3 Pipeline de CI observado

- **`backend-ci.yml`** — Postgres 16 efímero; `pnpm audit --prod` → `pnpm audit` → `db:migrate` → `typecheck` → `typecheck:test` → `test` → `build`. Timeout 15 min. Job id `validate-backend` (sin `name:` explícito).
- **`frontend-ci.yml`** — `lint` → `typecheck` → `build` → `security:public-surface` → `playwright install chromium` → `e2e:ci`. Timeout 20 min. Sube report solo `if: failure()`.
- **`pr-governance.yml`** — `node scripts/governance/pr-governance-validator.mjs`, `fetch-depth: 0`.
- **`qga-governance.yml`** — patrón `pull_request_target` correcto: checkout de la base *confiable*, checkout del head como **datos inertes** en `qga-candidate-head/`, `persist-credentials: false`, validador ejecutado desde `$GITHUB_WORKSPACE` (base), publicación del check vía GitHub App token. Diseño de seguridad de buen nivel.
- **`visual-regression-manual.yml`** y **`app-version-force-update.yml`** — solo `workflow_dispatch`.

## 3.4 Testing

- **Backend/contratos**: `node --test test/**/*.test.ts`, 514 archivos, sin coverage, sin watch.
- **`test/unit/ui/` (157 archivos)**: contratos estáticos de *frontend* ejecutados por el *runner de backend*. Es deliberado y documentado, pero significa que la salud del frontend depende de un gate que no está en Frontend CI.
- **Frontend**: **0 tests unitarios**, 0 vitest/jest/testing-library. Toda la verificación frontend es E2E o contrato-de-source.
- **E2E**: 72 specs con catálogo tipado (`frontend/e2e/suites/catalog.ts`) con `domain`, `criticality P0–P3`, `owner`, `fixture`, `evidence`, `targetGate`. Cohortes: `ci=43`, `extended=24`, `evidence=2`, `visual-linux=3`. Un solo project Playwright: **chromium**.

## 3.5 Seguridad

Invariantes vivas: `admin_session_id` / `app_session_id` separadas, 7 middlewares (`admin-auth`, `auth`, `clinic-permissions`, `particular-auth`, `request-logger`, `trusted-origin`, `version-gate`), rate limits por realm, `x-request-id`, matrices RBAC/endpoints/CSP documentadas y con guard anti-drift (`security-docs-matrix-drift-guard.test.ts`). Aislamiento tenant: **exclusivamente aplicativo** — la conexión Postgres no tiene RLS.

## 3.6 Ownership

Un solo maintainer (`@LABVETNEB`) en 9 paths de CODEOWNERS, con `require_code_owner_reviews: false` y `required_approving_review_count: 0`. El propio CODEOWNERS lo declara honestamente: *"does not require or simulate independent human approval"*.

---

# 4. Gap Analysis

## 4.1 P0 — Seguridad y merge integrity (3)

| ID | Brecha | Evidencia | Impacto |
|---|---|---|---|
| **GAP-P0-1** | Repo **público** con `secret_scanning`, `push_protection`, `validity_checks` y `non_provider_patterns` todos `disabled` | `gh api repos/LABVETNEB/PORTAL-VETNEB` → `security_and_analysis` | Un secreto commiteado queda público e indexado sin detección. Coste de fix: settings, gratis en repos públicos |
| **GAP-P0-2** | Gates funcionales no requeridos: required = `["validate-pr-governance","qga-workflow-security"]` | `gh api .../branches/main/protection`; `docs/ops/CI_PR_CHECKS_RUNBOOK.md` línea 17-18 | 514 tests, typecheck y build pueden fallar sin bloquear merge |
| **GAP-P0-3** | `SECRET_PATTERNS` no cubre el stack: sin Supabase `service_role` JWT / `sb_secret_`, sin `RENDER_API_KEY`, sin SMTP | `scripts/governance/pr-governance-validator.mjs:62-78` | El único control anti-secretos activo es ciego a los secretos reales del proyecto |

## 4.2 P1 — Documentación (0)
Sin P1. Fuerte a nivel de política; débil a nivel de enforcement (ver P2).

## 4.3 P1 — Tests (2)

| ID | Brecha | Evidencia |
|---|---|---|
| GAP-TEST-1 | **29/72 specs E2E (40%) nunca corren en CI**: `extended(24)`, `evidence(2)`, `visual-linux(3)` no aparecen en ningún workflow | `grep e2e:extended .github/workflows/` → vacío; catálogo `], extended` ×24 |
| GAP-TEST-2 | **0 medición de cobertura** sobre 514 tests | `grep -E "c8\|nyc\|istanbul\|--experimental-test-coverage" package.json .github/workflows` → 0 |

Esto contradice la invariante declarada por la propia auditoría rectora: *"la unión de las capas primarias == `e2e:full`"* (`docs/audit/e2e-ci-layering-strategy-audit.md:300`).

## 4.4 P1 — CI (2)

| ID | Brecha | Evidencia |
|---|---|---|
| GAP-CI-1 | Hallazgo original: `qga-workflow-security` era required en GitHub pero faltaba en el runbook. Reconciliado documentalmente el 2026-07-28; el ID se conserva para trazabilidad | `docs/ops/CI_PR_CHECKS_RUNBOOK.md` ahora distingue ambos required globales de los checks funcionales condicionales |
| GAP-CI-2 | `default_workflow_permissions: "write"`, `allowed_actions: "all"`, `sha_pinning_required: false` a nivel repo | `gh api .../actions/permissions{,/workflow}` |

GAP-CI-2 está *compensado* (los 6 workflows declaran `contents: read` y pinnean todo), pero cualquier workflow nuevo que omita `permissions:` hereda `write`.

## 4.5 P1 — Seguridad / tenant (2)

| ID | Brecha | Evidencia |
|---|---|---|
| GAP-SEC-1 | Evidencia runtime cross-tenant CT-01..CT-16 **nunca ejecutada**; matriz RLS en NO-GO | `docs/ops/CROSS_TENANT_SMOKE_EVIDENCE_RUNBOOK.md`; `ERM-SEC-001` abierto |
| GAP-SEC-2 | **RLS nativo 0%**: ADR aceptado, Fase 1 (verificación externa del rol efectivo, `rolsuper`, `rolbypassrls`, pooler) sin ejecutar | `grep -riE "CREATE POLICY\|ROW LEVEL SECURITY" drizzle server scripts` → 0 |

## 4.6 P1 — Datos y DR (2)

| ID | Brecha | Evidencia |
|---|---|---|
| GAP-DATA-1 | Restore drill nunca ejecutado; sin validación schema/smoke post-restore | `ERM-DATA-001`; `BACKUP_RESTORE_ROLLBACK.md` |
| GAP-DR-1 | **RPO/RTO no declarados numéricamente** | `ERM-DR-001` |

## 4.7 P1 — Observabilidad (1)

| ID | Brecha | Evidencia |
|---|---|---|
| GAP-OBS-1 | Logging no estructurado: `logInfo/logWarn/logError` = `console.*` con prefijo string; sin JSON, sin niveles configurables, sin correlación request-id **dentro del logger**, sin redacción en el logger | `server/lib/logger.ts` (22 líneas completas) |

Matiz importante: `serializeError()` **sí devuelve `stack`**. La no-filtración al cliente se garantiza en la capa HTTP (`test/architecture/security/security-response-disclosure-boundaries.test.ts`), no en el logger.

## 4.8 P1 — Dependencias (1)

| ID | Brecha | Evidencia |
|---|---|---|
| GAP-DEP-1 | `dependabot_security_updates: "disabled"` — solo hay *version updates* semanales | `gh api repos/...` → `security_and_analysis` |

Adicional (P2): `dependabot.yml` no declara `directory: /frontend`; con `pnpm-workspace.yaml` apuntando a `frontend`, los manifiestos del frontend pueden quedar fuera del ciclo. Sin `groups:` ni separación de estrategias.

## 4.9 P2 — Resto

| ID | Brecha | Evidencia |
|---|---|---|
| GAP-DOC-1 | 313 archivos en `docs/implementation`, 108 en `docs/audit`, 62 en `docs/pr-history`, 14 sueltos en `docs/` sin metadata de estado por archivo; sin guard automático de SoT/lifecycle | `docs/governance/documentation-lifecycle-policy.md` existe, sin enforcement (`ERM-DOC-001`) |
| GAP-OWN-1 | Bus factor 1: `required_approving_review_count: 0` | API en vivo |
| GAP-ARC-1 | Sin gate ADR/RFC para cambios de boundary | `ERM-ARC-001` |
| GAP-QLT-1 | 0 lint backend (`server/**`, `scripts/**`, `drizzle/**`); frontend con `react-hooks/immutability` y `react-hooks/set-state-in-effect` en `off` | `package.json`; `frontend/eslint.config.mjs:29-32` |
| GAP-QLT-2 | 71% de los tests (367/514) leen código fuente; 134 censos `readdirSync` | Fragilidad estructural: refactors legítimos rompen tests por path |
| GAP-REL-1 | `environments: 0`, `rulesets: 0` | API en vivo |
| GAP-OPS-1 | Sin incident runbook, severidades, comms ni postmortem template | `ERM-OBS-002` |
| GAP-CFG-1 | `allow_merge_commit: true` con `linear_history: true` (estrategia inutilizable); `delete_branch_on_merge: false` | API en vivo |
| GAP-E2E-1 | Playwright con **un solo project (chromium)**: 0 cobertura Firefox/WebKit | `frontend/playwright.config.ts:75-79` |

## 4.10 P2 — Deriva del Enterprise Control Register (hallazgo transversal reconciliado)

La auditoría detectó cuatro divergencias respecto al estado del registro del 2026-07-11:

| Control | Dice el registro (2026-07-11) | Estado real observado hoy |
|---|---|---|
| `ERM-CTRL-009` CODEOWNERS Domain Model, PARTIAL/1 | *"global `* @LABVETNEB` ownership and no path-domain model"* | `.github/CODEOWNERS` tiene modelo por 9 paths + `docs/audit/enterprise-codeowners-domain-model-audit.md`. Lo que falta es *enforcement*, no el modelo |
| `ERM-CTRL-014` Quality Gate Architecture, next action | *"Add impact-aware docs/test taxonomy gate and reduce Actions permissions"* | `quality-gate-impact-{policy,validator}.mjs` existen y están cableados en `pr-governance-validator.mjs:10`; los 6 workflows ya declaran `contents: read` |
| `ERM-CTRL-024` Dependency Governance | *"did not observe … full action pinning"* | 100% de actions pinneadas a SHA + `workflow-security-validator.mjs` con enforcement required |
| Evidencia transversal no registrada | Ninguna fila registra `qga-workflow-security` | Es **required check en producción** (verificado por API); debe integrarse en `ERM-CTRL-013` y `ERM-CTRL-014`, sin crear una capability 26 |

La reconciliación del 2026-07-28 corrigió la evidencia operativa en el registro vigente sin
reescribir este diagnóstico ni los snapshots históricos. Se conservan exactamente 25 master
capabilities.

---

# 5. Enterprise Roadmap

Reglas transversales: un scope por PR; nada de `--fix` masivo; todo PR que toque `.github/**`, `package.json`, `pnpm-lock.yaml`, `server/**`, `drizzle/**` es **R2 y requiere autorización explícita** de Nico en el mensaje de la tarea (AGENTS.md §3).

## Fase 0 — Estabilización documental y confirmación de SoT

| PR | Tipo | Objetivo | Archivos probables | Riesgo | Validaciones | Criterio de merge | Rollback |
|---|---|---|---|---|---|---|---|
| **PR-GOV-1** | docs-only | Registrar en el control register las divergencias de §4.10 e integrar `qga-workflow-security` como evidencia en `ERM-CTRL-013`/`014`, sin capability 26 | `docs/governance/enterprise-control-register.md` | Bajo | `git diff --check`; PR Gov | Registro refleja el árbol real; conserva 25 filas y snapshots históricos intactos | `git revert` |
| **PR-CI-0** | docs-only | Alinear el mapa de checks del runbook con la config real (añadir `qga-workflow-security` como required) | `docs/ops/CI_PR_CHECKS_RUNBOOK.md` | Bajo | PR Gov | Mapa == `gh api .../protection` | `git revert` |
| **PR-SOT-1** | docs-only | Actualizar `SOURCES_OF_TRUTH.md`: `PR-C3` cerrado, añadir esta auditoría, marcar `docs/fix-*`/`docs/audit-*` sueltos | `docs/SOURCES_OF_TRUTH.md`, `docs/HISTORICAL_DOCUMENTATION.md` | Bajo | PR Gov | Todo `docs/` raíz clasificado | `git revert` |
| **PR-DOC-1** | docs-only | Esta auditoría + roadmap como documento rector | `docs/audit/enterprise-repository-maturity-audit-roadmap.md`, `docs/audit/README.md` | Bajo | PR Gov | Enlazado desde índice y SoT | `git revert` |

## Fase 1 — Test architecture y taxonomy

| PR | Tipo | Objetivo | Archivos | Riesgo | Validaciones | Criterio de merge |
|---|---|---|---|---|---|---|
| **PR-TEST-ARCH-1** | docs-only | Auditoría de fragilidad: censo exacto de los 367 tests source-coupled y los 134 `readdirSync`, clasificados en *legítimo* (guard) vs *acoplamiento accidental* | `docs/audit/*` | Bajo | PR Gov | Censo con path exacto y clasificación por test |
| **PR-TEST-ARCH-2** | test-only | Crear `test/fixtures/`, `test/factories/`, `test/mocks/` y migrar los fixtures dispersos (`test/unit/application/report-access/fixtures.ts`, `test/helpers/public-professionals-fixtures.ts`) | `test/**`, `test/README.md` | Medio (rompe imports) | `pnpm typecheck:test`; `pnpm test` | 514 tests PASSED; `test/*.test.ts` = 0 |
| **PR-TEST-ARCH-3** | test-only | Reemplazar censos `readdirSync` no recursivos por helper canónico único | `test/helpers/tracked-source-files.ts`, `test/architecture/**` | Medio | `pnpm validate:local` | Ningún censo depende de raíz plana |

> Bloqueo conocido (memoria del proyecto): el trío `reports/admin-reports/reports-status` sigue anclado por `report-study-types-catalog` (censo por lista hardcodeada + `deepEqual`). Requiere **TEST-ARCH-15-b path-aware** antes de mover esos controllers. No incluir en PR-TEST-ARCH-2/3.

## Fase 2 — CI/CD gates, required checks y branch protection ← **empieza aquí en la práctica**

| PR | Tipo | Objetivo | Archivos | Riesgo | Validaciones | Criterio de merge |
|---|---|---|---|---|---|---|
| **PR-CI-1** | config-only (GitHub settings, sin archivos) | **P0-2**: hacer required `validate-backend` y `validate-frontend`. Requiere resolver el problema de checks condicionales: un check ausente en strict mode bloquea indefinidamente | ninguno (settings) | **Alto** | Canaria positiva (PR docs-only debe mergear) + canaria negativa (PR con test roto debe bloquear) | Ambas canarias con evidencia; ningún PR docs-only queda colgado |
| **PR-CI-2** | ci-only | Prerrequisito de PR-CI-1: convertir backend/frontend CI a *always-run con skip interno* (job que evalúa paths y sale 0 sin trabajo) para que el contexto siempre exista | `.github/workflows/backend-ci.yml`, `frontend-ci.yml` | Medio-alto | Canaria docs-only + canaria backend | Contexto presente en el 100% de PRs |
| **PR-CI-3** | ci-only | Ejecutar `e2e:extended` (24 specs) en CI o en workflow programado; cerrar la invariante *unión == full* | `.github/workflows/frontend-ci.yml` | Medio | `pnpm --dir frontend e2e:extended` local + CI verde | 72/72 specs con ruta de ejecución declarada |
| **PR-CI-4** | config-only | `default_workflow_permissions` → `read`; `sha_pinning_required` → `true`; `allowed_actions` → verified+selected | ninguno (settings) | Medio | Los 6 workflows siguen verdes | Ningún workflow degradado |

## Fase 3 — Security hardening, tenant isolation, RLS, RBAC, IDOR

| PR | Tipo | Objetivo | Archivos | Riesgo | Validaciones | Criterio de merge |
|---|---|---|---|---|---|---|
| **PR-SEC-0** | config-only (GitHub settings) | **P0-1**: activar secret scanning + push protection + validity checks + non-provider patterns | ninguno | Bajo | `gh api repos/...` muestra `enabled`; triaje de alertas históricas | 4 settings `enabled`; alertas históricas triadas |
| **PR-SEC-1** | ci-only | **P0-3**: ampliar `SECRET_PATTERNS` con Supabase (`sb_secret_`, `sb_publishable_`, JWT `service_role`), Render API key, SMTP URL | `scripts/governance/pr-governance-validator.mjs`, `test/unit/infrastructure/*` | Bajo | `pnpm test` dirigido; canaria con secreto falso | Canaria negativa falla; positiva pasa |
| **PR-SEC-2** | docs-only | Decidir y documentar el perfil de exposición del repo público: qué de `docs/security/*` (matrices RBAC/endpoints) debe seguir público | `docs/security/*`, `docs/governance/*` | Bajo | PR Gov | Decisión con owner y fecha |
| **PR-SEC-3** | ops-only | Ejecutar CT-01..CT-16 en staging con evidencia sanitizada | `docs/ops/CROSS_TENANT_SMOKE_EVIDENCE_RUNBOOK.md`, evidencia | Medio (requiere staging) | Runbook ejecutado | Acta con timestamp, commit/deploy, rol responsable, 0 secretos; cierra `ERM-SEC-001` |
| **PR-RLS-1** | docs-only | Fase 1 del ADR: verificación externa del rol DB efectivo (`rolsuper`, `rolbypassrls`, ownership, pooler, transacciones) | `docs/security/rls-enforcement-matrix.md` | Bajo | Consultas de solo lectura a la DB | Matriz con hallazgos reales; GO/NO-GO para diseño de policies |
| **PR-RLS-2** | data-only (R2/R3) | Piloto RLS en **una** tabla tenant-scoped con criterios de entrada/salida del ADR | `drizzle/migrations/00XX_*.sql` | **Alto** | `pnpm validate:local:schema`; smoke cross-tenant | Piloto con rollback probado; **requiere autorización explícita** |

Estado posterior: `PR-SEC-1` y `PR-ARCH-1` fueron consolidados en el bloque 03,
implementados por PR #1593 y cerrados con la matriz de canarias #1594–#1599.
Ver [closeout del bloque 03](./pr-sec-secret-patterns-audit.md).

## Fase 4 — Data governance, backup/restore, RPO/RTO, DR

| PR | Tipo | Objetivo | Archivos | Riesgo | Validaciones | Criterio de merge |
|---|---|---|---|---|---|---|
| **PR-DATA-1** | docs-only | Política de clasificación (clínico / comercial / operativo / auditoría), retención, borrado, base legal | `docs/governance/data-classification-retention-policy.md`, SoT | Bajo | PR Gov | Aprobada, enlazada desde SoT; cierra `ERM-DATA-002` |
| **PR-BACKUP-1** | docs-only | Declarar RPO/RTO numéricos por clase de dato (DB, Storage `reports`, audit log) | `docs/ops/BACKUP_RESTORE_ROLLBACK.md` | Bajo | PR Gov | RPO/RTO con número, no adjetivo |
| **PR-BACKUP-2** | ops-only | Ejecutar restore drill no productivo + validación schema/smoke | evidencia + `docs/ops/*` | Medio | `pnpm schema:verify` post-restore; `pnpm smoke:test` | Acta con duración medida vs RTO objetivo; cierra `ERM-DATA-001`/`ERM-DR-001` |

## Fase 5 — Observabilidad, logging, métricas, SLOs, incidentes

| PR | Tipo | Objetivo | Archivos | Riesgo | Validaciones | Criterio de merge |
|---|---|---|---|---|---|---|
| **PR-OBS-1** | docs-only | Runbook de incidentes: severidades S1–S4, roles, comms, timeline, postmortem template | `docs/ops/INCIDENT_MANAGEMENT_RUNBOOK.md`, SoT | Bajo | PR Gov | Enlazado desde SoT; cierra `ERM-OBS-002` |
| **PR-OBS-2** | backend-only | Logger estructurado JSON con niveles, `requestId` obligatorio y redacción de campos sensibles, preservando la API `logInfo/logWarn/logError` | `server/lib/logger.ts`, `server/middlewares/request-logger.ts`, tests | Medio | `pnpm validate:local`; `security-sensitive-log-redaction-boundaries.test.ts` | Guards de redacción PASSED; sin cambio de comportamiento HTTP |
| **PR-OBS-3** | backend-only | Endpoint `/metrics` o contadores in-process: uptime, 5xx, latencia p50/p95, error rate | `server/routes/*`, `server/lib/*` | Medio | `pnpm validate:local`; guard `no-store` en superficie privada | Métricas del `METRICS_BASELINE.md` expuestas y protegidas |
| **PR-OBS-4** | ops-only | SLOs + alertas + dashboard con thresholds | `docs/ops/METRICS_BASELINE.md` | Bajo | Test de alerta | Alerta dispara y se evidencia; cierra `ERM-OBS-001` |

## Fase 6 — Dependency governance y supply chain

| PR | Tipo | Objetivo | Archivos | Riesgo | Validaciones | Criterio de merge |
|---|---|---|---|---|---|---|
| **PR-DEPS-1** | config-only | Activar `dependabot_security_updates` | ninguno (settings) | Bajo | `gh api` → `enabled` | Alertas de seguridad activas |
| **PR-DEPS-2** | docs-only | Supply-chain policy: cadencia, quién mergea bumps, cómo se separan de PRs funcionales, manejo del caso `actions/checkout` (que rompe anclas de SHA en 2 contratos) | `docs/governance/supply-chain-policy.md` | Bajo | PR Gov | Policy aprobada |
| **PR-DEPS-3** | config-only | `dependabot.yml`: añadir `directory: /frontend`, `groups` por riesgo, separar github-actions | `.github/dependabot.yml` | Bajo | Observar PRs de la siguiente ventana | Frontend cubierto; agrupación efectiva |
| **PR-DEPS-4** | ci-only | SBOM CycloneDX no bloqueante como artifact | `.github/workflows/backend-ci.yml` | Bajo | CI verde | SBOM generado; cierra `ERM-DEP-001` |

## Fase 7 — Release y production readiness

| PR | Tipo | Objetivo | Archivos | Riesgo | Validaciones | Criterio de merge |
|---|---|---|---|---|---|---|
| **PR-REL-1** | config-only | Crear environments `staging` y `production` con deployment protection | ninguno (settings) | Bajo | `gh api .../environments` → `total_count >= 2` | Cierra `ERM-REL-001` |
| **PR-REL-2** | docs-only | Evidence archive: dónde vive la evidencia de cada release y por cuánto tiempo | `docs/release/*` | Bajo | PR Gov | Enlazado desde go/no-go |
| **PR-REL-3** | ops-only | Rollback probado end-to-end (no solo documentado) | evidencia | Medio | `smoke:prod:public` post-rollback | Acta con tiempo medido |

## Fase 8 — Quality engineering system

| PR | Tipo | Objetivo | Archivos | Riesgo | Validaciones | Criterio de merge |
|---|---|---|---|---|---|---|
| **PR-QUALITY-1** | config-only (R2) | Cobertura vía `node --test --experimental-test-coverage`, **sin threshold**, script `test:coverage` separado de `test` | `package.json` | Medio (R2) | `pnpm test` intacto; `pnpm test:coverage` genera reporte | Baseline publicado; `pnpm test` sin cambios; cierra `ERM-TST-001` |
| **PR-QUALITY-2** | config-only (R2) | Lint backend con baseline y **0 autofix** sobre `server/**`, `scripts/**`, `drizzle/**` | `package.json`, `eslint.config.mjs` raíz | Medio-alto | `pnpm lint:backend` local | Findings baseline documentados, 0 archivos reformateados; cierra `ERM-BE-001` |
| **PR-QUALITY-3** | docs-only | Technical debt register (incluye las 2 reglas react-hooks desactivadas y los 367 tests source-coupled) | `docs/governance/technical-debt-register.md` | Bajo | PR Gov | Cada deuda con owner y trigger de revisión |
| **PR-ARCH-1** | ci-only | Gate ADR/RFC: PR que toca `server/**` estructural, `drizzle/**` o `.github/workflows/**` debe enlazar ADR/RFC o justificar `not applicable` | `scripts/governance/pr-governance-validator.mjs`, PR template | Medio | Canaria positiva + negativa | Cierra `ERM-ARC-001` |
| **PR-OWNERS-1** | docs-only | Documentar explícitamente el riesgo de bus factor 1 y el disparador para pasar a review independiente | `docs/governance/ownership-model.md` | Bajo | PR Gov | Trigger de reasignación definido |

## Fase 9 — Enterprise closeout

| PR | Tipo | Objetivo |
|---|---|---|
| **PR-GOV-2** | docs-only | Matriz de trazabilidad `ERM-CTRL-* → gap → PR → evidencia → fecha` |
| **PR-GOV-3** | docs-only | Actualizar los 25 controles con evidencia post-roadmap |
| **PR-DOC-2** | docs-only | Declaración de 100% enterprise contra el checklist de §9 |

---

# 6. Validation Matrix

Solo scripts **verificados en `package.json` / `frontend/package.json`**. Ningún script inventado.

| Tipo de cambio | Comandos obligatorios | Comandos condicionales | No disponible |
|---|---|---|---|
| **docs-only** | `git diff --check`; `git diff --name-only` | — | Link checker standalone → **script no disponible** (la validación de links vive dentro de `pr-governance-validator.mjs`, que requiere `GITHUB_EVENT_PATH`) |
| **test-only** | `pnpm typecheck:test`; `pnpm test` | `pnpm validate:local` si toca tipos compartidos | Cobertura → **script no disponible** |
| **backend-only** | `pnpm validate:local` (= `typecheck && typecheck:test && test && build`) | `pnpm security:public-surface` si toca superficie pública | Lint backend → **script no disponible** |
| **schema/migrations** | `pnpm validate:local:schema` (incluye `schema:verify`) | `pnpm db:migrate` → normalmente **BLOCKED** local sin DB | — |
| **frontend no visual** | `pnpm --dir frontend lint`; `pnpm --dir frontend typecheck`; `pnpm --dir frontend build`; `pnpm security:public-surface` | — | Unit tests frontend → **no disponible** (0 tests) |
| **frontend visual** | los 4 anteriores + cohorte de §7 AGENTS.md | `pnpm --dir frontend e2e:visual-contract`; `e2e:admin-mobile`; `e2e:public-clinic`; `e2e:smoke`; `e2e:extended`; `e2e:affected` | Cross-browser → **no disponible** (Playwright con un solo project) |
| **e2e / catálogo** | `pnpm --dir frontend e2e:verify-catalog` | `pnpm --dir frontend e2e:verify-teardown`; `e2e:compare-visual-artifacts` | — |
| **ci-only / workflows** | `node scripts/governance/workflow-security-validator.mjs` | `pnpm test` dirigido a `test/unit/infrastructure/workflow-security-*` | Verificación real solo en CI (QGA required) |
| **dependencias / lockfile (R2)** | `pnpm audit --prod`; `pnpm audit`; gates funcionales del dominio | `pnpm validate:local` | SBOM / license gate → **no disponible** |
| **release / ops** | `node scripts/ops/verify-production-readiness.mjs`; `pnpm smoke:prod:public` | `pnpm smoke:test`; `pnpm smoke:upload`; `pnpm smoke:staging` | Restore drill → **procedimiento manual, script no disponible** |

**Estado de ejecución en esta auditoría: NOT_RUN para todos.** Ningún gate fue ejecutado — la tarea es exclusivamente lectura. No declaro cobertura equivalente a CI.

**Higiene obligatoria post-E2E** (AGENTS.md §7): revertir `frontend/next-env.d.ts`; borrar `frontend/.next` si se editó CSS global con el dev server caído; 0 artefactos `playwright-report/` o `test-results/` en el diff.

---

# 7. Risk Register

| ID | Riesgo | Categoría | Sev | Prob | Mitigación existente | Mitigación propuesta | Owner sugerido |
|---|---|---|---|---|---|---|
| R-01 | Secreto commiteado a repo público sin detección | Seguridad | **Crítica** | Media | `SECRET_PATTERNS` (PR-only, added-lines-only, 9 patrones) | PR-SEC-0 + PR-SEC-1 | Security owner |
| R-02 | Código con tests rojos entra a `main` | CI / calidad | **Crítica** | Media | Disciplina manual + AGENTS.md §6 | PR-CI-1 + PR-CI-2 | CI owner |
| R-03 | Fuga cross-tenant por bug aplicativo sin RLS que la contenga | Seguridad / datos | **Crítica** | Baja | Scoping aplicativo + `security-cross-tenant-idor-contract.test.ts` + 17 guards | PR-RLS-1 → PR-RLS-2 + PR-SEC-3 | Security / Backend |
| R-04 | Backup irrecuperable en incidente real | Datos | **Crítica** | Baja | Runbook documentado | PR-BACKUP-2 (drill real) | DBA / DevOps |
| R-05 | Degradación productiva no detectada | Observabilidad | Alta | **Alta** | `x-request-id` + smoke manual | PR-OBS-2/3/4 | DevOps / Backend |
| R-06 | Regresión en los 29 specs E2E fuera de CI | Testing | Alta | **Alta** | Catálogo tipado con criticidad | PR-CI-3 | QA owner |
| R-07 | Bus factor 1 | Operativo | Alta | Media | CODEOWNERS + `enforce_admins: true` | PR-OWNERS-1 | Tech lead |
| R-08 | CVE conocido sin PR automático de fix | Dependencias | Alta | Media | `pnpm audit` en cada Backend CI | PR-DEPS-1 | Security |
| R-09 | Refactor legítimo bloqueado por 367 tests source-coupled | Testing / mantenibilidad | Media | **Alta** | Convención documentada en `test/README.md` | PR-TEST-ARCH-1/3 | QA / Backend |
| R-10 | Control register desactualizado induce retrabajo | Governance | Media | **Alta** | Cadencias de revisión declaradas | PR-GOV-1 | Engineering governance |
| R-11 | Workflow nuevo hereda `permissions: write` | CI / supply chain | Media | Media | Los 6 actuales declaran `contents: read`; QGA valida | PR-CI-4 | CI / Security |
| R-12 | Bug solo en Firefox/WebKit no detectado | Testing / frontend | Media | Media | Ninguna | Añadir projects (fuera de este roadmap; requiere decisión de coste CI) | Frontend / QA |
| R-13 | Deploy productivo sin approval gate | Release | Media | Media | Go/no-go documental + version gate | PR-REL-1 | Release owner |
| R-14 | Documento histórico usado como fuente normativa | Documentación | Media | Media | SoT + `HISTORICAL_DOCUMENTATION.md` | PR-DOC guard (`ERM-DOC-001`) | Docs owner |
| R-15 | Incidente gestionado sin severidad ni postmortem | Operación | Media | Media | Rollback runbook | PR-OBS-1 | DevOps / Tech lead |

---

# 8. Source-of-Truth Update Plan

## Canónicos — mantener y actualizar

| Documento | Rol | Acción |
|---|---|---|
| `AGENTS.md` | Contrato operativo, precedencia máxima | Sin cambios |
| `docs/SOURCES_OF_TRUTH.md` | Mapa por dominio | Reconciliado por `PR-AUDIT-ENTERPRISE-DOCS`: precedencia Plan B, deuda técnica y documentos sueltos clasificados |
| `docs/governance/enterprise-control-register.md` | Estado operativo vivo de los 25 controles | Reconciliado por `PR-AUDIT-ENTERPRISE-DOCS`: evidencia de §4.10 integrada sin capability 26 |
| `docs/audit/README.md` | Índice de auditorías activas | **PR-DOC-1**: añadir esta auditoría |
| `docs/ops/CI_PR_CHECKS_RUNBOOK.md` | Mapa de checks | Reconciliado por `PR-AUDIT-ENTERPRISE-DOCS`: required globales, checks condicionales e integración externa diferenciados |
| `test/README.md` | Índice de suite (bloque autogenerado) | Regenerar solo si cambia `quality-gate-impact-policy.mjs` |
| `docs/architecture/rls-tenant-isolation-adr.md` | Decisión RLS (Accepted) | Actualizar tras PR-RLS-1 |
| `docs/governance/documentation-lifecycle-policy.md` | Ciclo de vida documental | Activar enforcement (`ERM-DOC-001`) |
| Wave 0 (4 auditorías) + 4 rectores (`total-*`, `design-system-contract`) | Fuentes rectoras por dominio | Sin cambios |

## Históricos aprobados — congelados

`docs/audit/enterprise-repository-maturity-baseline.md` y `docs/audit/enterprise-repository-gap-register.md`. **Nunca reescribir.** Esta auditoría es un snapshot posterior e independiente; las divergencias se registran en el control register, no reescribiendo el snapshot.

## Requieren índice — no leer por defecto

| Path | Archivos | Acción |
|---|---:|---|
| `docs/implementation/` | 313 | Índice con estado por archivo (vigente / secundario / histórico) |
| `docs/audit/` | 108 | Solo 10 son vigentes; los otros 98 necesitan marca explícita |
| `docs/pr-history/` | 62 | Marcar la carpeta completa como histórica en un único header |
| `docs/` raíz | 14 sueltos | Clasificar `fix-*`, `audit-*`, `production-*`, `smoke-*`, `legal-*`, `entrega-*` |

## No leer por defecto (histórico confirmado)

`docs/archive/**`, `docs/pr-history/**`, `docs/notes/todo.md`, `docs/production-readiness-snapshot-2026-05-27.md`, todos los `AUDIT_*` / `DASHBOARD_*_PLAN` mayúsculas ex-`docs/audits/`.

## Regla estructural propuesta

Todo `.md` bajo `docs/` debe declarar frontmatter con `status: vigente|secundario|histórico|superseded`, `owner`, `verification_date` y `supersedes`. Sin eso, el enforcement de `ERM-DOC-001` no es implementable de forma machine-checkable.

---

# 9. Definition of Done for 100% Enterprise Repository

Checklist medible. Cada línea verificable con un comando o una llamada de API.

**Seguridad (11)**
- [ ] `gh api repos/... --jq .security_and_analysis` → `secret_scanning`, `push_protection`, `validity_checks`, `non_provider_patterns` = `enabled`
- [ ] `dependabot_security_updates` = `enabled`
- [ ] `SECRET_PATTERNS` cubre Supabase (`sb_secret_`, JWT `service_role`), Render, SMTP; con test de canaria
- [ ] CT-01..CT-16 ejecutados con acta sanitizada (timestamp, commit/deploy, rol) → `ERM-SEC-001` cerrado
- [ ] `rls-enforcement-matrix.md` en GO o NO-GO con verificación externa del rol DB ejecutada
- [ ] RLS piloto en ≥1 tabla tenant-scoped con rollback probado, o decisión formal de no implementar con controles compensatorios evidenciados
- [ ] `admin_session_id` / `app_session_id` con guard activo (ya cumplido)
- [ ] 0 stack traces al cliente, verificado por guard (ya cumplido)
- [ ] Signed URLs y Storage privado con evidencia runtime
- [ ] Matrices RBAC / endpoints / CSP sin drift (guard activo — ya cumplido)
- [ ] Perfil de exposición del repo público decidido y documentado

**CI/CD y quality gates (7)**
- [ ] `required_status_checks.contexts` incluye `validate-backend` y `validate-frontend`
- [ ] Canaria negativa: PR con test roto **no** mergea, con evidencia de run
- [ ] Canaria positiva: PR docs-only mergea sin quedar colgado
- [ ] `default_workflow_permissions` = `read`; `sha_pinning_required` = `true`
- [ ] 100% de actions pinneadas a SHA (ya cumplido)
- [ ] Runbook de checks == `gh api .../protection` (verificable por diff)
- [ ] `allow_merge_commit` coherente con `linear_history`

**Testing (6)**
- [ ] `test/*.test.ts` = 0 (ya cumplido)
- [ ] 72/72 specs E2E con ruta de ejecución declarada en algún workflow
- [ ] `pnpm test:coverage` existe y publica baseline
- [ ] `test/fixtures|factories|mocks` existen y centralizan el soporte compartido
- [ ] Censos de arquitectura con helper canónico único, 0 `readdirSync` no recursivos ad-hoc
- [ ] Frontend con ≥1 capa de test no-E2E, o decisión formal de no tenerla

**Datos y DR (5)**
- [ ] Política de clasificación y retención aprobada y enlazada desde SoT
- [ ] RPO/RTO numéricos por clase de dato
- [ ] Restore drill ejecutado con `schema:verify` + smoke y duración medida vs RTO
- [ ] Audit trail con retención declarada
- [ ] Migraciones con procedimiento de rollback documentado por migración

**Observabilidad y operación (5)**
- [ ] Logging estructurado JSON con `requestId` y redacción en el logger
- [ ] Métricas uptime / 5xx / latencia p95 / error rate expuestas
- [ ] SLOs con thresholds y ≥1 alerta con prueba de disparo
- [ ] Incident runbook con severidades, comms y postmortem template, ejercitado en tabletop
- [ ] Dashboard operativo con evidencia sanitizada

**Release y dependencias (5)**
- [ ] `gh api .../environments` → `total_count ≥ 2` con deployment protection
- [ ] Go/no-go ejecutado con evidencia archivada por release
- [ ] Rollback probado end-to-end con tiempo medido
- [ ] SBOM generado por build como artifact
- [ ] Supply-chain policy aprobada con cadencia y ownership

**Governance y calidad (6)**
- [ ] Los 25 controles `IMPLEMENTED` o con `NOT_APPLICABLE` justificado, owner y fecha ≤90 días
- [ ] Matriz de trazabilidad control → gap → PR → evidencia completa
- [ ] Guard de SoT/lifecycle activo con canaria (`ERM-DOC-001`)
- [ ] Gate ADR/RFC activo con canaria (`ERM-ARC-001`)
- [ ] Lint backend con baseline y 0 reformateo masivo
- [ ] Technical debt register con owner y trigger por entrada

**Total: 45 criterios. Cumplidos hoy: 5 (11%).**

---

# 10. Next 10 PRs Recommended

Orden por reducción de riesgo por unidad de esfuerzo y por dependencia técnica.

Esta lista preserva la recomendación granular del roadmap original. Para ejecución vigente por
bloques prevalece el [Plan B de 18 PRs](./enterprise-roadmap-consolidation-plan.md).

| # | PR | Tipo | Razón | Riesgo | Validación mínima |
|---:|---|---|---|---|---|
| 1 | **PR-SEC-0** | config-only (GitHub settings) | **P0-1**. Repo público con secret scanning off. Gratis, minutos, sin código. Máxima relación impacto/coste del inventario | Bajo | `gh api repos/... --jq .security_and_analysis` = 4× `enabled`; triaje de alertas históricas |
| 2 | **PR-CI-0** | docs-only | El runbook omite un required check real. Sin esto, toda decisión de CI parte de un mapa falso. Habilita #4 y #5 | Bajo | `git diff --check`; mapa == salida de `gh api .../protection` |
| 3 | **PR-SEC-1** | ci-only | **P0-3**. El único control anti-secretos activo es ciego a Supabase/Render/SMTP. Complementa #1 sin depender de él | Bajo | `pnpm test` dirigido a `test/unit/infrastructure/pr-governance-*`; canaria con secreto falso |
| 4 | **PR-CI-2** | ci-only | Prerrequisito técnico de #5: los checks condicionales deben existir siempre para poder ser required en strict mode | Medio-alto | Canaria docs-only (contexto presente, sale 0) + canaria backend (corre completo) |
| 5 | **PR-CI-1** | config-only (GitHub settings) | **P0-2**. Cierra el agujero de merge integrity: 514 tests pasan a bloquear el merge | **Alto** | Canaria negativa (test roto → merge bloqueado) + positiva (docs-only → mergea) |
| 6 | **PR-GOV-1** | docs-only | Corrige las 4 divergencias de §4.10. Sin esto, el control register induce retrabajo en todo el roadmap | Bajo | PR Gov; 25 filas, IDs intactos, snapshots históricos sin tocar |
| 7 | **PR-DEPS-1** | config-only (GitHub settings) | `dependabot_security_updates: disabled` con `pnpm audit` corriendo en cada Backend CI = detección sin remediación automática | Bajo | `gh api repos/...` → `enabled`; observar la siguiente ventana semanal |
| 8 | **PR-CI-3** | ci-only | 29 specs (40%) sin ejecución. Cierra la invariante *unión == full* que la propia auditoría rectora declara | Medio | `pnpm --dir frontend e2e:extended` local PASSED; CI verde; `e2e:verify-catalog` |
| 9 | **PR-QUALITY-1** | config-only (R2 — requiere autorización) | 514 tests sin saber qué cubren. Sin threshold, script separado, `pnpm test` intacto | Medio | `pnpm test` sin cambio de comportamiento; `pnpm test:coverage` genera reporte; baseline publicado |
| 10 | **PR-BACKUP-2** | ops-only | Backup no probado no es backup. Único P1 de datos ejecutable sin tocar producción | Medio | `pnpm schema:verify` post-restore PASSED; `pnpm smoke:test`; acta con duración vs RTO |

**Los PRs #1, #5 y #7 no tocan ningún archivo** — son cambios de configuración de GitHub que Nico ejecuta desde la UI o `gh api`. No requieren rama, PR ni merge, pero sí evidencia registrada en el control register (PR-GOV-1 puede absorberla).

---

## Estado final de esta tarea

- **Qué se hizo**: auditoría de solo lectura de 25 ejes, con inspección local (1887 archivos rastreados) y verificación externa de solo lectura vía `gh api` (branch protection, environments, rulesets, Actions permissions, security settings).
- **Archivos modificados**: **ninguno**. `git status --short` vacío antes y después.
- **Validaciones**: todas **NOT_RUN** — ningún gate ejecutado por diseño de la tarea. No declaro cobertura equivalente a CI.
- **Exclusiones respetadas**: 0 escrituras, 0 comandos git de escritura, 0 `gh` de escritura, 0 lectura de `.env`/`.env.*`/secretos/dumps. `.env.example` no fue abierto.
- **Estado final**: `main` limpio en `db1da94`.

### Pendiente [MANUAL-NICO]

Ninguno para esta auditoría. Si querés que esto quede como documento rector en la rama `docs/enterprise-repository-maturity-audit-roadmap`, decímelo y lo escribo como **PR-DOC-1 (docs-only)** en `docs/audit/enterprise-repository-maturity-audit-roadmap.md` con actualización de `docs/audit/README.md` y `docs/SOURCES_OF_TRUTH.md` — eso sí requiere tu autorización de escritura, que esta tarea excluía explícitamente.
