# Enterprise Repository Maturity Baseline

## 1. Metadata

| Campo | Valor |
| --- | --- |
| Auditoria | PR-ERM-1 - Enterprise Repository Maturity Baseline |
| Repositorio | `C:\PORTAL-VETNEB` |
| Remoto observado | `https://github.com/LABVETNEB/PORTAL-VETNEB.git` |
| Rama activa | `audit/enterprise-repository-maturity-baseline` |
| HEAD base observado | `193e94c6648b7dc5071a081ced47f8dfdf776fb7` |
| Base esperada | `main@193e94c6648b7dc5071a081ced47f8dfdf776fb7` |
| Fecha de observacion | 2026-07-10 |
| Entorno | Windows + PowerShell + PNPM |
| Modelo | Codex (GPT-5) |
| Esfuerzo | Maximo disponible segun solicitud |
| Tipo de trabajo | Auditoria read-only con salida docs-only |
| Archivos autorizados | `docs/audit/enterprise-repository-maturity-baseline.md`, `docs/audit/enterprise-repository-gap-register.md` |

## 2. Alcance

[OBSERVED] Esta auditoria inspecciona evidencia local y GitHub read-only para establecer la linea base de madurez empresarial del repositorio VETNEB.

[OBSERVED] Se evaluan los 16 ejes solicitados, las 25 capacidades maestras, controles locales de documentacion/codigo/testing/CI/seguridad/datos/operacion y configuraciones externas GitHub verificables via `gh api` GET.

[OBSERVED] La auditoria incluye el caso PR #1435, `docs(test): align normative taxonomy with consolidated suite`, mergeado a `main` el 2026-07-10.

## 3. Fuera de alcance

[OBSERVED] No se implementaron correcciones.

[OBSERVED] No se modificaron backend, frontend, API, auth, sesiones, DB, schema, migraciones, tests, workflows, dependencias, lockfiles, configuracion productiva ni documentacion existente.

[OBSERVED] No se ejecutaron comandos destructivos, stage, commit, push, PR ni merge.

[OBSERVED] No se instalaron paquetes.

## 4. Metodologia

[OBSERVED] Verificacion inicial obligatoria:

| Comando | Resultado resumido | Fecha | Limitacion |
| --- | --- | --- | --- |
| `git branch --show-current` | `audit/enterprise-repository-maturity-baseline` | 2026-07-10 | Sin limitacion |
| `git rev-parse HEAD` | `193e94c6648b7dc5071a081ced47f8dfdf776fb7` | 2026-07-10 | Sin limitacion |
| `git status --short --untracked-files=all` | Sin salida; working tree limpio | 2026-07-10 | Sin limitacion |
| `git diff --check` | Sin salida; limpio | 2026-07-10 | Sin limitacion |
| `git worktree list` | Worktree actual en la rama requerida; worktree adicional `C:/PORTAL-VETNEB-e2e-extended-fixes` | 2026-07-10 | Worktree adicional no tocado |
| `gh pr list --state open` | Sin salida | 2026-07-10 | Repositorio visible para el token activo |

[OBSERVED] Evidencia local inspeccionada con `rg`, `Get-ChildItem`, `Get-Content`, `Test-Path` y `git`.

[OBSERVED] Evidencia GitHub inspeccionada con `gh pr view` y `gh api` GET sobre branch, branch protection, rulesets, Actions permissions, environments, workflows, check-runs, statuses, reviews y archivos del PR #1435.

[OBSERVED] No se leyeron `.env` ni `.env.*`; solo se verifico existencia y referencias a `.env.example` mediante documentacion y comandos permitidos.

## 5. Limitaciones

[NOT_VERIFIED] No se verificaron politicas de organizacion GitHub fuera del alcance del repositorio si no estan expuestas por endpoints de repo.

[NOT_VERIFIED] No se verificaron configuraciones de Render, Supabase, DNS, vault, secretos, branch protection historica ni deployment protection fuera de lo que `gh api` expone.

[NOT_VERIFIED] No se ejecuto runtime, staging, produccion, smokes autenticados ni tests; el trabajo solicitado fue auditoria read-only.

[OBSERVED] `render.yaml` no existe en la raiz (`Test-Path render.yaml` devolvio `False`).

## 6. Escala de madurez

| Nivel | Definicion |
| ---: | --- |
| 0 | Inexistente |
| 1 | Ad hoc |
| 2 | Documentado |
| 3 | Implementado |
| 4 | Automatizado y medido |
| 5 | Auditado, ensayado y con evidencia vigente |

Estados permitidos usados: `IMPLEMENTED`, `PARTIAL`, `DOCUMENTED_ONLY`, `NOT_IMPLEMENTED`, `NOT_VERIFIED`, `NOT_APPLICABLE`.

