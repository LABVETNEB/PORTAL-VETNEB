# VETNEB Supreme System-Level Alignment Plan

> **docs-only · plan de alineación de sistema.** Este documento **no** implementa, **no** reescribe y
> **no** es una lista de compras tecnológica. Sintetiza las tres auditorías existentes en una
> **secuencia ejecutable de PRs chicos y controlados**. No modifica código productivo, `frontend/src`,
> `frontend/e2e`, `server`/backend, `test`, `.github/workflows`, `package.json`,
> `frontend/package.json`, `pnpm-lock.yaml`, Playwright config, `scripts`, `drizzle`/migraciones,
> deps, lockfiles, CI, screenshots ni generados. No mueve, renombra ni borra archivos.
>
> **Base estratégica primaria (autoría de esta sesión):**
> `docs/audit/repository-operational-ordering-audit.md`,
> `docs/audit/vetneb-enterprise-engineering-readiness-audit.md`,
> `docs/audit/vetneb-extreme-multinational-enterprise-readiness-audit.md`.
>
> Skills VETNEB aplicadas (10, ya cargadas en sesión, declaradas): briefing-planificación,
> staff-senior-full-stack, web-end-to-end-global, security-production-invariants,
> admin-dashboard-operational-actions, production-web-optimization-engineer, pwa-end-to-end,
> lanzamiento-mantenimiento, bugs-errores-optimización-rutas, protocolos-comunicación. Prevalece el
> Protocolo Maestro VETNEB y el flujo Git manual de Nico.

---

## 1. Executive Summary

**Situación estratégica actual.** Las tres auditorías previas ya entregaron el diagnóstico completo:
VETNEB es un **baseline SaaS sólido (≈2.1/5 en rúbrica multinacional)** con cimientos fuertes
(seguridad, separación de superficies, testing/E2E) y brechas en **gobernanza, source-of-truth,
observabilidad, verificación tenant/RLS, performance budgets, gobernanza de datos, integración,
incident readiness y capa de confianza ejecutiva**. No falta arquitectura: falta **instrumentación,
evidencia y gobierno**. Este plan convierte ese diagnóstico en **olas (waves) de PRs chicos con
phase-gates**.

**Por qué las auditorías previas alcanzan para empezar a ejecutar.** El diagnóstico ya está
priorizado (P0/P1/P2/P3), con evidencia trazable y secuencia de PRs. No hace falta re-auditar: hace
falta **cerrar las auditorías (commit) y ejecutar la cadena de gobernanza primero**. Re-auditar
bloques cerrados sería desperdicio (regla anti-patrón §10).

**Por qué alinear por dominios y no reescribir.** El sistema tiene perfil "T invertida": transversales
fuertes, instrumentación débil. Reescribir destruiría los activos maduros (backend Fastify modular,
suite de ~400 tests + 42 E2E, controles de seguridad) para resolver problemas que son **aditivos**
(logs, budgets, ADRs, índices). Cada dominio sube a "supremo" sin tocar los demás, con gates entre
medio.

**Top blockers a nivel supremo:**

1. **Gobernanza ausente** (sin ADR/RFC/risk register/PRR/ownership) → decisiones no trazables.
2. **Source-of-truth inexistente** (174 docs sin índice/mapa) → re-descubrimiento costoso, ya
   diagnosticado.
3. **Observabilidad ciega** (`server/lib/logger.ts` = `console.*` plano; sin SLO/runbook/alerting).
4. **Tenant/RLS sin verificar** (aislamiento por `clinic_id` a nivel app; RLS DB no confirmada).
5. **3 auditorías base aún untracked** → riesgo de acumulación de scope sin cerrar (Wave 0).

**Top aceleradores:**

