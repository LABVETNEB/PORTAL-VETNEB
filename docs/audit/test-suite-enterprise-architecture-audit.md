# VETNEB Test Suite Enterprise Architecture Audit

> Auditoría documental de la suite de tests de Portal VETNEB y propuesta de una
> arquitectura de testing incremental (Clean Architecture / Hexagonal / Enterprise
> Testing). **No mueve archivos, no toca runtime, no modifica tests.** Es un
> documento de diagnóstico y plan.

---

## 1. Metadata

| Campo | Valor |
|-------|-------|
| Rama | `docs/test-suite-enterprise-architecture-audit` |
| Base commit observado | `8e0e1ed docs(logistics): close domain architecture block (#1306)` |
| Fecha | 2026-07-06 |
| Tipo de PR | **docs-only** |
| Archivo único | `docs/audit/test-suite-enterprise-architecture-audit.md` |
| Gestor | PNPM (`pnpm@10.8.1`) |
| Runner backend | `node:test` + `node:assert/strict` (`node --experimental-strip-types --test test/**/*.test.ts`) |
| Runner e2e | Playwright (`@playwright/test`, `frontend/e2e`) |

### Scope

- Inventariar y clasificar la suite de tests actual **con evidencia del repo**.
- Proponer una taxonomía enterprise y reglas de clasificación.
- Definir una secuencia incremental de PRs de bajo riesgo para llegar a esa taxonomía.
- Definir una matriz de validación por tipo de PR.

### No-scope

- **No** mover, renombrar, borrar ni reescribir tests.
- **No** tocar runtime (`server/**`, `frontend/src/**`).
- **No** modificar imports.
- **No** editar `package.json`, `pnpm-lock.yaml`, dependencias ni scripts.
- **No** tocar CI (`.github/workflows/**`), DB, schema ni migraciones.
- **No** tocar stashes ni `.claude/worktrees`.
- **No** copiar, descomprimir, editar ni versionar el ZIP de skills.
- **No** ejecutar acciones de git de escritura (las hace Nico manualmente).

> **Convención del documento:** cada afirmación se marca como **[OBSERVADO]**
> (verificado en el repo en el commit base) o **[PROPUESTO]** (recomendación, aún
> no existe). Ninguna carpeta o archivo propuesto existe hoy salvo que se marque
> explícitamente como observado.

---

## 2. Estado actual **[OBSERVADO]**

### 2.1. Scripts de test detectados

**Root `package.json`** (`portal-vetneb-backend`):

| Script | Comando | Rol |
|--------|---------|-----|
| `test` | `node --experimental-strip-types --experimental-specifier-resolution=node --test test/**/*.test.ts` | Runner único backend (node:test) |
| `typecheck` | `tsc --noEmit` | Typecheck runtime backend |
| `typecheck:test` | `tsc -p ./test/tsconfig.json --noEmit` | Typecheck de la suite de tests |
| `build` | `esbuild server/index.ts ... --outfile=dist/index.js` | Bundle backend |
| `validate:local` | `pnpm typecheck && pnpm typecheck:test && pnpm test && pnpm build` | Gate local compuesto |
| `validate:local:schema` | `pnpm validate:local && pnpm schema:verify` | Gate local + verificación de schema |
| `schema:verify` | `node scripts/schema-verify.mjs` | Drift de schema |
| `security:public-surface` | `node scripts/security/audit-public-devtools-surface.mjs` | Guard de superficie pública |
| `smoke:*` | `node scripts/smoke/*.mjs` / PowerShell | Smokes de staging/prod (fuera de `pnpm test`) |

**`frontend/package.json`** (`portal-vetneb-frontend`):

| Script | Comando | Rol |
|--------|---------|-----|
| `lint` | `eslint .` | Lint frontend |
| `typecheck` | `tsc --noEmit` | Typecheck frontend |
| `e2e` / `e2e:full` | `playwright test` | Suite e2e completa |
| `e2e:smoke` | `playwright test <7 specs>` | Subconjunto humo |
| `e2e:admin-mobile` | `playwright test <13 specs>` | Contratos no-scroll admin mobile |
| `e2e:visual-contract` | `playwright test <11 specs>` | Contratos de layout dashboard |
| `e2e:public-clinic` | `playwright test <11 specs>` | Flujos público + clínica |

