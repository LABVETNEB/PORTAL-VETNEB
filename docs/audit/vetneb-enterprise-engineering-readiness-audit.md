# VETNEB Enterprise Engineering Readiness — Audit

> **docs-only.** Este documento **no modifica** código productivo, `frontend/src`, `frontend/e2e`,
> `server`/backend, `test`, `.github/workflows`, `package.json`, `frontend/package.json`,
> `pnpm-lock.yaml`, Playwright config, `scripts`, `drizzle`/migraciones, deps, lockfiles, CI,
> screenshots ni archivos generados. No mueve, no renombra y no borra archivos. Es **auditoría +
> asesoría de ingeniería + roadmap de implementación**, no una implementación ni una lista de deseos
> de producto/tecnología. Cada recomendación se ata a uno o más PRs chicos con rollback.
>
> Skills VETNEB aplicadas (declaradas): `vetneb-briefing-planificacion-diseno-desarrollo-pruebas`,
> `vetneb-staff-senior-full-stack-engineer`, `vetneb-web-end-to-end-global`,
> `vetneb-security-production-invariants`, `vetneb-admin-dashboard-operational-actions`,
> `vetneb-production-web-optimization-engineer`, `vetneb-pwa-end-to-end`,
> `vetneb-lanzamiento-mantenimiento`, `vetneb-bugs-errores-optimizacion-rutas`,
> `vetneb-protocolos-comunicacion`. Ninguna skill se usa como autorización para ampliar el alcance;
> prevalece el Protocolo Maestro VETNEB y el flujo Git manual de Nico.

---

## 1. Executive Summary

**Estado actual de enterprise-readiness: VETNEB es un producto de ingeniería *sólido y bien
gobernado*, en nivel "estable pero todavía no enterprise-grade" (≈2.7/5 promedio ponderado).** El
núcleo —seguridad, separación de superficies, testing y disciplina de PRs chicos— está cerca de
nivel enterprise. Lo que falta para "enterprise SaaS" no es reescribir nada: es **instrumentar y
medir** (observabilidad, budgets de performance) y **formalizar contratos** (API/integración,
gobernanza de datos), todo de forma aditiva sobre una base limpia.

**Áreas más fuertes (no tocar la arquitectura):**

- **Seguridad y aislamiento de sesiones (4/5):** CSP con nonce + endpoint de report
  (`frontend/src/lib/security/csp-policy.ts`, `csp-nonce.ts`, `app/api/security/csp-report/route.ts`),
  headers de respuesta endurecidos (`server/lib/api-response-security.ts`: no-store/nosniff/
  referrer-policy/request-id), CSRF con cobertura propia, `middlewares/trusted-origin.ts`, hashing
  `argon2`, rate-limit **por superficie** (8+ archivos `*-rate-limit.ts`), y separación estricta
  `admin_session_id` / `app_session_id`.
- **Separación público/clínica/admin (4/5):** middlewares dedicados (`admin-auth`, `auth`,
  `clinic-permissions`, `particular-auth`), matrices `docs/security/RBAC_MATRIX.md` /
  `ENDPOINT_PERMISSION_MATRIX.md`, y tests E2E (`dashboard-auth-redirect`) que fijan
  "admin sin sesión → 404, privado sin sesión → redirect".