## 7. Resumen ejecutivo

[OBSERVED] El repositorio tiene una base tecnica relevante: estructura backend/frontend/DB/testing, 420 tests backend bajo `test/**/*.test.ts`, 70 specs Playwright bajo `frontend/e2e`, 31 migraciones SQL, scripts de validacion, workflows backend/frontend, PR template, CODEOWNERS, Dependabot y documentacion reciente de governance, QA, release, seguridad, source-of-truth y backup/restore.

[OBSERVED] La madurez empresarial no esta cerrada porque los controles de gobierno criticos no estan aplicados externamente: `main` no esta protegido, no hay rulesets, no hay required checks, no hay required reviews, no hay environments, Actions tiene permisos default `write` y no hay sha pinning requerido.

[OBSERVED] El caso PR #1435 demuestra la brecha: un PR docs/test pudo mergearse con cero GitHub Actions runs, cero statuses, solo un check externo `Supabase Preview` en `skipped`, sin required positive check y sin branch protection.

[INFERRED] El perfil actual es "engineering-heavy, governance-light": hay mucho trabajo tecnico y documental, pero faltan enforcement externo, medicion, evidencia runtime/staging y controles de supply chain/observabilidad/DR para declarar nivel enterprise.

## 8. Dictamen global

[INFERRED] Dictamen: madurez empresarial parcial, no enterprise-grade declarable.

[INFERRED] Nivel global estimado: 2.4/5. La cifra es ordinal y explicativa, no porcentaje de cumplimiento.

[OBSERVED] Controles evaluados: 25 capacidades maestras.

Distribucion por estado de las 25 capacidades:

| Estado | Cantidad |
| --- | ---: |
| IMPLEMENTED | 2 |
| PARTIAL | 18 |
| DOCUMENTED_ONLY | 4 |
| NOT_IMPLEMENTED | 1 |
| NOT_VERIFIED | 0 |
| NOT_APPLICABLE | 0 |

## 9. Scorecard de los 16 ejes

| # | Eje | Estado | Madurez | Evidencia principal | Riesgo principal |
| ---: | --- | --- | ---: | --- | --- |
| 1 | Enterprise Repository Governance | PARTIAL | 2 | `AGENTS.md`, `docs/governance/*`, `docs/SOURCES_OF_TRUTH.md`; branch protection ausente | Gobierno documentado sin enforcement externo |
| 2 | Source-of-Truth and Documentation Governance | PARTIAL | 3 | `docs/SOURCES_OF_TRUTH.md`, `docs/HISTORICAL_DOCUMENTATION.md`, `docs/audit/README.md` | Documentacion historica abundante y mixta |
| 3 | Change Control and Pull Request Governance | PARTIAL | 2 | `.github/PULL_REQUEST_TEMPLATE.md`, `docs/review-governance.md`; PR #1435 | Checks/reviews no obligatorios |
| 4 | Code and Operational Ownership | PARTIAL | 2 | `.github/CODEOWNERS`, `docs/governance/ownership-model.md` | CODEOWNERS global, no domain model efectivo |
| 5 | Software Architecture Governance | PARTIAL | 3 | `docs/architecture/backend-boundary-adr.md`, architecture tests | Templates ADR/RFC no gateados |
| 6 | Backend Enterprise Governance | PARTIAL | 3 | `server/**`, `package.json`, backend CI, security tests | Sin lint backend ni cobertura medida |
| 7 | Frontend Enterprise Governance | PARTIAL | 3 | `frontend/package.json`, frontend CI, Playwright E2E | Sin enforcement branch protection; E2E no requerido externamente |
| 8 | Enterprise Test Architecture | IMPLEMENTED | 3 | `test/README.md`, 420 tests backend, 70 E2E specs | Cobertura y mutation no medidos |
| 9 | CI/CD and Quality Gate Governance | PARTIAL | 2 | `.github/workflows/backend-ci.yml`, `frontend-ci.yml`, manual visual workflow | CI existe pero no es required check |
| 10 | Security Governance and Hardening | PARTIAL | 3 | `docs/security/*`, security tests, CSP/CORS/rate limit/session code | Evidencia runtime cross-tenant pendiente |
| 11 | Database and Data Governance | PARTIAL | 2 | `drizzle/schema.ts`, migrations, `schema:verify`, data docs | RLS nativo ausente; restore pendiente |
| 12 | Backup, Restore and Disaster Recovery | PARTIAL | 2 | `docs/ops/BACKUP_RESTORE_ROLLBACK.md` | Restore drill no ejecutado/evidenciado |
| 13 | Observability and Operations | PARTIAL | 2 | request IDs, logs, `docs/ops/METRICS_BASELINE.md` | Metrics/alerts/tracing/SLO docs-only o ausentes |
| 14 | Release and Production Readiness | PARTIAL | 2 | `docs/release/*`, `scripts/smoke/*`, app-version manual workflow | Environments/deployment protection ausentes |
| 15 | Dependency and Supply Chain Governance | PARTIAL | 2 | Dependabot, lockfile, `pnpm audit` in backend CI | Sin SBOM/provenance/pinning completo |
| 16 | Quality Engineering and Maintainability | PARTIAL | 2 | Tests, frontend lint, docs audit | Sin coverage, backend lint, complexity/dup/dead-code gates |