> **Hecho clave:** no hay `vitest` ni `jest`. El backend usa el runner nativo de
> Node; el frontend usa Playwright. Todos los `*.test.ts` corren en un **único
> proceso de runner** desde la raíz del repo.

### 2.2. Cantidad y agrupación de archivos de test

**[OBSERVADO]** — conteos exactos en el commit base:

| Ubicación | Patrón | Cantidad |
|-----------|--------|---------:|
| `test/` (raíz, plano) | `*.test.ts` | **418** |
| `test/helpers/` | `*.ts` (no `.test.ts`) | 6 |
| `frontend/e2e/` | `*.spec.ts` | **70** |
| `frontend/e2e/` | `*.png` (snapshots comprometidos) | 30 |
| `frontend/e2e/fixtures/` | `*.mjs` | 1 |
| `frontend/e2e/helpers/` | `*.ts` | 2 |
| `frontend/` (no e2e) | `*.test.ts(x)` | 0 |
| `server/` | `*.test.ts` | 0 |

Agrupación por prefijo dentro de `test/` (los grupos se solapan):

| Grupo (prefijo/sufijo) | Aprox. | Naturaleza dominante |
|------------------------|-------:|----------------------|
| `frontend-*.test.ts` | 147 | Assertions estáticas sobre el **source** del frontend (leen `.tsx` y verifican strings/imports) |
| `*-contract.test.ts` | 96 | Contratos (HTTP, runtime-timing, session, CSP, etc.) |
| `admin-*.test.ts` | 55 | Admin (auth, audit, clinics, tokens, sessions, densidad) |
| `*.fastify.test.ts` | 29 | Integración de controladores Fastify (`app.inject`) |
| `logistics-*.test.ts` | 28 | Dominio/aplicación/rutas de logística |
| `public-*.test.ts` | 27 | Superficie pública (professionals, pricing, reports) |
| `*runtime-timing*` | 22 | Contratos de timing de sesión/runtime |
| `security-*.test.ts` | 20 | Invariantes de seguridad y boundaries |
| `*suite-completeness*` | 8 | Guards de completitud de suite (registries) |
| `*audit*` | 24 | Auditoría (write, boundaries, gaps, completeness) |

### 2.3. Ubicación actual de tests **[OBSERVADO]**

- **Todo el backend y el frontend "de contrato" viven en un único directorio
  plano:** `test/*.test.ts` (418 archivos, sin subcarpetas salvo `test/helpers/`).
- **La taxonomía existe solo como convención de nombre de archivo** (prefijos
  `frontend-`, `admin-`, `security-`, `logistics-`, `public-`, sufijos `.fastify`,
  `-contract`, `-runtime-timing-contract`, `-suite-completeness`). No hay
  separación física por tipo/capa.
- **E2E aislado y bien ubicado:** `frontend/e2e/` con `fixtures/` y `helpers/`
  propios y un `playwright.config.ts`.
- `test/tsconfig.json` incluye `./**/*.ts`, `../server/**/*.ts`, `../drizzle/**/*.ts`,
  `../*.ts` con `rootDir: ".."` → la suite **puede** typechequear código anidado,
  por lo que subcarpetas dentro de `test/` no romperían `typecheck:test`.
- El runner usa el glob `test/**/*.test.ts` → **subcarpetas dentro de `test/` ya
  serían descubiertas** por `pnpm test` sin cambiar el script.

### 2.4. Infraestructura compartida detectada **[OBSERVADO]**

- **No hay setup/teardown global.** Cada test de integración inicializa su entorno
  inline. Ejemplo real (`test/auth.fastify.test.ts:5-10`):

  ```ts
  process.env.NODE_ENV ??= "development";
  process.env.SUPABASE_URL ??= "https://example.supabase.co";
  process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
  process.env.DATABASE_URL ??= "postgresql://postgres:postgres@127.0.0.1:5432/postgres";
  ```

  Este bloque (o variantes) está **duplicado** en múltiples `*.fastify.test.ts`.

