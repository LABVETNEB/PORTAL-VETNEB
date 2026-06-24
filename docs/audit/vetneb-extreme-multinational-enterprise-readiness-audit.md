# VETNEB Extreme Multinational Enterprise Readiness — Audit

> **docs-only · auditoría de segundo nivel.** Este documento audita y critica
> `docs/audit/vetneb-enterprise-engineering-readiness-audit.md` y lo eleva a un estándar de
> **empresa multinacional extrema**. **No** modifica código productivo, `frontend/src`, `frontend/e2e`,
> `server`/backend, `test`, `.github/workflows`, `package.json`, `frontend/package.json`,
> `pnpm-lock.yaml`, Playwright config, `scripts`, `drizzle`/migraciones, deps, lockfiles, CI,
> screenshots ni generados. No mueve, renombra ni borra archivos. No re-audita el repo desde cero:
> solo verifica afirmaciones de alto riesgo. Cada hallazgo se ata a un PR chico o a una auditoría
> enfocada posterior.
>
> Skills VETNEB aplicadas (declaradas, ya cargadas en esta sesión): briefing-planificación,
> staff-senior-full-stack, web-end-to-end-global, security-production-invariants,
> admin-dashboard-operational-actions, production-web-optimization-engineer, pwa-end-to-end,
> lanzamiento-mantenimiento, bugs-errores-optimización-rutas, protocolos-comunicación. Prevalece el
> Protocolo Maestro VETNEB y el flujo Git manual de Nico.

---

## 1. Executive Summary

**Calidad de la auditoría previa: alta, pero de alcance "enterprise SaaS", no "multinacional".** El
`vetneb-enterprise-engineering-readiness-audit.md` es un documento sólido: evidencia trazable,
scorecard de 20 dominios, matriz de tecnología con disciplina "not recommended now", secuencia de
PRs con rollback y apéndice de trazabilidad. Como diagnóstico de **baseline de ingeniería SaaS** es
correcto y accionable.

**¿El 2.7/5 es exacto?** Para la rúbrica que usó (5 = "enterprise-grade"), **sí, es razonable**.
Re-medido contra la rúbrica **multinacional** más estricta de este documento (5 = multinacional-grade,
4 = enterprise-ready, 3 = baseline SaaS sólido), el **score corregido baja a ≈2.1/5** — no porque el
sistema empeore, sino porque **el listón sube** y porque la auditoría previa **omitió dos dominios
enteros**: (A) **gobernanza de ingeniería corporativa** y (J) **capa de confianza ejecutiva
multinacional**, además de facetas multinacionales específicas (residencia de datos, i18n/l10n,
modelo de tenant/RLS verificado, soporte/escalamiento). Por eso el 2.7 es **ligeramente optimista**
para la pregunta multinacional.

**Qué le faltó a la auditoría previa (resumen):**

1. **No hay capa de gobernanza:** sin ADRs, sin RFC/change-control, sin risk register, sin
   Production-Readiness Review (PRR), sin modelo de ownership/CODEOWNERS, sin trazabilidad de
   decisiones. Es el vacío #1 para una multinacional.
2. **No verificó el aislamiento multi-tenant a nivel datos.** La frontera por `clinic_id` existe y es
   fuerte a nivel **aplicación** (middlewares + RBAC + `permissions.ts`), pero **RLS a nivel DB no
   está verificada** (Grep confirma `clinic_id`/`clinicId` masivo, no confirma policies). Para datos
   clínicos multi-cliente es un control crítico.
3. **No tocó dimensiones multinacionales:** residencia de datos, i18n/l10n (producto **español
   único**, Grep i18n=14 hits solo `Intl.`/SEO), multi-moneda (solo ARS), zonas horarias,
   DPA/privacidad por jurisdicción.
4. **No propuso un "evidence room" de cumplimiento** para due-diligence (DD) de ventas enterprise.
5. **Sin capa de soporte/escalamiento/on-call** ni narrativa de confianza ejecutiva.
6. **Recomendaciones sin criterio de aceptación medible** en varios PRs docs (p. ej. "design tokens",
   "valor operativo") y **sin rollback-drill ni data-impact** (lo exige `docs/review-governance.md`).

**Gaps de mayor riesgo (multinacional):** (P0) gobernanza ausente; (P0) aislamiento de tenant/RLS
sin verificar; (P0) ceguera de observabilidad (logger `console.*` plano); (P0) source-of-truth/índice
inexistente; (P1) sin budgets de performance ni gate CI por capas; (P1) Dependabot **envejeciendo**
(19 PRs abiertas desde 2026-06-18).

**Pasos de mayor valor:** instituir **gobernanza docs-only** (ADR + risk register + release/rollback
checklist + índice/SoT), cerrar el **gate de CI** (PR-C3) con política de flakes, y **abrir el
camino de observabilidad** (runbook + logger estructurado) — todo aditivo, sin reescrituras.

**Próximo PR exacto recomendado:** **PR-O1 docs-only** — `docs/audit/README.md` (índice de
auditorías vigentes con estado). Cero riesgo, prerequisito de toda la cadena de gobernanza.

---

## 2. Audited Base