## 10. Evaluacion de las 25 capacidades maestras

| # | Capacidad maestra | Estado | Madurez | Evidencia | Observacion |
| ---: | --- | --- | ---: | --- | --- |
| 1 | Enterprise Repository Governance | PARTIAL | 2 | `AGENTS.md`, `docs/governance/README.md` | [OBSERVED] Base documental fuerte; [OBSERVED] branch protection ausente |
| 2 | Operational Repository Architecture | PARTIAL | 3 | top-level dirs `server`, `frontend`, `drizzle`, `test`, `scripts`, `docs` | [OBSERVED] Arquitectura operativa clara; [OBSERVED] `render.yaml` ausente |
| 3 | Repository Maturity Model | DOCUMENTED_ONLY | 2 | `docs/audit/vetneb-enterprise-engineering-readiness-audit.md`, roadmaps | [OBSERVED] Hay auditorias previas; [NOT_VERIFIED] no hay medicion automatizada de madurez |
| 4 | Source-of-Truth Management | PARTIAL | 3 | `docs/SOURCES_OF_TRUTH.md:1-101` | [OBSERVED] Mapa vigente; [OBSERVED] documentos mixtos requieren disciplina humana |
| 5 | Documentation Governance | PARTIAL | 3 | `docs/HISTORICAL_DOCUMENTATION.md:34-45`, `docs/governance/*` | [OBSERVED] Clasificacion historica existe; [OBSERVED] no hay gate automatico |
| 6 | Change Control Governance | PARTIAL | 2 | `.github/PULL_REQUEST_TEMPLATE.md:1-36`, `docs/review-governance.md:1-28` | [OBSERVED] Template y reglas; [OBSERVED] no requeridas externamente |
| 7 | Single-Scope Pull Request Policy | DOCUMENTED_ONLY | 2 | `docs/governance/pr-readiness-review-checklist.md:16-27` | [OBSERVED] Politica documentada; [NOT_VERIFIED] no enforcement automatico |
| 8 | Code Ownership Governance | PARTIAL | 2 | `.github/CODEOWNERS:1`, `docs/governance/ownership-model.md:21-35` | [OBSERVED] Global owner; [OBSERVED] ownership por dominio es documental |
| 9 | CODEOWNERS Domain Model | PARTIAL | 1 | `.github/CODEOWNERS:1` | [OBSERVED] `* @LABVETNEB`; no modelo por paths |
| 10 | Architecture Boundary Enforcement | PARTIAL | 3 | `test/architecture/**`, `docs/architecture/backend-boundary-adr.md` | [OBSERVED] Guards existen; [NOT_VERIFIED] no required gate externo |
| 11 | Enterprise Test Architecture | IMPLEMENTED | 3 | `test/README.md:1-151`, 420 tests backend | [OBSERVED] Taxonomia implementada fisicamente |
| 12 | Test Suite Taxonomy | IMPLEMENTED | 3 | `docs/implementation/test-suite-enterprise-organization-convention.md`, `test/README.md` | [OBSERVED] Convencion adoptada post TEST-ARCH |
| 13 | CI/CD Pipeline Governance | PARTIAL | 2 | `.github/workflows/backend-ci.yml`, `frontend-ci.yml`, `app-version-force-update.yml` | [OBSERVED] Workflows activos; [OBSERVED] no required checks |
| 14 | Quality Gate Architecture | PARTIAL | 2 | `package.json:21-25`, `frontend/package.json:10-19`, CI workflows | [OBSERVED] Gates scriptados; [OBSERVED] no protegen todos los merges |
| 15 | Branch Protection Governance | NOT_IMPLEMENTED | 0 | `gh api repos/.../branches/main` -> `protected:false` | [OBSERVED] Branch protection y required checks ausentes |
| 16 | Security Hardening Program | PARTIAL | 3 | `docs/security/*`, `test/security/**`, server middlewares | [OBSERVED] Controles implementados parcialmente; [OBSERVED] runtime evidence pendiente |
| 17 | Tenant Isolation Governance | PARTIAL | 3 | `docs/security/rls-enforcement-matrix.md:67-82`, security tests | [OBSERVED] Enforcement aplicativo y matrices; [OBSERVED] smoke A/B pendiente |
| 18 | RLS Governance | DOCUMENTED_ONLY | 2 | `docs/security/rls-enforcement-matrix.md`; `rg CREATE POLICY` sin resultados | [OBSERVED] No hay RLS nativo PostgreSQL observable |
| 19 | Data Governance Framework | PARTIAL | 2 | `drizzle/schema.ts`, migrations, `scripts/schema-verify.mjs` | [OBSERVED] Schema/migraciones; [INFERRED] data lifecycle incompleto |
| 20 | Backup/Restore Drill Program | PARTIAL | 2 | `docs/ops/BACKUP_RESTORE_ROLLBACK.md:271-421` | [OBSERVED] Backup/export documentados; [OBSERVED] restore drill pendiente |
| 21 | Observability Baseline | PARTIAL | 2 | `server/lib/api-request-id.ts`, `server/middlewares/request-logger.ts`, `docs/ops/METRICS_BASELINE.md` | [OBSERVED] Request IDs/logging; [OBSERVED] metrics baseline docs-only |
| 22 | Incident Management Runbook | DOCUMENTED_ONLY | 2 | `docs/ops/BACKUP_RESTORE_ROLLBACK.md`, `docs/release/release-go-no-go-policy.md` | [OBSERVED] Rollback/runbooks; [NOT_VERIFIED] incident drills/postmortems |
| 23 | Release Readiness Review | PARTIAL | 2 | `docs/release/*`, `scripts/smoke/*`, app-version workflow | [OBSERVED] Checklist/scripts; [OBSERVED] no GitHub environments |
| 24 | Dependency Governance | PARTIAL | 2 | `.github/dependabot.yml`, `pnpm-lock.yaml`, backend CI audit step | [OBSERVED] Dependabot/audit; [OBSERVED] no SBOM/provenance/sha pinning required |
| 25 | Quality Engineering System | PARTIAL | 2 | `pnpm test`, frontend lint, QA docs | [OBSERVED] Tests abundantes; [OBSERVED] coverage/backend lint/mutation ausentes |