- **Inyección de dependencias manual** en los tests de controlador: cada
  `*.fastify.test.ts` registra la ruta con stubs escritos a mano vía opciones de
  ruta (ej. `test/auth.fastify.test.ts:31-59`, `createTestApp(overrides)` con
  `createActiveSession`, `verifyPassword`, `hashPassword`, etc.). Es DI ad-hoc,
  no un contenedor/factoría compartida.

- **Resolución de raíz inconsistente:** conviven `process.cwd()`
  (`test/frontend-dashboard-admin.test.ts:21`) y
  `fileURLToPath(new URL("../", import.meta.url))`
  (`test/audit-suite-completeness.test.ts:7`,
  `test/security-cross-tenant-idor-contract.test.ts:7`).

### 2.5. Fixtures / factories / mocks / helpers detectados **[OBSERVADO]**

`test/helpers/` (6 archivos, mezcla de responsabilidades):

| Archivo | Rol real | Patrón |
|---------|----------|--------|
| `public-professionals-fixtures.ts` | `buildPublicProfessionalFixtureRow(overrides)` + `buildPublicProfessionalsRouteFixtureStubs(options)` | **Test Data Builder** + **Stub/Fake factory** |
| `dashboard-scope-guard.ts` | `dashboardScopeGuardApplies(changedFiles)` | Guard de arquitectura basado en diff |
| `clean7a-dependency-cleanup-scope.ts` | Scope de limpieza de dependencias | Guard de scope PR |
| `report-foreign-access-scope.ts` | `isReportForeignAccessBackendFile(...)` | Guard de scope PR |
| `api-request-id-contract.ts` | Contrato de request-id | Helper de contrato |
| `read-dashboard-css-source.ts` | Lectura de CSS de dashboard | Helper de lectura de source |

E2E (`frontend/e2e/`):

- `fixtures/admin-populated-api-server.mjs` → **Fake** de API (servidor de datos
  poblados) levantado por `playwright.config.ts` como `webServer` en
  `http://127.0.0.1:3107`.
- `helpers/admin-mobile-contracts.ts`, `helpers/particular-session-contracts.ts`
  → **Page-Object-like** / contratos de escenario.

**No existen** directorios dedicados `factories/`, `mothers/`, `mocks/`,
`stubs/`, `fixtures/` ni `setup/` en `test/`. Los patrones ya presentes (builder,
stub, fake) están dispersos y sin convención.

### 2.6. Riesgos de acoplamiento actual **[OBSERVADO]**

| # | Riesgo | Evidencia | Impacto |
|---|--------|-----------|---------|
| R1 | **Directorio plano de 418 archivos**; taxonomía solo por nombre | `test/*.test.ts` | Navegación y ownership difíciles; no hay fronteras físicas por capa |
| R2 | **147 tests de frontend acoplados al string exacto del source** | `test/frontend-dashboard-admin.test.ts:30-42` (`source.includes('import ...')`) | Refactors seguros (rename/move/reformat) rompen tests sin cambio de comportamiento |
| R3 | **Bootstrap de entorno duplicado inline** | `test/auth.fastify.test.ts:5-10` replicado en `*.fastify.test.ts` | Cambiar un default de env obliga a editar N archivos |
| R4 | **Guards basados en `git diff` acoplan el resultado al estado del árbol** | `test/frontend-dashboard-logistics-hub.test.ts:311-322` (`git diff --name-only` + `dashboardScopeGuardApplies`) | Guardrails PR-N: fallan con árbol "sucio" en escenarios de scope; pasan en CI limpio. Mover tests puede activarlos |
| R5 | **Registries de completitud con paths hardcodeados** | `test/audit-suite-completeness.test.ts:28-45` (anclas `test/audit-write.test.ts`, etc.) | **Cualquier movimiento físico rompe la suite** si no se actualiza el registry en el mismo PR |
| R6 | **Snapshots visuales platform-locked comprometidos** | `frontend/e2e/*-snapshots/*-chromium-linux.png` (30 PNG) | Solo válidos en Chromium/Linux (CI); frágiles/no ejecutables localmente en Windows |
| R7 | **Resolución de raíz mixta** (`process.cwd()` vs `new URL`) | §2.4 | Fragilidad ante cambios de CWD y de ubicación de archivos |
| R8 | **`typecheck:test` incluye `server/**` y `drizzle/**`** | `test/tsconfig.json` | Un error de tipo en runtime rompe el gate de tests (acoplamiento de gates) |