| Campo | Valor |
| --- | --- |
| Branch | `main` |
| HEAD | `8e29cc2 test(e2e): add layered e2e scripts (#1096)` |
| `origin/main` | `8e29cc2` (idéntico) |
| `git status --short --untracked-files=all` | `?? docs/audit/repository-operational-ordering-audit.md`, `?? docs/audit/vetneb-enterprise-engineering-readiness-audit.md` (+ este archivo nuevo) |
| Worktree | único — `C:/PORTAL-VETNEB 8e29cc2 [main]` |
| Open PRs | **19, todas Dependabot** (#1018–#1038), más antiguas con timestamp 2026-06-18 |
| Fecha | 2026-06-23 |
| Plataforma | Windows / PowerShell / PNPM 10.8.1 |

**Archivo primario auditado:** `docs/audit/vetneb-enterprise-engineering-readiness-audit.md` (leído
completo; autoría de esta misma sesión).

**Archivos de soporte leídos/consultados:** `docs/audit/repository-operational-ordering-audit.md`
(contexto de source-of-truth; sesión previa), `docs/audit/e2e-ci-layering-strategy-audit.md`
(contexto E2E; sesión previa), `AGENTS.md` + `docs/protocol/vetneb-ai-working-protocol.md` +
`docs/review-governance.md` (gobernanza existente; sesión previa).

**Comandos de búsqueda ejecutados (verificación de alto riesgo, no re-auditoría):**

```
git branch --show-current ; git status --short --untracked-files=all ; git log -1 --oneline
git log --oneline --decorate -n 30 ; git branch ; git worktree list ; gh pr list --state open
rg "2\.7|enterprise-grade|scorecard" docs/audit/vetneb-enterprise-engineering-readiness-audit.md
Grep (server): rls|policy|tenant|clinic_id|i18n|locale|currency|timezone|region → 420/30 (dominado por clinic_id)
Grep (frontend/src): i18n|locale|next-intl|Intl.|currency|ARS|USD|timezone → 14/9 (solo Intl./SEO; sin framework i18n)
```

**Archivos leídos completos en esta corrida:** 1 (`vetneb-enterprise-engineering-readiness-audit.md`).
**Inspeccionados por snippet/grep:** `server/**`, `frontend/src/**` (solo conteos para verificar
tenant/i18n). **No** se re-abrieron los archivos ya auditados en las dos corridas previas.

**Confirmación de scope.** Solo se crea
`docs/audit/vetneb-extreme-multinational-enterprise-readiness-audit.md`. No se modificó, movió,
renombró ni borró ningún otro archivo. No se ejecutó `git add/commit/push`, `gh pr create/merge`. No
se instalaron dependencias. No se levantó `next dev`. **Esta auditoría es docs-only.**

---

## 3. Audit of the Previous Enterprise Readiness Document

### 3.1 Fortalezas (conservar)

| Fortaleza | Evidencia en el doc previo |
| --- | --- |
| Evidencia trazable | Apéndice "Evidence Traceability Map" (claim → archivo/símbolo) |
| Scorecard estructurado | 20 dominios con score/gap/riesgo/PR/prioridad |
| Disciplina tecnológica | Matriz "Recommended now / later / conditional / not now" con condición de adopción |
| Hallazgo de deps muertas | react-query/react-table/echarts instaladas sin consumidor |
| PRs chicos + rollback | §18 secuencia con tipo/scope/no-scope/validación/rollback |
| Lectura correcta del perfil | "T invertida": cimientos fuertes, instrumentación débil |

### 3.2 Debilidades y vacíos (corregir en este documento)

| # | Debilidad | Tipo | Corrección aquí |
| --: | --- | --- | --- |
| 1 | **Falta dominio de gobernanza** (ADR/RFC/risk register/PRR/ownership) | Dominio faltante | Dominio A + §9 + Fase 0 |
| 2 | **Falta capa de confianza ejecutiva/DD** | Dominio faltante | Dominio J + §13 |
| 3 | **No verifica aislamiento de tenant/RLS** | Claim no verificado | Dominio B/G, P0, "focused audit" |
| 4 | **Ignora i18n/l10n, multi-moneda, residencia, zonas horarias** | Faceta multinacional faltante | Dominio B/F/H, conditional |
| 5 | **Recos sin criterio de aceptación medible** (design tokens, valor operativo) | Reco vaga | §12 métricas + acceptance por PR |
| 6 | **Rollback genérico ("borrar archivo"); sin rollback-drill ni data-impact** | Rollback incompleto | §10/§11 con data-impact + drill |
| 7 | **SLOs mencionados sin números** | Reco no medible | §12 con targets numéricos |
| 8 | **Scores calibrados a "enterprise SaaS", no multinacional** | Score optimista | §4 re-scoring rúbrica estricta |
| 9 | **No clasifica evidencia de cumplimiento (evidence room)** | Control faltante | §9 + Fase 5 |
| 10 | **No define modelo de soporte/escalamiento** | Control faltante | Dominio C/J + §9 |
| 11 | **Dependabot tratado como "backlog", no como métrica de riesgo con SLA** | Métrica faltante | §12 (dependency risk age) |
| 12 | **Privileged-action logging asumido, no verificado** | Claim a verificar | Dominio B, "focused audit" |

### 3.3 Claims que requieren auditoría enfocada posterior (no afirmar como hecho)

- **Tenant isolation / RLS** a nivel DB (solo verificado a nivel app).
- **Privileged-action audit coverage** (qué acciones admin mutantes quedan en `audit-log`).
- **Backup/restore real** (existe doc `BACKUP_RESTORE_ROLLBACK.md`; no hay evidencia de restore drill).
- **Consistencia de fechas críticas** estudio→entrega.
- **`select('*')`/índices** en `db-*.ts`.
- **Cobertura a11y** con herramienta (axe).

---

## 4. Corrected Extreme Enterprise Scorecard

> Rúbrica multinacional: **0** ausente · **1** ad hoc · **2** parcial · **3** baseline SaaS sólido ·
> **4** enterprise-ready · **5** multinacional-grade. "Prev." mapea los dominios del scorecard previo
> (20 dominios) a los dominios A–J de este modelo.

| Dom | Dominio | Prev. (rúbrica SaaS) | Corregido (rúbrica multinacional) | Target 5/5 multinacional | Gap | Riesgo | Primer PR | Prio |
| --- | --- | :--: | :--: | --- | --- | --- | --- | :--: |
| **A** | Corporate engineering governance | *(ausente)* ~1 | **1** | ADRs, RFC/change-control, CODEOWNERS, PRR gate, risk register, release checklist, decision traceability | Sin proceso de decisión formal | Cambios sin aprobación/traza | PR-GOV1 docs | **P0** |
| **B** | Security & compliance governance | 4+4 | **3** | + secret-scanning CI, privileged-action log verificado, RLS verificada, retención/export/delete, residencia, evidence room | App-layer fuerte; DB/compliance sin evidencia | Aislamiento/compliance no demostrable | PR-S1 docs | **P0** |
| **C** | Production operations & SRE | 2 | **2** | Logs estructurados, correlación FE↔BE, métricas, alerting, SLO/SLA, runbooks, error budgets, synthetic checks, rollback drills, ownership | Logger `console.*`; sin alerting/SLO/runbook | Ceguera en incidentes; MTTR alto | PR-OBS1 docs | **P0/P1** |
| **D** | Quality engineering maturity | 4+3 | **3** | + capas E2E en CI, flake policy, coverage invariants, contract tests, release gates, test ownership | Volumen alto; sin gate por capa ni flake policy | Regresión/flake silenciosa | PR-C3 CI | **P1** |
| **E** | Enterprise product operability | 3+3+3 | **3** | + KPIs operativos, executive reporting, a11y certificada, premium polish verificado | Dashboards reales; sin KPIs ni a11y formal | UX no medida | PR-UX1 docs | P2 |
| **F** | Integration & platform maturity | 1+3 | **2** | + versioning, OpenAPI, idempotency, webhooks firmados, event schema versioning, SDK, tenant boundary model | API interna sólida; sin contrato externo | No integrable por terceros | PR-API1 docs | P2 |
| **G** | Data governance & auditability | 2+2 | **2** | + modelo canónico, lifecycle states, historia inmutable, lineage, retención, restore evidence, reconciliación | Audit/tracking existen; sin políticas | Cumplimiento/soporte | PR-DATA1 docs | P1/P2 |
| **H** | Scalability, performance, resilience | 1+3 | **2** | + budgets enforced, latency SLOs, caching policy, async candidates, graceful degradation, failover | Caches sí; sin budgets/medición | Degradación invisible | PR-PERF1 docs | P1 |
| **I** | Documentation & knowledge transfer | 2+3 | **2** | + índice, SoT map, ADRs, API/onboarding/runbooks, prompt packs, clasificación histórica | 174 docs sin índice/mapa | Re-descubrimiento costoso | PR-O1/O2 docs | **P0** |
| **J** | Multinational executive trust layer | *(ausente)* ~1 | **1** | Exec reporting, evidence room, risk review, compliance/DD pack, narrativa seguridad/reliability | Sin artefactos de DD | Bloquea ventas enterprise | PR-GOV2/REL1 docs | P1 |

**Score multinacional corregido = (1+3+2+3+3+2+2+2+2+1)/10 = ≈2.1/5** (rango 2.0–2.3). **Veredicto:**
el 2.7 previo se **corrige a la baja** para la pregunta multinacional, y se agregan **2 dominios
ausentes** (A, J). El sistema sigue siendo un baseline SaaS sólido; la brecha a multinacional es de
**gobernanza, evidencia y operación**, no de arquitectura.

---

## 5. P0 Foundation Gaps

> P0 = requerido antes de poder **afirmar** enterprise/multinacional. Prioridad por la fórmula
> Extreme Enterprise Priority (riesgo seguridad/incidente/datos/operación/confianza + confianza de
> implementación − complejidad − blast radius). Los P0 son mayormente **docs-only** (bajo blast
> radius, alto valor de control).

### P0-1 — Gobernanza de ingeniería inexistente (Dominio A/I)

- **Evidencia:** existe protocolo (`AGENTS.md`, `vetneb-ai-working-protocol.md`) y `review-governance.md`,
  pero **no** hay ADRs, RFC/change-control, CODEOWNERS, risk register, PRR ni índice/SoT.
- **Por qué bloquea multinacional:** una multinacional exige **decisiones trazables y aprobables**;
  sin ADR/risk register no hay narrativa de control interno para DD.
- **Dirección mínima:** plantillas ADR + RFC + risk register + release/rollback checklist en `docs/`;
  índice de auditorías + SoT map.
- **First safe PR:** PR-O1 (índice) → PR-O2 (SoT) → PR-GOV1 (ADR/RFC) → PR-GOV2 (risk register) →
  PR-REL1 (release/rollback checklist). Todos docs-only.
- **Validación:** `git diff --check`; lectura humana; cada plantilla con ejemplo real.
- **Rollback:** borrar archivos (docs-only). **Data impact:** ninguno.
- **Owner/dominio:** Engineering governance (Nico).
- **Dependencias:** ninguna.

### P0-2 — Aislamiento multi-tenant a nivel datos no verificado (Dominio B/G)

- **Evidencia:** frontera por `clinic_id`/`clinicId` masiva (Grep: admin-clinics 61, db-logistics 67)
  + middlewares `clinic-permissions`/`auth` + `permissions.ts` + matrices RBAC → **app-layer fuerte**.
  **No** se verificó RLS/policies a nivel Postgres.
- **Por qué bloquea:** datos clínicos multi-cliente sin defensa en profundidad a nivel DB es el riesgo
  de aislamiento más caro de un multinacional (un bug de query cruza tenants).
- **Dirección mínima:** auditoría enfocada **docs-only** que verifique presencia/ausencia de RLS y
  cobertura de `clinic_id` en cada acceso; **no** implementar RLS aquí.
- **First safe PR:** PR-S1 docs (incluye sección "tenant isolation / RLS verification").
- **Validación:** revisión + (futuro) test de aislamiento cross-tenant.
- **Rollback:** docs. **Data impact:** ninguno (auditoría).
- **Owner:** Security. **Dependencias:** ninguna.

### P0-3 — Ceguera de observabilidad (Dominio C)

- **Evidencia:** `server/lib/logger.ts` = `console.log('[INFO]', …)` no estructurado; sin
  Sentry/OTel/alerting/SLO; request-id existe (`api-request-id.ts`) pero no se propaga a logs
  estructurados ni a soporte.
- **Por qué bloquea:** sin logs estructurados + runbook no hay diagnóstico de incidentes ni narrativa
  de reliability para DD.
- **Dirección mínima:** runbook + baseline (docs) → logger JSON reutilizando request-id (1 archivo +
  test). Sentry/OTel = posterior.
- **First safe PR:** PR-OBS1 docs → PR-S2 backend-only (logger estructurado).
- **Validación:** test de shape del log; sin secretos; `pnpm test`.
- **Rollback:** revertir `logger.ts`. **Data impact:** logs (verificar no-secretos).
- **Owner:** SRE/backend. **Dependencias:** PR-OBS1 antes de PR-S2.

### P0-4 — Source-of-truth / índice inexistente (Dominio I)

- **Evidencia:** auditoría de ordenamiento ya documentó 174 docs sin índice/SoT.
- **Por qué bloquea:** onboarding, DD y consumo de IA dependen de un punto de entrada único.
- **First safe PR:** PR-O1 (índice) + PR-O2 (SoT map).
- **Validación / Rollback:** lectura humana / borrar. **Data impact:** ninguno.
- **Owner:** Docs. **Dependencias:** ninguna (es la base).

### P0-5 — Gate de calidad CI sin capas + sin política de flakes (Dominio D)

- **Evidencia:** capas `e2e:*` existen (#1096); CI corre el step "smoke" = full; sin flake/coverage
  policy.
- **Por qué bloquea:** riesgo de **pérdida silenciosa de cobertura** al cambiar CI sin política.
- **Dirección mínima:** validar localmente `unión == 42`; luego PR-C3 CI-only aditivo; PR-QA1 docs
  (flake/regression policy).
- **First safe PR:** PR-QA1 docs → PR-C3 CI-only.
- **Validación:** suma specs por capa == 42; CI verde; seguridad siempre en gate.
- **Rollback:** revertir workflow. **Data impact:** ninguno.
- **Owner:** QA/CI. **Dependencias:** validación local previa.

---

## 6. P1 High-Value Multinational Maturity Gaps

### P1-1 — Risk register vivo (Dominio A/J)

- **Evidencia:** ninguno. **Por qué:** DD multinacional exige registro de riesgos con dueño/mitigación.
- **First PR:** PR-GOV2 docs. **Validación:** revisión. **Rollback:** borrar. **Owner:** Governance.
- **Dependencias:** PR-O1.

### P1-2 — Logger estructurado + correlación FE↔BE (Dominio C)

- **Evidencia:** request-id backend; sin propagación FE ni surface a soporte.
- **First PR:** PR-S2 (logger JSON) → PR-S3 (correlation IDs FE↔BE).
- **Validación:** test de shape + e2e que verifique header de correlación. **Rollback:** revertir
  archivos. **Data impact:** logs sin secretos. **Owner:** SRE.

### P1-3 — Performance budgets medibles (Dominio H)

- **Evidencia:** sin budgets/medición; sin `next/dynamic`.
- **First PR:** PR-PERF1 docs (spec budgets) → medición posterior.
- **Validación:** comparación build size vs budget. **Rollback:** docs/medición aditiva. **Owner:** FE/Perf.

### P1-4 — Data lifecycle + retención (Dominio G)

- **Evidencia:** audit/tracking existen; sin políticas de retención/export/delete; restore sin evidencia.
- **First PR:** PR-DATA1 docs (lifecycle + retención propuesta; legal flags).
- **Validación:** revisión + confirmación Nico. **Rollback:** docs. **Owner:** Data/Legal.

### P1-5 — Dependency governance + Dependabot SLA (Dominio A/B)

- **Evidencia:** `pnpm.overrides` (manual) + **19 PRs Dependabot abiertas desde 2026-06-18**.
- **Por qué:** deps envejeciendo = superficie CVE y deriva; falta política de cadencia/agrupado.
- **First PR:** PR-GOV3 docs (dependency governance + SLA de merge de seguridad) ; **no** mezclar con
  feature work.
- **Validación:** edad de PR Dependabot. **Rollback:** docs. **Owner:** Governance.

### P1-6 — Release readiness + rollback drill (Dominio A/C)

- **Evidencia:** `review-governance.md` exige rollback+data-impact; no hay checklist de release ni drill.
- **First PR:** PR-REL1 docs. **Validación:** revisión. **Rollback:** docs. **Owner:** Release.

### P1-7 — Capa de confianza ejecutiva / DD pack (Dominio J)

- **Evidencia:** ninguna. **First PR:** PR-EXEC1 docs (narrativa + evidence room índice).
- **Validación:** revisión. **Rollback:** docs. **Owner:** Eng leadership.

---

## 7. P2 / P3 Advanced Capabilities

> Importantes pero dependientes de P0/P1. **No** se promueven a P0 sin evidencia que lo exija.

| Item | Dominio | Prio | Condición/Dependencia | Primer PR |
| --- | --- | :--: | --- | --- |
| KPIs operativos + executive reporting dashboard | E/J | P2 | Tras observabilidad (C) | PR-UX1 docs |
| Accessibility acceptance criteria (axe) | E | P2 | Tras CI gate (D) | PR-A11Y1 docs |
| API governance / OpenAPI desde zod | F | P2 | Demanda externa real | PR-API1 docs |
| Idempotency keys (mutaciones expuestas) | F | P2 | Pre-exposición externa | post PR-API1 |
| Webhooks firmados (HMAC) + event schema versioning | F | P3 | Consumidor externo | post PR-API1 |
| SDK cliente | F | P3 | OpenAPI estable | post PR-API1 |
| Async jobs / cola (email/PDF/report-workflow) | H | P3 | Trabajos largos que bloqueen request | PR-ASYNC1 docs |
| i18n/l10n framework | B/E | P3 | **Expansión internacional real** | PR-I18N1 docs (conditional) |
| Multi-moneda (hoy ARS) | F/G | P3 | Venta en otra moneda | post PR-DATA1 |
| Data residency / multi-region | B/H | P3 | Requisito legal por país | requires legal/domain confirmation |
| Tenant model formal (más allá de `clinic_id`) | F/G | P2 | Multi-cliente a escala | post PR-S1 |
| Synthetic monitoring / uptime externo | C | P2 | Tras SLOs | post PR-OBS1 |
| Error budgets formales | C | P2 | Tras SLOs + métricas | post PR-OBS1 |

---

## 8. Not Recommended Now

| Capacidad | Por qué no ahora | Condición que lo haría válido | Alternativa actual más simple |
| --- | --- | --- | --- |
| Micro-frontends / Module Federation | Monorepo único, sin equipos independientes | Independencia real de equipos/módulos | App Router + closeouts |
| CRDTs / Yjs / Automerge | Sin edición concurrente | Co-edición real con conflicto | Bloqueo optimista |
| WebGL dashboards | Sin visualización masiva | >100k puntos en una vista | ECharts (ya instalado) canvas |
| Full offline / PWA de datos privados | Riesgo de cachear privados | Política de cache de privados resuelta y auditada | PWA pública actual (`sw.js`) |
| Realtime en todo | Sin valor de usuario probado | Caso concreto medible (estado vivo crítico) | Refetch/polling |
| Backend rewrite | Backend es el activo más maduro | — (nunca como "mejora") | Instrumentar + contratos |
| Frontend rewrite | Base limpia, deuda baja (14 hits) | — | Optimización incremental |
| Adopción amplia de dependencias | 3 deps ya instaladas sin uso | Gap probado con consumidor | Resolver react-query/table/echarts primero |
| Rewrite grande de dashboard | Contratos no-scroll ya logrados | — | Pulido por superficie con `visual-contract` |

---

## 9. Multinational-Grade Controls Missing from Current Plan

| Control | Evidencia actual | Evidencia faltante | Riesgo | Prio | Primer PR |
| --- | --- | --- | --- | :--: | --- |
| **ADRs** | ninguna | template + decisiones clave registradas | Decisiones sin traza | P0 | PR-GOV1 |
| **RFC / change control** | protocolo de scope | proceso de propuesta/aprobación | Cambios sin gate | P0 | PR-GOV1 |
| **Source-of-truth map** | auditoría de ordenamiento lo pide | `docs/SOURCES_OF_TRUTH.md` | Re-descubrimiento | P0 | PR-O2 |
| **Audit index** | closeouts dispersos | `docs/audit/README.md` | Navegación lenta | P0 | PR-O1 |
| **Risk register** | ninguna | registro vivo con dueño/mitigación | DD sin control interno | P1 | PR-GOV2 |
| **Incident response runbook** | ninguna | runbook + severidades + roles | MTTR alto | P0/P1 | PR-OBS1 |
| **Release readiness checklist** | `review-governance.md` parcial | checklist versionado | Releases riesgosos | P1 | PR-REL1 |
| **Rollback checklist + drill + data impact** | rollback genérico | drill + data-impact por PR | Recuperación incierta | P1 | PR-REL1 |
| **Security review checklist** | tests `security-*` | checklist de gate por PR | Brecha por omisión | P1 | PR-S1 |
| **Dependency governance + Dependabot SLA** | `pnpm.overrides` manual | política/cadencia + SLA seguridad | CVE aging (19 PRs) | P1 | PR-GOV3 |
| **SLO/SLA draft** | health checks | SLOs numéricos | Sin objetivo de fiabilidad | P1 | PR-OBS1 |
| **Structured logs** | `logger.ts` console | JSON + niveles + campos | Sin diagnóstico | P0/P1 | PR-S2 |
| **Correlation IDs (FE↔BE)** | request-id backend | propagación + surface soporte | Trazabilidad parcial | P1 | PR-S3 |
| **Audit logs (privileged actions)** | `audit-log.ts` existe | verificación de cobertura de acciones admin | Acciones sin traza | P1 | PR-S1 (verify) |
| **Backup/restore evidence** | `BACKUP_RESTORE_ROLLBACK.md` | evidencia de restore drill | Recuperación no probada | P1 | PR-DATA1 |
| **Data retention policy** | ninguna | política + flags legales | Cumplimiento | P1 | PR-DATA1 |
| **OpenAPI / API governance** | API interna `/api` | contrato + versionado | No integrable | P2 | PR-API1 |
| **Webhook governance** | ninguna | firma + retry + schema versioning | Integración insegura | P3 | post PR-API1 |
| **Performance budgets** | ninguna | budgets + medición | Degradación invisible | P1 | PR-PERF1 |
| **Accessibility acceptance criteria** | `dashboard-accessibility-keyboard` | criterios axe formales | Exclusión/legal | P2 | PR-A11Y1 |
| **Support escalation process** | ninguna | niveles + SLA soporte | Soporte improvisado | P2 | PR-EXEC1 |
| **Tenant isolation / RLS evidence** | app-layer (`clinic_id`+RBAC) | RLS DB verificada | Cross-tenant | P0 | PR-S1 |
| **Compliance evidence room / DD pack** | sanitización + no-secrets | índice de evidencia | Bloquea ventas | P1 | PR-EXEC1 |
| **Ownership model (CODEOWNERS)** | `review-governance.md` lo menciona | CODEOWNERS real | Responsabilidad difusa | P1 | PR-GOV1 |

---

## 10. Extreme Enterprise Implementation Roadmap

> Fases por dependencia. Cada PR es chico, un eje, reversible. Git lo ejecuta Nico.

### Phase 0 — Governance Foundation
- **Objetivo:** índice + SoT + ADR/RFC + risk register + release/rollback checklist + CODEOWNERS.
- **Valor:** control interno y trazabilidad (base de DD).
- **Controles entregados:** ADRs, RFC, risk register, audit index, SoT, release/rollback checklist, ownership.
- **PRs:** PR-O1, PR-O2, PR-GOV1, PR-GOV2, PR-GOV3, PR-REL1 (todos docs-only).
- **Validación:** `git diff --check`, lectura humana, cada plantilla con ejemplo.
- **Rollback:** borrar archivos. **Data impact:** ninguno.
- **DoD:** existe `docs/audit/README.md`, `docs/SOURCES_OF_TRUTH.md`, `docs/governance/{adr,rfc,risk-register,release-checklist}.md`.

### Phase 1 — CI, Quality Gates & Test Governance
- **Objetivo:** capas E2E en CI, split smoke/full, flake policy, coverage invariants, regression strategy.
- **Valor:** feedback rápido sin pérdida de cobertura.
- **Controles:** release gates, flake policy, coverage invariants.
- **PRs:** PR-QA1 docs → (validación local unión==42) → PR-C3 CI-only.
- **Validación:** suma specs por capa == 42; CI verde; seguridad siempre en gate.
- **Rollback:** revertir workflow. **DoD:** smoke gate rápido + full red; step renombrado; flake policy publicada.

### Phase 2 — Security & Auditability
- **Objetivo:** verificar invariantes + RLS/tenant, secret-scanning plan, privileged-action coverage, headers/CSP/rate-limit review.
- **Valor:** demostrabilidad del control más crítico (datos clínicos multi-tenant).
- **Controles:** security review checklist, tenant isolation evidence, secret-scanning, audit coverage.
- **PRs:** PR-S1 docs → PRs security-only acotados.
- **Validación:** `security:public-surface`, suite `security-*`/`auth-*`, (futuro) test cross-tenant.
- **Rollback:** por PR. **DoD:** invariantes verificados + plan de secret-scanning + RLS dictaminada.

### Phase 3 — Observability & Incident Readiness
- **Objetivo:** logs estructurados, correlación FE↔BE, health por dependencia, runbooks, alerting, proceso de incidentes.
- **Valor:** soporte productivo y narrativa de reliability.
- **Controles:** SLO/SLA draft, runbooks, correlation IDs, structured logs.
- **PRs:** PR-OBS1 docs → PR-S2 (logger JSON) → PR-S3 (correlation) → (opcional) Sentry/OTel.
- **Validación:** test de shape de log; e2e de correlación; sin secretos.
- **Rollback:** revertir archivos acotados. **DoD:** logs JSON + runbook + SLOs numéricos.

### Phase 4 — Performance Budgets & Resilience
- **Objetivo:** budgets, latencia API, budgets FE/CI/E2E, candidatos async, degradación elegante.
- **Valor:** predictibilidad de performance.
- **Controles:** performance budgets, latency SLOs.
- **PRs:** PR-PERF1 docs → medición → lazy-load (si se cablean deps) → PR-ASYNC1 docs (candidatos).
- **Validación:** build size + vitals vs budget. **Rollback:** aditivo. **DoD:** budgets en repo + medición.

### Phase 5 — Data Governance & Lifecycle
- **Objetivo:** retención, export/delete, backup/restore evidence, lifecycle estudio/reporte, audit trail, reconciliación.
- **Valor:** cumplimiento y auditabilidad.
- **Controles:** retention policy, restore evidence, lineage, reconciliation.
- **PRs:** PR-DATA1 docs (legal flags) → focused audits.
- **Validación:** revisión + confirmación Nico + (futuro) restore drill en staging.
- **Rollback:** docs. **DoD:** política de retención + lifecycle mapeado + evidencia de restore.

### Phase 6 — Multinational Product Operability
- **Objetivo:** command center admin/clínica, KPIs ejecutivos, no-scroll enterprise, a11y, capa premium.
- **Valor:** confianza operativa y percepción premium.
- **Controles:** KPIs operativos, a11y acceptance, executive reporting.
- **PRs:** PR-UX1 docs → PR-A11Y1 docs → PRs frontend-only por superficie con `visual-contract`.
- **Validación:** `e2e:visual-contract` + QA humana + axe. **Rollback:** por PR. **DoD:** KPIs + tokens + a11y certificada.

### Phase 7 — Integration & Platform Maturity
- **Objetivo:** OpenAPI, versioning, idempotency, webhooks firmados, SDK, contratos de sistemas externos, tenant boundary.
- **Valor:** habilita integración B2B/multinacional.
- **Controles:** API governance, webhook governance, idempotency.
- **PRs:** PR-API1 docs → versioning → OpenAPI desde zod → webhooks → SDK.
- **Validación:** contract-tests; compatibilidad. **Rollback:** versioning aditivo. **DoD:** contrato externo estable.

### Phase 8 — Advanced Capabilities Only When Justified
- **Objetivo:** realtime/colas/PWA-offline/automatización/analytics avanzados **solo con evidencia**.
- **Valor:** condicional al caso de uso.
- **Controles:** por capacidad, con PRD corto + guardrails.
- **PRs:** por capacidad. **Validación/Rollback:** por capacidad. **DoD:** consumidor real + guardrails (no privados en cache, no realtime sin valor).

---

## 11. Recommended PR Sequence

| PR | Tipo | Objetivo | Scope permitido | No-scope | Validación | Rollback | Dependencia | Control entregado |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **PR-O1** | docs-only | Índice de auditorías | `docs/audit/README.md` | mover/editar audits | `git diff --check`, lectura | borrar | — | Audit index |
| **PR-O2** | docs-only | Mapa de fuentes de verdad | `docs/SOURCES_OF_TRUTH.md` (+1 línea AGENTS.md OK Nico) | consolidar carpetas | lectura | borrar/revertir | PR-O1 | SoT map |
| **PR-GOV1** | docs-only | Plantillas ADR/RFC/change-control + CODEOWNERS doc | `docs/governance/*` | tocar `.github/CODEOWNERS` real sin OK | lectura | borrar | PR-O1 | ADR/RFC/ownership |
| **PR-GOV2** | docs-only | Risk register enterprise | `docs/governance/risk-register.md` | inventar riesgos sin evidencia | lectura | borrar | PR-GOV1 | Risk register |
| **PR-GOV3** | docs-only | Dependency governance + Dependabot SLA | `docs/governance/dependency-policy.md` | tocar deps/lockfile | revisión + edad PRs | borrar | PR-GOV1 | Dependency governance |
| **PR-REL1** | docs-only | Release readiness + rollback + data-impact checklist | `docs/ops/release-readiness-checklist.md` | tocar CI | lectura | borrar | PR-O1 | Release/rollback control |
| **PR-QA1** | docs-only | Política de flaky tests + regression strategy | `docs/qa/flaky-and-regression-policy.md` | tocar tests/CI | lectura | borrar | — | Flake policy |
| **PR-C3** | CI-only | Capas E2E en CI sin pérdida de cobertura | `.github/workflows/frontend-ci.yml` | specs/scripts/Playwright config | unión==42; CI verde; renombrar step | revertir workflow | validación local + PR-QA1 | Release gate |
| **PR-S1** | docs-only | Auditoría seguridad/aislamiento (incl. RLS/tenant + privileged audit) | `docs/security/security-session-focused-audit.md` | tocar auth/middlewares | revisión + `security:public-surface` | borrar | PR-O1 | Security review + tenant evidence |
| **PR-OBS1** | docs-only | Baseline observabilidad + SLO numérico + incident runbook | `docs/ops/observability-baseline.md` | tocar logger/CI | revisión | borrar | PR-O1 | SLO/SLA + runbook |
| **PR-S2** | backend-only | Logger estructurado JSON (sin deps si posible) | `server/lib/logger.ts` + su test | otras capas | test shape, `pnpm test`, no-secretos | revertir 1 archivo | PR-OBS1 | Structured logs |
| **PR-S3** | backend/security-only | Correlation/request IDs FE↔BE (si factible) | `server/lib/api-request-id.ts` + propagación | otras capas | e2e de correlación | revertir | PR-S2 | Correlation IDs |
| **PR-PERF1** | docs-only | Spec de performance budgets | `docs/perf/performance-budgets.md` | medir/instrumentar | revisión | borrar | — | Performance budgets |
| **PR-DATA1** | docs-only | Auditoría lifecycle + retención (legal flags) | `docs/data/data-governance-audit.md` | inventar obligaciones legales | revisión + Nico | borrar | PR-O1 | Retention + lifecycle |
| **PR-API1** | docs-only | Readiness API governance/OpenAPI | `docs/api/api-governance-readiness.md` | tocar rutas | revisión | borrar | PR-O1 | API governance |
| **PR-UX1** | docs-only | Valor premium multinacional dashboard + KPIs | `docs/ux/dashboard-multinational-value.md` | tocar `frontend/src` | revisión | borrar | PR-O1 | Operational KPIs |
| **PR-A11Y1** | docs-only | Criterios de aceptación a11y enterprise | `docs/ux/accessibility-acceptance-criteria.md` | tocar `frontend/src`/tests | revisión | borrar | PR-O1 | A11y acceptance |
| **PR-EXEC1** | docs-only | DD pack / evidence room + narrativa ejecutiva | `docs/exec/multinational-readiness-narrative.md` | exponer secretos/evidencia real sensible | revisión + Nico | borrar | PR-GOV2 | Exec trust layer |

**Orden recomendado:** PR-O1 → PR-O2 → PR-GOV1 → PR-GOV2 → PR-REL1 → PR-QA1 → (validación local) →
PR-C3 → PR-S1 / PR-OBS1 / PR-PERF1 / PR-DATA1 / PR-API1 / PR-UX1 / PR-A11Y1 / PR-EXEC1 (docs en
paralelo) → PR-S2 → PR-S3.

---

## 12. Metrics for Multinational Enterprise Readiness

| Métrica | Target multinacional | Cómo medir inicialmente | Primer PR que la introduce |
| --- | --- | --- | --- |
| Deployment confidence | ≥95% PRs sin rollback | Conteo de rollbacks vs merges (release log) | PR-REL1 |
| Rollback time objective (RTO lógico) | < 15 min | Documentar pasos + cronometrar drill | PR-REL1 |
| Incident detection time (MTTD) | < 5 min | Alerting (futuro); hoy manual | PR-OBS1 |
| Incident diagnosis time | < 30 min | Runbook + correlation IDs | PR-OBS1 / PR-S3 |
| API p95 latency (críticos) | < 400ms lectura / < 800ms escritura | `runtime-timing` agregado | PR-PERF1 / PR-S2 |
| Dashboard load (admin/clínica) | LCP < 2.5s desktop / < 3.5s mobile | web-vitals client | PR-PERF1 |
| E2E smoke duration | < 4 min | medir en CI | PR-C3 |
| Full regression duration | < 12 min | medir en CI | PR-C3 |
| Flaky rate | < 1% por corrida | registro de reruns | PR-QA1 |
| Dependency risk age (seguridad) | < 7 días | edad de PRs Dependabot | PR-GOV3 |
| Unresolved Dependabot age | < 14 días promedio | hoy 19 PRs desde 2026-06-18 (~5 días) | PR-GOV3 |
| Public surface regression count | 0 por release | `security:public-surface` | PR-S1 |
| Audit log coverage (privileged actions) | 100% acciones admin mutantes | inventario vs `audit-log` | PR-S1 |
| Structured log coverage | 100% rutas vía logger JSON | conteo `console.*` vs logger | PR-S2 |
| Documented controls coverage | 100% controles §9 con doc | checklist §9 | PR-GOV2 |
| Docs source-of-truth coverage | 100% dominios en SoT map | SoT map | PR-O2 |
| Performance budget compliance | 100% rutas dentro de budget | medición vs budget | PR-PERF1 |
| Accessibility acceptance pass rate | 100% criterios críticos | axe + criterios | PR-A11Y1 |
| Support escalation readiness | proceso documentado + SLA | doc soporte | PR-EXEC1 |

---

## 13. Executive Multinational Readiness Narrative

**Fortalezas actuales (creíbles para DD).** VETNEB tiene cimientos de ingeniería que muchas empresas
"enterprise" no alcanzan: **separación estricta de superficies** (público/clínica/admin con
middlewares y RBAC + matrices documentadas), **postura de seguridad fuerte** (CSP con nonce + report,
headers endurecidos, rate-limit por superficie, CSRF, argon2, sesiones aisladas
`admin_session_id`/`app_session_id`), **disciplina de testing** (~400 unit/integration + 42 E2E
capeados) y **deuda técnica baja** (14 marcadores). El backend Fastify está limpio y modular; la PWA
es segura; el control de cambios es maduro (Git manual, scope estricto, closeouts).

**Brechas actuales (honestas).** La madurez **operacional y de gobernanza** es lo que falta:
observabilidad (logs `console.*` no estructurados, sin SLO/alerting/runbook), **gobernanza formal**
(sin ADR/RFC/risk register/PRR), **evidencia de aislamiento multi-tenant a nivel datos** (RLS sin
verificar), **gobernanza de datos** (retención/restore sin evidencia) y **dimensiones
multinacionales** (i18n/l10n, multi-moneda, residencia) que hoy no existen porque el producto es
single-locale (ARS, español).

**Credibilidad del roadmap.** El plan es **incremental y reversible**: gobernanza docs-only primero
(bajo riesgo, alto valor de control), luego gate de CI, luego observabilidad y seguridad demostrable,
después performance y datos. Ningún paso reescribe arquitectura. Esto es **más seguro que un
"enterprise rewrite"** y produce evidencia DD en cada fase.

**Posturas.** *Seguridad:* fuerte en controles, débil en **evidencia/compliance packaging** y RLS.
*Reliability:* health checks sí, **diagnóstico/alerting no**. *Datos:* trazabilidad operativa sí,
**políticas de ciclo de vida no**. *Soporte:* informal, **sin escalamiento documentado**.

**Qué debe completarse antes de afirmar "enterprise/multinacional-grade":** Fase 0 (gobernanza +
SoT), Fase 1 (gate CI), Fase 2 (seguridad/RLS demostrable) y Fase 3 (observabilidad + runbook). Hasta
entonces, la afirmación correcta es **"baseline SaaS sólido con roadmap multinacional creíble"**, no
"multinacional-grade".

---

## 14. Final Recommendation

1. **¿VETNEB es multinacional-enterprise-grade hoy?** **No.** Es un baseline SaaS sólido con
   cimientos fuertes y un roadmap creíble; faltan gobernanza, observabilidad operacional, evidencia de
   aislamiento/compliance y dimensiones multinacionales.

2. **Score de madurez corregido (rúbrica multinacional):** **≈2.1/5** (el 2.7 previo era correcto
   para "enterprise SaaS" pero optimista para "multinacional"; se corrige a la baja y se agregan los
   dominios A y J ausentes).

3. **Qué hacer antes de cualquier implementación visual/producto grande:** Fase 0 (PR-O1, PR-O2,
   PR-GOV1, PR-GOV2, PR-REL1) + Fase 1 (PR-QA1 → PR-C3). Sin índice/SoT/gobernanza y sin gate de CI,
   todo trabajo grande arriesga cobertura y trazabilidad.

4. **Camino más rápido y seguro a multinacional-grade:** gobernanza docs-only → gate CI →
   seguridad/RLS demostrable → observabilidad → performance/datos. Aditivo, reversible, sin rewrites.

5. **Próximo PR exacto:** **PR-O1 docs-only** (`docs/audit/README.md`, índice de auditorías).

6. **PR que más reduce riesgo:** **PR-S1 docs** (seguridad/aislamiento incl. verificación RLS/tenant
   + cobertura de privileged-action log) — ataca el riesgo más caro: cruce de datos multi-tenant.

7. **PR que más aumenta la confianza del cliente:** **PR-EXEC1 docs** (DD pack/evidence room +
   narrativa) apoyado en **PR-OBS1** (SLO/runbook) — convierte controles en evidencia presentable.

8. **PR que más sube la calidad premium percibida:** **PR-UX1 docs** (KPIs + design tokens) sobre los
   contratos no-scroll ya logrados, antes de PRs visuales por superficie.

9. **PR que más sube la madurez de ingeniería:** **PR-GOV1/GOV2** (ADR/RFC + risk register) — instala
   decisión trazable y gestión de riesgo como práctica permanente.

10. **Qué NO hacer aún:** micro-frontends, CRDTs, WebGL, PWA-offline de privados, realtime,
    backend/frontend rewrite, adopción amplia de deps (resolver antes las 3 instaladas sin uso), i18n/
    multi-region/residencia salvo expansión internacional real (requires legal/domain confirmation).

---

## Appendix — Verification Notes (this run)

| Afirmación verificada | Resultado | Comando |
| --- | --- | --- |
| HEAD y estado base | `8e29cc2`, worktree único, 19 PRs Dependabot | `git log/worktree/gh pr list` |
| Score previo 2.7 presente | Confirmado (líneas 23, 742-743 del doc previo) | `rg "2\.7" …enterprise-…md` |
| Tenant key omnipresente, RLS no confirmada | `clinic_id`/`clinicId` masivo (admin-clinics 61, db-logistics 67); policies no verificadas | Grep server |
| i18n framework ausente | 14 hits, solo `Intl.`/SEO; sin next-intl/react-intl | Grep frontend/src |
| Multi-moneda ausente | Solo ARS vía `Intl.NumberFormat` | Grep frontend/src |
| Dependabot envejeciendo | 19 PRs abiertas desde 2026-06-18 | `gh pr list` |

> Áreas marcadas **"requires focused audit"** (no afirmadas como hecho): RLS/tenant a nivel DB;
> cobertura de privileged-action en `audit-log`; restore drill real; consistencia de fechas críticas;
> `select('*')`/índices; cobertura a11y con axe.

---

## Final validation

```powershell
git status --short --untracked-files=all
git diff --name-only
git diff --stat
git diff --check
```

**Resultado esperado** (esta auditoría solo agrega un archivo **untracked**):

- `git status --short --untracked-files=all` → los dos audits previos untracked + este nuevo
  `?? docs/audit/vetneb-extreme-multinational-enterprise-readiness-audit.md`
- `git diff --name-only` / `git diff --stat` → vacíos (sin tracked modificados)
- `git diff --check` → limpio

> Los comandos los ejecuta Nico manualmente. Esta auditoría **no** ejecuta `git add/commit/push`,
> `gh pr create/merge` ni comandos con `exit`.