## 11. Evidencia por eje

### 11.1 Enterprise Repository Governance

[OBSERVED] `AGENTS.md` define protocolo operativo, restricciones de scope, seguridad, git y validaciones.

[OBSERVED] `docs/governance/README.md:7-9` declara base documental de gobernanza docs-only y explicita que no modifica CODEOWNERS, CI, workflows ni runtime.

[OBSERVED] `gh api repos/LABVETNEB/PORTAL-VETNEB/branches/main` devolvio `protected:false`.

[INFERRED] La gobernanza existe como proceso/documento, pero no como control externo obligatorio.

### 11.2 Source-of-Truth and Documentation Governance

[OBSERVED] `docs/SOURCES_OF_TRUTH.md:18-43` mapea fuentes vigentes por dominio.

[OBSERVED] `docs/HISTORICAL_DOCUMENTATION.md:34-45` separa auditorias vigentes, historicas y secundarias.

[OBSERVED] `Get-ChildItem -Recurse -File docs` mostro 242 archivos en `docs/implementation`, 86 en `docs/audit`, 62 en `docs/pr-history`, mas assets/evidence.

[INFERRED] El mapa reduce deriva documental, pero el volumen historico mantiene riesgo de falsa fuente de verdad si el proceso no se sigue.

### 11.3 Change Control and Pull Request Governance

[OBSERVED] `.github/PULL_REQUEST_TEMPLATE.md:1-36` exige summary, scope, validacion, checklist security/regression y rollback.

[OBSERVED] `docs/review-governance.md:3-28` documenta contenido requerido, checks esperados, scope discipline y branch protection como setting externo.

[OBSERVED] PR #1435 mergeo sin GitHub Actions runs ni required positive check.

[INFERRED] El proceso existe pero no impide merges con checks ausentes.

### 11.4 Code and Operational Ownership

[OBSERVED] `.github/CODEOWNERS:1` contiene solo `* @LABVETNEB`.

[OBSERVED] `docs/governance/ownership-model.md:21-35` documenta ownership por dominios, pero dice que `.github/CODEOWNERS` sigue siendo la fuente efectiva de GitHub.

[INFERRED] Hay ownership humano/documental, pero no ownership tecnico por paths en GitHub.

### 11.5 Software Architecture Governance

[OBSERVED] `docs/architecture/backend-boundary-adr.md` existe.

[OBSERVED] `test/architecture/**` contiene 20 archivos y `test/architecture/security/**` contiene 17 archivos.

[OBSERVED] `docs/governance/adr-template.md:1-78` y `docs/governance/rfc-change-control-template.md:1-70` existen.