> **Nota operativa (R4/R5):** el runner ya descubre subcarpetas (`test/**`), así
> que la migración física es viable **técnicamente**; el bloqueo real es que
> mover un archivo debe actualizar en el mismo PR (a) el registry de completitud
> que lo ancla y (b) los prefijos de scope de los guards de diff. Esto define el
> orden de la estrategia incremental (§8).

---

## 3. Arquitectura de referencia del runtime **[OBSERVADO]**

El runtime ya inició una separación Hexagonal/Clean en logística — es el molde
que la taxonomía de tests debe **espejar**, no inventar:

```
server/features/logistics/
  domain/            # entidades + reglas puras (barrel index.ts reciente, #1304-1306)
  application/       # casos de uso
  infrastructure/    # adaptadores de datos
  routes/            # controladores HTTP (Fastify)
```

El resto del backend sigue un patrón por capas técnicas:

```
server/
  routes/        # 35 controladores *.fastify.ts (HTTP)
  lib/           # 39 módulos de dominio/servicios/utilidades puras (env, audit,
                 #   permissions, tokens, rate-limit, runtime-timing, ...)
  middlewares/   # seguridad transversal
  utils/
```

**Implicación:** la taxonomía de tests debe alinear `unit/domain` con
`server/features/*/domain` + funciones puras de `server/lib`, `integration/adapters`
con `server/routes/*.fastify` y `server/features/*/infrastructure`, y reservar e2e
para `frontend/e2e`.

---

## 4. Taxonomía enterprise propuesta **[PROPUESTO]**

Estructura destino (ninguna de estas carpetas existe hoy salvo `test/helpers/`):

```
test/
  unit/
    domain/                 # reglas puras: tokens, timing, permissions, pagination,
                            #   logistics/domain, serializers
    use-cases/              # orquestación de casos de uso (application layer)
  integration/
    adapters/
      controllers/          # *.fastify.test.ts (app.inject sobre rutas Fastify)
      repositories/         # acceso a datos / infrastructure (con fakes de DB)
    external-services/       # Supabase storage/signed-url, email, gmail api (fakes)
  e2e/                      # (permanece en frontend/e2e; ver nota)
    flows/                  # login, auth-redirect, b2b operations
    features/               # no-scroll, densidad, layout contracts
  shared/
    fixtures/               # datos de ejemplo inmutables y seguros
    factories/              # Test Data Builders / Object Mothers
    mocks/                  # stubs / fakes / spies reutilizables
    setup/                  # bootstrap de env, helpers de app Fastify, root-resolve
```

Notas de encaje con lo observado:

- **`test/e2e`** es conceptual: el e2e físico **permanece** en `frontend/e2e`
  (tiene su propio `playwright.config.ts`, `webServer` y snapshots). La taxonomía
  `flows/` vs `features/` se puede adoptar como subcarpetas dentro de `frontend/e2e`.
- **`shared/factories`** absorbe `public-professionals-fixtures.ts` (ya es un
  builder + stub factory).
- **`shared/setup`** absorbe el bootstrap de env inline (R3) y un
  `createFastifyTestApp()` común que hoy está replicado como `createTestApp` local.
- Los **guards de arquitectura** (fastify-only, domain-boundary, suite-completeness,
  scope-guards) son una categoría transversal → `test/architecture/` **[PROPUESTO]**
  o etiquetado por convención; ver §5.

---

## 5. Reglas de clasificación **[PROPUESTO]**

Criterio de decisión por test. Se aplica leyendo **qué importa** y **qué asevera**
el archivo:

| Categoría | Criterio de pertenencia | Ejemplos observados hoy |
|-----------|-------------------------|-------------------------|
| **Unit / domain** | Importa una función/módulo puro (sin I/O, sin red, sin FS de runtime) y asevera su comportamiento. Sin `Fastify`, sin `app.inject`, sin leer source de otra capa. | `report-access-token.test.ts`, `particular-token.test.ts`, `report-access-token-serializers.test.ts`, `logistics-pagination.test.ts`, `runtime-timing.test.ts`, `rate-limit-store.test.ts` |
| **Unit / use-case** | Ejercita orquestación de aplicación (varios colaboradores puros/fakes) sin capa HTTP. | `logistics-metrics.test.ts`, `permissions-and-report-status.test.ts` |
| **Integration / controller** | Construye una app `Fastify()`, registra una ruta con stubs y usa `app.inject()`. | `*.fastify.test.ts` (29): `auth.fastify.test.ts`, `reports.fastify.test.ts`, `admin-*.fastify.test.ts` |
| **Integration / repository** | Ejercita acceso a datos / `infrastructure` con un fake de DB/cliente. | (parcial) `logistics-db.test.ts`, `db-pool-contract.test.ts` |
| **External-service integration** | Ejercita adaptadores a servicios externos (Supabase, email) con fakes; nunca red real. | `supabase-*.test.ts`, `email-*.test.ts`, `supabase-signed-url.test.ts` |
| **E2E flow** | Playwright que recorre un flujo de usuario end-to-end. | `frontend/e2e/dashboard-auth-redirect.spec.ts`, `login-hydration.spec.ts`, `public-clinics-b2b-operations.spec.ts` |
| **E2E feature/layout** | Playwright que valida un contrato visual/interacción de una feature. | `admin-mobile-*-no-scroll.spec.ts`, `dashboard-*-contract.spec.ts` |
| **Security invariant** | Asevera una frontera de seguridad (sesiones, disclosure, CORS, IDOR, redaction). Puede ser behavioral o registry-driven. | `security-*.test.ts` (20), `api-error-no-secrets-contract.test.ts`, `api-error-no-stack-traces-contract.test.ts` |
| **Regression guard** | Congela un contrato que ya se rompió/es sensible (timing, last-access, parity). | `*runtime-timing-contract.test.ts` (22), `*session-last-access-contract.test.ts`, `mobile-production-parity-invariants.test.ts` |
| **Architecture guard** | Lee FS/config y enforcea estructura, no comportamiento. | `fastify-only-guardrail.test.ts`, `logistics-domain-boundary-guard.test.ts`, `*suite-completeness*` (8), `audit-separated-surfaces.test.ts`, `toolchain-contract.test.ts`, `package-scripts-contract.test.ts` |

**Regla de desempate** (un archivo puede tocar varias): clasificar por el
**colaborador de mayor "peso" de I/O** que ejercita. Orden de prioridad:
E2E > External-service > Repository > Controller > Use-case > Domain. Los guards
(security/regression/architecture) son ejes **ortogonales**: se etiquetan además
del tipo, no en vez de.

**Caso especial — tests "source-contract" del frontend (147, R2):** hoy leen el
`.tsx` y aseveran strings. **No** son unit ni integration reales; son
**architecture/regression guards del frontend**. Propuesta de clasificación:
`architecture` (si aseveran estructura/imports/boundaries) o candidatos a
**reemplazo** por render tests / e2e cuando aseveran comportamiento visible
(deuda explícita, §10).

---

## 6. Patrones recomendados **[PROPUESTO]**

Con anclaje en lo que ya existe:

| Patrón | Uso recomendado en VETNEB | Estado hoy |
|--------|---------------------------|-----------|
| **Test Data Builder** | Construir filas/DTOs con `overrides` (defaults seguros) | **Ya existe:** `buildPublicProfessionalFixtureRow` |
| **Object Mother** | Escenarios nombrados de alto nivel (`clinicWithReports`, `adminSession`) | No existe → `shared/factories` |
| **Stub** | Colaboradores que devuelven valores fijos para forzar una rama | **Ya existe** ad-hoc en `createTestApp` overrides |
| **Fake** | Implementación ligera funcional (DB en memoria, API server) | **Ya existe:** `admin-populated-api-server.mjs`, `buildPublicProfessionalsRouteFixtureStubs` |
| **Spy** | Verificar que un efecto (audit write, email) fue invocado | Emular con closures que registran llamadas (hoy stubs vacíos) |
| **Mock** | Solo cuando se verifica interacción estricta; preferir stub/fake | Usar con moderación |
| **Dummy** | Rellenos que nunca se usan (satisfacer firmas) | Presente implícito en overrides |
| **Page Object Model** | E2E: encapsular selectores/acciones por pantalla | **Semilla:** `e2e/helpers/*-contracts.ts` |
| **Screenplay** | Solo si el e2e crece a múltiples actores (clínica/admin/particular) con tareas reutilizables | Diferir (over-engineering hoy) |
| **AAA** (Arrange-Act-Assert) | Estructura estándar de cada `test()` | Adoptar como convención de escritura |
| **FIRST** (Fast, Isolated, Repeatable, Self-validating, Timely) | Criterio de aceptación de un test nuevo | R3/R4/R7 hoy violan *Isolated/Repeatable* |

