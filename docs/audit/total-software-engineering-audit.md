# Total Software Engineering Audit

> **Tipo:** Senior Software Engineering Audit / Production Readiness Review / Architecture & Code Quality Assessment.
> **Fecha:** 2026-06-30 · **Rama:** `docs/total-software-engineering-audit` · **HEAD:** `8f6b1a2` · **PRs abiertos:** 0 · **Working tree:** limpio salvo este propio documento (untracked).
> **Naturaleza:** Documental. El único artefacto generado es este archivo Markdown; no se modificó frontend, backend, tests, DB, migraciones, dependencias, lockfiles ni workflows. Sin commit/push/PR.
> **Marcos:** ISO/IEC 25010 · 25000 SQuaRE · 5055 · 27001 · 15504 SPICE · 14598 · OWASP Top 10 / ASVS / API Top 10 · CWE · Twelve-Factor · SRE/Production Readiness · Clean Architecture.

Esta auditoría es **complementaria**, no sustituta, de las auditorías vigentes Wave 0
(`vetneb-enterprise-engineering-readiness-audit.md`, `vetneb-extreme-multinational-enterprise-readiness-audit.md`,
`vetneb-supreme-system-level-alignment-plan.md`, `repository-operational-ordering-audit.md`) y de
`total-visual-engineering-audit.md` (#1192). Donde un hallazgo ya está cubierto por una auditoría previa se cita
explícitamente y no se re-deriva. El foco aquí es **ingeniería de software dura** sobre el estado real del código en `HEAD`.

---

## 1. Executive Summary

**Estado general.** Portal VETNEB es un monorepo pnpm con backend Fastify 5 / Drizzle / Supabase (Postgres + Storage) y
frontend Next 16 / React 19. El repositorio está en un estado **maduro y disciplinado**: el árbol está limpio, las 7
validaciones obligatorias pasan en verde (typecheck × 3, lint frontend, **2896 tests backend 0 fallos**, build backend,
build frontend, `security:public-surface`), la deuda explícita es mínima (2 `TODO`, **0 `@ts-ignore`/`@ts-expect-error`**),
TypeScript está en `strict` en los tres tsconfig, y el diseño de seguridad de aplicación es de nivel senior (CSRF por
verificación de Origin, sesiones hasheadas con separación `admin_session_id`/`app_session_id`/`particular_session_id`,
rate-limit por superficie, headers de seguridad, sanitización de errores 5xx, version gate 426).

**Riesgo principal.** El sistema es **multi-tenant de datos clínicos** y **no tiene aislamiento a nivel de base de datos**:
no existe una sola política RLS (`CREATE POLICY` = 0) y la conexión es Postgres directa y privilegiada vía Drizzle
(`server/db.ts`), que de por sí *bypassea* RLS. Todo el aislamiento entre clínicas descansa en filtros `clinicId` en
código de aplicación. Hoy esa disciplina es correcta y está testeada, pero **no hay red de seguridad**: un único endpoint
que olvide el filtro de tenant expone informes clínicos cruzados sin que la DB lo impida. Es el hallazgo más importante del
informe (ENG-P1-001).

**Riesgos secundarios de alto impacto.** (1) la cobertura de tests **no se mide** en ningún punto (2896 tests, % real
desconocido); (2) el frontend **no tiene tests unitarios** (sólo E2E Playwright, Chromium-only, contra `next dev` y no
contra el build de producción); (3) el backend **no tiene linter**; (4) la observabilidad es **solo `console`** (Fastify
`logger:false`, `logger.ts` es un wrapper de `console`), sin logs estructurados, métricas, tracing ni error-tracking.

**Nivel de madurez:** **Senior**, con dimensiones que rozan "ingeniería extrema" (volumen y disciplina de tests backend,
seguridad de aplicación, gobernanza documental, version gate / deploy automation) y dimensiones que la frenan
(observabilidad **básica**, aislamiento de datos sin defensa en profundidad, testing sin métrica de cobertura, frontend sin
unidad).

**Dictamen.** **Apto para operación productiva actual** (baseline verde, auth sólida, health checks DB+Storage, rollback
documentado, version gate). **No apto todavía para "production readiness extremo / multinacional"** hasta cerrar el set P1,
encabezado por la defensa en profundidad de aislamiento de datos y la medición de cobertura. No se detectaron **P0**: no hay
bypass de auth, secretos versionados, ni build/test/CI roto.

| | |
| --- | --- |
| **Hallazgos** | **0 P0 · 7 P1 · 12 P2 · 7 P3 = 26 total** |
| **Baseline** | Verde (todas las validaciones obligatorias pasan) |
| **Veredicto** | Production-ready operativo / no aún "extremo" sin el set P1 |

### 1.1 Executive Value Add — Qué significa esto para VETNEB

**Lectura ejecutiva en una frase:** el portal **funciona, es operable y es vendible hoy**; el trabajo pendiente es
**blindaje incremental** (defensa en profundidad, observabilidad, medición), **no rescate**. Ningún hallazgo bloquea la
operación actual.

- **Riesgo de negocio / producto.** El activo central son **datos clínicos multi-tenant**. Una fuga cross-tenant (ENG-P1-001)
  dañaría la confianza B2B con clínicas y tendría exposición legal/contractual. La falta de observabilidad (ENG-P1-006)
  implica que un incidente productivo puede pasar inadvertido o tardar en diagnosticarse → impacto en SLA y reputación.
- **Riesgo técnico.** God-files (ENG-P1-007) y contrato frontend↔backend a mano (ENG-P2-003) elevan el costo de cambio y la
  probabilidad de regresión; **sin cobertura medida (ENG-P1-002) y sin unit tests de frontend (ENG-P1-003) no se sabe qué se
  rompe** al modificar.
- **Riesgo operativo.** Sin IaC (ENG-P2-009) ni métricas/alertas (ENG-P1-006), la operación depende de conocimiento implícito
  y del estado del dashboard Render; el rollback de esquema es manual (ENG-P2-011).
- **Riesgo de seguridad.** La postura de **aplicación** es sólida (auth, CSRF por Origin, rate-limit, headers); falta
  **defensa en profundidad de datos** (RLS, ENG-P1-001), **CSP enforcing** (ENG-P2-008) y **sanitización de 4xx** (ENG-P2-001).
- **Qué se puede resolver sin tocar producción crítica (docs/test-only o cambio mínimo aislado):** ADR del modelo de
  aislamiento + guard anti-IDOR (PR-SEC-2, docs+test), sanitización de 4xx (PR-SEC-1, una función), incluir
  `security:public-surface` en `validate:local` (PR-DX-1), eliminar handler muerto (PR-CLEAN-1), tipar el logger (PR-TYPE-1).
- **Qué requiere autorización especial:** dependencias nuevas (c8, vitest, pino, eslint backend), cambios de CI (gates de
  cobertura/lint, cross-browser), DB (RLS, down migrations) e infraestructura (`render.yaml`). Todos marcados ⚠ en §19.
- **Qué NO debe hacerse todavía:** RLS sin plan de migración/rollback en entorno no-prod; CSP enforcing sin revisar antes los
  reportes; activar coverage + lint + e2e + mutation **todo junto**; refactorizar god-files con cambios funcionales; **cualquier
  cambio visual** (eso pertenece a `total-visual-engineering-audit.md`).

**Conclusión ejecutiva (4 certezas):** (1) el repo está **estable y verde**; (2) **no hay P0**; (3) el mayor riesgo es la
**falta de defensa en profundidad + observabilidad + cobertura medida**, no un defecto activo; (4) la ruta correcta es
**incremental, por PRs chicos, reversibles y trazables** (no big-bang).

### 1.2 Executive Control Panel

Decisión en 60 segundos: estado por dimensión, riesgo vivo, siguiente acción concreta y si hace falta autorización.
Estado: ✅ ok · ⚠️ gap accionable · ⛔ gap con autorización fuerte. (Detalle: §5, §25, §26.)

| Dimensión | Estado | Riesgo actual | Siguiente acción (PR) | Autorización |
| --- | --- | --- | --- | --- |
| Security defense-in-depth | ⛔ | Sin red DB ante olvido de scope | PR-SEC-2 (ADR+guard) → PR-RLS-1 | docs/test → ⚠⚠ DB |
| Multi-tenant isolation | ⚠️ | App-layer correcto pero sin RLS | PR-SEC-2 | docs/test (no) |
| Observability | ⛔ | Incidentes ciegos (console-only) | PR-OBS-1 | ⚠ backend (¿`pino`?) |
| Test coverage measurement | ⚠️ | % real desconocido | PR-COV-1 (sin umbral) | ⚠ deps+CI |
| Frontend test strategy | ⚠️ | Lógica FE sin unit | PR-FE-TEST-1 | ⚠ deps |
| Backend static analysis | ⚠️ | ~33k LOC sin linter | PR-LINT-1 | ⚠ deps+CI |
| E2E production-mode | ⚠️ | Chromium-only contra dev | PR-E2E-1 | ⚠ CI |
| Database / RLS | ⛔ | RLS=0; forward-only | PR-RLS-1 | ⚠⚠ DB |
| CI/CD | ✅/⚠️ | Verde; sin gate cobertura/lint ni IaC | PR-LINT-1, PR-COV-1, PR-INFRA-1 | ⚠ CI/infra |
| Production readiness | ⚠️ | Operable; gates 2–6 abiertos | Ver §26 (gates) | mixto |

**Acción inmediata sin autorización:** **PR-SEC-2** (docs+test). **Mayor valor/menor riesgo después:** PR-SEC-1 → PR-DX-1 → PR-CLEAN-1 → PR-TYPE-1 (lote 0, §19.2).

---

## 2. Audit Scope

### Cubierto (white-box, sobre código en `HEAD`)
- **Config raíz:** `package.json`, `tsconfig.json`, `pnpm-workspace.yaml`, `.npmrc`/`.pnpmrc`, `drizzle.config.ts`, `.env.example`, `AGENTS.md`, `README.md`.
- **Backend (`server/`, 105 archivos, ~33.5k LOC):** `fastify-app.ts`, `index.ts`, `bootstrap.ts`, `preflight.ts`, `db.ts` + 13 `db-*.ts`, 51 archivos `lib/*`, 8 `middlewares/*`, 41 `routes/*.fastify.ts`, `utils/async-handler.ts`. Lectura profunda de: `db.ts`, `lib/env.ts`, `middlewares/{admin-auth,trusted-origin,error-handler}.ts`, `lib/logger.ts`, `lib/rate-limit-store.ts`.
- **Frontend (`frontend/`, 240 archivos; `src/` 167 archivos, ~40.8k LOC):** `next.config.ts`, `eslint.config.mjs`, `tsconfig.json`, `playwright.config.ts`, `postcss.config.mjs`, `tailwind.config.ts`, `src/proxy.ts`, mapa de `app/`, `components/`, `lib/`, `public/`.
- **DB:** `drizzle/schema.ts` (1196 LOC), `drizzle/relations.ts`, 31 migraciones SQL + `meta/_journal.json`.
- **Tests:** inventario de los 406 archivos `*.test.ts` backend y 47 `*.spec.ts` E2E; ejecución real (`pnpm test` → 2896 pasan).
- **CI/CD:** los 3 workflows (`backend-ci.yml`, `frontend-ci.yml`, `app-version-force-update.yml`), `dependabot.yml`, `CODEOWNERS`, `PULL_REQUEST_TEMPLATE.md`.
- **Scripts:** 19 scripts (`db/`, `dev/`, `ops/`, `security/`, `smoke/`).
- **Docs/gobernanza:** `SOURCES_OF_TRUTH.md`, `audit/README.md`, índices de `docs/audit`, `docs/implementation`, `docs/governance`, `docs/qa`, `docs/release`, `docs/ops`.

### Validaciones ejecutadas
`git diff --check` · `pnpm typecheck` · `pnpm typecheck:test` · `pnpm test` · `pnpm build` · `pnpm --dir frontend typecheck` · `pnpm --dir frontend lint` · `pnpm --dir frontend build` · `pnpm security:public-surface`. Resultados en §7 y en la salida final.

### No verificable sin acceso productivo (brechas declaradas)
- **Supabase real:** RLS efectiva (no existe en repo), policies, configuración de Storage/bucket, roles de DB, signed-URL TTL en prod.
- **Render:** variables de entorno reales, build/start commands, health-check path, deploy hooks, escalado/instancias (no hay IaC en repo).
- **Métricas/logs reales:** Core Web Vitals productivos, latencias p50/p95/p99, throughput, tasa de error, uso de recursos, cold start.
- **Cobertura real (%):** no se mide en el repo (sin c8/nyc/istanbul). No se inventa.
- **Backups/restore:** existencia de drills reales y RTO/RPO efectivos (sólo documentados en `docs/ops/BACKUP_RESTORE_ROLLBACK.md`).
- **Cross-browser/visual:** sólo Chromium en E2E; sin Firefox/WebKit ni regresión visual real (ver `total-visual-engineering-audit.md`).
- **Secretos:** por protocolo no se leen `.env` reales; sólo nombres de variables vía `.env.example`/`env.ts`.

---

## 3. Skills & Methodology

### Skills leídas y aplicadas (9/9, todas existen con el nombre exacto)

| Skill | Aporte a esta auditoría | Límite |
| --- | --- | --- |
| `vetneb-staff-senior-full-stack-engineer` | Marco de auditoría full-stack, separación admin/clínica/particular/público, criterio "no simular éxito". | Orientada a implementar PR mínimos; aquí sólo diagnóstico. |
| `vetneb-security-production-invariants` | Invariantes de sesión/cookies/roles, sanitización, no-cache privado, auditoría sin secretos. | No reemplaza pentest dinámico ni revisión de RLS real. |
| `vetneb-production-web-optimization-engineer` | Checklist frontend/backend/API/Supabase/Render/performance/seguridad; clasificación P0–P3. | Sin métricas productivas reales no hay perf medido. |
| `vetneb-web-end-to-end-global` | Mapa de superficies (público/clínica/admin/API), definición de "operativo". | Validación E2E real requiere staging. |
| `vetneb-lanzamiento-mantenimiento` | Readiness, post-merge, rollback, mantenimiento, incident readiness. | Rollback/restore reales requieren acceso productivo. |
| `vetneb-bugs-errores-optimizacion-rutas` | Clasificación de fallos de rutas/CORS/SW/caché/DB para el análisis de error handling. | Sin reproducción dinámica en este scope. |
| `vetneb-pwa-end-to-end` | Política PWA (qué cachear / qué nunca), validación manifest/SW/offline. | Lighthouse/instalación real no ejecutados. |
| `vetneb-briefing-planificacion-diseno-desarrollo-pruebas` | Estructura del plan de PRs (§19), anti-deriva, scope/no-scope. | — |
| `vetneb-protocolos-comunicacion` | Diagnóstico por endpoint (ruta→`api.ts`→Fastify→método→status→CORS→error). | — |

**Sustituciones:** ninguna. Las 9 skills solicitadas existen con su nombre exacto (`anthropic-skills:vetneb-*`).

### Herramientas / comandos
`git` (branch/status/log/ls-files/grep/diff), `git grep`/Grep (ripgrep) para conteos y patrones, `wc -l` para LOC,
lectura directa de archivos, `pnpm` para las validaciones. Conteos clave reproducibles incluidos en cada hallazgo.

### Límites metodológicos
Auditoría **estática y documental**. No hay ejecución dinámica de endpoints contra DB real, ni profiling, ni pentest, ni
medición de cobertura/mutación. Las severidades reflejan riesgo de ingeniería sobre evidencia de código; las brechas
productivas se marcan explícitamente (§2).

---

## 4. Repository Architecture Map

```
PORTAL-VETNEB/
├── server/                         Backend Fastify 5 (ESM, tsx dev, esbuild bundle)  ~33.5k LOC
│   ├── fastify-app.ts              Factory: hooks globales (reqId, security headers, trusted-origin, version-gate),
│   │                               error/notFound handlers, 34 register() con prefix /api/*
│   ├── index.ts / bootstrap.ts     Listen 0.0.0.0:PORT, preflight, graceful shutdown (closeDbConnection)
│   ├── db.ts (+ db-*.ts ×13)       Data access (Drizzle + postgres directo). Conexión privilegiada (bypassa RLS)
│   ├── lib/ (×51)                  env, auth-security, *-rate-limit, audit, email, supabase, permissions, logistics/*
│   ├── middlewares/ (×8)           admin-auth, auth, particular-auth, clinic-permissions, trusted-origin,
│   │                               version-gate, error-handler (legacy, no usado por la app), request-logger
│   └── routes/ (×41 *.fastify.ts)  HTTP + validación zod + lógica de negocio (colocadas)
├── frontend/                       Next 16 App Router, React 19, Tailwind 4, Radix, GSAP  ~40.8k LOC en src/
│   ├── src/app/ (×67)              Rutas: público (○ estático SEO) + /dashboard, /dashboard/admin, /dashboard/logistica (ƒ)
│   ├── src/components/ (×76)       UI dashboard/public/pwa/ui
│   ├── src/lib/ (×19)              api.ts (cliente API monolítico 2371 LOC), security/csp-policy, seo
│   ├── src/proxy.ts                Next middleware: redirect a /login por presencia de cookie (matcher /dashboard/:path*)
│   └── public/                     sw.js, icons (192/512/maskable/apple), favicon  (manifest/offline vía app/)
├── drizzle/                        schema.ts (1196 LOC, 89 index + 51 references/FK), relations.ts, 31 migraciones (forward-only)
├── scripts/                        db/ · dev/ · ops/ · security/ · smoke/  (19 archivos)
├── .github/                        workflows ×3, dependabot.yml, CODEOWNERS (* @LABVETNEB), PR template
├── docs/                           ~300 archivos: audit/ (índice vigente + históricos), implementation/, governance/,
│                                   qa/, release/, ops/, security/, SOURCES_OF_TRUTH.md, HISTORICAL_DOCUMENTATION.md
└── (sin) supabase/  ·  (sin) shared/  ·  (sin) render.yaml/Dockerfile
```

**Fronteras de auth/seguridad.** Tres dominios de sesión estrictamente separados por cookie:
`admin_session_id` (admin), `app_session_id` (clínica), `particular_session_id` (particular). El proxy Next protege
`/dashboard/*` por presencia de cookie; la autorización real ocurre en backend (middlewares por dominio). El borde CSRF
es `trusted-origin` (verificación de Origin/Referer en métodos inseguros), apropiado porque las cookies productivas son
`SameSite=None; Secure` (frontend y API en subdominios distintos).

**Observación arquitectónica central:** no hay capa `shared/` ni contrato generado/OpenAPI; el contrato frontend↔backend
se mantiene a mano (tipos duplicados + `api.ts`). El aislamiento multi-tenant es 100% de aplicación (sin RLS).

---

## 5. Engineering Maturity Assessment

Escala: Básico · Profesional · Senior · Ingeniería extrema.

| Dimensión | Nivel | Evidencia / freno |
| --- | --- | --- |
| **Code quality** | Senior | `strict` × 3, 0 `ts-ignore`, 2 `TODO`, lint frontend limpio. Freno: god-files (route 2241 LOC, `api.ts` 2371), backend sin linter. |
| **Architecture** | Senior | Modularización por feature, DI en middlewares, factory testeable. Freno: sin service layer en rutas grandes, sin `shared/`, sin contrato generado. |
| **Security (app)** | Senior | CSRF por Origin, sesiones hasheadas, rate-limit por superficie, headers, sanitización 5xx, version gate. Freno: CSP report-only, leak 4xx (CWE-209). |
| **Security (datos)** | Profesional | Scoping `clinicId` consistente y testeado. Freno fuerte: **sin RLS / conexión privilegiada → sin defensa en profundidad**. |
| **Testing** | Profesional→Senior | **2896 tests backend, 0 fallos**; tests de contrato de CI/seguridad/sesión. Freno: cobertura no medida, **frontend sin unit**, sin mutation, E2E Chromium-only contra dev. |
| **Performance** | Profesional | Paginación, 89 índices, caches (`*-cache.ts`), `compress`, imágenes avif/webp. Freno: sin load/stress, sin budgets medidos, rate-limit in-memory. |
| **Database** | Senior | 89 índices, 51 FK, transacciones, 31 migraciones versionadas, health DB+Storage. Freno: sin RLS, migraciones forward-only. |
| **CI/CD** | Senior | Postgres service, `pnpm audit`, migrate+typecheck+test+build, E2E por capas, force-update workflow endurecido. Freno: sin gate de cobertura, sin IaC, sin lint backend en CI. |
| **Observability** | **Básico** | `logger:false`, `logger.ts` = wrapper `console`, `console.*` en 29 archivos. Sin logs estructurados, métricas, tracing ni error-tracking. |
| **Documentation** | Profesional | Volumen extremo (~300 docs), `SOURCES_OF_TRUTH`, gobernanza/QA/release. Freno: fragmentación/solapamiento (ver `documentation-taxonomy-fragmentation-audit.md`). |
| **Developer Experience** | Senior | `validate:local`, scripts ricos, `AGENTS.md`, PR template, Dependabot. Freno: `validate:local` no corre lint ni security. |
| **Production readiness** | Senior (con gaps) | Health checks, version gate, rollback docs, env validado por zod. Freno: observabilidad básica, sin IaC, cobertura no medida. |

---

## 6. Findings by Audit Area

### 6.1 Código (White-box, Static, Clean Code, Complexity, Dead Code, Type Safety, Tech Debt)

**Observaciones.** Disciplina alta: `strict:true` en `tsconfig.json` (raíz), `frontend/tsconfig.json` y `test/tsconfig.json`;
**0** `@ts-ignore`/`@ts-expect-error` en todo el árbol; sólo **2** `TODO`/`FIXME` en `server`+`frontend/src`+`test`; **13**
ocurrencias de `any` (varias en `logger.ts` con `any[]`); **14** `eslint-disable` (frontend). `pnpm --dir frontend lint` y los
3 typecheck pasan.

**Hallazgos.**
- **God-files / complejidad colocada (ENG-P1-007).** Rutas backend con HTTP + validación + negocio en un solo archivo:
  `logistics-route-plans.fastify.ts` **2241**, `auth.fastify.ts` **1514**, `logistics-field-visits.fastify.ts` **1421**,
  `clinic-public-profile.fastify.ts` **1316**, `admin-study-tracking.fastify.ts` **1205**. Frontend: `lib/api.ts` **2371**
  (cliente único), `app/dashboard/admin/AdminParticularTokensCard.tsx` **1894**, `components/dashboard/ClinicParticularTokensCard.tsx` **1604**.
- **Duplicación admin/clínica (ENG-P2-004).** El par ParticularTokens (1894 + 1604 = ~3.5k LOC) comparte dominio; candidato a hook/UI compartida.
- **Dead/duplicado (ENG-P3-007).** `server/middlewares/error-handler.ts` sólo lo importa un test; la app usa `setErrorHandler` en `fastify-app.ts`. Lógica duplicada; el handler Express está muerto en producción.
- **Lint backend ausente (ENG-P1-005).** No hay ESLint/Biome para `server/`, `scripts/`, `drizzle/`: ~33k LOC sin análisis estático de estilo/errores.
- **`any` en logger (ENG-P3-002)** y **reglas react-hooks desactivadas (ENG-P3-001)** (`react-hooks/immutability`, `react-hooks/set-state-in-effect` en `off`).

### 6.2 Arquitectura (Design, Modularity, Coupling/Cohesion, API, Domain, Boundary, Scalability, ADR)

**Observaciones.** Estructura por feature clara y consistente: `routes/*.fastify.ts` (transporte), `db-*.ts` (acceso a datos),
`lib/*` (utilidades/seguridad), `middlewares/*` (transversal). Factory `createFastifyApp` con inyección de dependencias por
ruta → alta testeabilidad. Frontend App Router con `app/` por dominio y `components/` por familia.

**Hallazgos.**
- **Sin capa `shared/` ni contrato generado (ENG-P2-003).** No existe paquete compartido; `frontend/src/types/index.ts` (571 LOC) replica tipos del backend y `api.ts` se mantiene a mano contra las rutas. Sin OpenAPI/swagger (confirmado: 0). Riesgo de *drift* de contrato.
- **Negocio en transporte (ENG-P1-007).** Las rutas grandes carecen de service layer; el criterio "rutas finas / servicios testeables" de la skill de optimización no se cumple en los archivos más grandes.
- **Acoplamiento a infraestructura sin IaC (ENG-P2-009).** El borde Render no está codificado (ver §6.7).
- **ADRs:** existe `docs/governance/adr-template.md` pero la decisión arquitectónica clave (aislamiento por aplicación en vez de RLS) **no está registrada como ADR** → recomendado documentarla (parte de ENG-P1-001).

### 6.3 Seguridad (OWASP, AuthN/Z, Secrets, Input Validation, Data Exposure, RLS, Threat Model, Deps, Least Privilege)

**Observaciones (fortalezas).** Sesiones por token hasheado con verificación de expiración y limpieza de cookie
(`admin-auth.ts`); cookies `httpOnly`, `Secure` y `SameSite=None` en prod (`env.ts`); CSRF por Origin/Referer en métodos
inseguros (`trusted-origin.ts`), con tests que verifican que **no se loguean cookies/tokens** al bloquear; rate-limit por
superficie (login DB-backed, contact, public-professionals, report-access-token); headers de seguridad
(`X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, HSTS en prod); `security:public-surface`
audita el bundle público y pasa; env validado por zod con fallo duro si falta `CORS_ORIGIN`/`DATABASE_URL` en prod;
`SUPABASE_SERVICE_ROLE_KEY` confinado a backend.

**Hallazgos.**
- **Sin RLS / aislamiento solo de aplicación (ENG-P1-001).** `CREATE POLICY`/`ENABLE ROW LEVEL SECURITY` = **0** en todo el repo; no hay carpeta `supabase/`. `server/db.ts` usa `postgres(ENV.databaseUrl)` (conexión directa privilegiada) que bypassa RLS. El scoping por `clinicId` es hoy consistente (`getClinicScopedReportById`, `getReportsByClinicId`, `searchReports`) y el helper inseguro `getReportById` sólo lo usan rutas `admin-*` (legítimo) — pero **no hay defensa en profundidad**.
- **Leak de detalle DB en 4xx (ENG-P2-001 · CWE-209).** `fastify-app.ts` mapea códigos pg `23505/23503/22P02/42703`→400 y devuelve `error`/`details = error.message` (mensaje crudo de Postgres con nombres de constraint/columna). 5xx sí está sanitizado.
- **CSP report-only (ENG-P2-008).** `next.config.ts` sólo emite `Content-Security-Policy-Report-Only`; no hay CSP enforcing.
- **Rate-limit in-memory no distribuido (ENG-P2-010).** `lib/rate-limit-store.ts` usa `new Map` (no sobrevive reinicio ni multi-instancia); login sí es DB-backed. Sin rate-limit global por defecto.
- **Threat model / least privilege:** dependen enteramente de la corrección de aplicación por la ausencia de RLS (ver §11).

### 6.4 Testing (Coverage, Unit, Integration, E2E, Regression, Mutation, Reliability, Contract, Smoke, Acceptance)

**Observaciones.** **406** archivos `*.test.ts` backend → **2896 tests, 0 fallos, 0 skipped** en ~11.6 s con el test runner
nativo de Node. Distribución por dominio (nombre de archivo): admin 71, report 50, particular/token 37, logistics 33,
auth 26, security 24, session 24, rate 14, csp 6, tenant/scope 9, cors 2. Incluye **tests de contrato de gobernanza**
(p.ej. "package.json pins the expected package manager", "Backend CI uses the pinned pnpm and Node toolchain"). 47 specs E2E
Playwright por capas (smoke, admin-mobile, visual-contract, public-clinic).

**Hallazgos.**
- **Cobertura no medida (ENG-P1-002).** Sin c8/nyc/istanbul; `pnpm test` no produce métrica. % real desconocido (no se inventa).
- **Frontend sin unit (ENG-P1-003).** No hay vitest/jest/testing-library; sólo E2E. `api.ts` (2371 LOC) y cards de 1000–1900 LOC sin test unitario.
- **E2E Chromium-only contra dev (ENG-P1-004).** `playwright.config.ts` define un solo project `chromium`; `webServer` levanta `next dev` (no `next build`/`start`); CI instala sólo `chromium`. Sin cross-browser ni regresión visual (ver `total-visual-engineering-audit.md`).
- **Mutation testing ausente (ENG-P2-007).** Sin Stryker → fuerza de aserciones no medida (riesgo de tests "verdes huecos").
- **RLS tests = 0** (coherente con ausencia de RLS).

### 6.5 Performance (Frontend, Backend, DB, Latency, Caching, N+1, Load/Stress, Resources, Availability)

**Observaciones.** Paginación obligatoria en listados (`limit`/`offset`, `countReportsByClinicId`); 89 índices en `schema.ts`;
caches de dominio (`public-pricing-cache.ts`, `logistics-route-plans-cache.ts`, `sensitive-response-cache.ts`); `compress:true`,
imágenes `avif/webp` con TTL, headers `immutable` para assets; build backend 836.8kb (esbuild, externals).

**Hallazgos.**
- **Sin load/stress ni budgets (ENG-P2 perf, ver matriz §16).** No hay k6/artillery ni presupuesto de bundle/CWV medido.
- **Rate-limit/caches in-memory (ENG-P2-010).** Asunción implícita de instancia única; no distribuido.
- **`databaseMaxConnections` default 3 (cap 10).** Razonable con pooler Supabase; documentar para escalado horizontal.
- **Sin profiling backend** (latencias p95/p99 no observables por la ausencia de métricas — ver ENG-P1-006).

### 6.6 Base de datos (Schema, Integridad, Migraciones, Indexing, Query, Backup/Restore, Tenant Isolation, RLS, Audit Trail, Lifecycle)

**Observaciones.** `schema.ts` (1196 LOC) con 51 `references()` (FK) y 89 índices; transacciones en escrituras críticas
(`upsertReport`, `updateReportStatus`) con manejo defensivo de `42703` (columna inexistente → fallback a columnas legacy);
historial de estado de informes (`report_status_history`) = audit trail de dominio; `audit_log` (migración 0016) +
`lib/audit*`. 31 migraciones versionadas con `_journal.json`; `schema:verify` disponible.

**Hallazgos.**
- **Sin RLS / tenant isolation solo de aplicación (ENG-P1-001)** — ver §6.3/§11/§15.
- **Migraciones forward-only (ENG-P2-011).** Sin scripts down/rollback; el rollback de esquema depende de ops manual/backup (`docs/ops/BACKUP_RESTORE_ROLLBACK.md`).
- **Lifecycle/retención:** la limpieza de sesiones (`deleteExpiredSessions`, `deleteExpiredAdminSessions`) y rate-limits existe, pero la retención/borrado de datos clínicos y de `audit_log`/`login_failed_attempts` no está codificada como política (verificación productiva pendiente).

### 6.7 DevOps / CI/CD (Build, Reproducibility, Deploy, Rollback, Env, Infra, Observability, Incident, Release)

**Observaciones.** `backend-ci.yml`: Postgres 16 service, pnpm `10.8.1`, Node `24`, **`pnpm audit --prod` + `pnpm audit`**,
migrate→typecheck→typecheck:test→test→build, `concurrency` con cancel, `permissions: contents:read`.
`frontend-ci.yml`: lint→typecheck→build→`security:public-surface`→E2E por capas (con agregación de status) + upload report on
failure. `app-version-force-update.yml`: workflow manual endurecido (inputs vía env para evitar inyección, validación de
token, nunca imprime secretos, orden frontend→backend, smoke del gate 426/401). Dependabot (npm raíz+frontend+actions, weekly).
Node/pnpm locales = CI.

**Hallazgos.**
- **Sin IaC (ENG-P2-009).** No hay `render.yaml`/blueprint ni Dockerfile; build/start/env/health/deploy-hooks viven sólo en el dashboard Render → reproducibilidad y DR dependen de estado fuera del repo.
- **Sin lint backend en CI (ENG-P1-005)** y **sin gate de cobertura (ENG-P1-002).**
- **E2E no ejerce el artefacto de producción (ENG-P1-004).**
- **Observabilidad básica (ENG-P1-006)** — ver §6.8.
- **Branch protection/required checks:** no verificable desde el repo (config de GitHub); CODEOWNERS de un solo dueño limita el review independiente (ENG-P3-004).

### 6.8 Frontend (Arquitectura, Componentes, Estado, Forms, Data, Responsive, A11y, Bundle, Design System, PWA)

**Observaciones.** App Router con páginas públicas SEO **prerenderizadas estáticas** (`○`) y dashboards **dinámicos** (`ƒ`);
proxy de API vía `rewrites` (`/api/:path*`→`NEXT_PUBLIC_API_URL`); headers `no-store` para `/dashboard/*`; PWA completa
(sw.js, `/offline`, manifest, iconos 192/512/maskable/apple) alineada a la política "no cachear privados". Cliente API
centralizado en `api.ts` (positivo en centralización, negativo en tamaño). Design system con Radix + CVA + tailwind-merge.

**Hallazgos.**
- **Sin unit/component tests (ENG-P1-003)** y **`globals.css` 3262 LOC / cards 1.9k LOC (ENG-P1-007)** — el detalle visual/CSS está cubierto por `total-visual-engineering-audit.md` (no se re-deriva).
- **Proxy presence-only (ENG-P3-005).** `src/proxy.ts` redirige por presencia de cookie; el path admin redirige a `/login` (revela existencia de ruta) en vez de 404 — el invariante "admin sin cookie → 404" se cumple en API, no en la página.
- **A11y/responsive:** `AGENTS.md` fija invariantes (foco, aria, sin overflow horizontal) y hay specs de teclado/mobile; auditoría a11y profunda fuera de scope (parcial en visual audit).

### 6.9 Backend (Arquitectura, Rutas, Services, Validación, Reliability, Business Logic, Errores, Logging, Idempotencia, Concurrencia, Transaccionalidad, Jobs)

**Observaciones.** Validación de input con zod en rutas; respuestas uniformes `{success, error, ...}`; `requestId` por request
(`genReqId`) e inyectado en payloads de error (`addApiErrorRequestIdToJsonPayload`); `no-store` para respuestas sensibles
(`applySensitiveApiNoStoreHeaders`); transaccionalidad en escrituras de informes; idempotencia por `onConflictDoUpdate`
(upserts de usuarios/rate-limits) y por `storagePath` en `upsertReport`.

**Hallazgos.**
- **Logging/observabilidad (ENG-P1-006).** `Fastify({ logger:false })`; `logger.ts` = wrapper de `console` con `any[]`; `console.*` en 29 archivos `server/`. Sin logs estructurados JSON, sin niveles efectivos, sin correlación por `requestId` en el log, sin sink/aggregation, sin métricas ni tracing ni error-tracking (Sentry/OTel).
- **Error handling 4xx (ENG-P2-001).** Leak de mensaje pg crudo (CWE-209).
- **Jobs en background:** limpieza de sesiones/rate-limits expirados existe como funciones DB pero **no hay scheduler** visible (cron/worker); su disparo (lazy en request vs job) debe documentarse (verificación pendiente).
- **Handler legacy (ENG-P3-007)** y **helper inseguro `getReportById` (ENG-P3-006)** como footgun latente.

### 6.10 Documentación / Gobernanza (README, Onboarding, Architecture, ADR, Specs, PR Process, Ownership, DoD, Traceability)

**Observaciones.** Gobernanza notable: `SOURCES_OF_TRUTH.md` (mapa de fuentes vigentes), `audit/README.md` (índice Wave 0),
`docs/governance/*` (ADR/RFC/ownership/PR-readiness), `docs/qa/*` (flaky/regression), `docs/release/*` (go/no-go),
`docs/ops/*` (CI runbook, backup/restore/rollback), `AGENTS.md` (protocolo operativo), PR template. Trazabilidad PR→docs por
convención (`docs/implementation/*`).

**Hallazgos.**
- **Fragmentación documental (ENG-P2-012).** ~300 docs, docenas de auditorías solapadas en `docs/audit`; alto costo cognitivo y riesgo de guía obsoleta. Ya parcialmente tratado por `documentation-taxonomy-fragmentation-audit.md` y la consolidación PR-CLEAN2.
- **Ownership de un solo dueño (ENG-P3-004).** `CODEOWNERS: * @LABVETNEB` → sin review independiente posible; DoD sin segundo revisor.
- **ADR faltante** para la decisión "aislamiento por aplicación en vez de RLS" (parte de ENG-P1-001).

---

## 7. P0 Findings

**No se identificaron hallazgos P0.** El baseline está verde (las 7 validaciones obligatorias pasan; `pnpm test` = 2896/0),
no hay bypass de auth detectado, no hay secretos versionados (`security:public-surface` pasa; `.env` no está en el árbol), y
build/test/CI no están rotos. El riesgo más severo (aislamiento de datos sin RLS) está clasificado **P1** porque el
aislamiento de aplicación *funciona y está testeado* — es una ausencia de defensa en profundidad, no una frontera rota.

| ID | Severidad | Área | Ubicación | Evidencia | Impacto | Recomendación | Esfuerzo | Riesgo | Validación |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| — | — | — | — | Baseline verde; auth sólida; sin secretos | — | Mantener invariantes; priorizar set P1 | — | — | Validaciones §ejecución |

---

## 8. P1 Findings

| ID | Sev | Área | Ubicación | Evidencia | Impacto | Recomendación | Esfuerzo | Riesgo cambio | Validación |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **ENG-P1-001** | P1 | Seguridad/DB/Arq | `server/db.ts:23`, `drizzle/migrations/*`, (sin) `supabase/` | `CREATE POLICY`=0; conexión `postgres(ENV.databaseUrl)` privilegiada (bypassa RLS); isolation solo por `clinicId` en app | Sin red de seguridad multi-tenant: un endpoint sin filtro = fuga de datos clínicos cruzados | (1) Registrar ADR de la decisión; (2) test/lint guard que prohíba queries clínicas sin `clinicId`; (3) plan RLS defensa-en-profundidad con rol DB no-privilegiado (autorización DB requerida) | Alto (fases) | Alto (DB) | Tests de tenant-scope ampliados; revisión manual de cada `db-*.ts` |
| **ENG-P1-002** | P1 | Testing | `package.json:21` (`test`) | `node --test` sin c8/nyc; sin métrica de cobertura | No se sabe qué % del código está cubierto pese a 2896 tests | Añadir `c8` (dev-dep, requiere autorización) y reporte de cobertura no-bloqueante primero | Medio | Bajo | `pnpm test` con cobertura; baseline % |
| **ENG-P1-003** | P1 | Testing/Frontend | `frontend/package.json` (sólo `e2e`) | Sin vitest/jest/testing-library; `api.ts` 2371 LOC sin unit | Lógica de cliente/UI sin red de regresión a nivel unidad | Introducir vitest + testing-library (dev-deps, autorización); empezar por `lib/api.ts` y hooks | Medio-Alto | Bajo | `pnpm --dir frontend test` (nuevo) |
| **ENG-P1-004** | P1 | Testing/CI | `frontend/playwright.config.ts:32-37`, `frontend-ci.yml:68` | 1 project `chromium`; `webServer: pnpm dev`; CI instala sólo chromium | E2E no cubre Firefox/WebKit ni el build de producción; sin regresión visual | Añadir project(s) cross-browser y un E2E contra `next build && next start`; gating visual (ver visual audit) | Medio | Medio (CI) | E2E multi-browser verde; smoke contra build |
| **ENG-P1-005** | P1 | Code Quality/CI | raíz (sin eslint backend) | No hay ESLint/Biome para `server/`/`scripts/`/`drizzle/` | ~33k LOC backend sin análisis estático; estilos/bugs no detectados | Añadir ESLint flat o Biome backend (dev-dep, autorización); paso `lint:backend` en CI | Medio | Bajo | `pnpm lint` (nuevo) en CI |
| **ENG-P1-006** | P1 | Observabilidad | `fastify-app.ts:348` (`logger:false`), `server/lib/logger.ts`, `console.*`×29 archivos | Logging = `console`; sin estructura/niveles/sink/métricas/tracing | Incidentes difíciles de diagnosticar; sin p95/p99, sin alertas, sin error-tracking | Logger estructurado (pino) con `requestId`, niveles por env; baseline de observabilidad (ver `docs/audit/backend-observability-logger-console-audit.md`, PR-OBS1) | Medio | Medio | Smoke de logs; healthcheck |
| **ENG-P1-007** | P1 | Arq/Complejidad/Mantenibilidad | `routes/logistics-route-plans.fastify.ts` (2241), `routes/auth.fastify.ts` (1514), `lib/api.ts` (2371), `dashboard/admin/AdminParticularTokensCard.tsx` (1894) | LOC medidos; HTTP+validación+negocio colocados | Alto costo de cambio, riesgo de regresión, revisión difícil | Extraer service layer backend y módulos `api/*.ts` por dominio; dividir cards (PRs chicos, sin cambio de comportamiento) | Alto (incremental) | Medio | typecheck+test+lint por PR |

---

## 9. P2 Findings

| ID | Sev | Área | Ubicación | Evidencia | Impacto | Recomendación | Esfuerzo | Riesgo | Validación |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **ENG-P2-001** | P2 | Error handling/Data exposure | `server/fastify-app.ts:198-211,390-395` | pg `23505/23503/22P02/42703`→400 con `error/details = error.message` crudo | Leak de nombres de constraint/columna (CWE-209) | Mapear 400 de pg-code a mensaje genérico sanitizado; mantener `requestId` | Bajo | Bajo | Test de respuesta 400 sin texto pg |
| **ENG-P2-002** | P2 | Dependencias/Contratos | `package.json:36` (zod ^3), `frontend/package.json:36` (zod ^4) | Dos majors de zod en el workspace | Impide compartir schemas; divergencia de validación | Unificar a un major (autorización deps); o aislar schemas por capa | Medio | Medio | typecheck+test ambos lados |
| **ENG-P2-003** | P2 | Arq/Boundary/API | (sin) `shared/`, `frontend/src/types/index.ts` (571), `lib/api.ts` (2371), sin OpenAPI | Tipos duplicados; contrato a mano; OpenAPI=0 | Drift frontend↔backend silencioso | Paquete `shared/` de tipos/contratos o generación (OpenAPI/zod compartido) | Alto | Medio | typecheck cross-package |
| **ENG-P2-004** | P2 | Duplicación | `AdminParticularTokensCard.tsx` (1894) + `ClinicParticularTokensCard.tsx` (1604) | Dominio compartido duplicado | Doble mantenimiento, divergencia de UX | Extraer hook + UI compartida; especializar por rol | Medio | Medio | E2E tokens admin+clínica |
| **ENG-P2-005** | P2 | DevEx/CI parity | `package.json:24` (`validate:local`) | `validate:local` = typecheck+typecheck:test+test+build (sin lint ni security) | Gate local más débil que CI; backend nunca linteado | Incluir `security:public-surface` y (cuando exista) lint en `validate:local` | Bajo | Bajo | `pnpm validate:local` |
| **ENG-P2-006** | P2 | Observabilidad/Code quality | `console.*` en 29 `server/*` | Conteo git grep | Logging inconsistente; ruido | Migrar a logger único (depende de ENG-P1-006) | Bajo | Bajo | grep console = 0 en rutas |
| **ENG-P2-007** | P2 | Testing | (sin) Stryker | No hay mutation testing | Fuerza de aserciones no medida | Piloto Stryker en un módulo crítico (autorización dev-dep) | Medio | Bajo | Score de mutación baseline |
| **ENG-P2-008** | P2 | Seguridad | `frontend/next.config.ts:70-72` | Sólo `Content-Security-Policy-Report-Only` | CSP no aplica (sólo reporta) | Camino a CSP enforcing tras analizar reportes | Medio | Medio | E2E sin violaciones CSP |
| **ENG-P2-009** | P2 | DevOps/Infra | (sin) `render.yaml`/Dockerfile | No hay IaC en repo | Reproducibilidad/DR dependen del dashboard | Versionar blueprint Render (build/start/health/env names) | Medio | Bajo | Deploy reproducible documentado |
| **ENG-P2-010** | P2 | Scalability/Seguridad | `server/lib/rate-limit-store.ts:61` (`new Map`) | Store in-memory; sin rate-limit global | No multi-instancia/restart-safe; superficies sin límite | Backend DB/Redis para limiters no-login; o documentar instancia única | Medio | Medio | Test de límite tras "reinicio" |
| **ENG-P2-011** | P2 | DB/Rollback | `drizzle/migrations/*` (sin down) | Sólo migraciones forward | Rollback de esquema manual/backup | Documentar estrategia de rollback por migración; o down scripts (autorización DB) | Medio | Alto (DB) | Restore drill documentado |
| **ENG-P2-012** | P2 | Documentación | `docs/` (~300), `docs/audit/*` | Volumen/solapamiento | Costo cognitivo; guía obsoleta | Continuar consolidación (SOURCES_OF_TRUTH) y archivar históricos | Bajo | Bajo | Índice navegable |

---

## 10. P3 Findings

| ID | Sev | Área | Ubicación | Evidencia | Impacto | Recomendación | Esfuerzo | Riesgo | Validación |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **ENG-P3-001** | P3 | Code Quality | `frontend/eslint.config.mjs:26-31` | `react-hooks/immutability` y `set-state-in-effect` en `off` | Posibles anti-patrones de efecto/estado no detectados | Reactivar por archivo y corregir incrementalmente | Bajo | Bajo | lint sin disables globales |
| **ENG-P3-002** | P3 | Type Safety | `server/lib/logger.ts:1-11` (`any[]`) | 13 `any` en src | Erosión menor de tipos | Tipar args del logger | Bajo | Bajo | typecheck |
| **ENG-P3-003** | P3 | Dependencias | `package.json`, `frontend/package.json`, `eslint.config.mjs:13,21` | Next 16/React 19/ESLint 10/Tailwind 4/zod 4 con workarounds | Fragilidad de upgrade/supply-chain en majors bleeding-edge | Política de pinning + ventana de actualización (Dependabot ya activo) | Bajo | Bajo | CI verde post-bump |
| **ENG-P3-004** | P3 | Gobernanza | `.github/CODEOWNERS` | `* @LABVETNEB` (único dueño) | Sin review independiente | Documentar en DoD; segundo revisor si crece el equipo | Bajo | Bajo | — |
| **ENG-P3-005** | P3 | Frontend/Seguridad | `frontend/src/proxy.ts:21-43` | Redirect por presencia de cookie; admin→/login (no 404) | Info-disclosure menor (existe la ruta admin) | Mantener 404 admin en API; evaluar 404 de página admin sin cookie | Bajo | Bajo | E2E admin sin cookie |
| **ENG-P3-006** | P3 | Seguridad/Mantenibilidad | `server/db.ts:509` (`getReportById`) | Helper sin scope; callers sólo admin | Footgun latente sin red RLS | Renombrar/segregar (`getReportByIdUnscoped`) + guard de uso | Bajo | Bajo | test de uso |
| **ENG-P3-007** | P3 | Dead code/Duplicación | `server/middlewares/error-handler.ts` | Sólo importado por un test; app usa `setErrorHandler` | Lógica duplicada/muerta | Unificar en un handler compartido o eliminar el legacy | Bajo | Bajo | typecheck+test |

---

## 11. Security & Threat Model

**Activos críticos.** Informes clínicos (PDF en Storage privado + metadatos), datos de clínicas/usuarios, hashes de
credenciales (argon2), tokens de acceso particular/report-access, sesiones (admin/clínica/particular), `audit_log`,
`SUPABASE_SERVICE_ROLE_KEY`.

**Actores.** Público anónimo, particular (token), usuario de clínica (`clinic_staff`/roles), admin, atacante externo,
insider con acceso a una clínica.

**Superficies.**
- *Públicas:* `/`, landings SEO, `/login`, `/precios`, `/profesionales[/clinicId]`, y APIs `/api/public/*`, `/api/contact`, `/api/app-version`, `/api/report-access-tokens`, `/api/particular-tokens`.
- *Autenticadas clínica:* `/dashboard*`, `/api/auth/*`, `/api/reports*`, `/api/clinic/*`, `/api/logistics/*`, `/api/study-tracking`.
- *Particular:* `/api/particular/*`.
- *Admin:* `/dashboard/admin`, `/api/admin/*` (404 sin cookie en API).
- *Datos:* Storage privado + signed URLs; Postgres directo privilegiado.

**Amenazas → mitigación actual → gap.**

| Amenaza (OWASP) | Mitigación actual | Gap |
| --- | --- | --- |
| A01 Broken Access Control / IDOR cross-tenant | Scoping `clinicId` consistente + tests; admin 404 sin cookie | **Sin RLS** (ENG-P1-001): un olvido = fuga sin red DB |
| A01 CSRF (cookies SameSite=None) | `trusted-origin` (Origin/Referer) en métodos inseguros + tests | Sin token CSRF (defensa única por Origin) |
| A02 Cryptographic / secretos | argon2, env por zod, service-role sólo backend, `security:public-surface` | — (verificación de rotación productiva pendiente) |
| A03 Injection | Drizzle parametrizado, zod en input | `ilike('%'+query+'%')` concatenado (parametrizado por driver; revisar) |
| A04 Insecure Design | Separación de dominios, version gate | Aislamiento sin defensa en profundidad |
| A05 Misconfiguration | Headers de seguridad, HSTS prod, no-store privados | **CSP report-only** (ENG-P2-008); sin IaC (ENG-P2-009) |
| A07 AuthN Failures | Rate-limit login DB-backed, expiración/cleanup de sesión | Rate-limit no-login in-memory (ENG-P2-010) |
| A09 Logging/Monitoring Failures | `audit_log`, login_failed_attempts, requestId | **Observabilidad básica** (ENG-P1-006): sin alertas/sink |
| A10 SSRF | Sin fetch de URLs de usuario evidente | Verificación productiva |
| Info Exposure (CWE-209) | 5xx sanitizado | **4xx pg-code leak** (ENG-P2-001) |

**Conclusión threat model:** la postura de seguridad de **aplicación** es sólida y testeada; la **superficie de datos**
carece de defensa en profundidad. Prioridad: ENG-P1-001 → ENG-P2-001 → ENG-P2-008.

---

## 12. Architecture & Modularity Gap Analysis

- **Acoplamientos.** Frontend↔backend acoplados por contrato implícito (sin `shared/`, sin OpenAPI): `api.ts` (2371 LOC) y `types/index.ts` (571) se mantienen a mano contra 41 rutas → *drift* silencioso (ENG-P2-003).
- **Duplicación.** Par admin/clínica ParticularTokens (~3.5k LOC) (ENG-P2-004); doble error handler (ENG-P3-007).
- **Límites débiles.** Negocio dentro de transporte en rutas grandes (ENG-P1-007): no hay service layer entre `routes/*.fastify.ts` y `db-*.ts` en los archivos de mayor LOC.
- **Módulos candidatos a extracción.** `lib/api.ts` → `lib/api/{reports,admin,particular,logistics,...}.ts`; service layer backend `services/*`; `shared/` de contratos/tipos/zod.
- **shared vs backend vs frontend.** Hoy: 0 shared. Recomendado: paquete de contratos (tipos + validadores) consumible por ambos (requiere resolver zod v3/v4, ENG-P2-002).
- **Dominio.** Bien delimitado (reports, tokens, logistics, pricing, clinic-profile, audit); el modelo de estado de informe (`report_status_history` con columnas legacy + nuevas) arrastra compatibilidad dual → candidato a consolidación cuando se autorice DB.

---

## 13. Code Quality & Technical Debt Register

| Deuda | Archivo | Motivo | Impacto | Refactor | Riesgo | Orden |
| --- | --- | --- | --- | --- | --- | --- |
| God route | `routes/logistics-route-plans.fastify.ts` (2241) | HTTP+negocio colocados | Cambio costoso | Service layer | Medio | 3 |
| God route | `routes/auth.fastify.ts` (1514) | idem (auth crítico) | Alto | Extraer servicios auth | Medio | 3 |
| Cliente monolítico | `lib/api.ts` (2371) | Sin partición por dominio | Cambio costoso FE | Dividir `api/*` | Bajo | 2 |
| Card gigante | `AdminParticularTokensCard.tsx` (1894) | UI+estado+fetch | Regresión visual | Dividir + hook | Medio | 4 |
| Duplicación | `*ParticularTokensCard.tsx` (1894+1604) | Dominio repetido | Doble mantención | Hook/UI compartida | Medio | 4 |
| Sin lint backend | `server/**` | No hay ESLint/Biome | Bugs no detectados | Añadir linter | Bajo | 1 |
| Logging console | `server/**` (29) | Sin abstracción | Observabilidad pobre | Logger estructurado | Medio | 1 |
| Handler muerto | `middlewares/error-handler.ts` | Sólo en test | Confusión | Unificar/eliminar | Bajo | 2 |
| `any` logger | `lib/logger.ts` | `any[]` | Tipos débiles | Tipar | Bajo | 2 |
| zod split | `package.json`×2 | v3 vs v4 | Sin schemas compartidos | Unificar | Medio | 5 |
| CSS gigante | `app/globals.css` (3262) | Cubierto por visual audit | — | Ver visual audit | — | — |

---

## 14. Test Strategy Gap Analysis

**Bien cubierto.** Backend por dominio (2896 tests, 0 fallos): trusted-origin/CSRF, sesiones, auth admin/clínica/particular,
rate-limit, reports, tokens, logistics, contratos de CI/package.json/toolchain (tests de gobernanza), CSP policy. E2E por
capas (smoke, admin-mobile no-scroll, visual-contract, public-clinic).

**Falta.**
- **Cobertura no medida (ENG-P1-002):** sin c8 → % desconocido.
- **Frontend sin unit (ENG-P1-003):** `api.ts`, hooks, validación de forms.
- **Cross-browser/visual/prod-build (ENG-P1-004):** Chromium-only contra dev.
- **Mutation (ENG-P2-007):** ausente.
- **RLS/tenant a nivel DB:** 0 (no aplica sin RLS; sí hay tests de scope de aplicación).
- **Contract testing FE↔BE:** implícito (sin OpenAPI/pact).

**Frágiles/lentos.** Política de flaky documentada (`docs/qa/flaky-test-policy.md`); E2E con `trace: on-first-retry` y
`reuseExistingServer`. Riesgo conocido (memoria): `next-env.d.ts` regenerado por dev/e2e — **no ocurrió** en esta corrida
(build no modificó el archivo; árbol limpio).

---

## 15. Database & RLS Gap Analysis

| Aspecto | Estado | Gap |
| --- | --- | --- |
| Schema | `schema.ts` 1196 LOC, tipado | Compatibilidad dual `report_status_history` (legacy+nuevo) |
| Constraints/FK | 51 `references()` | — |
| Índices | 89 `index()` | Validar cobertura de queries `ilike`/orden por `createdAt` con datos reales |
| Migraciones | 31 versionadas + `_journal` | **Forward-only** (ENG-P2-011) |
| **RLS** | **0 policies; sin `supabase/`** | **Sin defensa en profundidad (ENG-P1-001)** |
| Tenant isolation | App-layer (`clinicId`) consistente + tests | Sin red DB |
| Conexión | `postgres` directa privilegiada (`db.ts:23`) | Bypassa RLS aun si existiera; sin rol no-privilegiado |
| Audit trail | `audit_log` + `report_status_history` | Retención/borrado no codificado como política |
| Backup/restore | Documentado (`docs/ops/BACKUP_RESTORE_ROLLBACK.md`) | Drills reales/RTO-RPO no verificables en repo |
| Lifecycle | Cleanup de sesiones/rate-limits | Sin scheduler visible; retención de datos clínicos pendiente |

---

## 16. Performance & Scalability Risk Matrix

| Capa | Estado | Riesgo | Acción |
| --- | --- | --- | --- |
| Frontend bundle | avif/webp, compress, assets immutable, code-split por ruta | Cards 1.9k LOC, GSAP | Budget de bundle + medir CWV reales |
| Next build | OK (estáticas SEO + dinámicas) | E2E no usa build | E2E contra `next start` (ENG-P1-004) |
| Backend | esbuild 836.8kb, externals | Sin profiling | Logger + métricas (ENG-P1-006) |
| DB | 89 índices, paginación, transacciones | `ilike` like-scan; conexiones=3 | Revisar índices con EXPLAIN real; documentar pooling |
| API | Respuestas uniformes, no-store sensibles | Sin rate-limit global | Limiter por defecto + distribuido (ENG-P2-010) |
| Uploads/downloads | multer + signed URLs (TTL env) | Tamaño 20MB; signed URL TTL | Validar límites/TTL en prod |
| Dashboard | App Shell single-viewport, paginación | Cards gigantes | Dividir (ENG-P1-007) |
| Public pages | Prerender estático | — | — |
| Cache | caches de dominio in-memory | No distribuido | Externalizar si escala horizontal |
| Availability | health DB+Storage, graceful shutdown | Sin métricas/alertas | Observabilidad (ENG-P1-006) |

**Ausentes:** load testing, stress testing, budgets medidos (todos P2/diferidos; requieren staging).

---

## 17. CI/CD & Operational Readiness Matrix

| Capacidad | Estado | Gap |
| --- | --- | --- |
| Build | backend esbuild + frontend next, ambos en CI | — |
| Tests | backend en CI (Postgres service) + E2E por capas | Sin lint backend; sin cobertura; E2E contra dev |
| Dependency audit | `pnpm audit --prod` + `pnpm audit` en CI; Dependabot | — |
| Deploy | Render (deploy hooks) | **Sin IaC** (ENG-P2-009) |
| Rollback | version gate (426) + docs backup/restore | Migraciones forward-only (ENG-P2-011) |
| Env/secrets | zod-validated; nunca impresos; force-update sin leaks | Verificación de rotación productiva |
| Observability | requestId, health | **Básica** (ENG-P1-006): sin logs/metrics/tracing/alertas |
| Alerts | login_failed_alerts (dominio) | Sin alerting de infra/errores |
| Incident response | `docs/ops/*`, runbooks | Sin SLOs/on-call formal |
| Release mgmt | go/no-go docs, PR template, concurrency | Required checks/branch protection no verificable en repo |

---

## 18. Documentation & DX Gap Analysis

- **Onboarding/README:** README backend claro (stack, scripts, endpoints, flujo). `SETUP.md` + `AGENTS.md` (protocolo). Frontend README presente.
- **Source of truth:** `SOURCES_OF_TRUTH.md` + `audit/README.md` (índice Wave 0) → buena gobernanza; freno: ~300 docs y solapamiento (ENG-P2-012).
- **ADRs:** template existe; falta ADR de "aislamiento por aplicación vs RLS" (ENG-P1-001) y de "logger:false / observabilidad".
- **Specs/traceability:** `docs/implementation/*` por PR; trazabilidad por convención (no herramienta).
- **PR process/DoD:** PR template + checklists de governance/QA/release; DoD sin segundo revisor (solo owner, ENG-P3-004).
- **DX:** `validate:local` útil pero incompleto (ENG-P2-005); scripts ricos (db/dev/ops/security/smoke).

---

## 19. Recommended PR Plan

PRs chicos, seguros, mergeables, un solo scope. **Esta auditoría no implementa ninguno.** Orden por riesgo/dependencia.
Los marcados ⚠ requieren **autorización explícita** (backend/DB/deps/CI) por el protocolo VETNEB / `AGENTS.md`.

| # | ID PR | Título | Aborda | Scope | Archivos esperados | Tests | Riesgo | Autorización |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | PR-SEC-1 | Sanitizar 4xx de pg-code (no leak DB) | ENG-P2-001 | backend | `server/fastify-app.ts` | test 400 sin texto pg | Bajo | ⚠ backend |
| 2 | PR-SEC-2 | Guard anti-IDOR: prohibir query clínica sin `clinicId` + ADR | ENG-P1-001 (fase 1) | test/docs | nuevo test, `docs/governance/adr-*` | test guard | Bajo | docs+test |
| 3 | PR-DX-1 | `validate:local` incluye `security:public-surface` | ENG-P2-005 | scripts(package) | `package.json` (scripts) | — | Bajo | ⚠ package script |
| 4 | PR-CLEAN-1 | Eliminar/unificar `error-handler.ts` legacy | ENG-P3-007 | backend | `server/middlewares/error-handler.ts`, su test | typecheck+test | Bajo | ⚠ backend |
| 5 | PR-TYPE-1 | Tipar `logger.ts` (quitar `any[]`) | ENG-P3-002 | backend | `server/lib/logger.ts` | typecheck | Bajo | ⚠ backend |
| 6 | PR-OBS-1 | Logger estructurado (pino) + requestId, niveles por env | ENG-P1-006, ENG-P2-006 | backend | `fastify-app.ts`, `lib/logger.ts`, rutas | smoke logs | Medio | ⚠ backend (¿dep pino?) |
| 7 | PR-LINT-1 | ESLint/Biome backend + paso CI | ENG-P1-005 | CI/deps | `eslint.config` backend, `backend-ci.yml` | `pnpm lint` | Bajo | ⚠ deps+CI |
| 8 | PR-COV-1 | Cobertura con c8 (no bloqueante) | ENG-P1-002 | deps/CI | `package.json`, CI | reporte cov | Bajo | ⚠ deps+CI |
| 9 | PR-FE-TEST-1 | vitest + testing-library; primer suite `lib/api.ts` | ENG-P1-003 | frontend/deps | config + `*.test.ts` | unit FE | Bajo | ⚠ deps |
| 10 | PR-E2E-1 | E2E cross-browser + contra `next start` | ENG-P1-004 | CI/test | `playwright.config.ts`, `frontend-ci.yml` | E2E multi-browser | Medio | ⚠ CI |
| 11 | PR-API-1 | Partir `lib/api.ts` en `api/*` por dominio (sin cambio de comportamiento) | ENG-P1-007, ENG-P2-003 (fase 1) | frontend | `lib/api/*` | typecheck+E2E | Bajo | frontend |
| 12 | PR-BE-SVC-1 | Service layer en 1 ruta grande (piloto, p.ej. auth) | ENG-P1-007 | backend | `services/*`, ruta | test ruta | Medio | ⚠ backend |
| 13 | PR-INFRA-1 | `render.yaml` blueprint (build/start/health/env names) | ENG-P2-009 | infra/docs | `render.yaml`, docs | — | Bajo | ⚠ infra |
| 14 | PR-CSP-1 | Plan/medición → CSP enforcing | ENG-P2-008 | frontend | `next.config.ts`, csp-policy | E2E sin violaciones | Medio | frontend |
| 15 | PR-RLS-1 | Diseño RLS defensa-en-profundidad (rol no-privilegiado) | ENG-P1-001 (fase 2) | DB/docs | migración RLS, `db.ts` | tests RLS | Alto | ⚠⚠ DB |

**No proponer:** mega-PR, reescritura total, nuevas dependencias sin autorización, mezclar docs+código+CI+DB en un PR.

### 19.1 PR Execution Matrix (scope · autorización · tests · acceptance · rollback)

| PR | Hallazgos | Scope | Autorización | Tests obligatorios | Acceptance Criteria | Rollback |
| --- | --- | --- | --- | --- | --- | --- |
| PR-SEC-2 | ENG-P1-001 (f1), ENG-P3-006 | docs+test | docs+test | test-guard `clinicId` | El test falla si una query clínica omite `clinicId`; ADR mergeado; **0 cambios de runtime** | Borrar test + ADR (docs/test-only) |
| PR-SEC-1 | ENG-P2-001 | backend | ⚠ backend | test 400 pg-code | Un 400 derivado de pg-code **no** contiene texto de constraint/columna; conserva `requestId` | Revertir el mapeo en `fastify-app.ts` (1 función) |
| PR-OBS-1 | ENG-P1-006, ENG-P2-006 | backend | ⚠ backend (¿dep `pino`?) | smoke de logs | Logs JSON con `level`+`requestId`; sin secretos/cookies; healthcheck intacto | Flag/revert a `console` (módulo aislado `logger.ts`) |
| PR-LINT-1 | ENG-P1-005 | CI+deps | ⚠ deps+CI | `pnpm lint` backend | Lint backend verde **sin `--fix` masivo**; paso CI agregado; 0 cambios funcionales | Quitar paso CI + config eslint |
| PR-COV-1 | ENG-P1-002 | deps+CI | ⚠ deps+CI | `pnpm test` con c8 | Reporte de cobertura generado, **no bloqueante** (sin umbral); baseline % publicado | Quitar wrapper c8 |
| PR-DX-1 | ENG-P2-005 | package script | ⚠ package script | `pnpm validate:local` | `validate:local` ejecuta `security:public-surface`; falla si rompe la superficie pública | Revertir el script |
| PR-CLEAN-1 | ENG-P3-007 | backend | ⚠ backend | typecheck+test | App sin `error-handler.ts` muerto (o unificado); cobertura del test reasignada | Restaurar archivo |
| PR-TYPE-1 | ENG-P3-002 | backend | ⚠ backend | typecheck | `logger.ts` sin `any`; typecheck verde | Revertir tipos |
| PR-FE-TEST-1 | ENG-P1-003 | frontend+deps | ⚠ deps | `pnpm --dir frontend test` | ≥1 suite unit de `lib/api.ts` verde; runner integrado | Quitar config + tests |
| PR-E2E-1 | ENG-P1-004 | CI+test | ⚠ CI | E2E multi-browser + smoke prod | E2E verde en ≥2 browsers y smoke contra `next build && next start` | Revertir `playwright.config.ts`/CI |
| PR-API-1 | ENG-P1-007, ENG-P2-003 (f1) | frontend | frontend | typecheck+E2E | `api.ts` dividido en `api/*` por dominio con re-exports; **sin cambio de comportamiento** | Revert mecánico (split puro) |
| PR-BE-SVC-1 | ENG-P1-007 | backend | ⚠ backend | tests de ruta | 1 ruta piloto delega en service; **contrato HTTP idéntico** | Revert de la ruta |
| PR-INFRA-1 | ENG-P2-009 | infra+docs | ⚠ infra | — (lint YAML) | `render.yaml` válido (build/start/health/env names) **sin secretos** | Borrar archivo |
| PR-CSP-1 | ENG-P2-008 | frontend | frontend | E2E sin violaciones | Tras revisar reportes, CSP **enforcing** sin violaciones en E2E | Volver a `report-only` (1 línea) |
| PR-RLS-1 | ENG-P1-001 (f2), ENG-P2-011 | DB+docs | ⚠⚠ DB | tests tenant a nivel DB | RLS en entorno **no-prod** con rol no-privilegiado; tests de aislamiento DB; plan de rollback explícito | Migración `down`/disable RLS + revert de rol de conexión |

### 19.2 Dependencias y secuenciación entre PRs

- **Lote 0 (docs/test-only y cambios mínimos, sin deps/CI/DB) — hacer primero, en este orden:** PR-SEC-2 → PR-SEC-1 → PR-DX-1 → PR-CLEAN-1 → PR-TYPE-1.
- **Lote 1 (fundaciones de calidad/operación, requieren deps/CI):** PR-OBS-1 → PR-LINT-1 → PR-COV-1 → PR-FE-TEST-1 → PR-E2E-1. *Regla anti-deriva:* **un tooling por PR** (no activar coverage+lint+e2e+mutation juntos).
- **Lote 2 (estructura, bajo riesgo):** PR-API-1 (facilita PR-FE-TEST-1; idealmente antes o en paralelo) → PR-BE-SVC-1 (piloto) → PR-INFRA-1.
- **Lote 3 (alto impacto, autorización fuerte):** PR-CSP-1 (depende de reportes CSP previos) → **PR-RLS-1** (depende de PR-SEC-2 ya mergeado + observabilidad PR-OBS-1 + cobertura PR-COV-1 como red antes de un cambio DB grande).
- **Precedencias duras:** PR-SEC-2 **antes** de PR-RLS-1 (fase 1 → fase 2); PR-OBS-1 **antes** de PR-RLS-1 (no tocar DB a ciegas); PR-LINT-1 **antes** de PR-API-1/PR-BE-SVC-1 (evita ruido en refactors).

### 19.3 First 5 PR — Implementation Briefs

Briefs ejecutables estilo ticket senior, en el orden recomendado (lote 0 primero por menor riesgo). **Listos para copiar como
prompt futuro.** Todos respetan el protocolo VETNEB (cambio mínimo, sin tocar fuera de scope, Git manual lo hace Nico).

#### Brief 1 — PR-SEC-2 · ADR de aislamiento + guard anti-IDOR `clinicId` *(docs+test)*
- **Contexto.** El aislamiento multi-tenant es 100% de aplicación (sin RLS, conexión DB privilegiada). Hoy es correcto pero sin red de seguridad ni decisión registrada.
- **Problema.** ENG-P1-001 / ENG-P3-006: un endpoint que olvide `clinicId` filtra datos clínicos cruzados; la decisión "app-layer en vez de RLS" no está documentada como ADR.
- **Objetivo.** (1) Registrar ADR de la decisión y su trade-off; (2) agregar un test-guard que verifique que las lecturas clínicas pasan por funciones scoped (`getClinicScopedReportById`, `getReportsByClinicId`, etc.) y que el helper sin scope (`getReportById`) sólo se use en rutas `admin-*`.
- **Archivos probables.** `docs/governance/adr-XXXX-tenant-isolation.md` (nuevo doc de gobernanza), `test/tenant-isolation-guard.test.ts` (nuevo test).
- **Cambios permitidos.** Documentación + test nuevo.
- **Cambios prohibidos.** Tocar `server/db.ts`, rutas, migraciones, deps, CI. **0 cambios de runtime.**
- **Tests esperados.** El nuevo test falla si una ruta clínica importa/usa `getReportById` sin scope.
- **Riesgos.** Bajo (docs/test-only). Posible falso positivo del guard → afinar la lista de callers permitidos.
- **Criterio de Done.** ADR mergeado; test verde; `pnpm test` sigue en 0 fallos; sin cambios fuera de `docs/` y `test/`.
- **Comando de validación.** `pnpm test` · `git diff --name-only` (solo docs+test).
- **Nota para Codex/Claude.** No modificar producción. Sólo agregar doc ADR + test de regresión estructural. Mantener el estilo de los tests de contrato existentes (p.ej. los que verifican `package.json`/CI).

#### Brief 2 — PR-SEC-1 · Sanitizar 4xx derivados de pg-code *(backend, ⚠)*
- **Contexto.** El error handler Fastify mapea códigos pg (`23505/23503/22P02/42703`) a 400 y devuelve `error.message` crudo.
- **Problema.** ENG-P2-001 (CWE-209): se filtran nombres de constraint/columna al cliente en 400.
- **Objetivo.** Devolver un mensaje genérico sanitizado para los 400 derivados de pg-code, conservando `requestId`; mantener 5xx ya sanitizado y los 4xx de aplicación (con `.status` propio) intactos.
- **Archivos probables.** `server/fastify-app.ts` (`getFastifyErrorStatus`/`setErrorHandler`).
- **Cambios permitidos.** Sólo la lógica de construcción del body de error.
- **Cambios prohibidos.** Cambiar status codes existentes, tocar rutas, validación zod, deps.
- **Tests esperados.** Test que provoca un error pg-code y verifica que `error`/`details` no contienen el texto pg; que sí incluye `requestId`.
- **Riesgos.** Bajo; riesgo de ocultar mensajes útiles de validación de aplicación → distinguir error de aplicación (con `.status`) de pg-error.
- **Criterio de Done.** Test nuevo verde; `pnpm test` + `pnpm build` verdes.
- **Comando de validación.** `pnpm test` · `pnpm build`.
- **Nota para Codex/Claude.** No alterar el contrato `{success,error,...}`. Cambio mínimo y aislado en un solo archivo.

#### Brief 3 — PR-OBS-1 · Logging estructurado gradual *(backend, ⚠)*
- **Contexto.** `Fastify({ logger:false })` y `logger.ts` es un wrapper de `console`; `console.*` en 29 archivos.
- **Problema.** ENG-P1-006 / ENG-P2-006: sin logs estructurados, niveles ni correlación → diagnóstico de incidentes pobre.
- **Objetivo.** Introducir un logger estructurado (p.ej. `pino`) detrás de la misma interfaz `logInfo/logWarn/logError`, con `level` por env y `requestId` en cada línea; migración **gradual** (empezar por el error handler y rutas críticas).
- **Archivos probables.** `server/lib/logger.ts`, `server/fastify-app.ts` (error handler), opcional `server/middlewares/request-logger.ts`.
- **Cambios permitidos.** Implementación del logger + cableado mínimo; **sin** reescribir las 29 ocurrencias en este PR.
- **Cambios prohibidos.** Refactor de negocio, tocar rutas no relacionadas, imprimir secretos/cookies.
- **Tests esperados.** Smoke: el logger no emite secretos; el error handler loguea `requestId`.
- **Riesgos.** Medio (nueva dep si se usa `pino` → requiere autorización); regresión de formato de logs.
- **Criterio de Done.** Logs JSON con nivel + `requestId`; `pnpm test`/`build` verdes; healthcheck intacto.
- **Comando de validación.** `pnpm test` · `pnpm build`.
- **Nota para Codex/Claude.** Mantener la API pública del logger para no tocar callers. Confirmar autorización de dependencia antes de agregar `pino`.

#### Brief 4 — PR-LINT-1 · Lint backend sin formateo masivo *(CI+deps, ⚠)*
- **Contexto.** El backend (~33k LOC) no tiene linter; sólo el frontend.
- **Problema.** ENG-P1-005: bugs/estilo no detectados estáticamente en `server/`, `scripts/`, `drizzle/`.
- **Objetivo.** Añadir ESLint (flat) o Biome backend con un ruleset conservador y un script `lint:backend` + paso CI, **sin** aplicar reformateo masivo.
- **Archivos probables.** `eslint.config.*` (backend) o `biome.json`, `package.json` (script), `.github/workflows/backend-ci.yml`.
- **Cambios permitidos.** Config de lint + script + paso CI + fixes mínimos puntuales que el lint exija.
- **Cambios prohibidos.** Reformateo global, cambios de lógica, mezclar con otros PRs.
- **Tests esperados.** `pnpm lint` (backend) verde en CI.
- **Riesgos.** Bajo; si el ruleset es agresivo puede generar mucho ruido → empezar mínimo.
- **Criterio de Done.** Lint verde sin `--fix` masivo; CI pasa; 0 cambios funcionales.
- **Comando de validación.** `pnpm lint` (nuevo) · `pnpm typecheck` · `pnpm test`.
- **Nota para Codex/Claude.** Ruleset mínimo (errores reales, no estilo) en la primera iteración. Requiere autorización de deps+CI.

#### Brief 5 — PR-COV-1 · Medición de cobertura sin umbral inicial *(deps+CI, ⚠)*
- **Contexto.** 2896 tests backend pasan, pero la cobertura no se mide.
- **Problema.** ENG-P1-002: no se conoce el % real cubierto.
- **Objetivo.** Instrumentar cobertura con `c8` sobre `pnpm test`, generar reporte **no bloqueante** (sin umbral) y publicar el baseline para fijar metas en PRs futuros.
- **Archivos probables.** `package.json` (script `test:coverage`), `.github/workflows/backend-ci.yml` (paso no bloqueante + artifact).
- **Cambios permitidos.** Dep dev `c8` + scripts + paso CI no bloqueante.
- **Cambios prohibidos.** Imponer umbral que rompa CI en este PR; tocar tests; cambiar el runner.
- **Tests esperados.** El reporte se genera; `pnpm test` sigue verde.
- **Riesgos.** Bajo; `c8` debe ser compatible con el runner nativo `node --test` y `--experimental-strip-types`.
- **Criterio de Done.** Reporte de cobertura disponible; baseline % documentado; sin gate bloqueante.
- **Comando de validación.** `pnpm test` · `pnpm test:coverage` (nuevo).
- **Nota para Codex/Claude.** No fijar umbral todavía. Sólo medir y publicar. Requiere autorización de deps+CI.

---

## 20. Definition of Done for Engineering Excellence

- **Código:** `strict` sin nuevos `any`/`ts-ignore`; **backend linteado**; sin god-files nuevos; sin dead code.
- **Arquitectura:** transporte/negocio/datos separados en módulos tocados; contrato FE↔BE versionado o tipado compartido.
- **Seguridad:** invariantes de sesión/cookies intactos; 4xx/5xx sanitizados; CSP con plan a enforcing; sin secretos; `security:public-surface` verde.
- **Testing:** cobertura **medida** con baseline; unit FE para lógica nueva; E2E cross-browser + contra build; tests de regresión por bug.
- **DB:** cambios con migración versionada; tenant-scope con test; estrategia de rollback declarada; RLS como meta de defensa en profundidad.
- **CI/CD:** lint+typecheck+test+build+audit verdes; (cuando exista) gate de cobertura; IaC versionada.
- **Observabilidad:** logs estructurados con `requestId`; healthcheck; métricas/alertas mínimas definidas.
- **Documentación:** entrega en `docs/implementation`; ADR para decisiones duraderas; `SOURCES_OF_TRUTH` actualizado.
- **Production readiness:** rollback probado; version gate; health DB+Storage; env validado.

---

## 21. Final Recommendation

**Qué hacer primero (orden estricto):**
1. **PR-SEC-2 + PR-SEC-1** (ENG-P1-001 fase 1 + ENG-P2-001): guard anti-IDOR + ADR del modelo de aislamiento, y sanitización de 4xx. Bajo riesgo, máximo valor de seguridad inmediato.
2. **PR-OBS-1** (ENG-P1-006): sin observabilidad no se puede operar "extremo" ni diagnosticar incidentes.
3. **PR-LINT-1 + PR-COV-1** (ENG-P1-005, ENG-P1-002): cerrar el blind-spot de calidad backend y empezar a medir cobertura.
4. **PR-FE-TEST-1 + PR-E2E-1** (ENG-P1-003, ENG-P1-004): red de regresión frontend y E2E representativo.
5. **PR-RLS-1** (ENG-P1-001 fase 2): defensa en profundidad de datos — el cambio de mayor impacto estructural, por fases y con autorización DB.

**Qué NO hacer:** no reescribir; no mega-PR; no agregar dependencias ni tocar DB/CI/deps sin autorización; no "ablandar" el
hallazgo RLS asumiendo que el scoping de aplicación es suficiente (lo es operativamente hoy, **no** como defensa en
profundidad).

**Riesgo de no hacerlo:** un único endpoint sin filtro de tenant = fuga de datos clínicos cruzados sin red DB (ENG-P1-001);
incidentes ciegos por falta de observabilidad (ENG-P1-006); regresiones frontend invisibles (ENG-P1-003/004); calidad
backend sin medición (ENG-P1-002/005).

**Ruta hacia excelencia técnica total:** consolidar el set P1 (seguridad de datos + observabilidad + medición de testing) →
luego P2 (contratos compartidos, CSP enforcing, IaC, rate-limit distribuido) → mantener la disciplina ya existente
(strict TS, 2896 tests verdes, `pnpm audit`, version gate, gobernanza documental). El repositorio ya opera a nivel **Senior**;
estos PRs lo llevan a "ingeniería extrema / multinacional".

**PR inicial recomendado:** **PR-SEC-2** (docs+test, sin tocar productivo): ADR del modelo de aislamiento + test-guard que
prohíbe queries clínicas sin `clinicId`. Es el de menor riesgo y mayor retorno, y prepara el terreno para PR-RLS-1.

### 21.1 Veredicto ejecutable directo

- **Primer PR (hoy, docs/test-only, sin autorización extra):** **PR-SEC-2** — ADR de aislamiento + guard anti-IDOR `clinicId`.
- **Segundo PR (cambio mínimo backend, ⚠ backend):** **PR-SEC-1** — sanitizar 4xx de pg-code (CWE-209).
- **Tercer PR (fundación operativa, ⚠ backend):** **PR-OBS-1** — logging estructurado gradual.
- **Antes de tocar RLS (PR-RLS-1) deben estar cerrados:** Gate 1 (baseline verde, ✔), PR-SEC-2 (ADR+guard), PR-OBS-1
  (observabilidad para no operar a ciegas) y PR-COV-1 (cobertura como red); además, RLS sólo en **entorno no-prod** con **rol
  DB no-privilegiado** y **plan de migración/rollback** explícito. RLS sin esto = riesgo de caída productiva.
- **Requiere autorización explícita (no avanzar sin ella):** deps (`pino`, `c8`, `vitest`, eslint backend), CI (gates/cross-browser),
  DB (RLS, down migrations), infra (`render.yaml`).
- **Se puede hacer docs/test-only ya mismo:** PR-SEC-2 (y la propia mantención documental de §27/§28).
- **Mayor valor con menor riesgo (orden de retorno):** PR-SEC-2 → PR-SEC-1 → PR-DX-1 → PR-CLEAN-1 → PR-TYPE-1 (todo el lote 0
  es bajo riesgo y alto valor de higiene/seguridad), antes de invertir en las fundaciones con autorización (lote 1).

---

## 22. Evidence Confidence Model

Cada hallazgo se sostiene en evidencia de distinto grado. **Alta** = comprobado por código/tests/config en el repo. **Media** =
inferido por ausencia de artefactos o patrón repetido (podría matizarse con datos externos). **Baja** = requiere acceso
productivo (Supabase/Render/logs reales) y aquí sólo se infiere.

| Categoría | Método de evidencia | Confianza | Brecha pendiente |
| --- | --- | --- | --- |
| Ausencia de RLS en el repo (ENG-P1-001) | `git grep "CREATE POLICY"`=0; sin carpeta `supabase/` | **Alta** | Confirmar que en Supabase prod tampoco hay policies creadas por fuera del repo |
| Conexión DB privilegiada bypassa RLS | `server/db.ts:23` (`postgres(ENV.databaseUrl)`) | Alta (es conexión directa) / **Media** (que el rol sea superusuario depende del connection string real) | Verificar rol/privilegios de la cuenta DB en prod |
| RLS efectiva en Supabase | No inspeccionable desde el repo | **Baja** | Requiere acceso a Supabase |
| Observabilidad console-only (ENG-P1-006) | `fastify-app.ts:348` `logger:false` + `lib/logger.ts` wrapper + `console.*`×29 | **Alta** | Si Render reenvía stdout a algún sink → Media |
| Cobertura no medida (ENG-P1-002) | Sin c8/nyc en `package.json`/CI | **Alta** | % real desconocido hasta instrumentar |
| Frontend sin unit (ENG-P1-003) | Sin vitest/jest/testing-library en `frontend/package.json` | **Alta** | — |
| E2E Chromium-only vs dev (ENG-P1-004) | `playwright.config.ts` 1 project + `webServer: pnpm dev` + CI `install chromium` | **Alta** | — |
| Backend sin linter (ENG-P1-005) | Sin eslint/biome config ni script backend | **Alta** | — |
| God-files (ENG-P1-007) | `wc -l` (2241/1894/2371/…) | Alta (LOC) | Complejidad ciclomática/cognitiva exacta no medida → Media |
| 4xx pg-code leak (ENG-P2-001) | `fastify-app.ts:198-211,390-395` | Alta (ruta de código) / **Media** (que un pg-error burbujee sin catch en alguna ruta) | Test dinámico que dispare cada pg-code |
| zod v3/v4 split (ENG-P2-002) | `package.json` (^3) vs `frontend/package.json` (^4) | **Alta** | — |
| Sin shared/OpenAPI (ENG-P2-003) | Sin `shared/`; `grep openapi`=0 | **Alta** | — |
| CSP report-only (ENG-P2-008) | `next.config.ts:70-72` | **Alta** | — |
| Sin IaC (ENG-P2-009) | Sin `render.yaml`/Dockerfile | Alta (en repo) / **Baja** (config real Render) | Acceso a Render |
| Rate-limit in-memory (ENG-P2-010) | `lib/rate-limit-store.ts:61` `new Map` | **Alta** | Nº de instancias Render (Baja) |
| Migraciones forward-only (ENG-P2-011) | Sin archivos `down` en `drizzle/migrations` | **Alta** | — |
| Performance p95/p99 (§16) | Sin métricas en repo | **Baja** | Acceso a logs/APM |
| Backups/restore RTO-RPO | Sólo `docs/ops/BACKUP_RESTORE_ROLLBACK.md` | **Baja** | Drill real |
| Branch protection / required checks | No representable en el repo | **Baja** | Config de GitHub |

---

## 23. Finding Evidence Ledger

Resumen para validar rápido cada P1/P2. *Tipo de evidencia:* `código` (lógica), `config`, `ausencia` (grep/falta de artefacto),
`LOC` (métrica de tamaño).

| ID | Evidencia principal | Tipo | Confianza | Validación adicional recomendada |
| --- | --- | --- | --- | --- |
| ENG-P1-001 | `db.ts:23` + `CREATE POLICY`=0 + sin `supabase/` | ausencia+código | Alta (repo) | Inspección Supabase prod; test de aislamiento DB |
| ENG-P1-002 | `package.json:21` sin c8/nyc | ausencia | Alta | Instrumentar c8 → baseline % |
| ENG-P1-003 | `frontend/package.json` sólo `e2e` | ausencia | Alta | Añadir vitest y medir |
| ENG-P1-004 | `playwright.config.ts:32-37`; `frontend-ci.yml:68` | config | Alta | Correr E2E en Firefox/WebKit y contra `next start` |
| ENG-P1-005 | Sin eslint backend | ausencia | Alta | Añadir lint y revisar findings |
| ENG-P1-006 | `fastify-app.ts:348`; `logger.ts`; `console.*`×29 | código+ausencia | Alta | Verificar sink de stdout en Render |
| ENG-P1-007 | `wc -l`: 2241/1514/2371/1894/1604 | LOC | Alta | Medir complejidad ciclomática |
| ENG-P2-001 | `fastify-app.ts:198-211,390-395` | código | Alta/Media | Test que dispara 23505/23503/22P02/42703 |
| ENG-P2-002 | zod ^3 (back) vs ^4 (front) | config | Alta | Intentar compartir un schema → confirma incompatibilidad |
| ENG-P2-003 | Sin `shared/`; `types/index.ts`(571)+`api.ts`(2371); openapi=0 | ausencia | Alta | Diff de tipos FE vs respuestas BE reales |
| ENG-P2-004 | `AdminParticularTokensCard.tsx`(1894)+`ClinicParticularTokensCard.tsx`(1604) | LOC+código | Media | Diff de lógica compartida |
| ENG-P2-005 | `package.json:24` `validate:local` | config | Alta | Correr `validate:local` y comparar con CI |
| ENG-P2-006 | `console.*`×29 en `server/` | ausencia/código | Alta | grep tras PR-OBS-1 |
| ENG-P2-007 | Sin Stryker | ausencia | Alta | Piloto de mutación en un módulo |
| ENG-P2-008 | `next.config.ts:70-72` (report-only) | config | Alta | Revisar reportes CSP reales |
| ENG-P2-009 | Sin `render.yaml`/Dockerfile | ausencia | Alta (repo) | Exportar config actual de Render |
| ENG-P2-010 | `rate-limit-store.ts:61` `new Map` | código | Alta | Test de límite tras "reinicio"/2 instancias |
| ENG-P2-011 | Sin `down` migrations | ausencia | Alta | Definir/ensayar rollback de una migración |
| ENG-P2-012 | `docs/` ~300, `docs/audit/*` solapados | LOC/estructura | Alta | Recorrer índice `SOURCES_OF_TRUTH` |

---

## 24. Risk × Effort × Reversibility Matrix

Impacto (Alto/Medio/Bajo) · Esfuerzo (S/M/L/XL) · Reversibilidad (Alta/Media/Baja) · Riesgo de implementación (Bajo/Medio/Alto).
"Orden" = secuencia ejecutiva recomendada (alineada con §19.2).

| ID | Sev | Impacto | Esfuerzo | Reversibilidad | Riesgo impl. | Orden |
| --- | --- | --- | --- | --- | --- | --- |
| ENG-P1-001 | P1 | Alto | XL (por fases) | Baja (RLS) / Alta (fase 1 docs+test) | Alto (fase DB) / Bajo (fase 1) | 1 (f1) / 15 (f2) |
| ENG-P2-001 | P2 | Alto | S | Alta | Bajo | 2 |
| ENG-P1-006 | P1 | Alto | M | Media | Medio | 3 |
| ENG-P2-005 | P2 | Medio | S | Alta | Bajo | 4 |
| ENG-P3-007 | P3 | Bajo | S | Alta | Bajo | 5 |
| ENG-P3-002 | P3 | Bajo | S | Alta | Bajo | 6 |
| ENG-P1-005 | P1 | Medio | M | Alta | Bajo | 7 |
| ENG-P1-002 | P1 | Alto | M | Alta | Bajo | 8 |
| ENG-P1-003 | P1 | Alto | L | Alta | Bajo | 9 |
| ENG-P1-004 | P1 | Alto | M | Alta | Medio | 10 |
| ENG-P1-007 | P1 | Medio | L (incremental) | Alta (split puro) | Medio | 11–12 |
| ENG-P2-003 | P2 | Medio | L | Media | Medio | 11 |
| ENG-P2-009 | P2 | Medio | M | Alta | Bajo | 13 |
| ENG-P2-008 | P2 | Medio | M | Alta (1 línea) | Medio | 14 |
| ENG-P2-010 | P2 | Medio | M | Media | Medio | PR futuro |
| ENG-P2-011 | P2 | Medio | M | Baja | Alto (DB) | 15 |
| ENG-P2-002 | P2 | Medio | M | Media | Medio | post-15 |
| ENG-P2-004 | P2 | Medio | M | Alta | Medio | post-API-1 |
| ENG-P2-007 | P2 | Bajo | M | Alta | Bajo | post-COV-1 |
| ENG-P2-012 | P2 | Bajo | S | Alta | Bajo | continuo |
| P3-001/003/004/005/006 | P3 | Bajo | S | Alta | Bajo | cleanup PRs |

**Justificación del orden:** primero lo de **alta reversibilidad y bajo riesgo** que reduce riesgo de seguridad/operación
(2,3) y deuda barata (4,5,6); luego **fundaciones de calidad** (7,8,9,10) que dan red para los cambios estructurales (11–13);
por último lo de **baja reversibilidad / autorización fuerte** (14,15) cuando ya existe observabilidad y cobertura.

---

## 25. Security Control Coverage Matrix

| Control | Estado actual | Evidencia | Gap | Severidad | PR recomendado |
| --- | --- | --- | --- | --- | --- |
| Auth | Implementado | `middlewares/{admin-auth,auth,particular-auth}.ts`; sesión hasheada | — | — | — |
| Session cookies | Implementado | `env.ts` httpOnly/Secure/SameSite=None; 3 cookies separadas | — | — | — |
| Admin/clinic role separation | Implementado | Cookies distintas + middlewares + tests | — | — | — |
| Multi-tenant isolation | Parcial (app-layer) | Filtros `clinicId` + tests scope | Sin RLS (red DB) | P1 | PR-SEC-2 → PR-RLS-1 |
| IDOR prevention | Parcial | Scoping consistente; `getReportById` sólo admin | Sin guard automatizado | P1/P3 | PR-SEC-2 |
| RLS | **Ausente** | `CREATE POLICY`=0 | Sin defensa DB | P1 | PR-RLS-1 |
| Input validation | Implementado | zod en rutas | — | — | — |
| Output sanitization | Implementado (mayormente) | Respuestas uniformes `{success,...}` | Revisar campos sensibles caso a caso | — | — |
| Error sanitization | Parcial | 5xx sanitizado (`fastify-app.ts`) | 4xx pg-code leak (CWE-209) | P2 | PR-SEC-1 |
| Rate limiting | Parcial | Login DB-backed + per-surface | No-login in-memory; sin global | P2 | PR futuro (ENG-P2-010) |
| Secrets handling | Implementado | `env.ts` zod; service-role backend; `security:public-surface` verde | Rotación productiva no verificable | — | (verif. externa) |
| CSP | Parcial | `next.config.ts` report-only | No enforcing | P2 | PR-CSP-1 |
| CORS | Implementado | `corsOrigins` env + `trusted-origin.ts` | — | — | — |
| Audit trail | Implementado | `audit_log` (0016) + `report_status_history` | Retención no codificada | — | (verif. externa) |
| Logging | **Básico** | `logger:false`; console wrapper | Sin estructura/sink/correlación | P1 | PR-OBS-1 |
| Least privilege | Parcial | Service-role confinado a backend | Conexión DB privilegiada; sin rol no-priv | P1 | PR-RLS-1 |

---

## 26. Production Readiness Gates

Gates obligatorios para declarar "ingeniería extrema / multinacional". Estado: ✔ pasado · ◐ parcial · ✘ no.

| Gate | Estado | Evidencia | Bloqueantes | PRs necesarios |
| --- | --- | --- | --- | --- |
| **Gate 1 — Repo green baseline** | ✔ | 2896 tests 0 fallos; 7 validaciones verdes; `git diff --check` limpio | — | — (mantener) |
| **Gate 2 — Security defense-in-depth** | ✘ | Sin RLS; 4xx leak; CSP report-only | ENG-P1-001, ENG-P2-001, ENG-P2-008 | PR-SEC-2, PR-SEC-1, PR-CSP-1, PR-RLS-1 |
| **Gate 3 — Observability minimum viable** | ✘ | `logger:false`; console-only | ENG-P1-006 | PR-OBS-1 |
| **Gate 4 — Coverage measured** | ✘ | Sin c8; frontend sin unit | ENG-P1-002, ENG-P1-003 | PR-COV-1, PR-FE-TEST-1 |
| **Gate 5 — Cross-browser / E2E production-mode** | ✘ | Chromium-only contra `next dev` | ENG-P1-004 | PR-E2E-1 |
| **Gate 6 — DB / RLS verified** | ✘ | RLS=0; migraciones forward-only | ENG-P1-001, ENG-P2-011 | PR-RLS-1 |
| **Gate 7 — Rollback / backup drill** | ◐ | Docs presentes (`docs/ops/*`); drill real no verificable | Acceso prod; IaC ausente | PR-INFRA-1 + verificación externa |
| **Gate 8 — Incident readiness** | ◐ | Runbooks + login alerts; sin SLOs/alerting/on-call | ENG-P1-006 | PR-OBS-1 + proceso de incidentes |

**Camino crítico a "extremo":** Gate 1 (✔) → Gate 3 (PR-OBS-1) → Gate 4 (PR-COV-1/PR-FE-TEST-1) → Gate 5 (PR-E2E-1) → Gate 2/6
(PR-SEC-* y PR-RLS-1) → Gate 7/8 (IaC + observabilidad + drills).

---

## 27. Open Questions Requiring External Access

Preguntas que **no** pueden cerrarse desde el repo y requieren Supabase/Render/logs/credenciales reales.

| Pregunta | Por qué importa | Cómo verificar | Riesgo si no se verifica |
| --- | --- | --- | --- |
| **Supabase:** ¿existen policies RLS aplicadas fuera del repo? | Define si hay alguna defensa DB real | Supabase Studio → Auth/Policies por tabla | Asumir falsa seguridad o falso gap |
| **Supabase:** ¿con qué rol/privilegios conecta el backend? | Determina si RLS sería efectiva | Inspeccionar el connection string/rol en Render env | Diseñar RLS sobre un rol que igual la bypassa |
| **Render/deploy:** build/start/health/instancias reales | Reproducibilidad y escalado (rate-limit in-memory) | Render dashboard → Settings/Scaling | Deploy no reproducible; rate-limit roto multi-instancia |
| **Logs/métricas:** ¿stdout va a un sink? ¿hay APM? | Define el gap real de observabilidad | Render logs / integración de logging | Sobre/infra-estimar ENG-P1-006 |
| **Variables de entorno:** nombres vs valores en prod | Confirmar gating de version, CORS, SMTP/Gmail | Render env (sin exponer valores) | Config drift; gate 426 mal configurado |
| **Backups:** ¿hay backups automáticos y restore probado? | RTO/RPO reales | Supabase backups + drill de restore | Pérdida de datos sin recuperación verificada |
| **RLS real:** comportamiento de un usuario no-privilegiado | Validar defensa en profundidad antes de PR-RLS-1 | Test de aislamiento en entorno no-prod | RLS que rompe queries legítimas en prod |
| **Branch protections / required checks** | Garantiza que CI bloquea merges rojos | GitHub → Settings → Branches | Merges sin checks; baseline verde no garantizado |
| **Usuarios/roles productivos** | Validar least-privilege y separación admin/clínica reales | Auditoría de cuentas en prod | Cuentas sobre-privilegiadas |
| **Performance real:** p50/p95/p99, cold start | Priorizar perf con datos, no supuestos | APM/logs de latencia | Optimizar a ciegas (anti-patrón §29) |
| **Errores reales:** tasa y tipos en prod | Validar sanitización y estabilidad | Logs de error agregados | No detectar leaks/errores recurrentes |

---

## 28. Traceability Matrix

Trazabilidad hallazgo → riesgo → PR → validación → estado (todos **Abierto** en este baseline). Cubre P1 y P2.

| Hallazgo | Riesgo | PR recomendado | Test / validación | Estado |
| --- | --- | --- | --- | --- |
| ENG-P1-001 | Fuga cross-tenant sin red DB | PR-SEC-2 (f1) → PR-RLS-1 (f2) | test-guard `clinicId`; tests RLS DB | Abierto |
| ENG-P1-002 | Calidad de tests no medida | PR-COV-1 | reporte c8 | Abierto |
| ENG-P1-003 | Regresiones frontend invisibles | PR-FE-TEST-1 | `pnpm --dir frontend test` | Abierto |
| ENG-P1-004 | E2E no representativo | PR-E2E-1 | E2E multi-browser + prod build | Abierto |
| ENG-P1-005 | Bugs backend no detectados | PR-LINT-1 | `pnpm lint` backend | Abierto |
| ENG-P1-006 | Incidentes ciegos | PR-OBS-1 | smoke de logs | Abierto |
| ENG-P1-007 | Alto costo de cambio/regresión | PR-API-1, PR-BE-SVC-1 | typecheck+E2E+tests ruta | Abierto |
| ENG-P2-001 | Info exposure (CWE-209) | PR-SEC-1 | test 400 sin texto pg | Abierto |
| ENG-P2-002 | Drift de validación FE/BE | PR post-15 (unificar zod) | typecheck cross | Abierto |
| ENG-P2-003 | Drift de contrato | PR-API-1 (f1) → contrato shared | typecheck cross-package | Abierto |
| ENG-P2-004 | Doble mantenimiento | PR post-API-1 | E2E tokens admin+clínica | Abierto |
| ENG-P2-005 | Gate local débil | PR-DX-1 | `pnpm validate:local` | Abierto |
| ENG-P2-006 | Logging inconsistente | PR-OBS-1 | grep console=0 en rutas | Abierto |
| ENG-P2-007 | Aserciones débiles | PR post-COV-1 (Stryker) | score de mutación | Abierto |
| ENG-P2-008 | CSP no aplica | PR-CSP-1 | E2E sin violaciones CSP | Abierto |
| ENG-P2-009 | DR/reproducibilidad | PR-INFRA-1 | blueprint válido | Abierto |
| ENG-P2-010 | Rate-limit no distribuido | PR futuro | test límite multi-instancia | Abierto |
| ENG-P2-011 | Rollback de esquema manual | PR-RLS-1 (+down strategy) | restore drill documentado | Abierto |
| ENG-P2-012 | Costo cognitivo docs | continuo (SOURCES_OF_TRUTH) | índice navegable | Abierto |

---

## 29. Do Not Do — Anti-Patterns to Avoid

Reglas explícitas para mantener el trabajo dentro del protocolo VETNEB y evitar regresiones:

- **No mega-refactor.** Cada PR = una causa raíz, un scope, rollback lógico posible.
- **No introducir RLS sin plan de migración/rollback** y sin entorno no-prod + rol no-privilegiado (PR-RLS-1 es fase final).
- **No activar CSP enforcing sin revisar antes los reportes** report-only (riesgo de romper la app).
- **No agregar coverage + lint + e2e + mutation todo junto.** Un tooling por PR (§19.2).
- **No tocar CI / dependencias / DB sin autorización explícita** (marcado ⚠/⚠⚠ en §19).
- **No mezclar observabilidad con refactor de negocio** (PR-OBS-1 cablea logger, no reescribe lógica).
- **No "arreglar" god-files con cambios funcionales grandes.** Split puro / extracción sin cambiar comportamiento.
- **No romper contratos existentes** (`{success,error,...}`, payloads, cookies) por mejora de estilo.
- **No optimizar performance sin métricas reales** (ver §27; evitar supuestos).
- **No hacer cambios visuales en esta línea de trabajo** — pertenecen a `total-visual-engineering-audit.md`.

---

## 30. Acceptance Criteria por Severidad

**P1 — cada hallazgo debe:**
- tener un **PR específico** (no agruparse con otros P1);
- incluir **test o verificación** que demuestre el cierre;
- definir **rollback** explícito;
- tener **dueño técnico** asignado;
- ser **trazable** (aparecer en §28).

**P2 — cada hallazgo debe:**
- **puede agruparse** con otros P2 del mismo área (p.ej. observabilidad) si reduce ruido;
- requiere **validación** (test, lint, build o verificación manual documentada);
- **no introducir deuda nueva** ni romper contratos.

**P3 — cada hallazgo:**
- se puede cerrar en **cleanup PRs** agrupados;
- **no debe bloquear** entregas críticas ni gates de producción;
- se documenta como cerrado en el registro de deuda (§13).

---

## 31. Decision Framework — cómo elegir el próximo PR

Reglas en orden de prioridad. Si dos PRs compiten, gana el de **mayor confianza × menor riesgo × mayor reversibilidad**.

1. Primero P1 de **alta confianza y bajo riesgo de implementación** (lote 0, §19.2).
2. No tocar DB/RLS sin ADR + guard/tests previos (PR-SEC-2 antes de PR-RLS-1).
3. No introducir dependencias sin autorización explícita.
4. No mezclar observabilidad con refactor de negocio.
5. No medir coverage y exigir threshold en el mismo PR.
6. No activar CSP enforcing sin revisar report-only.
7. No pasar de app-level isolation a RLS sin rollback plan + entorno no-prod.
8. Priorizar controles **reversibles** antes que cambios **irreversibles**.

| Situación | Decisión recomendada | Motivo |
| --- | --- | --- |
| Hay tiempo para 1 PR de bajo riesgo | PR-SEC-2 (docs+test) | Máx. valor de seguridad, 0 runtime, reversible |
| "Endurecer seguridad ya" | PR-SEC-1 antes que RLS | 4xx leak es S/reversible; RLS es XL/irreversible |
| "Medir calidad" | PR-COV-1 sin umbral | Medir primero, exigir después |
| "RLS ahora" | Bloquear hasta PR-SEC-2 + PR-OBS-1 + plan rollback | RLS a ciegas = riesgo de caída |
| "Activar CSP" | Revisar reportes report-only primero | Enforcing prematuro rompe la app |
| Van a refactorizar un god-file | Split puro, sin cambio funcional | Aísla riesgo, rollback mecánico |
| Aparece dep nueva en un PR | Separar y pedir autorización | Protocolo VETNEB / `AGENTS.md` |
| PR toca auth | Exigir test negativo | Sin prueba de no-exposición no hay Done |

---

## 32. Risk Acceptance Register

Estado recomendado por riesgo mientras no se cierra: Mitigado · Aceptado temporal · Transferido · Pendiente evidencia · Bloqueado por acceso externo.

| Riesgo | Sev | Estado recomendado | Revisión | Condición para cerrar |
| --- | --- | --- | --- | --- |
| RLS ausente (P1-001) | P1 | Aceptado temporal (mitigado app-layer) | Cada cambio DB/auth | PR-SEC-2 + PR-RLS-1 en prod con rol no-priv + tests DB |
| Observabilidad mínima (P1-006) | P1 | Pendiente evidencia (sink Render) | 30 días | PR-OBS-1 + logs estructurados con `requestId` |
| Coverage no medido (P1-002) | P1 | Aceptado temporal | Próximo PR de testing | PR-COV-1 con baseline publicado |
| E2E Chromium-only (P1-004) | P1 | Aceptado temporal | Antes de "cross-browser ready" | PR-E2E-1 (≥2 browsers + prod build) |
| Backend sin lint (P1-005) | P1 | Aceptado temporal | Próximo PR de calidad | PR-LINT-1 verde en CI |
| God-files (P1-007) | P1 | Aceptado temporal | Por módulo tocado | Split + service layer sin cambio funcional |
| Error leak 4xx (P2-001) | P2 | Mitigable ya | Inmediato | PR-SEC-1 + test |
| CSP report-only (P2-008) | P2 | Aceptado temporal | Tras revisar reportes | PR-CSP-1 enforcing sin violaciones |
| Caches/rate-limit in-memory (P2-010) | P2 | Bloqueado por acceso externo (nº instancias) | Al escalar horizontal | Store distribuido o instancia única documentada |
| Migraciones forward-only (P2-011) | P2 | Aceptado temporal | Antes de PR-RLS-1 | Estrategia rollback/drill documentada |

---

## 33. PR Dependency Graph

Dependencias **duras** (bloqueantes) y **blandas** (recomendadas); secuencia en §19.2.

| PR | Depende de | Bloquea | Tipo | Motivo |
| --- | --- | --- | --- | --- |
| PR-SEC-2 | — | PR-RLS-1 | Dura | Fase 1 (ADR+guard) precede fase 2 (RLS) |
| PR-SEC-1 | — | — | — | Independiente, alto valor temprano |
| PR-OBS-1 | — | PR-RLS-1, incident readiness | Blanda→Dura | No tocar DB ni operar sin observabilidad |
| PR-LINT-1 | — | lint blocking, PR-API-1, PR-BE-SVC-1 | Blanda | Evita ruido en refactor; habilita lint enforcing |
| PR-COV-1 | — | thresholds estrictos | Dura | No exigir umbral sin medir primero |
| PR-DX-1 | — | — | — | Independiente |
| PR-FE-TEST-1 | PR-API-1 (blanda) | thresholds FE | Blanda | Módulos chicos son más testeables |
| PR-API-1 | PR-LINT-1 (blanda) | PR-FE-TEST-1, contrato shared | Blanda | Split limpio antes de unit/contratos |
| PR-E2E-1 | — | "cross-browser production ready" | Dura | Sin esto no se declara cross-browser |
| PR-BE-SVC-1 | PR-LINT-1 (blanda) | — | Blanda | Refactor sobre base linteada |
| PR-INFRA-1 | — | DR/reproducibilidad (Gate 7) | Blanda | Habilita IaC |
| PR-CSP-1 | revisión report-only | Gate 2 (parcial) | Dura | Enforcing requiere análisis previo |
| PR-RLS-1 | PR-SEC-2, PR-OBS-1, PR-COV-1 | Gate 2/6 | Dura | Defensa en profundidad con red previa |

---

## 34. Validation Command Matrix

Comandos por tipo de PR (Terminal 1, PowerShell). Si Next modifica `frontend/next-env.d.ts`:
`git restore --staged frontend/next-env.d.ts 2>$null; git restore frontend/next-env.d.ts` y repetir `pnpm test`.

| Tipo de PR | Comandos mínimos | Adicionales | Cuándo aplica |
| --- | --- | --- | --- |
| Docs-only | `git diff --check` · `git diff --name-only` (solo docs) | — | Sólo `docs/**` |
| Tests-only | `git diff --check` · `pnpm test` | `pnpm typecheck:test` | Sólo `test/**` |
| Frontend-only | `pnpm --dir frontend typecheck` · `lint` · `build` · `pnpm security:public-surface` | E2E afectado | `frontend/src/**` |
| Backend-only | `pnpm typecheck` · `pnpm typecheck:test` · `pnpm test` · `pnpm build` | — | `server/**` |
| Security/auth | backend + `pnpm security:public-surface` + test negativo | E2E auth/redirect | auth/middlewares/headers |
| DB/migration | `pnpm typecheck` · `pnpm test` · `pnpm build` · `pnpm db:migrate` (CI Postgres) · `schema:verify` | rollback/restore drill | `drizzle/**` |
| CI/dependency | `pnpm install --frozen-lockfile` · `pnpm audit` · suite afectada | — | workflows / `package.json` |
| E2E/Playwright | `pnpm --dir frontend e2e:*` (capa) | multi-browser; contra `next start` | `frontend/e2e/**` |
| Performance | medir antes/después (sin métricas, no avanzar) | profiling / EXPLAIN | optimizaciones |
| Observability | backend + smoke de logs (sin PII/secretos) | — | logger/health/audit |
| RLS/Supabase | DB + tests de aislamiento en no-prod + plan rollback | verificación productiva | RLS/policies |

**Gate global previo a cualquier merge:** `git diff --check` · `pnpm test` · `pnpm --dir frontend typecheck` · `pnpm --dir frontend lint` · `pnpm --dir frontend build` · `pnpm build` · `pnpm security:public-surface`.

---

## 35. Authorization Matrix

| Cambio | Autorización | Motivo | Ejemplo |
| --- | --- | --- | --- |
| docs-only | No | Sin impacto runtime | Esta auditoría, ADR |
| tests-only | No | No toca producción | Guard anti-IDOR |
| frontend UI (en scope) | No | Sin contrato/seguridad | Dividir `api.ts` |
| backend validation | Sí (⚠) | Toca runtime | Sanitizar 4xx |
| auth/security | Sí (⚠) + test negativo | Frontera crítica | Cambios de sesión/headers |
| DB/migrations | Sí (⚠⚠) | Irreversible / datos | Nueva migración |
| RLS | Sí (⚠⚠) + plan rollback | Riesgo de caída | Policies + rol no-priv |
| dependencies | Sí (⚠) | Supply-chain / lockfile | `pino`, `c8`, `vitest` |
| CI/workflows | Sí (⚠) | Gatekeeper de merges | Gate cobertura/lint |
| production env | Sí (⚠⚠) | Operación real | Render env vars |
| secrets | Sí (⚠⚠) + nunca exponer | Confidencialidad | Rotación de claves |
| deploy/rollback | Sí (⚠⚠) | Impacto productivo | Force-update gate |
| observability vendor | Sí (⚠) | Coste / PII externa | Sentry / OTel |
| external service | Sí (⚠) | Dependencia externa | SMTP / Gmail / Storage |

---

## 36. Owner / Reviewer Matrix

Roles técnicos (no personas). En proyecto solo-owner (`* @LABVETNEB`, ENG-P3-004), "reviewer" = checklist + self-review disciplinado, o segundo par cuando exista.

| Área | Owner | Reviewer | Motivo |
| --- | --- | --- | --- |
| Aislamiento / RLS | Staff full-stack | Security + DB/Supabase | Riesgo de datos cruzados |
| Auth / sesiones | Backend | Security | Frontera crítica |
| 4xx / errores | Backend | Security | Info exposure |
| Observabilidad | Backend | DevOps/Ops | Operación / incidentes |
| Coverage / lint | Staff full-stack | QA | Calidad medible |
| E2E / cross-browser | Frontend | QA/E2E | Regresión real |
| `api.ts` / contratos | Frontend | Backend | Drift de contrato |
| Migraciones | DB/Supabase | Backend | Integridad / rollback |
| CI / IaC | DevOps/CI | Staff full-stack | Gatekeeper / deploy |
| CSP / headers | Frontend | Security | Romper app vs proteger |
| Release / rollback | Operations | Product owner | Go/no-go |

---

## 37. Done Evidence Requirements

| Tipo de cambio | Evidencia mínima en PR | Opcional | No aceptable |
| --- | --- | --- | --- |
| Security/auth | Test negativo / prueba de no-exposición + validaciones verdes | Captura de respuesta sanitizada | "Funciona local" sin test |
| DB/RLS | Migración + plan rollback/restore o verificación manual documentada | Drill de restore | Migración sin rollback ni nota |
| Observability | Ejemplo de log estructurado **sin PII/secretos** | Dashboard/sink | Log con cookies/tokens/PII |
| Coverage | Reporte generado (baseline) | Tendencia | Umbral que rompe CI en el PR inicial |
| E2E | Browsers/viewports cubiertos + verde | Trace/video | Sólo Chromium si el PR dice "cross-browser" |
| Frontend UI | typecheck+lint+build+`security:public-surface` verdes | Screenshot/E2E | `next-env.d.ts` modificado sin restaurar |
| Docs-only | `git diff --name-only` = solo `docs/**` | — | Tocó código "de paso" |
| Refactor (god-file) | Diff del split + E2E/tests sin cambio de comportamiento | — | Mezcla refactor + cambio funcional |

---

## 38. Failure Mode Analysis

| Hallazgo | Cómo falla en prod | Señal temprana | Prevención | Detección | Recuperación |
| --- | --- | --- | --- | --- | --- |
| App-only isolation (P1-001) | Endpoint sin `clinicId` filtra datos de otra clínica | Cliente ve datos ajenos | Guard anti-IDOR + RLS | Tests scope + RLS + logs | Revocar acceso, parche scope, auditar `audit_log` |
| Error leak 4xx (P2-001) | 400 expone constraint/columna → recon | Mensajes pg en respuestas | Sanitizar 4xx | Test + scan de respuestas | Deploy del fix (reversible) |
| Sin observabilidad (P1-006) | Incidente no detectado / diagnóstico lento | Quejas sin trazas | Logs estructurados + alertas | Sink/APM | PR-OBS-1; correlación por `requestId` |
| Caches in-memory (P2-010) | Rate-limit inconsistente entre instancias | Bypass de límite / contadores raros | Store distribuido | Test multi-instancia | Escalar a 1 instancia o store externo |
| E2E no prod-mode (P1-004) | Bug sólo en `next start` llega a prod | Falla post-deploy no vista en CI | E2E contra build + cross-browser | Smoke productivo | Rollback de deploy |
| Migraciones forward-only (P2-011) | Migración mala sin rollback rápido | Error de esquema en deploy | Down / plan rollback + drill | `schema:verify` / health | Restore desde backup |
| CSP report-only (P2-008) | XSS no bloqueado (sólo reportado) | Reportes CSP con orígenes raros | CSP enforcing | Reportes report-only | Activar enforcing / revertir 1 línea |
| God-files (P1-007) | Regresión por cambio en archivo gigante | PRs lentos, miedo a tocar | Split + service layer | Tests por módulo | Revert del PR de refactor |

---

## 39. Engineering Scorecard

Escala 0–5 cualitativa basada en hallazgos (sin precisión falsa): 0=ausente, 3=funcional, 5=extremo.

| Dimensión | Actual | Objetivo | Brecha | PRs que suben score |
| --- | --- | --- | --- | --- |
| Code quality | 4 | 5 | Lint backend, god-files | PR-LINT-1, PR-API-1, PR-BE-SVC-1 |
| Architecture | 3.5 | 5 | Service layer, contrato shared | PR-API-1, PR-BE-SVC-1 |
| Security | 3.5 | 5 | RLS, 4xx, CSP | PR-SEC-1/2, PR-RLS-1, PR-CSP-1 |
| Testing | 3 | 5 | Cobertura, mutation | PR-COV-1, PR-FE-TEST-1 |
| Frontend | 3.5 | 5 | Unit tests, god-cards | PR-FE-TEST-1, PR-API-1 |
| Backend | 4 | 5 | Lint, service layer | PR-LINT-1, PR-BE-SVC-1 |
| Database | 4 | 5 | RLS, rollback | PR-RLS-1 |
| CI/CD | 4 | 5 | Gate cobertura/lint, IaC | PR-COV-1, PR-LINT-1, PR-INFRA-1 |
| Observability | 1.5 | 5 | Logs/metrics/tracing | PR-OBS-1 |
| Documentation | 4 | 5 | Fragmentación | continuo (SOURCES_OF_TRUTH) |
| Production readiness | 3.5 | 5 | Gates 2–6 | set P1 |
| Developer experience | 4 | 5 | `validate:local` débil | PR-DX-1 |

**Promedio actual ≈ 3.5/5 (Senior).** Salto a ≈4.5 con lote 0 + PR-OBS-1 + PR-COV-1; "extremo" exige PR-RLS-1 + E2E + IaC.

---

## 40. Measurable Improvement Targets

Metas medibles; los baselines no medidos se declaran como tales (no se inventan).

| Área | Métrica objetivo | Baseline conocido | Cómo medir | PR habilitador |
| --- | --- | --- | --- | --- |
| Coverage backend | Línea base + meta tras 1ª medición | **Desconocido** (no medido) | c8 sobre `pnpm test` | PR-COV-1 |
| Coverage frontend | Módulos críticos (api/hooks) cubiertos | **0** (sin runner) | vitest + cobertura | PR-FE-TEST-1 |
| Backend lint | 0 errores enforcement | **0** (sin linter) | `pnpm lint` en CI | PR-LINT-1 |
| Cross-browser E2E | Chromium + WebKit + Firefox | **Chromium-only** | projects Playwright | PR-E2E-1 |
| E2E prod-mode | Smoke contra `next start` | **dev-only** | webServer = build | PR-E2E-1 |
| Observability | Logs JSON con `requestId` y niveles | **console-only** | smoke de logs | PR-OBS-1 |
| RLS | Policies versionadas + tests DB | **0 policies** | migración + test no-priv | PR-RLS-1 |
| CSP | Enforcing sin violaciones | **report-only** | revisar reportes → enforce | PR-CSP-1 |
| Migration rollback | Rollback/drill documentado | **forward-only** | drill de restore | PR-RLS-1 / PR-INFRA-1 |
| Error 4xx | 0 leaks de texto pg | **leak presente** | test 400 | PR-SEC-1 |

---

## 41. No-Go Criteria (bloquean merge)

| No-Go | Aplica a | Motivo | Cómo detectarlo |
| --- | --- | --- | --- |
| Toca DB sin rollback plan | DB/migration | Irreversible | ¿Hay down/drill en el PR? |
| Toca auth sin test negativo | Security | Frontera crítica | ¿Hay test de no-exposición? |
| Agrega dependencia sin autorización | deps | Supply-chain / lockfile | Diff de `package.json`/lock |
| Modifica CI sin fallback | workflows | Romper gatekeeper | Revisar plan de revert |
| Cambia contrato API sin test de contrato | API | Drift FE/BE | ¿Test de contrato? |
| Toca tenant isolation sin prueba anti-IDOR | Security/DB | Fuga de datos | ¿Test scope `clinicId`? |
| Deja `next-env.d.ts` modificado | frontend build | Ruido / regresión | `git status -- frontend/next-env.d.ts` |
| Reduce cobertura E2E crítica | E2E | Pérdida de red | Diff de specs eliminados |
| Mezcla refactor + cambio funcional crítico | refactor | Riesgo / rollback difícil | Revisar diff por scope |
| Expone secreto/PII en logs o respuesta | observability/security | Confidencialidad | grep + review |

---

## 42. Codex/Claude Execution Contract

Contrato para que un agente ejecute PRs futuros con bajo riesgo, leyendo **este** documento como fuente.

**Cómo operar.** (1) Leer §1.2 (Control Panel) y §19 (PR plan). (2) Elegir **un** PR (el primero no cerrado del lote vigente; ante duda, **PR-SEC-2**). (3) Limitar scope a los archivos del PR (§19.1); nada "de paso". (4) Aplicar §34 (validaciones del tipo) y §37 (evidencia). (5) Respetar §35 (autorización): si el PR la requiere y no está dada en el mismo mensaje → **detenerse y pedirla** (listar archivos + riesgo). (6) Respetar §41 (No-Go) y §29 (Do Not Do). (7) **No** `git add/commit/push` ni `gh pr` (lo hace Nico).

**Salida obligatoria del agente:**
1. Hallazgo/PR elegido (ID). 2. Scope (incluido/excluido). 3. Archivos esperados. 4. Riesgos. 5. Tests. 6. Validaciones ejecutadas + resultado real (ejecutado/pasó · ejecutado/falló · no ejecutado · script no disponible). 7. Confirmación de restricciones respetadas. 8. Comandos manuales pendientes para Nico, **sin** ejecutarlos.

**Desviaciones:** si hay que salir de scope, detenerse, documentar motivo + archivos + riesgo y esperar autorización. No simular éxito ni ocultar fallos.

---

## 43. PR Prompt Templates (copiar / pegar)

**A — Docs/test-only (sin autorización):**
```
Repo: C:\PORTAL-VETNEB | Rama base: main (crear rama docs/* o test/*)
PR: <ID, p.ej. PR-SEC-2> | Objetivo: <1 línea>
Scope: SOLO docs/** y/o test/**. Excluido: server, frontend, drizzle, deps, CI.
Restricciones: protocolo VETNEB; no commit/push/PR; no tocar producción.
Tests/validación: pnpm test ; git diff --name-only (solo docs/test).
Salida: resumen + archivos + validaciones reales + restricciones respetadas.
```

**B — Frontend/Backend implementation (cambio mínimo):**
```
Repo: C:\PORTAL-VETNEB | Rama base: main (crear rama feat/*|fix/*|refactor/*)
PR: <ID> | Objetivo: <causa raíz, 1 línea>
Scope exacto: <archivos>. Fuera de scope: <lista>. Sin cambio de contrato.
Restricciones: sin deps nuevas; sin DB/CI; protocolo VETNEB; no commit/push.
Tests: <test nuevo/reforzado>.
Validación: pnpm typecheck ; pnpm test ; pnpm build
  (o frontend: typecheck/lint/build/security:public-surface).
Si Next cambia next-env.d.ts: restaurarlo y repetir pnpm test.
Salida: diff lógico + riesgos + validaciones reales + pendientes manuales.
```

**C — Security/DB/CI con autorización (⚠):**
```
Repo: C:\PORTAL-VETNEB | Rama base: main
PR: <ID, p.ej. PR-RLS-1> | Objetivo: <1 línea> | AUTORIZACIÓN: <explícita aquí>
Scope: <archivos DB/CI/security>. Entorno: NO producción.
Obligatorio: plan de rollback + test (negativo/anti-IDOR/contrato) + evidencia §37.
Restricciones: no exponer secretos; no commit/push/PR; un tooling por PR.
Validación: §34 según tipo + gate global.
Salida: cambios + rollback + validaciones reales + riesgo residual.
```

---

## 44. Audit Maintenance Policy

- **Cuándo actualizar:** ante un evento invalidante (abajo) o al cerrar un PR del plan (marcar §28 "Cerrado", re-score §39, ajustar §40).
- **Eventos que la invalidan (revisar el área afectada):** cambios en auth/sesiones; cambios DB/RLS/migraciones; cambios de CI/workflows; nuevas dependencias; nuevo dashboard / UI mayor; cambio de deploy / IaC; incidentes productivos; cambios en Supabase/Render; cambio de estrategia de tests.
- **Cómo cerrar un hallazgo:** PR mergeado con evidencia (§37) → estado "Cerrado" en §28 → nota en registro de deuda (§13) → re-score (§39).
- **Cómo agregar un hallazgo:** ID estable siguiente (`ENG-Px-NNN`) + fila en §8/§9/§10 + §23 + §28; no romper la numeración existente.
- **Evitar drift:** este documento es la fuente del plan de ingeniería; los hallazgos cerrados se **marcan, no se borran** (trazabilidad). Conciliar con `SOURCES_OF_TRUTH.md`.
- **Revisión:** Staff full-stack + reviewer del área (§36); auditable por un tercero vía §22/§23/§27.

---

## 45. Internal Consistency Check

Verificación interna al cerrar este upgrade (auditable por un tercero):
- **Cada P1 tiene PR:** ✔ (001→SEC-2/RLS-1 · 002→COV-1 · 003→FE-TEST-1 · 004→E2E-1 · 005→LINT-1 · 006→OBS-1 · 007→API-1/BE-SVC-1). Ver §28.
- **Cada P2 tiene PR o justificación:** ✔ (001→SEC-1 · 002→post-15 · 003→API-1 · 004→post-API-1 · 005→DX-1 · 006→OBS-1 · 007→post-COV-1 · 008→CSP-1 · 009→INFRA-1 · 010→PR futuro · 011→RLS-1 · 012→continuo).
- **Autorizaciones marcadas:** ✔ coherentes entre §1.2, §19.1, §34 y §35 (⚠ / ⚠⚠).
- **Primer PR inequívoco:** ✔ **PR-SEC-2** (§1.2, §19.3, §21.1) — único docs/test-only de máximo valor.
- **Conteo estable:** ✔ 0 P0 · 7 P1 · 12 P2 · 7 P3 = 26 (sin cambios; no se hallaron inconsistencias que exijan corrección de conteo).
- **Estado del árbol expresado con precisión:** ✔ el front-matter aclara "limpio salvo este propio documento (untracked)".
- **Sin contradicciones** detectadas entre Control Panel (§1.2), PR plan (§19), gates (§26), scorecard (§39) y recomendación final (§21).

---

*Fin del informe. Auditoría documental; sin cambios de código, frontend, backend, DB/migraciones, dependencias, lockfiles ni
workflows. Sin commit/push/PR. Baseline verde verificado en `HEAD` `8f6b1a2`.*