[INFERRED] La arquitectura esta parcialmente gobernada por docs/tests, no por enforcement obligatorio previo al merge.

### 11.6 Backend Enterprise Governance

[OBSERVED] `package.json:21-25` define `pnpm test`, `security:public-surface`, `schema:verify`, `validate:local`, `validate:local:schema`.

[OBSERVED] `.github/workflows/backend-ci.yml:71-89` ejecuta audit, migrations, typecheck, typecheck:test, test y build.

[OBSERVED] `server/**` contiene 108 archivos TypeScript.

[OBSERVED] No se observo lint backend en `package.json`; auditoria previa `docs/audit/total-software-engineering-audit.md:382` lo identifica como brecha.

### 11.7 Frontend Enterprise Governance

[OBSERVED] `frontend/package.json:10-19` define lint, typecheck, build y suites E2E focalizadas.

[OBSERVED] `.github/workflows/frontend-ci.yml:55-80` ejecuta lint, typecheck, build, public surface audit y E2E layered tests.

[OBSERVED] `frontend/e2e` tiene 70 specs Playwright.

[INFERRED] La gobernanza frontend es fuerte localmente, pero depende de que el workflow sea requerido o ejecutado por paths adecuados.

### 11.8 Enterprise Test Architecture

[OBSERVED] `test/README.md:1-151` declara estructura canonica y que `test/*.test.ts` debe permanecer en 0.

[OBSERVED] `Get-ChildItem -File test\*.test.ts | Measure-Object` devolvio `Count: 0`.

[OBSERVED] `Get-ChildItem -Recurse -File test -Filter *.test.ts | Measure-Object` devolvio `Count: 420`.

[INFERRED] La taxonomia fisica esta implementada, pero la madurez no llega a nivel 4 porque coverage/mutation/medicion no estan implementados.

### 11.9 CI/CD and Quality Gate Governance

[OBSERVED] GitHub API `actions/workflows` devolvio 5 workflows activos: App Version Force Update, Backend CI, Frontend CI, Visual Regression Manual, Dependabot Updates.

[OBSERVED] Backend CI ignora PRs que solo cambian `docs/**` y `**/*.md` (`backend-ci.yml:7-9`).

[OBSERVED] Frontend CI solo corre en PRs hacia main cuando cambian `frontend/**`, lockfiles, package root o workflow frontend (`frontend-ci.yml:13-21`).

[OBSERVED] `gh api repos/.../branches/main/protection/required_status_checks` devolvio 404 `Branch not protected`.

### 11.10 Security Governance and Hardening

[OBSERVED] `docs/security/ENDPOINT_PERMISSION_MATRIX.md`, `ENDPOINT_TEST_MATRIX.md`, `RBAC_MATRIX.md`, `rls-enforcement-matrix.md` y `security-sessions-tenant-rls-audit.md` existen.

[OBSERVED] `test/security/**` contiene 9 archivos; `test/architecture/security/**` contiene 17 archivos.

[OBSERVED] `server/middlewares/auth.ts`, `admin-auth.ts`, `particular-auth.ts`, `trusted-origin.ts`, `error-handler.ts`, `request-logger.ts` contienen controles de sesion/origen/error/logging.

[OBSERVED] `frontend/next.config.ts` define headers de cache y CSP report-only.

[INFERRED] El hardening aplicativo es real, pero runtime/staging evidence y RLS nativo no cierran el control enterprise.

### 11.11 Database and Data Governance

[OBSERVED] `drizzle/schema.ts` define tablas con `clinic_id` en superficies tenant-scoped.

[OBSERVED] `drizzle/migrations` tiene 31 SQL migrations.

[OBSERVED] `package.json:23` define `schema:verify`.

[OBSERVED] `rg -n -i "CREATE POLICY|ENABLE ROW LEVEL|ROW LEVEL SECURITY" drizzle server scripts` no devolvio resultados.

[INFERRED] La separacion tenant depende principalmente de enforcement aplicativo y constraints, no de RLS PostgreSQL nativo observable.

### 11.12 Backup, Restore and Disaster Recovery

[OBSERVED] `docs/ops/BACKUP_RESTORE_ROLLBACK.md:271-421` documenta mitigacion temporal, dump DB 2026-06-08, storage export bucket `reports`, pendientes de cifrado/vault y restore drill.

[OBSERVED] `docs/ops/production-readiness-audit.md:47-50` mantiene restore drill y smoke post-deploy como pendientes.

[INFERRED] Hay evidencia de backup/export, pero no de restore drill ensayado y cerrado.

### 11.13 Observability and Operations

[OBSERVED] `server/fastify-app.ts` usa request IDs y sanitiza errores 500 como `Error interno del servidor`.