**Prioridad de adopción:** consolidar Builder + Fake + Stub en `shared/factories`
y `shared/mocks` (ya existen en germen) antes de introducir Object Mother /
Screenplay (aún no justificados).

---

## 7. Guardrails VETNEB **[OBSERVADO + PROPUESTO]**

Invariantes que la suite debe preservar (y hoy ya vigila en parte):

1. **No mezclar `admin_session_id` con `app_session_id`.**
   Observado: `security-session-cookie-boundaries.test.ts`,
   `auth-session-boundaries.test.ts`, `security-cross-auth-surface-boundaries.test.ts`.
2. **No exponer secrets / tokens / hashes / cookies / signed URLs.**
   Observado: `api-error-no-secrets-contract.test.ts`,
   `security-sensitive-log-redaction-boundaries.test.ts`,
   `security-response-disclosure-boundaries.test.ts`, `supabase-signed-url.test.ts`.
3. **No cachear dashboards privados / APIs privadas.**
   Observado: `backend-api-no-store-cache-contract.test.ts`,
   `frontend-dashboard-server-401-redirect.test.ts`,
   `frontend-pwa-global-operational-contract.test.ts`,
   e2e `dashboard-logout-private-cache.spec.ts`.
4. **No stack traces en producción.**
   Observado: `api-error-no-stack-traces-contract.test.ts`.
5. **No tests frágiles por snapshots visuales innecesarios.**
   Riesgo: 30 PNG platform-locked (R6). **Propuesto:** limitar snapshots a rutas
   críticas y correrlos solo en el job manual `visual-regression-manual.yml`; no
   agregarlos al gate por defecto.
6. **No fixtures con datos sensibles reales.**
   Observado: los fixtures usan datos sintéticos (`fixture@example.com`,
   `test-service-role-key`, `https://example.supabase.co`). **Propuesto:** regla
   de convención que prohíba `.env` real / PII en `shared/fixtures`.
7. **No tests que dependan de orden global.**
   Riesgo: el bootstrap `??=` de env (R3) crea estado de proceso compartido; los
   guards de diff (R4) dependen del árbol. **Propuesto:** centralizar env en
   `shared/setup` idempotente y aislar guards de diff.
8. **No tests que requieran producción.**
   Observado: los smokes de prod/staging viven **fuera** de `pnpm test`
   (`scripts/smoke/*`, scripts `smoke:*`). Mantener esa separación.

> **Invariante de migración (nuevo, propio de esta suite):** ningún PR de reorg
> puede dejar `pnpm test` rojo por desincronizar un **registry de completitud**
> (R5) o un **prefijo de scope-guard** (R4). Todo movimiento actualiza su
> registry/guard en el mismo PR.

---

## 8. Estrategia incremental por PRs **[PROPUESTO]**

Principio VETNEB: **cambio mínimo, verificable, con rollback lógico.** El orden
minimiza el riesgo de R4/R5 (guards y registries acoplados a paths).