- **Testing (4/5):** ~400 tests unit/integration en `test/` + 42 specs E2E ya **capeados** (#1096),
  con contract-tests de runtime-timing, session-last-access, no-secrets, no-store, CSP, schema-health.
- **Backend Fastify maduro (3-4/5):** separación `lib`(41)/`routes`(34)/`middlewares`(7), un
  `db-*.ts` por dominio, `error-handler`, validación `zod`, `permissions.ts`, `audit-log.ts`.

**Áreas más débiles (foco del roadmap):**

- **Performance budgets (1/5):** **no hay budgets medidos ni gates**. No hay `next/dynamic`/lazy
  para deps pesadas; no hay medición de LCP/INP/CLS ni de bundle.
- **Integraciones/API/webhooks (1/5):** sin OpenAPI/Swagger, sin versionado (`/api/...` sin `/v1`),
  sin webhooks ni idempotency keys.
- **Background jobs/async (1/5):** email/PDF/report-workflow son **síncronos**; no hay cola.
- **Observabilidad/SRE (2/5):** `server/lib/logger.ts` es un wrapper de `console.log` **no
  estructurado**; hay health checks y request-id, pero **sin** Sentry/OTel, métricas agregadas ni
  alerting.
- **Gobernanza de datos/lifecycle (2/5)** y **documentación/source-of-truth (2/5)** (ver auditoría
  previa `docs/audit/repository-operational-ordering-audit.md`).

**Riesgos enterprise de mayor severidad (con evidencia):**

1. **Ceguera en producción (P0-obs):** logging plano `console.*` sin estructura ni agregación → un
   incidente real es difícil de diagnosticar; no hay error-monitoring de frontend ni backend.
2. **Sin red de performance (P1-perf):** sin budgets ni medición, una regresión de bundle/latencia
   pasa el gate sin ser vista.
3. **Deps pesadas sin consumidor (P1-deps):** `@tanstack/react-query`, `@tanstack/react-table` y
   `echarts`/`echarts-for-react` están en `dependencies` pero **no se usan en `frontend/src`** (solo
   `gsap` aparece, en `PublicScrollReveal.tsx`) → peso de bundle/superficie de supply-chain sin
   valor. Decidir: **cablear o quitar**.
4. **CI engañoso (P1-ci):** el único step E2E sigue etiquetado "smoke" pero corre la regresión
   completa; las capas `e2e:*` existen (#1096) pero CI no las usa (PR-C3 pendiente).

**Mejoras de mayor valor (orden de retorno):** (a) baseline de observabilidad **sin nuevas deps**
(logger estructurado JSON + request-id ya existente); (b) budgets de performance medibles + CI-only
de capas E2E (PR-C3); (c) higiene de deps (cablear/retirar las 3 no usadas); (d) índice/mapa de
fuentes de verdad (ya iniciado por la auditoría de ordenamiento).

**Qué debe hacerse antes de trabajo de producto grande:** Fase 0 (índice + mapa de fuentes de
verdad) y Fase 1 (gate de testing/CI: PR-C3 validando `unión == e2e:full`). Sin esto, cada feature
grande paga el costo de re-descubrir contexto y arriesga pérdida de cobertura.

**Qué NO debe implementarse todavía:** realtime/WebSockets, CRDTs, WebGL, micro-frontends, colas,
PWA-offline para datos privados, y **adopción de cualquier dependencia nueva**. Ninguno tiene hoy un
gap probado que lo justifique.

**Próximo PR exacto recomendado:** **PR-O1 docs-only** — `docs/audit/README.md` (índice de
auditorías vigentes con estado), continuación directa de la auditoría de ordenamiento. Es cero
riesgo y desbloquea la secuencia.

---

## 2. Audited Base

| Campo | Valor |
| --- | --- |
| Branch | `main` |
| HEAD (`git log -1 --oneline`) | `8e29cc2 test(e2e): add layered e2e scripts (#1096)` |
| `origin/main` / `origin/HEAD` | `8e29cc2` (idéntico al HEAD local) |
| `git status --short --untracked-files=all` | `?? docs/audit/repository-operational-ordering-audit.md` (de la auditoría previa) + (este archivo nuevo, untracked) |
| Worktree | único — `C:/PORTAL-VETNEB 8e29cc2 [main]` |
| Branches locales | `main` + `test/admin-mobile-final-polish-shared-primitives` (residual, ya integrada) |
| Open PRs | **19, todas Dependabot** (#1018–#1038) |
| Fecha | 2026-06-23 |
| Plataforma | Windows / PowerShell / PNPM 10.8.1 |

**Comandos read-only ejecutados (evidencia):**

```
git branch --show-current ; git status --short --untracked-files=all ; git log -1 --oneline
git log --oneline --decorate -n 30 ; git branch ; git worktree list ; gh pr list --state open
git ls-files server/** ; git ls-files frontend/src/** ; git ls-files frontend/public/* ; git ls-files supabase/** (vacío)
git ls-files frontend/*.ts frontend/next.config.* frontend/src/lib/** frontend/src/app/**
Grep (server): seguridad (helmet/CSP/headers/rate-limit/csrf/no-store/trusted-origin) → 52/16 archivos
Grep (server): observabilidad (logger/request-id/health/metrics/trace/otel/sentry/runtime-timing) → 132/38
Grep (repo): integración/async (websocket/realtime/webhook/idempoten/openapi/queue/cron) → casi todo en docs
Grep (frontend/src): estado/perf (zustand/redux/xstate/dynamic/lazy/react-window/tanstack/useQuery) → 8/4
Grep (frontend/src): tanstack/echarts/gsap reales → 1 archivo (gsap)
Grep (frontend/src): sentry/otel/openapi/idempoten/feature-flag/websocket/api-version → 0
Grep (frontend/src): deuda (TODO/FIXME/as any/console.log/ts-ignore) → 14/14
Grep (server): integración/logging externo + console.* → 54/30
```

**Archivos leídos completos (5):** `frontend/package.json`, `package.json` (raíz), `server/lib/logger.ts`,
`docs/audit/e2e-ci-layering-strategy-audit.md` (en sesión previa), `docs/audit/repository-operational-ordering-audit.md`
(redactado en sesión previa). **Closeouts/protocolo** (`AGENTS.md`, `docs/protocol/vetneb-ai-working-protocol.md`,
`admin-mobile-e2e-helper-optimization-closeout.md`) leídos en sesión previa de este mismo chat.

**Archivos inspeccionados por búsqueda/snippet (no leídos completos):** todo `server/**` (estructura
+ greps), `frontend/src/**` (estructura + greps), `frontend/public/*`, ambos `package.json` de
scripts E2E.

**Confirmación de scope.** Solo se crea `docs/audit/vetneb-enterprise-engineering-readiness-audit.md`.
No se modificó, movió, renombró ni borró ningún otro archivo. No se ejecutó `git add/commit/push`,
`gh pr create/merge`. No se instalaron dependencias. No se levantó `next dev` (no se tocó
`frontend/next-env.d.ts`). **Esta auditoría es docs-only.**

**Nota de mapeo de nombres.** La misión menciona `backend` y `supabase` como carpetas; **no
existen** con esos nombres. El backend real es `server/` (Fastify); las migraciones viven en
`drizzle/`; Supabase se consume vía `server/lib/supabase.ts` + `@supabase/supabase-js`. Se audita
bajo los nombres reales.

---

## 3. Enterprise Scorecard

> Escala: 0 ausente · 1 ad hoc/frágil · 2 parcial · 3 estable (no enterprise) · 4 fuerte/casi
> enterprise · 5 enterprise-grade.

| Dominio | Score | Evidencia (repo) | Gap | Riesgo enterprise | Impacto producto/negocio | Próximo PR | Prio |
| --- | :--: | --- | --- | --- | --- | --- | :--: |
| Product operational excellence | **3** | Dashboards admin/clínica con acciones reales; no-scroll contracts; closeouts density | Sin métricas de operación (tiempo de tarea, clicks) | Decisiones de UX sin datos | Eficiencia operativa diaria | PR-D1 docs (valor operativo) | P2 |
| Premium UI/UX & design system | **3** | Radix + `class-variance-authority` + tailwind4 + `tailwind-merge`; dark/light (`theme.ts`, `theme-init.js`); no-scroll | Sin catálogo de design tokens documentado; sin auditoría visual formal | Inconsistencia visual al escalar módulos | Percepción premium | PR-D1 docs (design-system map) | P2 |
| Frontend architecture/performance | **3** | API client centralizado (`lib/api.ts`), `routes.ts`, estado cliente mínimo, Next16/React19 | Sin `next/dynamic`/lazy; deps pesadas sin uso; sin budgets | Bundle crece sin control | Carga lenta percibida | PR-P1 docs + PR-P2 measure | P1 |
| Backend/API reliability | **3** | Fastify sep. `lib/routes/middlewares`; `error-handler`; `zod`; `db-*.ts` por dominio | Sin contratos OpenAPI; sin idempotency; sin versionado | Integración frágil a futuro | Estabilidad de API | PR-A1 docs (API readiness) | P2 |
| Security/session isolation | **4** | CSP nonce+report, `api-response-security.ts`, CSRF, rate-limit/superficie, argon2, sesiones separadas | Sin rotación documentada; sin auditoría de secret-scanning en CI | Brecha si se relaja una frontera | Confianza/compliance | PR-S1 docs (security audit) | P1 |
| Public/clinic/admin separation | **4** | middlewares por rol; RBAC matrices; E2E redirect/404 | Falta verificación periódica anti-enumeración | Cross-tenant si regresiona | Aislamiento de datos | PR-S1 docs | P1 |
| Data governance/lifecycle | **2** | `audit-log.ts`, `study-tracking`, `report-workflow`; `docs/ops/BACKUP_RESTORE_ROLLBACK.md` | Sin política de retención/exportación/borrado formal; trazabilidad de fechas no auditada | Cumplimiento y soporte | Continuidad/legal | PR-G1 docs (data governance) | P2 |
| Testing strategy | **4** | ~400 unit/integration + 42 E2E + contract-tests | Sin gate de cobertura por capa en CI todavía | Regresión silenciosa | Confiabilidad | PR-C3 CI-only | P1 |
| E2E layering & CI readiness | **3** | `e2e:smoke/admin-mobile/visual-contract/public-clinic/full` (#1096) | CI no usa capas; step "smoke" engañoso | Feedback lento, nombre confuso | Velocidad de entrega | PR-C3 CI-only | P1 |
| Release engineering | **3** | `build-info` route; `smoke:staging`; `BACKUP_RESTORE_ROLLBACK`; `review-governance.md`; CI 2 workflows | Sin checklist de release versionado ni gate de artefactos | Releases riesgosos | Estabilidad de deploy | PR-R1 docs (release readiness) | P2 |
| Observability/SRE | **2** | `logger.ts` (console), `api-request-id.ts`, `request-logger.ts`, `admin-system-health`, `runtime-timing` | Logger no estructurado; sin Sentry/OTel/métricas/alerting | Ceguera en incidentes | Soporte productivo | PR-R1 docs + PR-R2 structured logging | **P0/P1** |
| Performance budgets | **1** | `docs/pr-history/PR-audit-performance-routes-web-vitals.md` (histórico, sin enforcement) | Sin budgets, sin LCP/INP/CLS, sin bundle gate | Degradación invisible | Velocidad percibida | PR-P1 docs (budgets) | P1 |
| Accessibility/mobile operability | **3** | `dashboard-accessibility-keyboard.spec.ts`; aria/focus; mobile parity specs; no-scroll | Sin auditoría a11y formal (axe) ni budget de a11y | Exclusión/legal | Inclusión | PR-D1/PR-A11y docs | P2 |
| Integrations/API/webhooks | **1** | Solo `/api/...` interno; sin OpenAPI/versionado/webhooks | Sin contrato externo ni firmas | No integrable por terceros | Comercial B2B | PR-A1 docs (API/webhook) | P2 |
| Background jobs/async | **1** | email (`nodemailer`), report-workflow, PDF — **síncronos** | Sin cola; trabajos largos bloquean request | Timeouts/latencia | Escalabilidad | PR-A2 docs (async candidates) | P3 |
| PWA/offline safety | **3** | `public/sw.js`, `app/manifest.ts`, `/offline`, iconos maskable, `PwaServiceWorkerRegistrar` | Política de cache no auditada contra privados recientemente | Cache de privados si regresiona | Instalabilidad | PR-PWA1 docs (cache policy audit) | P3 |
| Dependency/supply-chain hygiene | **3** | `pnpm.overrides` (brace-expansion/esbuild/ws/js-yaml); Dependabot activo | 3 deps sin consumidor; 19 PRs en cola | Superficie/peso sin valor | Mantenibilidad | PR-DEP1 docs (dep audit) | P1 |
| Documentation/source-of-truth | **2** | `repository-operational-ordering-audit.md`; closeouts | Sin índice/mapa todavía; 174 docs | Re-descubrimiento costoso | DX/consumo IA | PR-O1/PR-O2 docs | P0 |
| Developer/AI workflow efficiency | **3** | Protocolo + 10 skills + closeouts + git manual disciplinado | Doc overload; contexto repetido | Consumo de tokens | Velocidad de entrega | PR-O2 docs (SoT map) | P1 |
| Compliance/privacy readiness | **2** | Audit logs; sanitización; no-secrets tests | Sin controles de privacidad documentados (datos clínicos) | Legal/regulatorio | Confianza B2B | PR-G1 docs (requires legal) | P2 |

**Lectura del scorecard.** Perfil "T invertida": cimientos transversales fuertes (seguridad 4,
separación 4, testing 4) y **picos bajos en instrumentación** (observabilidad 2, performance 1,
integración 1, jobs 1). Es el patrón típico de un producto bien construido que **aún no fue
medido/operado a escala**. La ruta enterprise es instrumentar, no reconstruir.

---

## 4. Critical Enterprise Gaps

> Solo gaps con evidencia de repo. Prioridad por la matriz de §Decision rules.

### P0 — Observabilidad de producción insuficiente (logging no estructurado, sin error-monitoring)

- **Dominio:** Observability/SRE.
- **Evidencia:** `server/lib/logger.ts` = wrapper de `console.log('[INFO]', ...)` (22 líneas, no
  JSON, sin campos de correlación); 54 llamadas `console.*` directas en `server` (30 archivos);
  Grep `sentry|otel|opentelemetry` = **0** en `frontend/src` y `server`.
- **Por qué importa:** sin logs estructurados ni monitoreo de errores, un incidente real es
  diagnosticable solo por inspección manual; no hay correlación automática request→error→usuario.
- **Riesgo si se ignora:** MTTR alto, incidentes silenciosos, imposible cumplir SLOs.
- **Dirección de implementación (sin deps nuevas primero):** estructurar `logger.ts` a JSON
  (timestamp, level, request-id, ruta, status) reutilizando `api-request-id.ts`; consolidar
  `console.*` dispersos detrás del logger. Sentry/OTel = fase posterior, opcional.
- **First safe PR:** **PR-R1 docs-only** (baseline de observabilidad) → luego **PR-R2 backend-only**
  (logger estructurado, contrato testeable, sin deps).
- **Validación:** test de contrato del shape del log; `pnpm test`; no exponer secretos en logs.
- **Rollback:** revertir `logger.ts` (cambio acotado de 1 archivo + su test).

### P1 — Sin budgets ni medición de performance

- **Dominio:** Performance budgets.
- **Evidencia:** Grep `next/dynamic|lazy|react-window` en `frontend/src` = 0; no hay web-vitals
  medido en repo; `PR-audit-performance-routes-web-vitals.md` es histórico sin enforcement.
- **Por qué importa:** una regresión de bundle o latencia pasa el gate sin verse.
- **Riesgo si se ignora:** degradación acumulativa de LCP/INP en dashboards densos.
- **Dirección:** definir budgets (tabla §12), medir build output (Next ya reporta tamaños), agregar
  web-vitals client mínimo más adelante.
- **First safe PR:** **PR-P1 docs-only** (budgets propuestos) → **PR-P2** (medición no intrusiva).
- **Validación:** comparar tamaños de build antes/después; budgets documentados.
- **Rollback:** docs/medición son aditivas; revertir doc/medición.

### P1 — Dependencias pesadas sin consumidor

- **Dominio:** Dependency/supply-chain hygiene.
- **Evidencia:** `frontend/package.json` declara `@tanstack/react-query`, `@tanstack/react-table`,
  `echarts`, `echarts-for-react`; Grep en `frontend/src` de su uso real = **0** (solo `gsap` aparece
  en `PublicScrollReveal.tsx`).
- **Por qué importa:** peso potencial de bundle y superficie de supply-chain sin valor entregado;
  además sesga el roadmap (parecen "adoptados" cuando no lo están).
- **Riesgo si se ignora:** Dependabot mantiene/actualiza deps sin consumidor; ruido y CVE-surface.
- **Dirección:** decisión explícita por dep: **cablear** (si hay un plan concreto: tablas con
  TanStack Table, gráficos con ECharts, server-state con React Query) **o retirar**. No mezclar con
  feature work.
- **First safe PR:** **PR-DEP1 docs-only** (auditoría de deps usadas vs no usadas + decisión) →
  luego PR de cableado **o** de retiro, separado.
- **Validación:** `git grep` de import por dep; build size; `pnpm test`.
- **Rollback:** decisión documentada; cambios de deps son reversibles (pero los hace Nico, fuera de
  esta auditoría).

### P1 — CI no usa las capas E2E y el step "smoke" es engañoso

- **Dominio:** E2E layering & CI readiness.
- **Evidencia:** `frontend/package.json` tiene `e2e:smoke/admin-mobile/visual-contract/public-clinic/full`
  (#1096); auditoría `e2e-ci-layering-strategy-audit.md` documenta que el único step E2E corre la
  suite completa bajo etiqueta "smoke".
- **Por qué importa:** feedback lento, nombre confuso, sin gate barato por superficie.
- **Riesgo si se ignora:** desincentivo a correr E2E; al separar mal, **pérdida de cobertura
  silenciosa**.
- **Dirección:** PR-C3 CI-only **aditivo**: agregar job `e2e:smoke` rápido **manteniendo** `full`
  como gate hasta probar `unión de capas == full`.
- **First safe PR:** **PR-C3 CI-only** (precedido de validación local `unión == full`).
- **Validación:** CI verde; suma de specs por capa == 42; renombrar el step.
- **Rollback:** revertir el workflow al step único.

### P2 — Gobernanza de datos / lifecycle sin formalizar

- **Dominio:** Data governance.
- **Evidencia:** existen `audit-log.ts`, `study-tracking`, `report-workflow`, `report-access-token`,
  `BACKUP_RESTORE_ROLLBACK.md`; **no** hay política documentada de retención/exportación/borrado ni
  auditoría de consistencia de fechas críticas (recepción/entrega).
- **Por qué importa:** trazabilidad y cumplimiento de datos clínicos.
- **Riesgo si se ignora:** vacíos de retención/borrado; soporte difícil.
- **Dirección:** **PR-G1 docs-only** que mapee lifecycle real (estudio→reporte→token→entrega) y
  marque obligaciones legales como "requires legal/domain confirmation".
- **Validación:** revisión humana + confirmación de Nico.
- **Rollback:** docs.

### P2 — Integración/API no contractual

- **Dominio:** Integrations.
- **Evidencia:** rutas `/api/...` sin `/v1`; Grep `openapi|swagger|webhook|idempoten|apiVersion` en
  código = 0 real.
- **Por qué importa:** terceros (clínicas/labs externos) no pueden integrarse de forma estable.
- **Dirección:** **PR-A1 docs-only** (readiness de API: versionado, errores estándar ya existentes,
  paginación ya existente vía `list-pagination.ts`, idempotency para mutaciones, webhooks firmados).
- **Validación:** revisión humana.
- **Rollback:** docs.

---

## 5. Product and Operational Excellence Audit

**Evidencia.** Dashboards admin y clínica son **command centers operativos reales**: módulos admin
(`AdminMobilePricingModule`, `AdminMobileSessionsModule`, `AdminMobileUsersModule`,
`AdminMobileAuditModule`, `AdminMobileHealthModule`, `AdminMobileMaintenanceModule`,
`AdminMobileCommandModule`) y read-only cards (`AdminSessionsReadOnlyCard`,
`AdminFailedLoginAlertsReadOnlyCard`, `AdminUsersRolesReadOnlyCard`). Existen contratos no-scroll
(`usePagedRows.ts`, specs `*-no-scroll-contract`) y la skill de acciones operativas exige
"backend real o deshabilitado con motivo". Estados loading/empty/error están testeados
(`frontend-dashboard-empty-states.test.ts`, `*-live-read-contract`, `*-no-mock-fallback`).

| Gap operativo | Evidencia | Mejora de mayor valor | Métrica de éxito |
| --- | --- | --- | --- |
| Sin métricas de operación (tiempo de tarea, clicks por acción) | No hay instrumentación cliente | Definir KPIs operativos por módulo admin | Reducción de clicks/tiempo por tarea crítica |
| Visibilidad de acciones críticas dispersa | Múltiples módulos mobile/desktop | Mapa de "acciones críticas" por superficie (docs) | 100% acciones críticas con feedback real |
| Eficiencia no-scroll lograda pero no medida | specs no-scroll | Budget de "viewport fit" por densidad 25/50/100 | 0 overflow en datos densos |

**PR sequence (operacional):** PR-D1 docs (valor operativo + mapa de acciones críticas) → (luego,
fuera de esta auditoría) PRs frontend-only por módulo, cada uno con su contract-test.

---

## 6. Premium UI/UX and Design-System Audit

**Evidencia.** Sistema visual basado en **Radix UI** (10 primitivos) + `class-variance-authority`
(variants) + **Tailwind 4** + `tailwind-merge` + `tailwindcss-animate`; tema claro/oscuro
(`lib/theme.ts`, `public/theme-init.js`, `theme-mode.spec.ts`); `lucide-react` para iconografía;
`gsap` para motion en público (`PublicScrollReveal.tsx`, `useScrollPerspective.ts`); contratos
no-scroll y stage persistente del hub (memoria de proyecto). Componentes base testeados
(`frontend-button-component`, `card`, `badge`, `input`).

| Eje | Estado | Acción segura | Requiere auditoría visual enfocada |
| --- | --- | --- | --- |
| Tokens de diseño | Implícitos en tailwind/CVA | Documentar catálogo de tokens (docs) | Sí (consistencia cross-módulo) |
| Densidad / spacing | Resuelto por bloque density (cerrado) | No reabrir | No |
| Tablas/listas | Custom + `usePagedRows` | Evaluar TanStack Table (ya instalado) si crece complejidad | Sí (antes de cablear) |
| Dark/light | Consistente y testeado | Mantener | No |
| Premium polish | Alto en mobile admin | Auditoría visual formal por superficie | Sí |

**Qué sube más la percepción enterprise:** consistencia de **design tokens documentados** +
microinteracciones de feedback en acciones críticas. **Qué es seguro ya:** documentar tokens
(docs-only). **First PRs:** PR-D1 docs (design-system map + tokens) → PRs visuales por superficie con
`visual-contract` E2E. **Validación:** capa `e2e:visual-contract` (estructural) + QA humana.

---

## 7. Frontend Engineering Audit

**Evidencia.** App Router Next 16 / React 19; `frontend/src`: `components`(70), `app`(67), `lib`(16),
`hooks`(2: `useAuth`, `useScrollPerspective`), `context`(1: `AuthContext`). API client **centralizado**
(`lib/api.ts`), rutas centralizadas (`lib/routes.ts`), auth de servidor (`lib/dashboard-server-auth.ts`),
`proxy.ts`. Estado cliente **deliberadamente mínimo** (sin zustand/redux/xstate — Grep = 0).

| Aspecto | Hallazgo | Recomendación |
| --- | --- | --- |
| Rendering model | App Router + server components; estado mínimo | Mantener; no introducir store global sin necesidad |
| Organización rutas/componentes | Clara por dominio (admin/dashboard/public) | OK |
| Complejidad de estado | Muy baja (1 context) | **No** adoptar Zustand/Redux: no hay evidencia de necesidad |
| Client/server boundaries | Server-auth en `lib`, UI en componentes | Mantener; auditar fetchs dispersos puntualmente |
| Code splitting / lazy | **Ausente** (`next/dynamic`=0) | Lazy-load deps pesadas (echarts/gsap) **si se cablean** |
| Pagination/search/list | Server (`list-pagination.ts`) + `usePagedRows` | OK; virtualización solo si listas no paginadas crecen |
| Virtualización | Ausente | **Conditional**: solo si aparece lista grande no paginable |
| Bundle/performance | Sin budget; 3 deps sin uso | PR-DEP1 + PR-P1 |
| Estados error/loading | Consistentes y testeados | Mantener |
| Mantenibilidad | Alta (deuda 14 hits) | Mantener |

**Regla aplicada:** no se recomienda ninguna librería de estado nueva — la evidencia muestra estado
mínimo bien resuelto. El riesgo frontend real es **bundle/performance no medido** + **deps muertas**,
no la arquitectura.

---

## 8. Backend / API / Data Audit

**Evidencia.** Fastify 5 con separación limpia: `server/lib`(41), `server/routes`(34, todos
`*.fastify.ts`), `server/middlewares`(7). Un `db-*.ts` por dominio (admin-clinics, admin-sessions,
audit, logistics, particular, pricing, report-access, report-workflow, study-tracking, etc.).
Validación con `zod`; `error-handler.ts` central; `permissions.ts`; `audit-log.ts`; `list-pagination.ts`;
caches dedicadas (`public-pricing-cache`, `sensitive-response-cache`, `logistics-route-plans-cache`);
`schema-health.ts` + `runtime-timing.ts`. DB: `postgres` + `drizzle-orm`, storage/Supabase vía
`lib/supabase.ts`. Hashing `argon2`. Build: `esbuild` bundle → `node dist/index.js`.

| Aspecto | Hallazgo | Recomendación (sin rewrite) |
| --- | --- | --- |
| Organización API | Rutas finas por dominio | Mantener |
| Validación | `zod` por endpoint | Mantener; documentar contratos (PR-A1) |
| Domain modeling | `db-*.ts` por dominio + `lib/*` de negocio | OK |
| Study/report/token lifecycle | `study-tracking`, `report-workflow`, `report-access-token` | Mapear lifecycle (PR-G1) |
| DB/storage health | `schema-health`, `schema:verify`, `db-pool-contract.test.ts` | Mantener; vigilar `select('*')`/paginación (audit puntual) |
| Error handling | `error-handler.ts` + tests no-stack/no-secrets | Fuerte |
| Background-job candidates | email/PDF/report-workflow síncronos | Documentar candidatos async (PR-A2), no implementar aún |
| Consistencia API | snake/camel y métodos: requiere verificación puntual | "requires focused API contract audit" |
| Latency risks | caches presentes; sin medición | Medir endpoints críticos (PR-P1) |
| Integration readiness | sin OpenAPI/versionado/idempotency | PR-A1 docs |

**Regla aplicada:** **no** se recomienda rewrite de backend. El backend es el activo más maduro; las
acciones son contractuales/observabilidad, no estructurales.

---

## 9. Security and Session Isolation Audit

**Evidencia (fuerte).**

- **Aislamiento de sesión:** `admin_session_id` (admin) vs `app_session_id` (clínica) +
  `particular-auth`; middlewares `admin-auth`, `auth`, `clinic-permissions`, `particular-auth`;
  `session-last-access.ts`; tests `auth-session-boundaries`, `*-session-last-access-contract`.
- **Superficie pública:** `scripts/security/audit-public-devtools-surface.mjs`
  (`pnpm security:public-surface`), test `frontend-public-devtools-exposure-contract`.
- **Headers/cache:** `server/lib/api-response-security.ts` (no-store/nosniff/referrer-policy),
  `sensitive-response-cache.ts`, tests `backend-api-no-store-cache`, `backend-api-nosniff-responses`,
  `api-error-no-secrets`, `api-error-no-stack-traces`.
- **CSP:** `frontend/src/lib/security/csp-policy.ts` + `csp-nonce.ts` + `app/api/security/csp-report`
  + `frontend-csp-*` tests (nonce, report-only, report-uri, inline-blockers, policy-builder).
- **CSRF:** `PR-security-csrf-mutating-route-coverage.md` + `middlewares/trusted-origin.ts`.
- **Rate-limit / anti-enumeración:** `login-rate-limit`, `contact-rate-limit`,
  `public-professionals-rate-limit`, `public-report-access-rate-limit`,
  `report-access-token-rate-limit`, `rate-limit-store.ts`.
- **RBAC:** `docs/security/RBAC_MATRIX.md`, `ENDPOINT_PERMISSION_MATRIX.md`, `permissions.ts`.
- **Supply-chain:** `pnpm.overrides` (brace-expansion, esbuild, ws, fast-uri, postcss, js-yaml);
  Dependabot activo (19 PRs).

| Invariante P0 (no debilitar) | Evidencia | Verificación |
| --- | --- | --- |
| Admin sin sesión → 404 | `dashboard-auth-redirect.spec.ts` | E2E smoke |
| Clínica sin sesión → redirect login | idem + `frontend-dashboard-server-401-redirect` | E2E + unit |
| No mezclar `admin_session_id`/`app_session_id` | middlewares + `auth-session-boundaries` | unit |
| No exponer hashes/tokens/cookies/signed URLs | `api-error-no-secrets`, audit sanitizado | unit |
| No cachear privados (SW/API) | PWA skill + `sensitive-response-cache` | contract |

**Focused security audit PRs:** **PR-S1 docs-only** (revisión de invariantes + plan de
secret-scanning en CI + rotación de sesión) → luego PRs security-only acotados. **Validación:**
`pnpm security:public-surface`, suite `security-*`/`auth-*`, sin secretos en logs.

**Riesgo residual:** la postura es fuerte pero **no hay secret-scanning automatizado en CI** ni
revisión periódica anti-enumeración; documentarlo en PR-S1.

---

## 10. Testing, E2E, CI, and Release Engineering Audit

**Evidencia.** `test/` ≈ 400 archivos (unit/integration/contract, `node --test`); `frontend/e2e` =
42 specs Playwright capeados (#1096): `smoke`(7) + `admin-mobile`(13) + `visual-contract`(11) +
`public-clinic`(11) = **42 = full**. Contract-tests notables: `frontend-ci-workflow`,
`backend-ci-workflow`, `fastify-only-guardrail`, `audit-suite-completeness`,
`api-request-id-observability-contract`, `db-pool-contract`. CI: `.github/workflows/backend-ci.yml`
(audit/migrate/typecheck/test/build con Postgres) + `frontend-ci.yml` (lint/typecheck/build/
security:public-surface/E2E). `build-info` route + `smoke:staging` + `BACKUP_RESTORE_ROLLBACK` +
`review-governance.md`.

| Aspecto | Estado | Recomendación |
| --- | --- | --- |
| Balance unit/integration/E2E | Muy bueno (400 + 42) | Mantener |
| Capas E2E post-#1096 | Scripts listos; CI no las usa | PR-C3 CI-only aditivo |
| ¿PR-C3 CI-only listo? | **Casi** — falta validar localmente `unión == full` | Validar conteo por capa primero |
| Naming CI | Step "smoke" corre full → engañoso | Renombrar en PR-C3 |
| Smoke vs full | Definido en scripts; no en CI | Separar gate barato + full |
| Tests visuales | Estructurales (no pixel) | OK; no convertir screenshots a baseline |
| Tests a11y | `dashboard-accessibility-keyboard` | Ampliar con axe (futuro) |
| Tests seguridad | Amplios (`security-*`, `csp-*`, `no-secrets`) | Mantener |
| Flake risk | `fullyParallel` + fixture mock + `next dev` | Tratar reproduciendo, no relajando |
| Artefactos/screenshots | Evidencia, no baseline versionado | Mantener |
| Release/rollback | Docs + build-info + staging smoke | Formalizar checklist (PR-R1) |

**¿Es seguro PR-C3 CI-only ahora?** **Sí, condicionado:** primero validar localmente que la suma de
specs por capa == `e2e:full` (42) sin huérfanos ni duplicados; luego CI-only **aditivo** (smoke
rápido + full como gate hasta probar la unión). **Qué validar antes:** conteo por capa, que
`dashboard-auth-redirect` (seguridad) quede siempre en gate, y que Dependabot siga validando contra
suite estable.

**PR sequence:** validación local (no-PR) → **PR-C3 CI-only** → (luego, otro bloque) PR-C4
full→nightly si corresponde.

---

## 11. Observability and Production Diagnostics Audit

**Evidencia.** `server/lib/logger.ts` = `console.log/warn/error` con prefijos `[INFO]/[WARN]/[ERROR]`
+ `serializeError` (no JSON, sin campos estructurados); `api-request-id.ts` (correlación request-id),
`middlewares/request-logger.ts`, `runtime-timing.ts`, `admin-system-health.fastify.ts`,
`admin-system-schema-health.fastify.ts`, `schema-health.ts`, `app/api/build-info/route.ts`. **Sin**
Sentry/OTel/métricas agregadas/alerting (Grep = 0).

| Capacidad | Estado | Baseline mínimo (sin deps) | Opcional futuro |
| --- | --- | --- | --- |
| Logs | console plano | **Estructurar a JSON** (level, ts, request-id, ruta, status) | Pino/aggregator |
| Métricas | ausente | Contadores básicos en health | OTel metrics |
| Tracing | ausente | request-id ya correlaciona | OTel traces |
| Error monitoring FE | ausente | CSP-report ya captura violaciones | Sentry FE |
| Error monitoring BE | `error-handler` + console | Logger estructurado de errores | Sentry BE |
| Health checks | presentes | Mantener + documentar | uptime externo |
| Job monitoring | n/a (sin jobs) | — | con cola futura |
| Alerting | ausente | Definir umbrales en docs | PagerDuty/etc. |
| SLO/SLA | ausente | Definir SLOs objetivo (docs) | dashboards |
| Incident diagnostics | manual | Runbook + request-id | tracing |

**Primeros pasos sin dependencias:** (1) **PR-R1 docs-only** — baseline de observabilidad + SLOs
objetivo + runbook de diagnóstico usando request-id existente. (2) **PR-R2 backend-only** — logger
estructurado JSON (1 archivo + test de shape), consolidando `console.*`. Sentry/OTel quedan como
**Recommended later / Conditional**, nunca como primer paso.

---

## 12. Performance Budget Audit

> Budgets **propuestos** (no medidos aún). "Evidencia actual" = lo que el repo permite observar hoy.

| Métrica | Evidencia actual | Falta medir | Budget propuesto | Primer PR |
| --- | --- | --- | --- | --- |
| Admin dashboard load | sin medición | LCP/TTI admin | LCP < 2.5s (desktop), < 3.5s (mobile mid) | PR-P2 measure |
| Clinic dashboard load | sin medición | LCP/TTI clínica | LCP < 2.5s / < 3.5s | PR-P2 |
| Public report/token page | sin medición | LCP público | LCP < 2.0s | PR-P2 |
| API latency (críticos: auth, list, report) | `runtime-timing.ts` existe (no agregado) | p95 por endpoint | p95 < 400ms (lecturas), < 800ms (escrituras) | PR-P3 backend metric |
| Search response | server pagination | latencia búsqueda | p95 < 500ms | PR-P3 |
| CI duration | sin reporte | tiempo por job | full E2E < 12min; smoke < 4min | PR-C3 |
| E2E layer duration | capas en scripts | tiempo por capa | smoke < 4min; admin-mobile < 6min | PR-C3 |
| Bundle / initial JS | Next reporta en build | tamaño por ruta | initial JS < 200KB gzip (público) | PR-P1/P2 |
| LCP / INP / CLS | sin medición | web-vitals | LCP<2.5s, INP<200ms, CLS<0.1 | PR-P2 |
| Mobile no-scroll perf | specs estructurales | jank/frame budget | 0 overflow; transición < 100ms | PR-P2 |

**Acción:** **PR-P1 docs-only** fija estos budgets como objetivo; **PR-P2** mide (web-vitals client
mínimo + lectura del build output de Next, sin deps pesadas); **PR-P3** agrega `runtime-timing`
agregado por endpoint. Sin budget no hay gate; con budget documentado, cada PR futuro se compara.

---

## 13. Integration Readiness Audit

**Evidencia.** API interna `/api/...` consumida por el propio frontend (no `/v1`); errores
estandarizados (`api-error.ts`, `error-handler.ts`, request-id en respuestas); paginación
(`list-pagination.ts`); **sin** OpenAPI/Swagger, versionado, webhooks ni idempotency (Grep = 0).

| Capacidad | Estado | Recomendación | Condición para adoptar |
| --- | --- | --- | --- |
| API-first readiness | parcial (interna sólida) | Documentar contratos antes de exponer | Si hay consumidor externo real |
| OpenAPI/Swagger | ausente | **Recommended later** (generar desde zod) | Cuando haya integradores |
| API versioning | ausente | Definir estrategia `/v1` antes de exponer | Pre-exposición externa |
| Errores estándar | presentes | Mantener; documentar | — |
| Paginación | presente | Mantener; documentar contrato | — |
| Idempotency keys | ausente | **Conditional** para mutaciones expuestas | Si terceros reintentan |
| Webhooks | ausente | **Recommended later** con firma HMAC | Si clínicas/labs consumen eventos |
| Firmas de webhook | ausente | Junto con webhooks | — |
| Retries | n/a | Con webhooks/jobs | — |
| SDK | ausente | Solo tras OpenAPI estable | — |
| Integración clínica/lab externa | potencial comercial | Roadmap Fase 6 | Demanda concreta |

**Roadmap de integración:** PR-A1 docs (readiness + contratos) → (Fase 6) versionado → OpenAPI desde
zod → webhooks firmados → SDK. **No recomendado aún:** webhooks/SDK sin consumidor externo probado.

---

## 14. Data Governance and Compliance Readiness Audit

**Evidencia.** Audit trails (`audit-log.ts`, `db-audit.ts`, `clinic-audit`, `particular-audit`,
`admin-audit`); lifecycle de estudio/reporte (`study-tracking`, `report-workflow`,
`report-access-token`, `token-study-tracking`); `lab-received-date-delivery-estimate.md`
(fechas críticas); `docs/ops/BACKUP_RESTORE_ROLLBACK.md`; `docs/notes/PENDIENTE_NORMALIZACION_CLINICS.md`
(deuda de datos pendiente).

| Aspecto | Estado | Recomendación |
| --- | --- | --- |
| Trazabilidad estudio→reporte→entrega | parcial (tracking existe) | Mapear lifecycle completo (PR-G1) |
| Consistencia de fechas críticas | doc de delivery estimate | Auditar consistencia (focused audit) |
| Historial de auditoría | presente y sanitizado | Mantener |
| Retención | **no documentada** | Definir política (PR-G1) |
| Backups/restore | doc presente | Validar restore real (staging) |
| Borrado/exportación | no formalizado | Definir (requires legal) |
| Logs de acceso | audit presente | Verificar cobertura de accesos a reportes |
| Fronteras de privacidad | sanitización + no-secrets | Documentar clasificación de datos |
| Cumplimiento | **desconocido** | **requires legal/domain confirmation** |

**Regla aplicada:** no se inventan obligaciones legales. Todo lo regulatorio se marca
"requires legal/domain confirmation". **First PR:** PR-G1 docs-only (lifecycle + retención propuesta).

---

## 15. Technology Recommendation Matrix

> Regla: no recomendar por "moderno". Cada decisión exige evidencia y un consumidor real.

| Tecnología/Patrón | Evidencia actual en repo | Valor enterprise | Riesgo/complejidad | Recomendación | Condición para adoptar | Alternativa más simple | Primer PR seguro |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Zustand** | 0 (estado cliente mínimo, 1 context) | Bajo | Bajo | **Not recommended now** | Estado cliente compartido complejo real | `useState`/Context actual | — |
| **Redux Toolkit** | 0 | Bajo | Medio | **Not recommended now** | Múltiples flujos globales con time-travel | Context + React Query | — |
| **XState** | 0 | Bajo-medio | Medio | **Not recommended now** | Máquinas de estado críticas (wizard report) | Reducer local | — |
| **TanStack Table** | **instalado, sin uso en `src`** | Medio-alto | Bajo-medio | **Conditional** | Tablas admin con sort/filtros server complejos | `usePagedRows` actual | PR-DEP1 (decidir cablear/retirar) |
| **react-window / virtualization** | 0 | Medio | Medio | **Recommended later / Conditional** | Lista no paginable > ~1k filas | Server pagination actual | — |
| **Recharts / Chart.js / D3** | 0 | Medio | Medio | **Not recommended now** | — | **ECharts ya instalado** | — |
| **ECharts** (ya en deps) | **instalado, sin uso en `src`** | Medio-alto | Medio | **Conditional** | Dashboards con gráficos reales | Tablas/métricas actuales | PR-DEP1 (cablear o retirar) |
| **WebGL dashboards** | 0 | Bajo | Alto | **Not recommended now** | Visualización masiva (>100k puntos) | ECharts canvas | — |
| **WebSockets / Supabase Realtime** | 0 (supabase-js sí, realtime no) | Medio | Medio-alto | **Not recommended now** | Colaboración/estado vivo con valor concreto | Polling/refetch | — |
| **CRDTs / Yjs / Automerge** | 0 | Bajo | Muy alto | **Not recommended now** | Edición concurrente real | Bloqueo optimista | — |
| **BullMQ / colas / async jobs** | 0 (email/PDF síncronos) | Medio-alto | Medio | **Recommended later** | Trabajos largos que bloquean request | Procesamiento síncrono actual | PR-A2 docs (candidatos) |
| **OpenAPI / Swagger** | 0 | Alto (B2B) | Medio | **Recommended later** | Integradores externos | Contratos `zod` + docs | PR-A1 docs |
| **Webhooks** | 0 | Medio-alto (B2B) | Medio | **Recommended later** | Consumidor externo de eventos | — | PR-A1 docs |
| **Service Worker / IndexedDB** | **SW presente**; IndexedDB 0 | Medio | Medio | **Conditional** (SW ya OK) | Offline de datos privados con política de cache | SW público actual | PR-PWA1 docs (audit cache) |
| **OpenTelemetry / Sentry** | 0 | Alto | Medio | **Recommended later** | Tras logger estructurado | request-id + logs JSON | PR-R2 (logger) primero |
| **Feature flags** | 0 | Medio | Bajo-medio | **Conditional** | Rollouts graduales de features grandes | Deploy + revert | PR-R1 docs (evaluar) |
| **Micro-frontends / Module Federation** | 0 (monorepo único) | Bajo | Muy alto | **Not recommended now** | Independencia de equipos/módulos real | App Router actual | — |
| **CSP / security headers** | **presente y fuerte** | Alto | Bajo | **Already adopted** | — | — | mantener (PR-S1 review) |
| **RBAC / ABAC** | **RBAC presente** (`permissions.ts` + matrices) | Alto | Medio | **Already adopted (RBAC)**; ABAC **later** | Reglas por atributo complejas | RBAC actual | PR-S1 docs |
| **API versioning** | 0 | Medio-alto | Bajo | **Recommended later** | Pre-exposición externa | `/api` interno | PR-A1 docs |
| **Idempotency keys** | 0 | Medio | Bajo-medio | **Conditional** | Mutaciones expuestas/reintentos | — | PR-A1 docs |
| **Structured logging** | console plano | Alto | Bajo | **Recommended now** | — | — | **PR-R2 backend-only** |

**Conclusión del matrix:** la única adopción **"now"** es **structured logging** (sin dep nueva). El
resto es "later/conditional/not-now". Y hay **3 deps ya instaladas sin consumidor** (react-query,
react-table, echarts) que deben resolverse (cablear o retirar) antes de hablar de "adoptar" nada.

---

## 16. Enterprise Implementation Roadmap

> Fases ordenadas por dependencia. Cada fase = PRs chicos, un eje, con rollback. Git lo ejecuta Nico.

### Phase 0 — Repository & Source-of-Truth Foundation
- **Objetivo:** índice de auditorías, mapa de fuentes de verdad, disciplina de closeout, prompt-packs.
- **Valor:** reduce consumo de IA y re-descubrimiento; base para todo lo demás.
- **Prerrequisitos:** ninguno.
- **PRs:** PR-O1 (índice), PR-O2 (mapa SoT), PR-O3 (clasificación histórica) — todos docs-only.
- **Validación:** `git diff --check`, lectura humana.
- **Rollback:** borrar archivos.
- **DoD:** existe `docs/audit/README.md` + `docs/SOURCES_OF_TRUTH.md`; histórico marcado.

### Phase 1 — Testing & CI Enterprise Gate
- **Objetivo:** validar `unión de capas == e2e:full`; PR-C3 CI-only aditivo; separar smoke/full.
- **Valor:** feedback rápido sin pérdida de cobertura.
- **Prerrequisitos:** Phase 0 (para no reauditar) + validación local de conteo por capa.
- **PRs:** validación local (no-PR) → PR-C3 CI-only.
- **Validación:** suma specs por capa == 42; CI verde; seguridad siempre en gate.
- **Rollback:** revertir workflow al step único.
- **DoD:** smoke como gate rápido + full como red; step renombrado.

### Phase 2 — Security & Session Invariants
- **Objetivo:** confirmar invariantes, plan de secret-scanning en CI, rotación de sesión, anti-enumeración.
- **Valor:** mantener la frontera más crítica del producto.
- **Prerrequisitos:** Phase 0.
- **PRs:** PR-S1 docs (audit) → PRs security-only acotados.
- **Validación:** `security:public-surface`, suite `security-*`/`auth-*`.
- **Rollback:** por PR (acotado).
- **DoD:** invariantes documentados + verificados; plan de secret-scanning.

### Phase 3 — Premium Dashboard Operational Value
- **Objetivo:** pulido enterprise admin/clínica, densidad no-scroll, design-system, mobile.
- **Valor:** percepción premium + eficiencia operativa.
- **Prerrequisitos:** Phase 0/1 (E2E visual-contract estable).
- **PRs:** PR-D1 docs (valor + tokens) → PRs frontend-only por superficie con `visual-contract`.
- **Validación:** `e2e:visual-contract` + QA humana.
- **Rollback:** por PR.
- **DoD:** tokens documentados; acciones críticas con feedback real.

### Phase 4 — Performance Budgets & Scalability
- **Objetivo:** budgets medibles; search/pagination/list; bundle/route loading; API latency.
- **Valor:** velocidad percibida + escalabilidad controlada.
- **Prerrequisitos:** Phase 1 (CI estable) + PR-DEP1 (deps resueltas).
- **PRs:** PR-P1 docs (budgets) → PR-P2 (medición) → PR-P3 (latency) → lazy-load si se cablean deps.
- **Validación:** comparación build size + web-vitals vs budget.
- **Rollback:** medición/lazy son aditivos.
- **DoD:** budgets en repo + medición en CI/local.

### Phase 5 — Observability & Release Engineering
- **Objetivo:** logger estructurado, diagnósticos de producción, checklist rollback/staging/release.
- **Valor:** soporte productivo y MTTR bajo.
- **Prerrequisitos:** Phase 0.
- **PRs:** PR-R1 docs (baseline + SLOs + runbook) → PR-R2 backend-only (logger JSON) → (opcional) Sentry/OTel.
- **Validación:** test de shape de log; sin secretos; health checks.
- **Rollback:** revertir `logger.ts`.
- **DoD:** logs estructurados + runbook + SLOs objetivo.

### Phase 6 — API / Integration Readiness
- **Objetivo:** gobernanza de API, versionado, webhooks firmados, contratos.
- **Valor:** habilita integración B2B.
- **Prerrequisitos:** Phase 2/5; demanda externa real.
- **PRs:** PR-A1 docs (readiness) → versionado → OpenAPI desde zod → webhooks.
- **Validación:** contract-tests; compatibilidad.
- **Rollback:** versionado aditivo.
- **DoD:** contrato externo estable + versionado.

### Phase 7 — Advanced Enterprise Capabilities
- **Objetivo:** realtime/async/scoring/PWA-offline **solo si se justifican**.
- **Valor:** condicional al caso de uso.
- **Prerrequisitos:** Fases previas + evidencia de demanda.
- **PRs:** por capacidad, cada uno con PRD corto.
- **Validación:** por capacidad.
- **Rollback:** por capacidad.
- **DoD:** cada capacidad con consumidor real y guardrails (no privados en cache offline, no realtime sin valor).

---

## 17. Top 25 Enterprise Value Opportunities

| # | Oportunidad | Dominio | Tipo de valor | Impacto esperado | Complejidad | Riesgo | Prioridad | Primer PR |
| --: | --- | --- | --- | --- | --- | --- | :--: | --- |
| 1 | Índice de auditorías | Docs/SoT | DX | Alto | Baja | Bajo | P0 | PR-O1 docs |
| 2 | Mapa de fuentes de verdad | Docs/SoT | DX | Alto | Baja | Bajo | P0 | PR-O2 docs |
| 3 | Logger estructurado JSON | Observability | reliability | Alto | Baja | Bajo | P0/P1 | PR-R2 backend |
| 4 | PR-C3 CI-only (capas E2E) | CI | reliability/DX | Alto | Baja-media | Medio | P1 | PR-C3 CI |
| 5 | Auditoría de deps sin uso | Deps | reliability/perf | Medio-alto | Baja | Bajo | P1 | PR-DEP1 docs |
| 6 | Budgets de performance | Perf | performance | Alto | Baja | Bajo | P1 | PR-P1 docs |
| 7 | Medición web-vitals mínima | Perf | performance | Alto | Media | Bajo | P1 | PR-P2 |
| 8 | Baseline observabilidad + SLOs | Observability | reliability | Alto | Baja | Bajo | P1 | PR-R1 docs |
| 9 | Security/session audit | Security | security | Alto | Baja | Bajo | P1 | PR-S1 docs |
| 10 | Secret-scanning en CI (plan) | Security | security | Medio-alto | Baja | Bajo | P1 | PR-S1 docs |
| 11 | Lazy-load deps pesadas (si se cablean) | Frontend | performance | Medio | Media | Medio | P2 | post PR-DEP1 |
| 12 | Design tokens documentados | UI/UX | visual | Medio-alto | Baja | Bajo | P2 | PR-D1 docs |
| 13 | Mapa de acciones críticas admin | Product ops | operational | Medio-alto | Baja | Bajo | P2 | PR-D1 docs |
| 14 | API readiness (versionado/errores) | Integrations | commercial | Medio-alto | Media | Medio | P2 | PR-A1 docs |
| 15 | Lifecycle de datos + retención | Governance | compliance | Medio-alto | Media | Medio | P2 | PR-G1 docs |
| 16 | Latencia agregada por endpoint | Perf/Backend | performance | Medio | Media | Medio | P2 | PR-P3 backend |
| 17 | Release checklist + rollback | Release | reliability | Medio | Baja | Bajo | P2 | PR-R1 docs |
| 18 | Auditoría a11y formal (axe) | A11y | operational/legal | Medio | Media | Bajo | P2 | PR-A11y docs |
| 19 | Auditoría política cache PWA | PWA | security | Medio | Baja | Bajo | P3 | PR-PWA1 docs |
| 20 | Consolidar `console.*` tras logger | Observability | reliability | Medio | Media | Bajo | P2 | post PR-R2 |
| 21 | Candidatos de jobs async (doc) | Async | scalability | Medio | Baja | Bajo | P3 | PR-A2 docs |
| 22 | OpenAPI desde zod | Integrations | commercial | Medio | Media-alta | Medio | P3 | post PR-A1 |
| 23 | Feature flags (evaluación) | Release | DX | Bajo-medio | Media | Medio | P3 | PR-R1 docs |
| 24 | Webhooks firmados | Integrations | commercial | Medio | Media-alta | Medio | P3 | post PR-A1 |
| 25 | Cierre de bloques dashboard premium/legacy | Docs/SoT | DX | Bajo-medio | Baja | Bajo | P2 | PR-O3 docs |

---

## 18. Recommended PR Sequence

> Solo PRs chicos. Cada uno: tipo, objetivo, scope permitido, no-scope, validación, rollback, dependencia.

| PR | Tipo | Objetivo | Scope permitido | No-scope | Validación | Rollback | Dependencia |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **PR-O1** | docs-only | Índice de auditorías (`docs/audit/README.md`) | crear 1 archivo | mover/editar audits | `git diff --check`, lectura | borrar archivo | ninguna |
| **PR-O2** | docs-only | Mapa de fuentes de verdad (`docs/SOURCES_OF_TRUTH.md`) | crear 1 archivo (+1 línea AGENTS.md con OK de Nico) | consolidar carpetas | lectura humana | borrar/revertir | PR-O1 |
| **PR-O3** | docs-only | Clasificar histórico/superseded (banners) | editar cabeceras | mover/renombrar/borrar | `git diff --check` + no-lectura por test | revertir | PR-O1/O2 |
| **PR-DEP1** | docs-only | Auditoría deps usadas vs no usadas (react-query/table/echarts) | crear 1 doc | tocar `package.json` | `git grep` imports, build size | borrar doc | ninguna |
| **PR-C3** | CI-only | Usar capas E2E sin pérdida de cobertura (smoke gate + full) | `.github/workflows/frontend-ci.yml` | tocar specs/scripts/Playwright config | unión == 42; CI verde; renombrar step | revertir workflow | validación local previa |
| **PR-S1** | docs-only | Auditoría seguridad/aislamiento + plan secret-scanning | crear 1 doc | tocar auth/middlewares | revisión + `security:public-surface` | borrar doc | PR-O1 |
| **PR-D1** | docs-only | Valor operativo dashboard + design tokens map | crear 1 doc | tocar `frontend/src` | revisión humana | borrar doc | PR-O1 |
| **PR-P1** | docs-only | Budgets de performance propuestos | crear 1 doc | medir/instrumentar | revisión humana | borrar doc | ninguna |
| **PR-R1** | docs-only | Baseline observabilidad/SLO + release/rollback checklist | crear 1 doc | tocar logger/CI | revisión humana | borrar doc | PR-O1 |
| **PR-A1** | docs-only | Readiness API/webhooks/versionado/idempotency | crear 1 doc | tocar rutas | revisión humana | borrar doc | PR-O1 |
| **PR-G1** | docs-only | Gobernanza de datos/lifecycle/retención | crear 1 doc (legal flags) | inventar obligaciones legales | revisión + confirmación Nico | borrar doc | PR-O1 |
| **PR-R2** | backend-only | Logger estructurado JSON (post PR-R1) | `server/lib/logger.ts` + su test | tocar otras capas | test de shape, `pnpm test`, sin secretos | revertir 1 archivo | PR-R1 |
| **PR-P2** | frontend-only | Medición web-vitals mínima (post PR-P1) | medición no intrusiva | budgets nuevos | build size + vitals vs budget | revertir medición | PR-P1 |

**Orden recomendado:** PR-O1 → PR-O2 → PR-O3 → PR-DEP1 → (validación local capas) → PR-C3 → PR-S1 /
PR-R1 / PR-P1 / PR-A1 / PR-D1 / PR-G1 (docs en paralelo) → PR-R2 / PR-P2 (implementación acotada).

---

## 19. Enterprise Guardrails

- **No reescrituras grandes.** Backend y frontend son activos maduros; instrumentar, no reconstruir.
- **No adoptar dependencias sin gap probado.** Y resolver primero las 3 ya instaladas sin uso.
- **No mezclar visual + seguridad + CI en un PR.** Un eje por PR.
- **No mezclar backend + frontend** salvo PR contract-only explícito.
- **No tocar CI sin validar scripts localmente** (unión de capas == `e2e:full`).
- **No mover E2E** antes de estabilizar capas + CI.
- **No riesgo de cache público/privado:** SW no cachea `/dashboard`, `/dashboard/admin`, `/api`
  privadas, auth, reports, downloads, signed URLs, ni respuestas con `Set-Cookie`.
- **No debilitar fronteras de sesión** (`admin_session_id` vs `app_session_id`).
- **No mezclar Dependabot con feature work.**
- **No PWA/offline para datos privados** sin política de cache resuelta y auditada.
- **No realtime** salvo valor de usuario concreto y medible.
- **No micro-frontends** antes de independencia real de equipos/módulos.
- **No CRDTs** sin edición concurrente real.
- **No WebGL** sin visualización masiva.
- **No exponer secretos/tokens/hashes/cookies/signed URLs** en UI, logs, fixtures, screenshots.
- **Siempre definir rollback** y mantener cada PR reversible.
- **Git lo ejecuta Nico** (no `add`/`commit`/`push`/PR/merge por la IA); **no comandos con `exit`**.

---

## 20. Final Recommendation

1. **¿VETNEB es hoy enterprise-grade?** **No todavía**, pero está cerca en los cimientos. Nivel
   "estable, no enterprise" (≈2.7/5). Fuerte en seguridad/separación/testing; débil en
   observabilidad, performance budgets, integración y jobs async.

2. **Camino más rápido y seguro a enterprise-grade:** instrumentar y formalizar de forma **aditiva**,
   no reescribir. Fase 0 (SoT) → Fase 1 (CI gate) → Fase 5 (observabilidad) → Fase 4 (performance).

3. **Qué hacer primero:** **Fase 0** (índice + mapa de fuentes de verdad) y validación local de las
   capas E2E para habilitar **PR-C3**.

4. **Qué NO hacer aún:** realtime, CRDTs, WebGL, micro-frontends, colas, PWA-offline de privados,
   OpenAPI/webhooks sin consumidor, y **adoptar cualquier dependencia nueva** (resolver antes las 3
   instaladas sin uso).

5. **Próximo PR exacto:** **PR-O1 docs-only** — `docs/audit/README.md` (índice de auditorías
   vigentes con estado por archivo). Cero riesgo; desbloquea la secuencia.

6. **Qué auditoría debe seguir:** tras Fase 0, **PR-S1 docs (security/session)** y **PR-R1 docs
   (observabilidad/release)** como auditorías de dominio único, antes de cualquier implementación.

7. **Área que más sube el valor:** **observabilidad** (logger estructurado + baseline) — convierte un
   producto "que funciona" en uno "operable y soportable".

8. **Área que más reduce el riesgo:** **CI gate por capas (PR-C3)** + **seguridad (PR-S1)** —
   protegen cobertura e invariantes críticos sin tocar arquitectura.

9. **Área que más mejora la calidad premium percibida:** **design tokens documentados + pulido
   operativo del dashboard** (PR-D1) sobre los contratos no-scroll ya logrados.

10. **Área que más mejora la madurez de ingeniería:** **fuentes de verdad + budgets de performance**
    (Fase 0 + Fase 4) — instalan medición y trazabilidad como práctica permanente.

---

## Appendix — Evidence Traceability Map

> Mapa claim → archivo/símbolo exacto, para que auditorías futuras salten directo a la evidencia sin
> re-escanear. Reduce consumo y evita reabrir lo ya verificado (alineado con ISO/IEC 14598:
> evaluación trazable).

| Claim de la auditoría | Evidencia exacta (archivo / símbolo) | Verificación read-only usada |
| --- | --- | --- |
| Backend Fastify separado por capas | `server/lib`(41), `server/routes`(34, `*.fastify.ts`), `server/middlewares`(7) | `git ls-files server/**` |
| Un acceso a datos por dominio | `server/db-admin-clinics.ts`, `db-admin-sessions.ts`, `db-audit.ts`, `db-pricing.ts`, `db-report-workflow.ts`, `db-study-tracking.ts`, … | `git ls-files server/*` |
| Rate-limit por superficie | `server/lib/login-rate-limit.ts`, `contact-rate-limit.ts`, `public-professionals-rate-limit.ts`, `public-report-access-rate-limit.ts`, `report-access-token-rate-limit.ts`, `rate-limit-store.ts` | `git ls-files` + Grep |
| Headers de respuesta endurecidos | `server/lib/api-response-security.ts`, `sensitive-response-cache.ts`; tests `backend-api-no-store-cache`, `backend-api-nosniff-responses` | Grep server (52/16) |
| CSP nonce + report | `frontend/src/lib/security/csp-policy.ts`, `csp-nonce.ts`, `frontend/src/app/api/security/csp-report/route.ts`; tests `frontend-csp-*` | `git ls-files frontend/src/lib/**` |
| CSRF / origen confiable | `server/middlewares/trusted-origin.ts`; `docs/pr-history/PR-security-csrf-mutating-route-coverage.md` | `git ls-files` |
| Aislamiento de sesión | `server/middlewares/{admin-auth,auth,clinic-permissions,particular-auth}.ts`; `lib/session-last-access.ts`; `app_session_id`/`admin_session_id` | Grep server |
| RBAC | `server/lib/permissions.ts`; `docs/security/RBAC_MATRIX.md`, `ENDPOINT_PERMISSION_MATRIX.md` | `git ls-files docs/security/*` |
| Logger NO estructurado | `server/lib/logger.ts` (`console.log('[INFO]', …)`, 22 líneas) | Read completo |
| Request-id / health / timing | `server/lib/api-request-id.ts`, `middlewares/request-logger.ts`, `lib/runtime-timing.ts`, `routes/admin-system-health.fastify.ts`, `lib/schema-health.ts`, `frontend/src/app/api/build-info/route.ts` | Grep server (132/38) |
| Sin Sentry/OTel/OpenAPI/webhooks/idempotency/realtime | Grep en `frontend/src` y `server` = 0 (real); menciones solo en `docs/**` | Grep dirigido |
| Capas E2E (#1096) | `frontend/package.json` scripts `e2e:smoke/admin-mobile/visual-contract/public-clinic/full` (7+13+11+11=42) | Read `frontend/package.json` |
| Deps instaladas sin uso | `frontend/package.json` deps `@tanstack/react-query`, `@tanstack/react-table`, `echarts`, `echarts-for-react`; Grep uso en `src` → solo `gsap` (`PublicScrollReveal.tsx`) | Read + Grep |
| Estado cliente mínimo | `frontend/src/context/AuthContext.tsx`, `hooks/useAuth.ts`; sin zustand/redux/xstate (Grep=0) | Grep frontend/src |
| API client centralizado | `frontend/src/lib/api.ts`, `lib/routes.ts`, `lib/api-error.ts`, `lib/dashboard-server-auth.ts` | `git ls-files frontend/src/lib/**` |
| PWA segura | `frontend/public/sw.js`, `frontend/src/app/manifest.ts`, ruta `app/offline`, iconos maskable 192/512, `components/pwa/PwaServiceWorkerRegistrar.tsx` | `git ls-files frontend/public/*` |
| Deuda técnica baja | TODO/FIXME/as any/console.log/ts-ignore = 14 hits / 14 archivos | Grep frontend/src |
| Supply-chain gestionado | `package.json` → `pnpm.overrides` (brace-expansion, esbuild, ws, fast-uri, postcss, js-yaml); Dependabot #1018–#1038 | Read + `gh pr list` |
| Backups/rollback documentados | `docs/ops/BACKUP_RESTORE_ROLLBACK.md`, `docs/ops/CI_PR_CHECKS_RUNBOOK.md`, `docs/review-governance.md` | `git ls-files docs/ops/*` |
| Lifecycle de datos | `server/lib/study-tracking.ts`, `report-status.ts`, `report-access-token.ts`, `token-study-tracking.ts`; `docs/implementation/lab-received-date-delivery-estimate.md` | `git ls-files` |
| Deuda de datos pendiente | `docs/notes/PENDIENTE_NORMALIZACION_CLINICS.md`, `docs/notes/todo.md` | `git ls-files docs/notes/*` |

> Áreas marcadas **"requires focused audit"** (no expandidas aquí): consistencia camel/snake y
> métodos HTTP por endpoint; uso de `select('*')`/índices en `db-*.ts`; consistencia de fechas
> críticas estudio→entrega; cobertura a11y con axe. Cada una merece su propia auditoría de dominio
> único con archivo de salida propio.

---

## Final validation

```powershell
git status --short --untracked-files=all
git diff --name-only
git diff --stat
git diff --check
```

**Resultado esperado** (esta auditoría solo agrega un archivo **untracked**):

- `git status --short --untracked-files=all` → `?? docs/audit/repository-operational-ordering-audit.md`
  y `?? docs/audit/vetneb-enterprise-engineering-readiness-audit.md`
- `git diff --name-only` → vacío (sin archivos tracked modificados)
- `git diff --stat` → vacío
- `git diff --check` → limpio

> Los comandos los ejecuta Nico manualmente. Esta auditoría **no** ejecuta `git add/commit/push`,
> `gh pr create/merge` ni comandos con `exit`.