- La cadena de gobernanza es **docs-only** (bajo blast radius, alto valor de control).
- Las capas E2E ya existen (#1096): PR-C3 es CI-only aditivo, no necesita tocar specs.
- La observabilidad arranca **sin deps** (logger JSON reutilizando `api-request-id.ts`).
- Hay un patrón de closeout maduro reutilizable como plantilla de evidencia.

**Próximo PR inmediato:** **PR-O1 docs-only** — `docs/audit/README.md` (índice de auditorías
vigentes con estado). Pero antes, **Wave 0**: commitear las 3 auditorías + este plan (Nico, manual).

**Dominios que NO deben tocarse sin auditoría enfocada previa:** tenant/RLS a nivel DB,
privileged-action audit coverage, backup/restore real, consistencia de fechas críticas, `select('*')`/
índices, cobertura a11y con axe. Todos marcados **"Requires focused audit before implementation."**

---

## 2. Audited Base

| Campo | Valor |
| --- | --- |
| Branch | `main` |
| HEAD | `8e29cc2 test(e2e): add layered e2e scripts (#1096)` |
| `origin/main` | `8e29cc2` (idéntico) |
| `git status --short --untracked-files=all` | `?? repository-operational-ordering-audit.md`, `?? vetneb-enterprise-engineering-readiness-audit.md`, `?? vetneb-extreme-multinational-enterprise-readiness-audit.md` (+ este plan, untracked) — **las 3 base siguen sin commitear** |
| Worktree | único — `C:/PORTAL-VETNEB 8e29cc2 [main]` |
| Open PRs | **19, todas Dependabot** (#1018–#1038), envejeciendo desde 2026-06-18 |
| Fecha | 2026-06-24 |
| Plataforma | Windows / PowerShell / PNPM 10.8.1 |

**Documentos primarios usados (en contexto de sesión, no re-leídos completos):** los tres audits
base. **Comandos ejecutados:** `git branch/status/log/worktree`, `gh pr list --state open`,
`git ls-files` de los tres audits (confirmado untracked). **No** se re-auditó el repo ni se re-leyó
cada fuente — síntesis pura, según las reglas de eficiencia de la misión.

**Confirmación de scope.** Solo se crea `docs/audit/vetneb-supreme-system-level-alignment-plan.md`.
No se modificó/movió/renombró/borró ningún otro archivo. No se ejecutó `git add/commit/push`,
`gh pr create/merge`, ni comandos con `exit`. No se instalaron dependencias. **docs-only.**

---

## 3. Supreme-Level Control Model

> "Supremo" = cada dominio tiene dueño/SoT, cada control tiene evidencia, cada dominio de alto riesgo
> tiene auditoría enfocada antes de implementar, y todo avanza por PRs chicos con rollback.

| Control domain | Supreme standard | Current evidence | Current gap | Required control | First PR | Prio |
| --- | --- | --- | --- | --- | --- | :--: |
| Governance | ADR+RFC+PRR+ownership+decision traceability | `AGENTS.md`, `review-governance.md` | Sin ADR/RFC/risk register | Plantillas + registro | PR-GOV1 | **P0** |
| Source of truth | Índice + mapa por dominio, histórico marcado | ordering audit lo pide | Sin índice/mapa | `docs/audit/README.md` + SoT map | PR-O1/O2 | **P0** |
| ADR/RFC discipline | Decisiones registradas y aprobadas | ninguna | Inexistente | ADR/RFC templates | PR-GOV1 | **P0** |
| Security/session isolation | Invariantes verificados + secret-scanning CI | CSP, headers, rate-limit, sesiones aisladas | Sin secret-scanning; sin verificación periódica | Security review checklist | PR-S1 | **P0** |
| Tenant isolation/RLS | RLS DB + cobertura `clinic_id` probada | app-layer (`clinic_id`+RBAC) | RLS DB sin verificar | Focused audit + (futuro) test cross-tenant | PR-S1 | **P0** |
| Observability | Logs JSON + correlación + métricas + alerting | `logger.ts` console, request-id, health | No estructurado, sin alerting/SLO | Baseline + runbook + logger | PR-OBS1→PR-OBS2 | **P0/P1** |
| Incident readiness | Runbook + severidades + MTTD/MTTR | ninguna | Inexistente | Incident runbook | PR-OBS1 | P1 |
| Release/rollback | Checklist + drill + data-impact | `review-governance.md` parcial | Sin checklist/drill | Release/rollback checklist | PR-REL1 | P1 |
| Testing/E2E layers | Capas en CI, unión==full probada | scripts `e2e:*` (#1096) | CI no las usa | CI-only aditivo | PR-C3 | **P1** |
| CI quality gates | Smoke gate + flake/coverage policy | 2 workflows; step "smoke"=full | Sin política de flakes/cobertura | Flake/regression policy | PR-QA1 | P1 |
| Performance budgets | Budgets enforced + medición | ninguna; sin `next/dynamic` | Sin budgets/medición | Budget spec + medición | PR-PERF1 | P1 |
| Data governance | Lifecycle + retención + restore evidence | audit/tracking; backup doc | Sin políticas; restore sin evidencia | Lifecycle/retención audit | PR-DATA1 | P1/P2 |
| API/integration governance | Versioning + OpenAPI + idempotency + webhooks | API interna `/api` | Sin contrato externo | API readiness audit | PR-API1 | P2 |
| Dependency governance | Política + SLA + risk register | `pnpm.overrides`; Dependabot | 3 deps sin uso; 19 PRs aging | Dep policy + uso audit | PR-DEP1/GOV3 | P1 |
| Accessibility | Criterios axe aceptados | a11y keyboard E2E | Sin criterios formales | A11y acceptance criteria | PR-A11Y1 | P2 |
| Premium UX | Tokens + KPIs + polish certificado | Radix/CVA/tailwind, no-scroll | Sin tokens doc ni KPIs | Dashboard value audit | PR-UX1 | P2 |
| Executive trust | DD pack + evidence room + narrativa | sanitización/no-secrets | Sin artefactos DD | Exec narrative + evidence index | PR-EXEC1 | P1 |
| Support readiness | Escalamiento + SLA soporte | ninguna | Inexistente | Support escalation doc | PR-EXEC1 | P2 |
| AI workflow efficiency | Prompt-packs + SoT + reglas de auditoría | protocolo + skills | Doc overload | Prompt-pack index | PR-O4/O5 | P1 |

---

## 4. System Parity Matrix

> ¿Está cada superficie al mismo nivel? Maduración 0–5 (rúbrica multinacional). El objetivo supremo es
> **paridad en 5/5**; hoy hay **dispersión 1–4**.

| Surface | Maturity 0–5 | Target | Strongest control | Weakest control | Missing evidence | Blocking gap | First PR | Dependency |
| --- | :--: | :--: | --- | --- | --- | --- | --- | --- |
| Public website | **3** | 5 | SEO (manifest/robots/sitemap), CSP | Performance budget | LCP/CLS medidos | Sin budgets | PR-PERF1 | — |
| Public tokens | **3** | 5 | Rate-limit + sanitización | Lifecycle/retención | Política de expiración/retención | Data governance | PR-DATA1 | PR-S1 |
| Public reports | **3** | 5 | Access-token + no-cache privados | Audit de acceso | Cobertura de access log | Data/observ. | PR-DATA1/OBS1 | PR-S1 |
| Clinic dashboard | **3** | 5 | No-scroll contracts, live-read | KPIs/observabilidad | Métricas operativas | UX KPIs | PR-UX1 | PR-OBS1 |
| Admin dashboard | **3** | 5 | Acciones reales (skill ops) | Executive KPIs | Reporting ejecutivo | UX/exec | PR-UX1 | PR-OBS1 |
| Admin mobile | **3** | 5 | No-scroll, helper consolidado | a11y formal | axe acceptance | A11y | PR-A11Y1 | PR-C3 |
| Session/auth layer | **4** | 5 | Aislamiento `admin/app_session_id` | Rotación/secret-scanning | Rotación documentada | Security gov | PR-S1 | — |
| API/backend | **3** | 5 | Fastify modular, error-handler | Contratos/versioning | OpenAPI/idempotency | API gov | PR-API1 | PR-OBS2 |
| Data/storage | **2** | 5 | Drizzle + caches | RLS/retención | RLS DB + restore evidence | Data/tenant | PR-S1/DATA1 | — |
| E2E/CI | **3** | 5 | 42 specs capeados (#1096) | CI usa capas | unión==full en CI | Quality gate | PR-C3 | PR-QA1 |
| Documentation/governance | **2** | 5 | Closeouts + protocolo | Índice/SoT/ADR | Índice + ADR + risk register | Governance | PR-O1/GOV1 | — |
| Release process | **3** | 5 | build-info, staging smoke | Checklist/rollback drill | Release checklist | Release | PR-REL1 | PR-O1 |
| Observability | **2** | 5 | request-id, health | Logs estructurados/alerting | JSON logs + SLO + runbook | Observability | PR-OBS1 | — |
| Security controls | **3** | 5 | CSP/headers/rate-limit/CSRF | Secret-scanning + RLS | CI secret-scan + RLS | Security gov | PR-S1 | — |
| Integration/API readiness | **1** | 5 | Errores estándar, paginación | Versioning/OpenAPI/webhooks | Contrato externo | Integration | PR-API1 | PR-API1 |

**Lectura:** ninguna superficie está bajo 1 salvo integración (capacidad ausente, aceptable hoy). La
**paridad se rompe** por la base transversal débil (governance 2, observability 2, data 2): subir esas
tres **eleva todas las superficies simultáneamente** → confirma "alinear por dominios transversales
antes que por superficie".

---

## 5. Gap Consolidation

> Gaps fusionados y deduplicados de las tres auditorías. `R-OO`=ordering audit, `R-ENT`=enterprise
> audit, `R-EXT`=extreme audit.

### P0 — Foundation

| Gap | Fuente | Dominio | Razón | Riesgo | First PR | Validación | Rollback | Dependencia |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Índice de auditorías | R-OO/R-EXT | SoT | 174 docs sin entrada única | Re-descubrimiento | PR-O1 | lectura + `git diff --check` | borrar | — |
| Mapa de fuentes de verdad | R-OO | SoT | Sin "para X leé Y" | Decisiones contradictorias | PR-O2 | lectura | borrar | PR-O1 |
| Gobernanza (ADR/RFC/ownership) | R-EXT | Governance | Decisiones no trazables | DD sin control interno | PR-GOV1 | lectura | borrar | PR-O1 |
| Tenant/RLS sin verificar | R-EXT | Security/Data | Aislamiento DB no probado | Cross-tenant clínico | PR-S1 | revisión (+test futuro) | docs | — |
| Observabilidad ciega | R-ENT/R-EXT | Observability | Logs `console.*` | MTTR alto | PR-OBS1→OBS2 | test shape, no-secretos | revertir 1 archivo | PR-OBS1 |
| Cerrar 3 audits untracked | este plan | Governance | Scope sin cerrar | Pérdida/duplicación | Wave 0 (Nico) | `git status` limpio | — | — |

### P1 — High-value maturity

| Gap | Fuente | Dominio | Razón | Riesgo | First PR | Validación | Rollback | Dependencia |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CI no usa capas E2E | R-ENT/R-EXT | CI | Feedback lento, nombre engañoso | Coverage loss | PR-C3 | unión==42; CI verde | revertir workflow | PR-QA1 + val. local |
| Flake/regression policy | R-EXT | QA | Sin política | Flake silencioso | PR-QA1 | lectura | borrar | — |
| Risk register | R-EXT | Governance | Sin registro vivo | DD débil | PR-GOV2 | lectura | borrar | PR-GOV1 |
| Release/rollback checklist | R-ENT/R-EXT | Release | Sin drill/data-impact | Recuperación incierta | PR-REL1 | lectura | borrar | PR-O1 |
| Performance budgets | R-ENT/R-EXT | Performance | Sin medición | Degradación invisible | PR-PERF1 | build size vs budget | docs | — |
| Structured logger | R-ENT/R-EXT | Observability | console plano | Diagnóstico nulo | PR-OBS2(=R2/S2) | test shape | revertir | PR-OBS1 |
| Correlation IDs FE↔BE | R-EXT | Observability | request-id sin propagación | Traza parcial | PR-S3 | e2e correlación | revertir | PR-OBS2 |
| Dep governance + Dependabot SLA | R-EXT | Dependencies | 19 PRs aging; deps sin uso | CVE aging | PR-DEP1/GOV3 | edad PRs | docs | — |
| Data lifecycle/retención | R-ENT/R-EXT | Data | Sin políticas | Cumplimiento | PR-DATA1 | revisión + Nico | docs | PR-O1 |
| Exec trust / DD pack | R-EXT | Exec | Sin artefactos | Bloquea ventas | PR-EXEC1 | revisión | borrar | PR-GOV2 |

### P2 — Dependent maturity

| Gap | Fuente | First PR | Dependencia |
| --- | --- | --- | --- |
| API governance/OpenAPI | R-ENT/R-EXT | PR-API1 | demanda externa |
| KPIs operativos + executive reporting | R-EXT | PR-UX1 | PR-OBS1 |
| A11y acceptance (axe) | R-ENT/R-EXT | PR-A11Y1 | PR-C3 |
| Design tokens documentados | R-ENT | PR-UX1 | PR-O1 |
| Tenant model formal | R-EXT | post PR-S1 | PR-S1 |
| Synthetic monitoring / error budgets | R-EXT | post PR-OBS1 | PR-OBS1 |

### P3 — Advanced / later

| Gap | Fuente | Condición |
| --- | --- | --- |
| Idempotency keys / webhooks firmados / SDK | R-ENT/R-EXT | consumidor externo real |
| Async jobs / cola | R-ENT/R-EXT | trabajos largos que bloqueen request |
| i18n/l10n / multi-moneda / residencia | R-EXT | expansión internacional real (requires legal) |

### Not recommended now

micro-frontends · CRDTs · WebGL · PWA-offline de privados · realtime en todo · backend/frontend
rewrite · adopción amplia de deps · rewrite grande de dashboard. (Detalle y condiciones en §10.)

---

## 6. Supreme PR Architecture

> Reglas: PRs chicos, **un dominio y una clase de riesgo por PR**, docs-only antes de implementación,
> implementación solo con auditoría/SoT previa, CI-only ≠ scripts-only, move-only ≠ contenido,
> security-only ≠ visual, backend-only ≠ frontend (salvo contract-only), rollback y no-scope
> explícitos siempre.

### Registro canónico de PRs (reconcilia el drift de nombres entre las 3 auditorías)

| Canónico | Alias en auditorías previas | Tipo | Familia |
| --- | --- | --- | --- |
| PR-O1 | PR-O1 | docs-only | Ordering |
| PR-O2 | PR-O2 | docs-only | Ordering |
| PR-O3 | PR-O3 (clasificación histórica) | docs-only | Ordering |
| PR-O4 | PR-O5 (prompt-pack) | docs-only | Ordering |
| PR-O5 | (nuevo: operating map auditorías) | docs-only | Ordering |
| PR-GOV1 | PR-GOV1 | docs-only | Governance |
| PR-GOV2 | PR-GOV2 (risk register) | docs-only | Governance |
| PR-GOV3 | PR-GOV3 / PR-DEP1 (dep gov) | docs-only | Governance/Dep |
| PR-REL1 | PR-REL1 | docs-only | Release |
| PR-QA1 | PR-QA1 | docs-only | CI/QA |
| PR-C3 | PR-C3 | CI-only | CI |
| PR-S1 | PR-S1 | docs-only | Security |
| PR-OBS1 | PR-OBS1 / PR-R1 | docs-only | Observability |
| PR-OBS2 | PR-S2 / PR-R2 (logger JSON) | backend-only | Observability |
| PR-S3 | PR-S3 (correlation IDs) | backend/security-only | Observability/Security |
| PR-PERF1 | PR-PERF1 / PR-P1 | docs-only | Performance |
| PR-PERF2 | PR-P2 (medición) | frontend-only | Performance |
| PR-DATA1 | PR-DATA1 / PR-G1 | docs-only | Data |
| PR-API1 | PR-API1 / PR-A1 | docs-only | API |
| PR-UX1 | PR-UX1 / PR-D1 | docs-only | UX |
| PR-A11Y1 | PR-A11Y1 | docs-only | UX/A11y |
| PR-EXEC1 | PR-EXEC1 / PR-EXEC | docs-only | Exec |
| PR-DEP1 | PR-DEP1 | docs-only | Dependencies |

### PR families

**PR-O — Repository Ordering & Source of Truth.** *Objetivo:* punto de entrada único. *Por qué:*
reduce consumo y re-descubrimiento. *First PR:* PR-O1. *Deps:* ninguna. *Validación:* `git diff --check`
+ lectura. *Rollback:* borrar. *DoD:* `docs/audit/README.md` + `docs/SOURCES_OF_TRUTH.md` + histórico
clasificado + prompt-pack + operating-map. *PRs:* PR-O1 índice, PR-O2 SoT, PR-O3 clasificación
histórica, PR-O4 prompt-pack index, PR-O5 operating map para futuras auditorías Claude.

**PR-GOV — Engineering Governance.** *Objetivo:* decisiones trazables y gestión de riesgo. *First PR:*
PR-GOV1. *Deps:* PR-O1. *Validación/Rollback:* lectura/borrar. *DoD:* ADR template, RFC/change-control
template, risk register, ownership matrix (CODEOWNERS doc), enterprise readiness checklist.

**PR-C — CI & Quality Gates.** *Objetivo:* gate barato sin pérdida de cobertura. *First PR:* PR-C3
(precedido de validación local `unión==42` + PR-QA1). *Deps:* PR-QA1. *Validación:* unión==42, CI
verde, seguridad siempre en gate. *Rollback:* revertir workflow. *DoD:* smoke/full split, coverage
invariant, flake policy, regression policy.

**PR-S — Security & Isolation.** *Objetivo:* invariantes demostrables. *First PR:* PR-S1. *Deps:*
PR-O1. *Validación:* `security:public-surface`, suites `security-*`/`auth-*`. *Rollback:* por PR.
*DoD:* auditoría session isolation, tenant/RLS verification, public surface hardening, rate-limit/CSP/
headers review, audit-log strategy.

**PR-OBS — Observability & Incident Readiness.** *Objetivo:* diagnóstico y reliability. *First PR:*
PR-OBS1 docs. *Deps:* PR-O1. *Validación:* test de shape de log, e2e de correlación. *Rollback:*
revertir archivos. *DoD:* structured logging audit, JSON logger (PR-OBS2), correlation/request IDs
(PR-S3), health checks por dependencia, incident runbook, alerting/SLO baseline.

**PR-REL — Release Engineering.** *Objetivo:* releases predecibles y reversibles. *First PR:* PR-REL1.
*Deps:* PR-O1. *Validación:* lectura + drill cronometrado. *Rollback:* docs. *DoD:* release readiness
checklist, rollback checklist (+data-impact), postdeploy smoke, staging/prod validation, release notes
discipline.

**PR-PERF — Performance & Scalability.** *Objetivo:* predictibilidad. *First PR:* PR-PERF1 docs.
*Deps:* PR-DEP1 (deps resueltas). *Validación:* build size + vitals vs budget. *Rollback:* aditivo.
*DoD:* budget spec, baseline measurement, CI/perf timing, budgets FE/admin/clínica/público, API
latency budgets.

**PR-DATA — Data Governance.** *Objetivo:* auditabilidad y cumplimiento. *First PR:* PR-DATA1 docs
(legal flags). *Deps:* PR-O1. *Validación:* revisión + Nico + (futuro) restore drill. *Rollback:*
docs. *DoD:* lifecycle states, retención/export/delete, backup/restore evidence, audit trail strategy,
reconciliation strategy.

**PR-API — Platform & Integration.** *Objetivo:* integrabilidad B2B. *First PR:* PR-API1 docs. *Deps:*
PR-O1 + demanda real. *Validación:* contract-tests. *Rollback:* versioning aditivo. *DoD:* API
governance audit, OpenAPI readiness, versioning, idempotency, webhooks, standard errors, pagination.

**PR-UX — Supreme Product Operability & Premium UX.** *Objetivo:* confianza operativa + premium.
*First PR:* PR-UX1 docs. *Deps:* PR-OBS1 (medir antes de pulir). *Validación:* `e2e:visual-contract`
+ QA humana + axe. *Rollback:* por PR. *DoD:* admin/clínica command-center audit, no-scroll enterprise
UX audit, executive KPI layer, premium visual system audit, accessibility acceptance criteria.

**PR-DEP — Dependency & Supply Chain.** *Objetivo:* superficie mínima y actualizada. *First PR:*
PR-DEP1 docs. *Deps:* ninguna. *Validación:* `git grep` imports + edad PRs Dependabot. *Rollback:*
docs. *DoD:* used vs unused audit (react-query/table/echarts), Dependabot aging policy, dependency risk
register, update cadence.

### 6.x Per-PR execution detail (scope / no-scope / validación / rollback / success metric)

> Tabla operable: cada PR con todo lo que la misión exige por PR. "Éxito" = métrica observable de
> cierre. Todos los PRs `docs-only` salvo donde se indique. Git lo ejecuta Nico.

| PR | Tipo | Objetivo (1 línea) | Allowed scope | Explicit no-scope | Validación | Rollback | Success metric | Dep |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PR-O1 | docs-only | Índice de auditorías | `docs/audit/README.md` | mover/editar audits | `git diff --check`, lectura | borrar | índice cubre 100% audits | — |
| PR-O2 | docs-only | Mapa de fuentes de verdad | `docs/SOURCES_OF_TRUTH.md` (+1 línea AGENTS.md OK Nico) | consolidar carpetas | lectura | borrar/revertir | 100% dominios mapeados | PR-O1 |
| PR-O3 | docs-only | Clasificar histórico/vigente | banners en docs | mover/renombrar/borrar | `git diff --check` + no-lectura por test | revertir | 0 docs vigentes sin clasificar | PR-O1 |
| PR-O4 | docs-only | Prompt-pack index para Claude | `docs/audit/README.md` (sección) | tooling/código | lectura | revertir sección | auditorías referencian SoT | PR-O1 |
| PR-O5 | docs-only | Operating map de futuras auditorías | `docs/audit/README.md` (sección) | scope nuevo | lectura | revertir sección | reglas de auditoría publicadas | PR-O1 |
| PR-GOV1 | docs-only | ADR/RFC/change-control + ownership doc | `docs/governance/*` | `.github/CODEOWNERS` real sin OK | lectura | borrar | templates con ejemplo real | PR-O1 |
| PR-GOV2 | docs-only | Risk register vivo | `docs/governance/risk-register.md` | inventar riesgos sin evidencia | lectura | borrar | 100% riesgos con dueño/mitigación | PR-GOV1 |
| PR-GOV3 | docs-only | Dependency governance + Dependabot SLA | `docs/governance/dependency-policy.md` | tocar deps/lockfile | edad PRs | borrar | SLA seguridad <7d definido | PR-GOV1 |
| PR-REL1 | docs-only | Release readiness + rollback + data-impact | `docs/ops/release-readiness-checklist.md` | tocar CI | lectura + drill | borrar | RTO <15min documentado | PR-O1 |
| PR-QA1 | docs-only | Flaky + regression policy | `docs/qa/flaky-and-regression-policy.md` | tocar tests/CI | lectura | borrar | política publicada | — |
| PR-C3 | CI-only | Capas E2E en CI sin pérdida cobertura | `.github/workflows/frontend-ci.yml` | specs/scripts/Playwright config | unión==42; CI verde | revertir workflow | smoke <4min; full red | PR-QA1 + val. local |
| PR-S1 | docs-only | Auditoría seguridad/aislamiento (incl. RLS/tenant) | `docs/security/security-session-focused-audit.md` | tocar auth/middlewares | revisión + `security:public-surface` | borrar | RLS verificada o gap doc | PR-O1 |
| PR-OBS1 | docs-only | Baseline observabilidad + SLO + incident runbook | `docs/ops/observability-baseline.md` | tocar logger/CI | revisión | borrar | SLOs numéricos + runbook | PR-O1 |
| PR-OBS2 | backend-only | Logger estructurado JSON (sin deps) | `server/lib/logger.ts` + test | otras capas | test shape, `pnpm test`, no-secretos | revertir 1 archivo | 100% rutas vía logger | PR-OBS1 |
| PR-S3 | backend/security-only | Correlation IDs FE↔BE | `server/lib/api-request-id.ts` + propagación | otras capas | e2e de correlación | revertir | correlación FE↔BE 100% | PR-OBS2 |
| PR-PERF1 | docs-only | Spec de performance budgets | `docs/perf/performance-budgets.md` | medir/instrumentar | revisión | borrar | budgets por superficie | PR-DEP1 |
| PR-PERF2 | frontend-only | Medición web-vitals mínima | medición no intrusiva | budgets nuevos | build size + vitals vs budget | revertir | LCP/INP/CLS medidos | PR-PERF1 |
| PR-DATA1 | docs-only | Lifecycle + retención (legal flags) | `docs/data/data-governance-audit.md` | inventar obligaciones legales | revisión + Nico | borrar | retención definida | PR-O1 |
| PR-API1 | docs-only | API governance/OpenAPI readiness | `docs/api/api-governance-readiness.md` | tocar rutas | revisión | borrar | path de versioning definido | PR-O1 |
| PR-UX1 | docs-only | Valor premium dashboard + KPIs + tokens | `docs/ux/dashboard-multinational-value.md` | tocar `frontend/src` | revisión | borrar | KPIs operativos definidos | PR-OBS1 |
| PR-A11Y1 | docs-only | Criterios de aceptación a11y (axe) | `docs/ux/accessibility-acceptance-criteria.md` | tocar `frontend/src`/tests | revisión | borrar | criterios críticos definidos | PR-C3 |
| PR-EXEC1 | docs-only | DD pack / evidence room + narrativa | `docs/exec/multinational-readiness-narrative.md` | exponer evidencia sensible | revisión + Nico | borrar | índice de evidencia completo | PR-GOV2 |
| PR-DEP1 | docs-only | Used vs unused deps + risk register | `docs/governance/dependency-audit.md` | tocar `package.json` | `git grep` imports | borrar | 3 deps con decisión cablear/retirar | — |

### 6.y PR dependency DAG (orden de habilitación)

```text
Wave0 commit-audits
   └─> PR-O1 ──> PR-O2 ──> PR-O3 / PR-O4 / PR-O5        (Gate 0)
         ├─> PR-GOV1 ─> PR-GOV2 ─> PR-EXEC1
         │      └─> PR-GOV3                              (Gate 1)
         ├─> PR-REL1                                     (Gate 1)
         ├─> PR-QA1 ─> PR-C3                             (Gate 2)
         ├─> PR-S1                                       (Gate 3)
         ├─> PR-OBS1 ─> PR-OBS2 ─> PR-S3                 (Gate 4)
         ├─> PR-DEP1 ─> PR-PERF1 ─> PR-PERF2             (Gate 5)
         ├─> PR-DATA1                                    (Gate 6)
         ├─> PR-API1                                     (Gate 6)
         └─> PR-OBS1 ─> PR-UX1 ; PR-C3 ─> PR-A11Y1       (Gate 7)
```

> Lectura del DAG: nada arranca antes de **PR-O1** (raíz). La rama de governance (PR-GOV*) y la de
> calidad (PR-QA1→PR-C3) son independientes y pueden correr en paralelo tras Gate 0. La
> implementación de observabilidad (PR-OBS2/PR-S3) depende de su auditoría docs (PR-OBS1). El trabajo
> visual (PR-UX1/PR-A11Y1) es **hoja del grafo**: requiere observabilidad (medir antes de pulir) y el
> gate de calidad (a11y tras CI estable).

---

## 7. Phase Gates

> Ningún wave avanza si su gate no pasa. Los gates son **criterios de evidencia**, no fechas.

| Gate | Nombre | Criterios de salida (todos verdaderos) | Bloquea hasta |
| --- | --- | --- | --- |
| **Gate 0** | Repository control | Índice existe · SoT map existe · docs current/histórico clasificados · próximas auditorías referencian docs correctos | Cualquier wave ≥1 |
| **Gate 1** | Governance control | ADR/RFC templates · risk register · release checklist · rollback checklist | Wave ≥3 |
| **Gate 2** | Quality control | E2E layer CI seguro (unión==full) · smoke/full split · coverage invariant documentado · flake policy | Wave ≥4 cambios de riesgo |
| **Gate 3** | Security control | Session isolation auditada · tenant/RLS verificada o gap documentado · riesgos de superficie pública clasificados · audit-log strategy definida | Wave ≥6 datos/API |
| **Gate 4** | Observability control | Logs estructurados existen · correlation IDs diseñados/implementados · incident runbook · health checks clasificados | Wave ≥5/8 |
| **Gate 5** | Performance control | Budgets definidos · baseline medido · budgets admin/clínica/público/API trackeados | Wave ≥8 UX pesado |
| **Gate 6** | Data/API control | Data lifecycle documentado · retención/export/delete evaluado · OpenAPI/API governance path · webhook/idempotency readiness | Wave ≥9 |
| **Gate 7** | Supreme UX/Product | Admin/clínica premium command-center path definido · no-scroll preservado · a11y acceptance criteria · visual separado de security/CI | Wave 9 features visuales |

---

## 8. Execution Roadmap

> Olas (waves) ordenadas por gate. Git lo ejecuta Nico. Cada wave = scope, no-scope, precondición,
> criterio de éxito, rollback, artefactos.

### Wave 0 — Commit & close current audits
- **Objetivo:** llevar las 3 auditorías base (+ este plan) a `main` limpiamente; evitar acumulación
  de scope untracked.
- **Allowed scope:** Nico hace `git add` de los 4 `.md` de `docs/audit/` + commit + push + PR docs-only.
- **Non-scope:** ningún cambio de código; no mezclar con otros archivos.
- **Preconditions:** ninguna.
- **Success:** `git status` limpio; 4 audits en `main`.
- **Rollback:** revert del commit docs.
- **Artifacts:** 4 documentos de auditoría versionados.

### Wave 1 — Source-of-truth & audit control (Gate 0)
- **Objetivo:** PR-O1, PR-O2, PR-O3. **Scope:** crear `docs/audit/README.md`, `docs/SOURCES_OF_TRUTH.md`,
  banners de histórico. **Non-scope:** mover/renombrar/borrar. **Precond:** Wave 0.
- **Success:** Gate 0 pasa. **Rollback:** borrar archivos/banners. **Artifacts:** índice + mapa.

### Wave 2 — Governance & release safety (Gate 1)
- **Objetivo:** PR-GOV1, PR-GOV2, PR-REL1. **Scope:** `docs/governance/*`, `docs/ops/release-readiness-checklist.md`.
  **Non-scope:** tocar `.github/CODEOWNERS` real sin OK. **Precond:** Gate 0.
- **Success:** Gate 1 pasa. **Rollback:** borrar docs. **Artifacts:** ADR/RFC/risk-register/checklist.

### Wave 3 — CI quality gate (Gate 2)
- **Objetivo:** PR-C3, PR-QA1. **Scope:** `.github/workflows/frontend-ci.yml` (CI-only) + `docs/qa/*`.
  **Non-scope:** specs/scripts/Playwright config. **Precond:** Gate 1 + validación local `unión==42`.
- **Success:** smoke gate + full red; Gate 2 pasa. **Rollback:** revertir workflow. **Artifacts:**
  CI por capas + flake policy.

### Wave 4 — Security & isolation (Gate 3)
- **Objetivo:** PR-S1, y (si auditoría lo habilita) PR-S2/S3 viven en Wave 5 (observability). **Scope:**
  `docs/security/*` (auditoría enfocada incl. RLS/tenant + privileged audit + secret-scanning plan).
  **Non-scope:** tocar auth/middlewares en este wave. **Precond:** Gate 2.
- **Success:** Gate 3 pasa (RLS verificada o gap documentado). **Rollback:** docs. **Artifacts:**
  security focused audit + tenant evidence.

### Wave 5 — Observability & incident readiness (Gate 4)
- **Objetivo:** PR-OBS1 (docs), PR-OBS2 (logger JSON backend-only), PR-S3 (correlation IDs). **Scope:**
  `docs/ops/observability-baseline.md`, `server/lib/logger.ts` + test, `api-request-id.ts` propagación.
  **Non-scope:** otras capas; deps nuevas. **Precond:** Gate 1 (no requiere Gate 3 para docs, sí para
  implementación si toca seguridad).
- **Success:** Gate 4 pasa. **Rollback:** revertir archivos acotados. **Artifacts:** runbook + logs
  JSON + SLO baseline.

### Wave 6 — Performance budgets (Gate 5)
- **Objetivo:** PR-PERF1 (docs), PR-PERF2 (medición). **Scope:** `docs/perf/*`, medición no intrusiva.
  **Non-scope:** budgets sin medición; deps. **Precond:** Gate 2 + PR-DEP1.
- **Success:** Gate 5 pasa. **Rollback:** aditivo. **Artifacts:** budgets + baseline.

### Wave 7 — Data/API governance (Gate 6)
- **Objetivo:** PR-DATA1, PR-API1. **Scope:** `docs/data/*`, `docs/api/*` (legal flags). **Non-scope:**
  inventar obligaciones legales; tocar rutas. **Precond:** Gate 3 + Gate 4.
- **Success:** Gate 6 pasa. **Rollback:** docs. **Artifacts:** lifecycle/retención + API readiness.

### Wave 8 — Supreme dashboard & product operability (Gate 7)
- **Objetivo:** PR-UX1, PR-UX2, PR-UX3 (+ PR-A11Y1). **Scope:** `docs/ux/*` primero, luego PRs
  frontend-only por superficie con `visual-contract`. **Non-scope:** mezclar visual con security/CI.
  **Precond:** Gates 0–5.
- **Success:** Gate 7 pasa; tokens + KPIs + a11y. **Rollback:** por PR. **Artifacts:** dashboard value
  + a11y criteria.

### Wave 9 — Advanced capabilities only if justified
- **Objetivo:** realtime/colas/PWA-offline/analytics/automatización **solo con evidencia + PRD corto**.
  **Scope:** por capacidad. **Non-scope:** todo lo de §10. **Precond:** todos los gates + demanda real.
- **Success:** por capacidad. **Rollback:** por capacidad. **Artifacts:** PRD + guardrails.

---

## 9. Supreme Standards by Domain

| Domain | Current baseline | Supreme standard | Min PRs | Measurable acceptance | Evidence required | What not to do |
| --- | --- | --- | --- | --- | --- | --- |
| Governance | protocolo + closeouts | ADR/RFC/risk register/PRR/ownership | PR-GOV1/2 | 100% decisiones clave con ADR | ADR repo + risk register | No gobernanza ceremonial sin uso |
| Security | CSP/headers/rate-limit/sesiones | + secret-scanning + RLS verificada + rotación | PR-S1(+impl) | 0 regresión superficie pública; RLS dictaminada | security audit + test cross-tenant | No relajar fronteras por conveniencia |
| Observability | console + request-id + health | logs JSON + correlación + alerting + SLO | PR-OBS1/2, PR-S3 | 100% rutas vía logger; correlación FE↔BE | runbook + log shape test | No agregar Sentry/OTel antes de logs JSON |
| CI/testing | 400 unit + 42 E2E | capas en CI + flake/coverage policy | PR-C3, PR-QA1 | unión==42; flaky <1% | CI verde + policy | No tocar CI sin validación local |
| Release | build-info + staging smoke | checklist + rollback drill + data-impact | PR-REL1 | RTO <15min documentado | checklist + drill | No release sin rollback definido |
| Performance | sin budgets | budgets enforced + medición | PR-PERF1/2 | 100% rutas en budget | budgets + vitals | No optimizar sin medir |
| Data | audit/tracking + backup doc | lifecycle + retención + restore evidence | PR-DATA1 | retención definida; restore probado | lifecycle doc + restore drill | No inventar obligaciones legales |
| API/integration | API interna `/api` | versioning + OpenAPI + idempotency + webhooks | PR-API1 | contrato versionado estable | OpenAPI + contract-tests | No exponer API sin versioning |
| UX/product | Radix/no-scroll | tokens + KPIs + premium certificado | PR-UX1/2/3 | KPIs operativos medidos | tokens doc + KPIs | No rewrite de dashboard |
| Accessibility | a11y keyboard E2E | criterios axe aceptados | PR-A11Y1 | 100% criterios críticos | axe report | No marcar a11y "ok" sin herramienta |
| Documentation | 174 docs sin índice | índice + SoT + ADR + runbooks | PR-O1/O2 | 100% dominios en SoT | índice + mapa | No mover docs sin índice |
| Dependencies | overrides + Dependabot | política + SLA + risk register | PR-DEP1/GOV3 | dep risk age <7d (seguridad) | dep audit + policy | No adoptar deps sin consumidor |
| AI workflow | protocolo + skills | prompt-packs + SoT + reglas auditoría | PR-O4/O5 | auditorías referencian SoT | prompt-pack index | No dejar a Claude elegir prioridad sin matriz |

---

## 10. Anti-Patterns to Block

| Anti-patrón | Por qué se bloquea | Alternativa controlada |
| --- | --- | --- |
| Rewrites grandes | Destruye activos maduros | Instrumentar/aditivo por dominio |
| Adopción amplia de deps | 3 deps ya sin uso | Resolver react-query/table/echarts primero |
| Dashboard rewrite antes de governance/security/observability | Inversión sin red ni evidencia | Wave 8 tras Gates 0–5 |
| CI sin validación de scripts | Pérdida de cobertura silenciosa | Validar `unión==42` antes de PR-C3 |
| Mover E2E antes de estabilidad de capas | Rompe scripts por-ruta (#1096) | No mover hasta capas+CI estables |
| Visual mezclado con security | Diff irrevisable, riesgo cruzado | PRs separados (un eje) |
| Producto mezclado con docs/SoT | Confunde control con feature | PRs separados |
| Backend+frontend en un PR sin contrato | Blast radius | Contract-only o PRs separados |
| Realtime en todo | Sin valor probado | Refetch/polling; Wave 9 condicional |
| PWA-offline de datos privados | Cache de privados | PWA pública actual |
| Micro-frontends | Sin equipos independientes | Monorepo + App Router |
| CRDTs sin co-edición | Complejidad sin caso | Bloqueo optimista |
| WebGL sin visualización masiva | Riesgo sin necesidad | ECharts (ya instalado) |
| Mover docs históricos sin índice | Rompe referencias/tests por path | PR-O1/O2 primero, move-only después |
| Re-auditar bloques cerrados | Desperdicio de tokens | Consultar closeouts/SoT |
| Claude elige prioridad sin matriz | Decisión no trazable | Matriz P0–P3 obligatoria |

---

## 11. Supreme Metrics

| Categoría / Métrica | Target | Evidencia actual | First PR para medir | Owner/Dominio | Frecuencia |
| --- | --- | --- | --- | --- | --- |
| Governance maturity | 100% controles §3 con doc | ~0 | PR-GOV2 | Governance | por release |
| Source-of-truth coverage | 100% dominios en SoT | 0 (sin mapa) | PR-O2 | Docs | por audit |
| Audit closure rate | 100% bloques con closeout | parcial | PR-O1 | Docs | mensual |
| PR size/risk | <~400 LOC, 1 eje | alto (disciplina ya buena) | PR-GOV1 | Eng | por PR |
| CI duration | full <12min | sin reporte | PR-C3 | CI | por corrida |
| E2E smoke duration | <4min | sin medición | PR-C3 | CI | por corrida |
| Full regression duration | <12min | sin medición | PR-C3 | CI | por corrida |
| Flaky rate | <1% | sin registro | PR-QA1 | QA | semanal |
| Incident detection time (MTTD) | <5min | manual | PR-OBS1 | SRE | por incidente |
| Incident diagnosis time | <30min | manual | PR-OBS1/S3 | SRE | por incidente |
| Rollback time objective | <15min | sin drill | PR-REL1 | Release | por release |
| Structured log coverage | 100% rutas | 0 (console) | PR-OBS2 | SRE | por release |
| Correlation ID coverage | 100% FE↔BE | parcial (BE) | PR-S3 | SRE | por release |
| API latency p95 | <400ms lectura/<800ms escritura | `runtime-timing` sin agregar | PR-PERF1 | Backend | continuo |
| Dashboard load time | LCP<2.5s/<3.5s | sin medición | PR-PERF2 | FE | por release |
| Public report load time | LCP<2.0s | sin medición | PR-PERF2 | FE | por release |
| Accessibility acceptance | 100% criterios críticos | a11y E2E parcial | PR-A11Y1 | UX | por release |
| Dependency aging (seguridad) | <7d | 19 PRs desde 2026-06-18 | PR-DEP1 | Governance | semanal |
| Security invariant coverage | 100% invariantes con test | alto | PR-S1 | Security | por release |
| Docs freshness | 0 docs vigentes sin clasificar | 174 sin índice | PR-O1/O3 | Docs | por audit |

---

## 12. Supreme Readiness Narrative

VETNEB está hoy en un **baseline SaaS sólido (≈2.1/5 multinacional)** con cimientos que muchas
empresas no alcanzan: separación estricta de superficies, postura de seguridad fuerte, disciplina de
testing y control de cambios maduro. Lo que falta es **madurez operacional y de gobierno**, no
arquitectura.

**Por qué el camino es incremental.** El sistema tiene perfil "T invertida": transversales fuertes,
instrumentación débil. Subir los transversales (governance, observability, data) **eleva todas las
superficies a la vez**; reescribir las destruiría. Cada wave es aditiva, reversible y con gate.

**Por qué governance/source-of-truth va primero.** Sin índice, mapa de fuentes de verdad, ADRs y risk
register, cada wave posterior paga el costo de re-descubrir contexto y carece de decisión trazable —
exactamente lo que una due-diligence multinacional exige ver primero. Es además el wave de **menor
riesgo** (docs-only).

**Por qué observability/security/performance preceden a la expansión de producto.** Hacer trabajo
visual pesado sin logs estructurados, sin verificación de aislamiento de tenant y sin budgets es
construir sobre terreno no medido: un incidente sería ciego, una regresión de performance invisible y
un cruce de datos indetectable. Los Gates 3–5 instalan la red antes de acelerar.

**Cómo encaja el trabajo premium de dashboard de forma segura.** El pulido premium (Wave 8) llega
**después** de los gates de fundación, sobre los contratos no-scroll ya logrados, con tokens y KPIs
documentados y separando siempre lo visual de lo de seguridad/CI. Así el premium es **medible y
reversible**, no cosmético.

**Por qué esto es más fuerte que un rewrite.** Un rewrite tiraría ~400 tests, 42 E2E y un backend
modular para resolver problemas aditivos, introduciendo riesgo masivo y meses sin evidencia. La ruta
de waves entrega **evidencia de DD en cada paso** y mantiene producción intacta.

**Cómo soporta DD multinacional y confianza enterprise.** Al cerrar los gates, VETNEB acumula un
**evidence room** (ADRs, risk register, security audit, SLOs, runbooks, budgets, lifecycle de datos)
que responde directamente a las preguntas de una venta enterprise: ¿cómo deciden?, ¿cómo aíslan
datos?, ¿cómo operan incidentes?, ¿cómo recuperan?, ¿cómo miden calidad?

---

## 13. Final Recommendation

1. **¿Próximo PR exacto?** **PR-O1 docs-only** — `docs/audit/README.md` (índice de auditorías
   vigentes con estado).

2. **¿Qué commitear/mergear antes de iniciar el plan?** **Wave 0:** las 3 auditorías base + este plan
   (hoy untracked) → commit docs-only a `main` por Nico. Sin esto, el plan ejecuta sobre scope sin
   cerrar.

3. **¿Camino más rápido y seguro a nivel supremo?** Gates en orden: 0 (SoT) → 1 (governance) → 2 (CI)
   → 3 (security/RLS) → 4 (observability) → 5 (performance) → 6 (data/API) → 7 (UX). Aditivo, por
   waves, sin rewrites.

4. **¿Qué se retrasa hasta pasar governance/security/observability?** Todo trabajo visual/producto
   grande (Wave 8), API externa/webhooks (Wave 7), y capacidades avanzadas (Wave 9).

5. **¿Qué familia de PR da más valor inmediato?** **PR-O** (ordering/SoT) — desbloquea todo y reduce
   consumo de IA ya.

6. **¿Qué familia reduce más riesgo?** **PR-S** (security/aislamiento, incl. verificación RLS/tenant)
   — ataca el riesgo más caro: cruce de datos clínicos multi-tenant.

7. **¿Qué familia sube más la calidad premium percibida?** **PR-UX** (tokens + KPIs + premium) —
   pero solo en Wave 8, tras los gates de fundación.

8. **¿Qué familia sube más la confianza multinacional?** **PR-GOV** + **PR-OBS** (governance +
   observabilidad/SLO/runbook) — son la base del evidence room de DD.

9. **¿Qué familia mejora más la eficiencia de Claude?** **PR-O** (índice + SoT map + prompt-packs) —
   convierte 174 docs en un punto de entrada único.

10. **¿Qué NO debe hacerse bajo ninguna circunstancia ahora?** Rewrites (backend/frontend/dashboard),
    adopción amplia de deps, tocar CI sin validación local, mover E2E/docs sin índice, mezclar
    visual+security en un PR, realtime/PWA-offline de privados/micro-frontends/CRDTs/WebGL, y dejar a
    Claude elegir prioridades sin matriz.

---

## Appendix — Verification Notes (this run)

| Afirmación | Resultado | Comando |
| --- | --- | --- |
| HEAD/estado base | `8e29cc2`, worktree único, 19 PRs Dependabot | `git log/worktree/gh pr list` |
| 3 auditorías base untracked | Confirmado (`??` las tres) | `git status` + `git ls-files` |
| E2E capeado (#1096) | Confirmado en sesión previa (7+13+11+11=42) | contexto |
| Dependabot aging | 19 PRs desde 2026-06-18 | `gh pr list` |

> Marcado **"Requires focused audit before implementation"**: tenant/RLS a nivel DB, privileged-action
> audit coverage, backup/restore real, consistencia de fechas críticas, `select('*')`/índices,
> cobertura a11y con axe. No se afirman como hechos; cada uno tiene su PR de auditoría enfocada.

---

## Final validation

```powershell
git status --short --untracked-files=all
git diff --name-only
git diff --stat
git diff --check
```

**Resultado esperado** (este plan solo agrega un archivo **untracked**):

- `git status --short --untracked-files=all` → las 3 auditorías previas untracked + este nuevo
  `?? docs/audit/vetneb-supreme-system-level-alignment-plan.md`
- `git diff --name-only` / `git diff --stat` → vacíos (sin tracked modificados)
- `git diff --check` → limpio

> Los comandos los ejecuta Nico manualmente. Este plan **no** ejecuta `git add/commit/push`,
> `gh pr create/merge` ni comandos con `exit`.