| PR | Scope | Archivos probables | Riesgo | Validación local | Criterio de merge | Rollback lógico |
|----|-------|--------------------|--------|------------------|-------------------|-----------------|
| **TEST-ARCH-1** | Documento de convención y nomenclatura de tests (esta taxonomía como norma) | `docs/qa/test-architecture-conventions.md` (nuevo) | **Nulo** (docs-only) | `git diff --check`, `pnpm test`, `pnpm build` | Doc aprobado; sin cambios de runtime | Borrar el `.md` |
| **TEST-ARCH-2** | Helpers compartidos mínimos **aditivos** (no mueven nada): `shared/setup/env.ts`, `shared/setup/fastify-app.ts`, `shared/factories/index.ts` que **re-exporta** los builders ya existentes | `test/shared/**` (nuevo), sin editar tests existentes | **Bajo** (solo agrega archivos `.ts` no-`.test`) | `pnpm typecheck:test`, `pnpm test` | Helpers compilan y no rompen la suite; 0 imports nuevos en tests legacy | Borrar `test/shared/**` |
| **TEST-ARCH-3** | Clasificar/mover **solo unit/domain puros** (sin FS/HTTP): tokens, timing, serializers, pagination | mover a `test/unit/domain/**` + actualizar registries que los anclen (R5) | **Medio** (paths en registries + posibles scope-guards) | `pnpm typecheck:test`, `pnpm test` (verde obligatorio), `git diff --stat` (acota N) | Suite verde; registries actualizados en el mismo PR; sin cambio de aserciones | `git restore`/revert del move (paths vuelven a raíz) |
| **TEST-ARCH-4** | Consolidar factories/mocks/fixtures compartidos y **migrar `test/helpers/*` de fixtures** a `shared/` (dejando shims de re-export si algún test los importa) | `test/shared/factories/**`, `test/shared/mocks/**`, actualizar imports de los tests que usan `helpers/public-professionals-fixtures.ts` | **Medio** (toca imports — fuera de scope de esta auditoría) | `pnpm typecheck:test`, `pnpm test` | Imports resueltos; builders/fakes en un solo lugar | Revertir move; shims de re-export mantienen compatibilidad |
| **TEST-ARCH-5** | Mover integración HTTP/controladores `*.fastify.test.ts` a `test/integration/adapters/controllers/**` + centralizar `createFastifyTestApp` (R3) | 29 archivos + registries + `shared/setup` | **Alto** (volumen + registries + guards de diff) | `pnpm validate:local` completo | Suite verde; env centralizado; sin duplicación `process.env ??=` | Revert por lotes (por dominio) |
| **TEST-ARCH-6** | Separar e2e en `frontend/e2e/flows/**` y `frontend/e2e/features/**` + actualizar los `testDir`/globs de scripts `e2e:*` | `frontend/e2e/**`, `frontend/package.json` (scripts) *(requiere autorización: toca package.json)* | **Alto** (scripts + rutas de snapshots) | `pnpm --dir frontend lint`, `typecheck`, `build`, `e2e:smoke` | Specs descubiertos; snapshots re-anclados; job visual manual intacto | Revert de rutas; scripts vuelven a globs previos |
| **TEST-ARCH-7** | Guard de arquitectura de tests: un test que asevere que cada `*.test.ts` está en su carpeta correcta según reglas §5 | `test/architecture/test-taxonomy-guard.test.ts` (nuevo) + registry de mapa | **Medio** (se vuelve fuente de verdad; debe tolerar legacy no migrado) | `pnpm test` | Guard pasa con estado mixto (legacy permitido con allowlist decreciente) | Borrar el guard |
| **TEST-ARCH-8** | Closeout documental: actualizar esta auditoría con estado final, deuda restante y allowlist residual | `docs/audit/test-suite-enterprise-architecture-audit.md` | **Nulo** | `git diff --check`, `pnpm build` | Estado consistente con el repo | Revert del doc |

**Guía de secuenciación:**

- PRs 1–2 son **aditivos y de riesgo casi nulo** → arrancan la convención sin tocar
  nada existente.
- PRs 3–5 hacen los movimientos reales; cada uno **acota el volumen** (`git diff
  --stat`) y **actualiza registries/guards en el mismo PR** (invariante §7).
- PRs 6–8 cierran e2e, guard y documentación.
- Cualquiera de 3–6 puede **subdividirse por dominio** (admin / logistics /
  public / particular) para mantener PRs pequeños y revertibles.

---