[OBSERVED] `server/middlewares/request-logger.ts` sanitiza URLs para logs.

[OBSERVED] `docs/ops/METRICS_BASELINE.md:5` declara baseline docs-only sin collectors, alertas, dashboards ni schema changes.

[INFERRED] Observabilidad esta en nivel parcial: logging/request-id existe, pero metrics/alerts/tracing/SLO no estan ejercitados.

### 11.14 Release and Production Readiness

[OBSERVED] `docs/release/release-go-no-go-policy.md:3-145` define politica go/no-go, validaciones y rollback.

[OBSERVED] `scripts/smoke/*` y `scripts/ops/verify-production-readiness.mjs` existen.

[OBSERVED] `.github/workflows/app-version-force-update.yml` es manual `workflow_dispatch` y opera Render con smoke opcional.

[OBSERVED] `gh api repos/.../environments` devolvio `{"total_count":0,"environments":[]}`.

### 11.15 Dependency and Supply Chain Governance

[OBSERVED] `.github/dependabot.yml:1-25` configura updates weekly para npm raiz, npm frontend y GitHub Actions.

[OBSERVED] `pnpm-lock.yaml` existe con integrities.

[OBSERVED] `.github/workflows/backend-ci.yml:71-74` ejecuta `pnpm audit --prod` y `pnpm audit`.

[OBSERVED] `gh api repos/.../actions/permissions` devolvio `sha_pinning_required:false`.

[OBSERVED] No se observo SBOM, provenance, SLSA, attestation, cosign o license gate implementado.

### 11.16 Quality Engineering and Maintainability

[OBSERVED] `docs/qa/*` define estrategia de regression y flaky tests.

[OBSERVED] `frontend/package.json:10` define lint frontend.

[OBSERVED] `docs/audit/total-software-engineering-audit.md:124`, `:276`, `:379`, `:398` documenta cobertura no medida, ausencia de c8/nyc/istanbul y ausencia de mutation testing.

[INFERRED] La calidad esta fuertemente apoyada por tests, pero falta medicion de cobertura, mutation, complejidad, duplicacion y dead code para nivel enterprise medido.

## 12. Controles externos de GitHub

| Control externo | Comando GET/read-only | Resultado | Estado | Observacion |
| --- | --- | --- | --- | --- |
| Default branch | `gh repo view --json owner,name,defaultBranchRef,url` | `main` | IMPLEMENTED | [OBSERVED] Repo `LABVETNEB/PORTAL-VETNEB` |
| Branch protection `main` | `gh api repos/.../branches/main` | `protected:false` | NOT_IMPLEMENTED | [OBSERVED] Sin proteccion |
| Branch protection detail | `gh api repos/.../branches/main/protection` | 404 `Branch not protected` | NOT_IMPLEMENTED | [OBSERVED] No protegido |
| Required status checks | `gh api repos/.../branches/main/protection/required_status_checks` | 404 `Branch not protected` | NOT_IMPLEMENTED | [OBSERVED] No required checks |
| Required reviews | `gh api repos/.../branches/main/protection/required_pull_request_reviews` | 404 `Branch not protected` | NOT_IMPLEMENTED | [OBSERVED] No required reviews |
| Repository rulesets | `gh api repos/.../rulesets` | `[]` | NOT_IMPLEMENTED | [OBSERVED] Sin rulesets repo |
| CODEOWNERS enforcement | Branch protection + CODEOWNERS | No protection, `CODEOWNERS` global | NOT_IMPLEMENTED | [INFERRED] Sin branch protection no hay enforcement de review requerido |
| Force-push policy | Branch protection/rulesets | No protection/rulesets | NOT_IMPLEMENTED | [INFERRED] Sin control repo observable |
| Branch deletion policy | Branch protection/rulesets | No protection/rulesets | NOT_IMPLEMENTED | [INFERRED] Sin control repo observable |
| Actions permissions | `gh api repos/.../actions/permissions` | `enabled:true`, `allowed_actions:"all"`, `sha_pinning_required:false` | PARTIAL | [OBSERVED] Actions habilitado sin sha pinning requerido |
| Workflow token permissions | `gh api repos/.../actions/permissions/workflow` | `default_workflow_permissions:"write"`, `can_approve_pull_request_reviews:false` | PARTIAL | [OBSERVED] GITHUB_TOKEN default write |
| Environments | `gh api repos/.../environments` | `total_count:0` | NOT_IMPLEMENTED | [OBSERVED] Sin environments/deployment protection |

## 13. Evaluacion especifica del PR #1435

### 13.1 Metadata del PR

[OBSERVED] `gh pr view 1435 --json ...`:

| Campo | Valor |
| --- | --- |
| Numero | `1435` |
| Titulo | `docs(test): align normative taxonomy with consolidated suite` |
| Estado | `MERGED` |
| Base | `main` |
| Head | `docs/test-suite-normative-taxonomy-sync` |
| Merged at | `2026-07-10T21:36:21Z` |
| Merge commit | `193e94c6648b7dc5071a081ced47f8dfdf776fb7` |
| Commits del PR | `fe1ef50e7d3dd079387eb753fc02ecbfc4d5fb8d`, `9f7d18da9b04081c43abeefcaba52e3e9f0c87ad` |
| Archivos | `docs/implementation/test-suite-enterprise-organization-convention.md`, `test/README.md` |

### 13.2 Workflows y checks ejecutados

[OBSERVED] `gh api repos/.../actions/runs?head_sha=fe1ef...` devolvio `total_count:0`.

[OBSERVED] `gh api repos/.../actions/runs?head_sha=9f7d...` devolvio `total_count:0`.

[OBSERVED] `gh api repos/.../actions/runs?branch=docs/test-suite-normative-taxonomy-sync` devolvio `total_count:0`.

[OBSERVED] `gh api repos/.../commits/fe1ef.../check-runs` devolvio 1 check-run: `Supabase Preview`, `conclusion:"skipped"`, summary `This git branch is not associated with any Supabase Branch. You can open a PR to create a new branch.`

[OBSERVED] `gh api repos/.../commits/9f7d.../check-runs` devolvio 1 check-run: `Supabase Preview`, `conclusion:"skipped"`, summary `No changes detected in supabase directory.`

[OBSERVED] `gh api repos/.../commits/{sha}/status` para ambos commits devolvio `total_count:0`, `statuses:[]`, `state:"pending"` para status API legacy.

[OBSERVED] `statusCheckRollup` en `gh pr view` mostro solo `Supabase Preview` con conclusion `SKIPPED`.

[OBSERVED] `gh api repos/.../pulls/1435/reviews` mostro una review `COMMENTED` de `chatgpt-codex-connector[bot]`, sin approval.

### 13.3 Por que no corrieron Backend CI ni Frontend CI

[OBSERVED] Backend CI en PR hacia main ignora `docs/**` y `**/*.md` (`.github/workflows/backend-ci.yml:7-9`). PR #1435 cambio dos Markdown.

[OBSERVED] Frontend CI en PR hacia main corre solo para `frontend/**`, lockfiles, root `package.json` o workflow frontend (`.github/workflows/frontend-ci.yml:16-21`). PR #1435 no toco esos paths.

[INFERRED] Por paths, GitHub Actions no genero jobs para Backend CI ni Frontend CI en PR #1435.

### 13.4 Por que GitHub permitio el merge

[OBSERVED] `main` no estaba protegido (`protected:false`).

[OBSERVED] Required status checks devolvio 404 `Branch not protected`.

[OBSERVED] Required pull request reviews devolvio 404 `Branch not protected`.

[OBSERVED] Rulesets devolvio `[]`.

[INFERRED] GitHub permitio el merge porque no habia branch protection, ruleset, required status check ni required review que exigiera un check positivo. `SKIPPED` no fue equivalente a `SUCCESS`; simplemente no habia un control externo que lo bloqueara.

### 13.5 Brecha demostrada

[INFERRED] PR #1435 demuestra una brecha de governance: un cambio documental/test-taxonomy pudo entrar a `main` sin un required check minimo de docs-only (`git diff --check`/scope check), sin review obligatoria y con solo un check externo skipped.

### 13.6 Control empresarial requerido

[INFERRED] Control preventivo recomendado: habilitar branch protection o ruleset para `main` con al menos required PR, required positive status checks por tipo de cambio, CODEOWNERS/review enforcement, bloqueo de force-push/delete y control docs-only que no dependa de workflows path-gated.

## 14. Fortalezas confirmadas

[OBSERVED] Base documental de source-of-truth, governance, QA, release y seguridad reciente.

[OBSERVED] Test architecture fisicamente consolidada: `test/*.test.ts` en 0, 420 tests backend recursivos y 70 specs Playwright.

[OBSERVED] Workflows backend/frontend activos con validaciones tecnicas relevantes.

[OBSERVED] Controles aplicativos de seguridad: sesiones separadas, trusted origin, request IDs, error sanitization, no-store privado, CSP report-only, rate limit login, audit surfaces.

[OBSERVED] Dependabot y `pnpm audit` en backend CI.

[OBSERVED] Backup/export documentados fuera del repo con evidencia sanitizada.

## 15. Brechas criticas

[OBSERVED] `main` sin branch protection, required checks, required reviews ni rulesets.