## 9. Matriz de comandos de validación **[OBSERVADO]**

Todos los comandos son de solo lectura/validación; el git de escritura lo ejecuta
Nico. **Terminal 1** = raíz `C:\PORTAL-VETNEB`; **Terminal 2** = `frontend`.

| Tipo de PR | Validación mínima obligatoria | Notas |
|------------|-------------------------------|-------|
| **docs-only** | `git diff --check` · `git diff --name-only` · `git diff --stat` · `pnpm test` · `pnpm build` | Archivo untracked bajo `docs/**` no dispara guards de diff (usan `git diff --name-only`, que ignora untracked) |
| **Movimiento mecánico de tests** | `pnpm typecheck:test` · `pnpm test` · `pnpm build` · `git diff --stat` (acotar) | **Actualizar registries de completitud (R5) y prefijos de scope-guard (R4) en el mismo PR** |
| **Helpers / factories / mocks** | `pnpm typecheck:test` · `pnpm test` | Aditivo; verificar 0 imports rotos |
| **Tests runtime / backend** | `pnpm validate:local` (`typecheck` + `typecheck:test` + `test` + `build`) | `typecheck:test` cubre `server/**` (R8) |
| **E2E / UI** | `pnpm --dir frontend lint` · `pnpm --dir frontend typecheck` · `pnpm --dir frontend build` · `pnpm --dir frontend e2e:smoke` | Visual-regression = job manual (`visual-regression-manual.yml`), **no** gatear por defecto; si `.next` corrupto, borrar `frontend/.next` |
| **Security guards** | `pnpm test` · `pnpm run security:public-surface` · (si toca schema) `pnpm run schema:verify` | Preferir aserciones behaviorales; evitar registries frágiles |

Comandos base de inspección (PowerShell, solo lectura):

```powershell
git -C C:\PORTAL-VETNEB status --short --untracked-files=all
git -C C:\PORTAL-VETNEB diff --check
git -C C:\PORTAL-VETNEB diff --stat
git -C C:\PORTAL-VETNEB diff --name-only
```

---

## 10. Recomendación final **[PROPUESTO]**

### Primer PR ejecutable posterior

**TEST-ARCH-1 (docs-only): documento de convención y nomenclatura de tests.**
Es riesgo nulo, no toca runtime, no dispara guards y establece la norma que
habilita los PRs de movimiento. Segundo candidato: **TEST-ARCH-2** (helpers
`shared/` aditivos), también de bajo riesgo.

### Qué NO hacer

- **No** hacer un "big-bang move" de los 418 archivos: rompería registries (R5) y
  scope-guards (R4) y dejaría `pnpm test` rojo.
- **No** mover tests sin actualizar en el **mismo PR** su registry de completitud
  y los prefijos de scope.
- **No** introducir `vitest`/`jest` ni dependencias nuevas para "ordenar" — el
  runner nativo ya soporta subcarpetas (`test/**`).
- **No** agregar snapshots visuales al gate por defecto (R6).
- **No** convertir esta auditoría en refactor: mover archivos queda **fuera** de
  este PR docs-only.

### Deuda dejada explícita para auditoría posterior

1. **147 tests "source-contract" del frontend (R2):** decidir por archivo si
   pasan a `architecture` guard, se convierten en render/e2e tests, o se retiran.
   Es la mayor fuente de fragilidad y merece su propia auditoría.
2. **Guards de diff (R4):** evaluar reemplazar la dependencia de `git diff` por
   allowlists estáticas o moverlos a CI-only, para desacoplar el resultado del
   estado del árbol local.
3. **Registries de completitud con paths hardcodeados (R5):** evaluar generarlos
   por descubrimiento (glob) en vez de listas manuales.
4. **Snapshots platform-locked (R6):** definir política de visual regression
   (rutas mínimas, entorno único, job manual).
5. **`typecheck:test` acoplado a `server/**` (R8):** evaluar separar el typecheck
   de tests del typecheck de runtime.
6. **Bootstrap de env duplicado (R3):** centralizar en `shared/setup` idempotente.

---

*Fin de la auditoría. Documento de diagnóstico y plan; no ejecuta cambios de
runtime ni de estructura de tests.*