[OBSERVED] PR #1435 mergeado con cero GitHub Actions runs y unico check `SKIPPED`.

[OBSERVED] CODEOWNERS global unico, sin modelo de dominios por path en GitHub.

[OBSERVED] RLS nativo PostgreSQL no observable.

[OBSERVED] Restore drill pendiente.

[OBSERVED] Metrics baseline docs-only; sin collectors/alerts/SLO/tracing verificados.

[OBSERVED] Supply-chain parcial: no SBOM, provenance, sha pinning requerido ni license gate.

[OBSERVED] Coverage, mutation, complexity, duplication y dead-code gates ausentes o no verificados.

## 16. Riesgos de falsa madurez

[INFERRED] Cantidad alta de tests puede ocultar que cobertura real y mutation score son desconocidos.

[INFERRED] PR template y checklists pueden parecer governance suficiente, pero no bloquean merges si no hay branch protection/rulesets.

[INFERRED] Dependabot y `pnpm audit` no equivalen a supply-chain governance completa.

[INFERRED] Backup documentado no equivale a restore drill ensayado.

[INFERRED] Logging/request IDs no equivalen a observabilidad completa con SLI/SLO/alerting/tracing.

[INFERRED] Matrices de seguridad no equivalen a evidencia runtime/staging actual.

## 17. Dependencias entre capacidades

[INFERRED] Branch protection/rulesets debe preceder a required checks efectivos.

[INFERRED] Quality gate architecture depende de CI required checks y de separar docs-only/backend/frontend/security/deps gates.

[INFERRED] CODEOWNERS domain model depende de ownership model y de branch protection con review enforcement.

[INFERRED] Coverage/mutation/quality metrics dependen de tooling incremental y baselines no bloqueantes antes de umbrales.

[INFERRED] Release readiness depende de backup/restore, runtime evidence, environments/deployment protection y observability.

[INFERRED] Tenant isolation enterprise depende de runtime smoke A/B y, si se adopta, de RLS nativo o una decision ADR explicita que justifique enforcement aplicativo.

## 18. Orden recomendado de remediacion

1. PR-GOV-EXT-1: branch protection/ruleset para `main` con required PR, no force-push/delete y required positive checks minimos.
2. PR-CI-DOCS-1: gate docs-only universal que cubra PRs Markdown y scope checks sin depender de paths backend/frontend.
3. PR-CODEOWNERS-1: CODEOWNERS por dominio y review routing, despues de ownership model aprobado.
4. PR-CI-REQUIRED-1: mapear workflows a required checks por tipo de cambio.
5. PR-SEC-RUNTIME-1: ejecutar y registrar smoke cross-tenant A/B con evidencia sanitizada.
6. PR-DATA-DR-1: restore drill no productivo con evidencia cerrable.
7. PR-OBS-1: observability baseline implementado con metrics/alerts/SLO iniciales.
8. PR-SUPPLY-1: SBOM/provenance/sha-pinning/license policy incremental.
9. PR-QLT-1: coverage baseline no bloqueante.
10. PR-QLT-2: backend lint/static analysis y metricas de maintainability.

## 19. Criterio objetivo para declarar nivel empresarial

[INFERRED] VETNEB podria declararse enterprise-grade repository cuando se cumpla todo esto con evidencia vigente:

- `main` protegido por branch protection o rulesets.
- Required checks positivos por tipo de cambio, incluyendo docs-only.
- Required PR review/CODEOWNERS efectivo por dominio.
- CI pathing sin huecos para cambios normativos/documentales.
- Security runtime/staging evidence vigente para tenant isolation, session isolation y public/private surfaces.
- Restore drill ejecutado en entorno no productivo y registrado.
- Observability con logs estructurados, request/correlation IDs, metrics, alerting y SLO inicial.
- Supply-chain con Dependabot, audit, lockfile, SBOM/provenance y politica de pinning/Actions.
- Quality engineering medido: coverage baseline, lint backend/frontend, typecheck, build, complexity/dup/dead-code strategy.
- Release/go-no-go con deployment protection o control externo equivalente.

## 20. Conclusion

[INFERRED] El repositorio VETNEB esta por encima de una base ad hoc: tiene arquitectura, tests, documentacion y hardening significativos. Sin embargo, la madurez empresarial exige que los controles criticos sean efectivos, medidos y auditables, no solo documentados.

[OBSERVED] La mayor brecha real y verificable esta en GitHub governance: `main` sin proteccion, sin rulesets y sin required checks/reviews. PR #1435 prueba que un cambio pudo entrar con checks ausentes/skipped.

[INFERRED] La prioridad no es una transformacion masiva, sino una secuencia de PRs chicos que conviertan las politicas ya documentadas en controles ejercitados y verificables.
