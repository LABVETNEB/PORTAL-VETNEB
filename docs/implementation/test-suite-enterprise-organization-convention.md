# VETNEB Test Suite Enterprise Organization Convention

> Convención documental oficial para organizar, nombrar y clasificar los tests de
> Portal VETNEB. **Docs-only.** No mueve archivos, no toca runtime, no modifica
> tests, imports, `package.json`, `pnpm-lock.yaml`, CI, DB ni schema. Define la
> **norma destino** que gobernará los futuros PRs de migración incremental
> descritos en la auditoría ya mergeada.

---

## 1. Metadata

| Campo | Valor |
|-------|-------|
| Rama | `docs/test-suite-enterprise-organization-convention` |
| Base commit observado | `47ef047 docs(test): audit enterprise test suite architecture (#1307)` |
| Fecha | 2026-07-06 |
| Tipo de PR | **docs-only** |
| Archivo único | `docs/implementation/test-suite-enterprise-organization-convention.md` |
| Source audit | [`docs/audit/test-suite-enterprise-architecture-audit.md`](../audit/test-suite-enterprise-architecture-audit.md) |
| Gestor | PNPM (`pnpm@10.8.1`) |
| Runner backend | `node:test` + `node:assert/strict` (`node --experimental-strip-types --test test/**/*.test.ts`) |
| Runner e2e | Playwright (`@playwright/test`, `frontend/e2e`) |

### Scope

- Establecer la **convención oficial** de organización, nomenclatura y
  clasificación de tests como norma de referencia para PRs futuros.
- Codificar los patrones de test recomendados y los guardrails de seguridad
  VETNEB que la suite debe preservar.
- Definir las reglas de migración incremental y la matriz de validación por tipo
  de PR, alineadas 1:1 con la auditoría fuente.

### No-scope

- **No** mover, renombrar, borrar ni reescribir tests (esto ocurre en PRs
  posteriores TEST-ARCH-3+).
- **No** tocar runtime (`server/**`, `frontend/src/**`), imports ni configuración
  de runner.
- **No** editar `package.json`, `pnpm-lock.yaml`, dependencias, scripts ni CI
  (`.github/workflows/**`).
- **No** tocar DB, schema, migraciones, stashes ni `.claude/worktrees`.
- **No** crear carpetas `test/unit/`, `test/integration/`, `test/shared/` todavía:
  este PR **documenta** la estructura destino, no la materializa.

> **Convención de marcado.** Cada afirmación se etiqueta como **[OBSERVADO]**
> (verificado en el repo en el commit base, con evidencia de la auditoría fuente)
> o **[PROPUESTO]** (norma que aún no existe físicamente). Esta convención es en
> su mayoría **[PROPUESTO]**: describe el destino, no el estado actual. El estado
> actual está exhaustivamente inventariado en la auditoría fuente §2.

---

## 2. Objetivo de la convención **[PROPUESTO]**

Esta convención define **cómo se organizarán, nombrarán y clasificarán** los
tests de VETNEB —tanto los nuevos como los migrados— **sin ejecutar todavía
ningún movimiento de archivos**.

Su función es ser la **fuente de verdad normativa** que:

1. Habilita los PRs de migración mecánica (TEST-ARCH-3 en adelante) dándoles una
   estructura destino inequívoca y reglas de clasificación deterministas.
2. Fija el criterio de aceptación de todo test **nuevo** desde este commit: dónde
   vive, cómo se llama, qué puede importar y qué debe aseverar.
3. Congela los invariantes de seguridad y de migración que ningún PR de reorg
   puede violar.

**Lo que esta convención NO es:** no es un refactor, no es una migración, no es
una reescritura funcional. El estado actual observado (directorio plano de 418
`*.test.ts` en `test/`, taxonomía solo por prefijo de nombre) **sigue siendo
válido** hasta que un PR de migración lo cambie. Ver auditoría fuente §2.2–§2.3.

> **Distinción central del documento:** "convención oficial propuesta" (la norma
> destino) ≠ "estado actual observado" (lo que hay hoy). Donde esta convención
> describe carpetas o helpers que **no existen**, se marca **[PROPUESTO]**.

---

## 3. Principios rectores **[PROPUESTO]**

La convención se apoya en principios de testing enterprise ya establecidos.
Ninguno introduce dependencias ni cambia el runner:

| Principio | Qué exige en VETNEB |
|-----------|---------------------|
| **Clean Architecture** | La ubicación de un test refleja la capa que ejercita: dominio puro → `unit/domain`; casos de uso → `unit/use-cases`; adaptadores → `integration/adapters`. El test **espeja** la arquitectura del runtime, no inventa una nueva. |
| **Hexagonal boundaries** | Un test unitario del núcleo (dominio/aplicación) **no** cruza puertos (HTTP, DB, FS de runtime, red). Los adaptadores se ejercitan solo en `integration/**`. Cada frontera se testea desde un único lado. |
| **Test pyramid / testing trophy** | Mayoría de tests rápidos y aislados (unit) en la base; una capa media de integración de adaptadores; una cúspide fina de e2e. Los guards de arquitectura/seguridad son un eje transversal, no un nivel. |
| **FIRST** | **F**ast, **I**solated, **R**epeatable, **S**elf-validating, **T**imely. Todo test nuevo debe cumplirlo; los riesgos R3/R4/R7 de la auditoría violan *Isolated/Repeatable* y son deuda a saldar, no patrón a copiar. |
| **AAA** | **A**rrange–**A**ct–**A**ssert como estructura estándar de cada `test()`/`it()`, con separación visual clara de las tres fases. |
| **Determinism** | Sin dependencia de reloj real no congelado, de orden global de ejecución, ni del estado del árbol de git en tests unitarios. Fechas y aleatoriedad se inyectan. |
| **Minimal I/O para unit tests** | Un unit test no abre sockets, no toca disco de runtime ni levanta Fastify. Si necesita I/O, pertenece a `integration/**`. |
| **No dependencia de producción** | Ningún test dentro de `pnpm test` requiere staging/prod ni credenciales reales. Los smokes de prod viven **fuera** del runner (`scripts/smoke/*`). **[OBSERVADO]** en auditoría §7.8. |
| **No fixtures con datos sensibles reales** | Los fixtures usan datos sintéticos y seguros (`fixture@example.com`, `test-service-role-key`, `https://example.supabase.co`). Prohibido `.env` real o PII. **[OBSERVADO]** en auditoría §7.6. |

---

## 4. Estructura objetivo oficial **[PROPUESTO]**

Estructura destino como **norma incremental** (ninguna de estas carpetas existe
hoy salvo `test/helpers/`; ver auditoría §4). Se adopta archivo por archivo en
PRs posteriores, no de golpe:

```
test/
├── unit/
│   ├── domain/                 # reglas puras: tokens, timing, permissions,
│   │                           #   pagination, logistics/domain, serializers
│   └── use-cases/              # orquestación de casos de uso (application layer)
├── integration/
│   ├── adapters/
│   │   ├── controllers/        # *.fastify.test.ts (app.inject sobre rutas)
│   │   └── repositories/       # acceso a datos / infrastructure (fakes de DB)
│   └── external-services/      # Supabase storage/signed-url, email, gmail (fakes)
├── e2e/                        # conceptual: el e2e físico permanece en frontend/e2e
│   ├── flows/                  # login, auth-redirect, b2b operations
│   └── features/               # no-scroll, densidad, layout contracts
└── shared/
    ├── fixtures/               # datos de ejemplo inmutables y seguros
    ├── factories/              # Test Data Builders / Object Mothers
    ├── mocks/                  # stubs / fakes / spies reutilizables
    └── setup/                  # bootstrap de env, app Fastify de test, root-resolve
```

**Notas de encaje con lo observado** (auditoría §4):

- **`test/e2e/` es conceptual.** El e2e físico **permanece** en `frontend/e2e`
  (tiene su propio `playwright.config.ts`, `webServer` y snapshots). La taxonomía
  `flows/` vs `features/` se adopta como **subcarpetas dentro de `frontend/e2e`**,
  no como una carpeta bajo `test/`.
- **`shared/factories`** es el destino de `test/helpers/public-professionals-fixtures.ts`
  (ya es Builder + Stub factory). **[OBSERVADO]**
- **`shared/setup`** absorbe el bootstrap de env inline duplicado (auditoría R3) y
  un `createFastifyTestApp()` común que hoy está replicado como `createTestApp`
  local en cada `*.fastify.test.ts`.
- **Guards transversales** (arquitectura/seguridad/regresión): ver §6. Pueden
  vivir en `test/architecture/` **[PROPUESTO]** o etiquetarse por convención de
  nombre; no son un nivel de la pirámide.

> **Habilitador técnico [OBSERVADO]:** el runner usa el glob `test/**/*.test.ts`,
> así que las subcarpetas dentro de `test/` **ya serían descubiertas** por
> `pnpm test` sin cambiar el script. `test/tsconfig.json` (rootDir `..`) permite
> typechequear código anidado. La migración es viable sin tocar tooling.

---

## 5. Clasificación oficial **[PROPUESTO]**

Para cada categoría se define: qué entra, qué **no** entra, dependencias
permitidas y prohibidas, ejemplos de nombre de archivo y validación esperada. Los
ejemplos citan archivos **[OBSERVADO]** hoy en `test/` (directorio plano) que
serían los candidatos naturales a cada carpeta destino.

### 5.1. `unit/domain`

- **Qué entra:** funciones y módulos puros (sin I/O, red ni FS de runtime) y sus
  aserciones de comportamiento.
- **Qué NO entra:** cualquier test que construya `Fastify()`, use `app.inject()`,
  toque DB, red, disco de runtime, o lea el source de otra capa como string.
- **Permitido:** `node:assert/strict`, el módulo bajo test, factories/fixtures de
  `shared/**`, fakes puros en memoria.
- **Prohibido:** `fastify`, clientes Supabase/postgres reales, `fs` de runtime,
  `git`, red.
- **Ejemplos de nombre:** `report-access-token.test.ts`,
  `particular-token.test.ts`, `report-access-token-serializers.test.ts`,
  `logistics-pagination.test.ts`, `runtime-timing.test.ts`,
  `rate-limit-store.test.ts`.
- **Validación esperada:** `pnpm typecheck:test` · `pnpm test` (verde y rápido;
  ideal < decenas de ms por archivo).

### 5.2. `unit/use-cases`

- **Qué entra:** orquestación de la capa de aplicación (varios colaboradores
  puros o fakes) **sin** capa HTTP.
- **Qué NO entra:** tests que necesiten un servidor HTTP o un cliente de datos
  real.
- **Permitido:** dominio puro, fakes/stubs de puertos, factories de `shared/**`.
- **Prohibido:** `app.inject()`, red, DB real.
- **Ejemplos de nombre:** `logistics-metrics.test.ts`,
  `permissions-and-report-status.test.ts`.
- **Validación esperada:** `pnpm typecheck:test` · `pnpm test`.

### 5.3. `integration/adapters/controllers`

- **Qué entra:** tests que construyen una app `Fastify()`, registran una ruta con
  stubs y ejercitan `app.inject()`.
- **Qué NO entra:** dominio puro; e2e de navegador; acceso a servicios externos
  reales.
- **Permitido:** `fastify`, `createFastifyTestApp()` de `shared/setup`, stubs de
  colaboradores, factories de `shared/**`.
- **Prohibido:** red externa real, DB productiva, Playwright.
- **Ejemplos de nombre:** `auth.fastify.test.ts`, `reports.fastify.test.ts`,
  `admin-*.fastify.test.ts` (29 archivos `*.fastify.test.ts` observados).
- **Validación esperada:** `pnpm validate:local` (incluye `typecheck:test` +
  `test` + `build`).

### 5.4. `integration/adapters/repositories`

- **Qué entra:** ejercicio de acceso a datos / `infrastructure` con un **fake** de
  DB o cliente (en memoria).
- **Qué NO entra:** DB productiva o de staging; dominio puro.
- **Permitido:** fakes de cliente de datos, factories/fixtures de `shared/**`.
- **Prohibido:** conexión a Postgres/Supabase reales, red.
- **Ejemplos de nombre:** `logistics-db.test.ts`, `db-pool-contract.test.ts`
  (parcial, según auditoría §5).
- **Validación esperada:** `pnpm typecheck:test` · `pnpm test`.

### 5.5. `integration/external-services`

- **Qué entra:** adaptadores a servicios externos (Supabase storage/signed-url,
  email, gmail api) ejercitados con **fakes**; nunca red real.
- **Qué NO entra:** llamadas de red vivas a proveedores.
- **Permitido:** fakes/servidores locales de datos, factories de `shared/**`.
- **Prohibido:** endpoints reales de Supabase/SMTP/gmail, credenciales reales.
- **Ejemplos de nombre:** `supabase-signed-url.test.ts`, `supabase-*.test.ts`,
  `email-*.test.ts`.
- **Validación esperada:** `pnpm typecheck:test` · `pnpm test`.

### 5.6. `e2e/flows` (físico en `frontend/e2e/flows`)

- **Qué entra:** specs Playwright que recorren un **flujo de usuario**
  end-to-end.
- **Qué NO entra:** aserciones de layout/interacción puntuales (van a `features`).
- **Permitido:** page objects de `e2e/helpers`, fakes de API (`webServer`),
  fixtures e2e.
- **Prohibido:** backend productivo, datos reales.
- **Ejemplos de nombre:** `dashboard-auth-redirect.spec.ts`,
  `login-hydration.spec.ts`, `public-clinics-b2b-operations.spec.ts`.
- **Validación esperada:** `pnpm --dir frontend e2e:smoke` (y suites `e2e:*`
  relevantes).

### 5.7. `e2e/features` (físico en `frontend/e2e/features`)

- **Qué entra:** specs Playwright que validan un **contrato visual/interacción**
  de una feature.
- **Qué NO entra:** flujos multi-pantalla completos (van a `flows`).
- **Permitido:** page objects, contratos de escenario, snapshots aprobados.
- **Prohibido:** snapshots visuales frágiles en el gate por defecto (ver R6).
- **Ejemplos de nombre:** `admin-mobile-*-no-scroll.spec.ts`,
  `dashboard-*-contract.spec.ts`.
- **Validación esperada:** `pnpm --dir frontend e2e:admin-mobile` /
  `e2e:visual-contract`; visual-regression = **job manual**, no gatea por defecto.

### 5.8. `shared/fixtures`

- **Qué entra:** datos de ejemplo **inmutables y seguros** reutilizables.
- **Qué NO entra:** lógica de construcción (va a `factories`); datos productivos o
  PII.
- **Permitido:** literales sintéticos, JSON/TS estáticos.
- **Prohibido:** `.env` real, secretos reales, emails/nombres de clientes reales.
- **Ejemplos de nombre:** `public-professionals.fixture.ts`,
  `admin-session.fixture.ts`.
- **Validación esperada:** `pnpm typecheck:test` (no ejecutable por sí solo).

### 5.9. `shared/factories`

- **Qué entra:** **Test Data Builders** y **Object Mothers** (construcción de
  datos con `overrides` y defaults seguros).
- **Qué NO entra:** stubs/fakes de colaboradores (van a `mocks`); datos estáticos
  (van a `fixtures`).
- **Permitido:** tipos del dominio/DTO, fixtures de `shared/fixtures`.
- **Prohibido:** I/O, red, dependencia de otro test.
- **Ejemplos de nombre:** `public-professional.factory.ts` (destino de
  `buildPublicProfessionalFixtureRow`), `admin-session.mother.ts`.
- **Validación esperada:** `pnpm typecheck:test` · usado por tests que sí se
  ejecutan.

### 5.10. `shared/mocks`

- **Qué entra:** **stubs**, **fakes** y **spies** reutilizables entre tests.
- **Qué NO entra:** builders de datos (van a `factories`); mocks de interacción
  estricta salvo necesidad real.
- **Permitido:** implementaciones ligeras en memoria, closures que registran
  llamadas.
- **Prohibido:** red real, dependencia de orden global.
- **Ejemplos de nombre:** `fastify-collaborators.stub.ts`,
  `admin-api-server.fake.mjs` (patrón de `admin-populated-api-server.mjs`),
  `audit-writer.spy.ts`.
- **Validación esperada:** `pnpm typecheck:test` · consumido por integración/e2e.

### 5.11. `shared/setup`

- **Qué entra:** bootstrap **idempotente** de entorno de test, `createFastifyTestApp()`
  común, resolución de raíz única.
- **Qué NO entra:** aserciones; lógica de dominio.
- **Permitido:** set de `process.env` con defaults seguros (`??=`), factoría de
  app Fastify de test.
- **Prohibido:** valores reales de secretos; efectos que dependan del orden de
  import.
- **Ejemplos de nombre:** `env.ts`, `fastify-app.ts`, `root-resolve.ts`.
- **Validación esperada:** `pnpm typecheck:test` · elimina la duplicación R3.

### 5.12. Architecture guards (eje transversal)

- **Qué entra:** tests que **leen FS/config y enforcean estructura**, no
  comportamiento.
- **Qué NO entra:** tests de comportamiento de dominio o HTTP.
- **Permitido:** lectura de source/config, glob, registries.
- **Prohibido:** acoplar el resultado al estado del árbol de git en unit tests
  (deuda R4); paths hardcodeados frágiles (deuda R5, a migrar a descubrimiento).
- **Ejemplos de nombre:** `fastify-only-guardrail.test.ts`,
  `logistics-domain-boundary-guard.test.ts`, `*suite-completeness*` (8),
  `toolchain-contract.test.ts`, `package-scripts-contract.test.ts`.
- **Validación esperada:** `pnpm test`.

### 5.13. Security invariants (eje transversal)

- **Qué entra:** aserciones de **fronteras de seguridad** (sesiones, disclosure,
  CORS, IDOR, redaction). Behavioral o registry-driven.
- **Qué NO entra:** lógica de negocio no relacionada con seguridad.
- **Permitido:** aserciones sobre respuestas, headers, cookies, logs redactados.
- **Prohibido:** exponer secretos reales en fixtures; depender de red externa.
- **Ejemplos de nombre:** `security-*.test.ts` (20),
  `api-error-no-secrets-contract.test.ts`,
  `api-error-no-stack-traces-contract.test.ts`,
  `security-session-cookie-boundaries.test.ts`.
- **Validación esperada:** `pnpm test` · `pnpm run security:public-surface`.

### 5.14. Regression guards (eje transversal)

- **Qué entra:** tests que **congelan un contrato ya roto o sensible** (timing,
  last-access, parity).
- **Qué NO entra:** cobertura exploratoria nueva (va a unit/integration).
- **Permitido:** aserciones sobre el contrato congelado, con referencia al
  incidente.
- **Prohibido:** fragilidad platform-locked no justificada.
- **Ejemplos de nombre:** `*runtime-timing-contract.test.ts` (22),
  `*session-last-access-contract.test.ts`,
  `mobile-production-parity-invariants.test.ts`.
- **Validación esperada:** `pnpm test`.

> **Regla de desempate [PROPUESTO]** (un archivo puede tocar varias capas):
> clasificar por el **colaborador de mayor peso de I/O** que ejercita. Orden de
> prioridad: **E2E > External-service > Repository > Controller > Use-case >
> Domain.** Los ejes transversales (security / regression / architecture) se
> **etiquetan además** del tipo, no en vez de él.

> **Caso especial [OBSERVADO] — 147 tests "source-contract" del frontend (R2):**
> hoy leen el `.tsx` y aseveran strings exactos. **No** son unit ni integration
> reales; son **architecture/regression guards del frontend**. Se clasifican como
> `architecture` (si aseveran estructura/imports/boundaries) o quedan como
> **candidatos a reemplazo** por render/e2e tests cuando aseveran comportamiento
> visible. Es deuda explícita, no patrón a replicar (ver §12 y auditoría §10).

---

## 6. Convención de nombres **[PROPUESTO]**

Reglas de nomenclatura estables para navegación y ownership. No renombran nada
hoy; aplican a tests nuevos y a los migrados.

### 6.1. Nombres de archivo

- **Formato:** `kebab-case`, terminación `*.test.ts` (backend) o `*.spec.ts`
  (e2e). Se conserva el sufijo `.fastify.test.ts` para controladores.
- **Prefijo por dominio** cuando aporta: `admin-`, `logistics-`, `public-`,
  `security-`.
- **Sufijos de rol** existentes que se mantienen como norma: `-contract`,
  `-runtime-timing-contract`, `-boundaries`, `-guard`/`-guardrail`,
  `-suite-completeness`.
- **Helpers de `shared/`:** sufijo de patrón explícito —
  `*.factory.ts`, `*.mother.ts`, `*.fixture.ts`, `*.stub.ts`, `*.fake.ts`,
  `*.spy.ts`.

### 6.2. Nombres de `describe`

- Nombra la **unidad bajo test** (módulo, ruta o feature), no el archivo.
  Ej.: `describe("reportAccessToken", ...)`, `describe("POST /auth/login", ...)`.
- Para guards transversales, prefija el eje:
  `describe("[security] session cookie boundaries", ...)`.

### 6.3. Nombres de `it` / `test`

- Enuncian **comportamiento observable**, no implementación. Empiezan por verbo en
  presente: `it("rejects an expired token", ...)`.
- Prohibido enunciar el nombre del método interno o el número de línea.

### 6.4. Estilo Given/When/Then

Se adopta **Given/When/Then** donde aporta claridad al escenario (integración,
e2e, casos de borde de seguridad):

```ts
// Given un admin_session_id válido y un app_session_id ausente
// When se solicita un recurso de dashboard privado
// Then la respuesta es 401 y no setea cache
it("given admin session and no app session, when fetching private dashboard, then returns 401 with no-store", ...)
```

Para unit tests triviales de dominio, AAA plano es suficiente; no forzar GWT.

### 6.5. Factories, Object Mothers, spies, stubs, fakes, dummies

| Rol | Convención de nombre | Ejemplo |
|-----|----------------------|---------|
| **Test Data Builder / factory** | `build<Entidad>` o `<entidad>.factory.ts` con `create<Entidad>(overrides)` | `buildPublicProfessionalFixtureRow` **[OBSERVADO]** |
| **Object Mother** | `<escenario>.mother.ts` con métodos nombrados | `adminSession()`, `clinicWithReports()` |
| **Spy** | `<colaborador>.spy.ts`; instancia `<verbo>Spy` | `auditWriterSpy` |
| **Stub** | `<colaborador>.stub.ts`; instancia `<colaborador>Stub` | `verifyPasswordStub` |
| **Fake** | `<colaborador>.fake.ts(.mjs)`; instancia `<colaborador>Fake` | `adminApiServerFake` (patrón `admin-populated-api-server.mjs`) |
| **Dummy** | prefijo `dummy` / `_unused` | `dummyLogger` |

### 6.6. Page Objects (e2e)

- Un archivo por pantalla/área: `<area>.page.ts` o `<area>-contracts.ts`
  (patrón semilla `e2e/helpers/*-contracts.ts` **[OBSERVADO]**).
- Encapsulan selectores y acciones; **no** contienen aserciones de negocio (esas
  viven en el spec).

---

## 7. Patrones obligatorios / recomendados **[PROPUESTO]**

Anclados en lo que **ya existe** (auditoría §6); no se introduce ninguna
dependencia nueva.

| Patrón | Uso en VETNEB | Estado hoy |
|--------|---------------|-----------|
| **Test Data Builder** | Construir filas/DTOs con `overrides` y defaults seguros | **Ya existe:** `buildPublicProfessionalFixtureRow` **[OBSERVADO]** |
| **Object Mother** | Escenarios nombrados de alto nivel (`adminSession`, `clinicWithReports`) | No existe → `shared/factories` **[PROPUESTO]** |
| **Spy** | Verificar que un efecto (audit write, email) fue invocado | Emular con closures que registran llamadas |
| **Stub** | Colaboradores que devuelven valores fijos para forzar una rama | **Ya existe** ad-hoc en `createTestApp` overrides **[OBSERVADO]** |
| **Mock** | Solo cuando se verifica interacción estricta; preferir stub/fake | Usar con moderación |
| **Fake** | Implementación ligera funcional (DB en memoria, API server) | **Ya existe:** `admin-populated-api-server.mjs`, `buildPublicProfessionalsRouteFixtureStubs` **[OBSERVADO]** |
| **Dummy** | Rellenos que nunca se usan (satisfacer firmas) | Presente implícito en overrides |
| **Page Object Model** | E2E: encapsular selectores/acciones por pantalla | **Semilla:** `e2e/helpers/*-contracts.ts` **[OBSERVADO]** |
| **Screenplay** | Solo si el e2e crece a múltiples actores (clínica/admin/particular) con tareas reutilizables | **Diferir** — over-engineering hoy |
| **AAA** | Estructura estándar de cada `test()` | Adoptar como convención de escritura |
| **FIRST** | Criterio de aceptación de todo test nuevo | R3/R4/R7 hoy violan *Isolated/Repeatable* |

> **Prioridad de adopción [PROPUESTO]:** consolidar **Builder + Fake + Stub** en
> `shared/factories` y `shared/mocks` (ya existen en germen) **antes** de
> introducir Object Mother o Screenplay (aún no justificados por complejidad).

---

## 8. Guardrails VETNEB **[OBSERVADO + PROPUESTO]**

Invariantes que la suite debe preservar. Los marcados **[OBSERVADO]** ya se
vigilan hoy (auditoría §7); los demás son norma a mantener.

1. **No mezclar `admin_session_id` con `app_session_id`.** **[OBSERVADO]** —
   `security-session-cookie-boundaries.test.ts`, `auth-session-boundaries.test.ts`,
   `security-cross-auth-surface-boundaries.test.ts`.
2. **No exponer secrets, tokens, hashes, cookies ni signed URLs.** **[OBSERVADO]**
   — `api-error-no-secrets-contract.test.ts`,
   `security-sensitive-log-redaction-boundaries.test.ts`,
   `security-response-disclosure-boundaries.test.ts`, `supabase-signed-url.test.ts`.
3. **No cachear dashboards privados ni APIs privadas.** **[OBSERVADO]** —
   `backend-api-no-store-cache-contract.test.ts`,
   `frontend-dashboard-server-401-redirect.test.ts`,
   `frontend-pwa-global-operational-contract.test.ts`,
   e2e `dashboard-logout-private-cache.spec.ts`. (Incluye: no stack traces en prod
   — `api-error-no-stack-traces-contract.test.ts`.)
4. **No usar datos productivos reales en fixtures.** **[OBSERVADO]** — datos
   sintéticos (`fixture@example.com`, `test-service-role-key`,
   `https://example.supabase.co`). **[PROPUESTO]** regla que prohíba `.env` real /
   PII en `shared/fixtures`.
5. **No depender de orden global de ejecución.** **[PROPUESTO]** — centralizar el
   bootstrap `??=` de env (R3) en `shared/setup` idempotente; aislar los guards de
   diff (R4).
6. **No depender de red externa en unit tests.** **[PROPUESTO]** — el I/O de red
   solo aparece con **fakes** en `integration/external-services`.
7. **No snapshots visuales frágiles salvo aprobación explícita.** **[OBSERVADO +
   PROPUESTO]** — 30 PNG platform-locked (R6) solo válidos en Chromium/Linux;
   limitar a rutas críticas y correrlos en el job manual
   `visual-regression-manual.yml`, **no** en el gate por defecto.
8. **No modificar CI / deps / lockfiles en PRs de migración mecánica** salvo
   instrucción explícita. **[PROPUESTO]**
9. **No tocar DB / schema / migrations en PRs de organización de tests** salvo
   instrucción explícita. **[PROPUESTO]**

> **Invariante de migración (propio de esta suite) [PROPUESTO]:** ningún PR de
> reorg puede dejar `pnpm test` rojo por desincronizar un **registry de
> completitud** (R5) o un **prefijo de scope-guard** (R4). Todo movimiento
> actualiza su registry/guard **en el mismo PR**.

---

## 9. Reglas para migración incremental **[PROPUESTO]**

Cómo debe moverse un test en PRs futuros (TEST-ARCH-3 en adelante). Principio
VETNEB: **cambio mínimo, verificable, con rollback lógico.**

1. **Un grupo pequeño por PR.** Nunca "big-bang" de los 418 archivos. Subdividir
   por dominio (admin / logistics / public / particular) para mantener el diff
   revertible.
2. **Diff mecánico.** El PR de movimiento **solo mueve**; no reescribe lógica ni
   aserciones. Un rename/move puro.
3. **Sin reescritura funcional en un PR de movimiento.** Cualquier reescritura de
   aserción es un PR aparte, posterior a la migración.
4. **Validar imports.** Tras el move, `pnpm typecheck:test` debe pasar; si un test
   legacy importaba un helper movido, dejar **shim de re-export** en la ubicación
   antigua o actualizar el import en el mismo PR.
5. **Validar `pnpm test`.** Verde obligatorio antes de merge. Actualizar en el
   **mismo PR** los registries de completitud (R5) y los prefijos de scope-guard
   (R4) que anclen los archivos movidos.
6. **Validar `pnpm build`.** El bundle backend no debe verse afectado por
   movimientos de test; confirmarlo.
7. **Documentar rollback lógico.** Cada PR de migración declara su reverso: `git
   restore`/revert del move devuelve los paths a la raíz; los shims de re-export
   mantienen compatibilidad durante la transición.

> **Acotar volumen:** usar `git diff --stat` para verificar que el PR mueve solo
> el grupo previsto. Un archivo untracked bajo `docs/**` (como este) **no**
> dispara los guards de diff, que usan `git diff --name-only` e ignoran untracked.

---

## 10. Matriz de validación por PR **[OBSERVADO]**

**Terminal 1** = raíz `C:\PORTAL-VETNEB`; **Terminal 2** = `frontend`. El git de
escritura lo ejecuta Nico manualmente.

| Tipo de PR | Comandos mínimos | Comandos recomendados | Criterio de merge |
|------------|------------------|-----------------------|-------------------|
| **docs-only** | `git diff --check` · `git diff --name-only` · `pnpm test` · `pnpm build` | `git diff --stat` | Doc aprobado; sin cambios de runtime; suite verde sin tocarla |
| **Movimiento mecánico** | `pnpm typecheck:test` · `pnpm test` · `pnpm build` | `git diff --stat` (acotar volumen) | Suite verde; registries (R5) y scope-guards (R4) actualizados en el mismo PR; sin cambio de aserciones |
| **Factories / mocks / shared helpers** | `pnpm typecheck:test` · `pnpm test` | `git diff --stat` | Aditivo; 0 imports rotos; builders/fakes en un solo lugar |
| **unit/domain** | `pnpm typecheck:test` · `pnpm test` | `pnpm validate:local` | Suite verde y rápida; sin I/O; sin `Fastify` |
| **integration/controller** | `pnpm validate:local` | `pnpm run security:public-surface` | Suite verde; `createFastifyTestApp` centralizado; sin `process.env ??=` duplicado |
| **integration/repository** | `pnpm typecheck:test` · `pnpm test` | `pnpm validate:local` · (si toca schema) `pnpm run schema:verify` | Fakes de DB; sin conexión real |
| **e2e/flow** | `pnpm --dir frontend lint` · `pnpm --dir frontend typecheck` · `pnpm --dir frontend build` · `pnpm --dir frontend e2e:smoke` | `e2e:public-clinic` / `e2e:admin-mobile` según dominio | Specs descubiertos; snapshots re-anclados; job visual manual intacto (si `.next` corrupto, borrar `frontend/.next`) |
| **security / architecture guard** | `pnpm test` · `pnpm run security:public-surface` | (si toca schema) `pnpm run schema:verify` | Preferir aserciones behaviorales; evitar registries frágiles |

Comandos base de inspección (PowerShell, solo lectura):

```powershell
git -C C:\PORTAL-VETNEB status --short --untracked-files=all
git -C C:\PORTAL-VETNEB diff --check
git -C C:\PORTAL-VETNEB diff --stat
git -C C:\PORTAL-VETNEB diff --name-only
```

---

## 11. Orden recomendado posterior **[PROPUESTO]**

Secuencia de PRs habilitada por esta convención (TEST-ARCH-1). Cada uno acota su
volumen y actualiza registries/guards en el mismo PR:

| PR | Objetivo | Riesgo |
|----|----------|--------|
| **TEST-ARCH-2** | Crear índice / README de testing o convención visible si falta (superficie de descubrimiento) | Bajo (docs / aditivo) |
| **TEST-ARCH-3** | Preparar shared test helpers mínimos si aplica: `shared/setup/env.ts`, `shared/setup/fastify-app.ts`, `shared/factories/index.ts` re-exportando builders existentes | Bajo (solo agrega `.ts` no-`.test`) |
| **TEST-ARCH-4** | Migrar `unit/domain` puros (tokens, timing, serializers, pagination) + actualizar registries que los anclen | Medio |
| **TEST-ARCH-5** | Migrar guards de arquitectura / security si aplica | Medio |
| **TEST-ARCH-6** | Migrar `integration/controllers` (`*.fastify.test.ts`) + centralizar `createFastifyTestApp` | Alto (volumen + registries) |
| **TEST-ARCH-7** | Migrar `integration/repositories` / `external-services` si aplica | Medio-alto |
| **TEST-ARCH-8** | Migrar `e2e/flows` (subcarpetas en `frontend/e2e`) si aplica | Alto (scripts + snapshots; requiere autorización para `package.json`) |
| **TEST-ARCH-9** | Closeout documental: actualizar auditoría + esta convención con estado final, deuda restante y allowlist residual | Nulo |

> **Guía de secuenciación:** PRs aditivos (2–3) primero, riesgo casi nulo. Los
> movimientos reales (4–8) acotan volumen y actualizan registries/guards en el
> mismo PR. Cualquiera puede subdividirse por dominio para mantener PRs pequeños y
> revertibles.

---

## 12. Sección "No hacer" **[PROPUESTO]**

Prohibiciones explícitas para todo el bloque TEST-ARCH:

- **No reorganizar todo en un único PR.** Un "big-bang move" de los 418 archivos
  rompería registries (R5) y scope-guards (R4) y dejaría `pnpm test` rojo.
- **No mezclar cambios de runtime con movimientos de tests.** Un PR de reorg de
  tests no toca `server/**` ni `frontend/src/**`.
- **No crear abstracciones de test no usadas.** Nada de Object Mother / Screenplay
  / page objects sin un consumidor real que lo justifique.
- **No cambiar el runner de tests en este bloque.** No introducir `vitest`/`jest`
  ni dependencias nuevas para "ordenar": el runner nativo (`node:test`) ya
  descubre subcarpetas (`test/**`). **[OBSERVADO]**
- **No introducir mutation testing ni contract testing** hasta tener una
  clasificación estable (post TEST-ARCH-9).
- **No mover tests sin actualizar** en el mismo PR su registry de completitud y
  los prefijos de scope-guard.
- **No agregar snapshots visuales al gate por defecto** (R6).
- **No convertir esta convención en refactor:** mover archivos queda **fuera** de
  este PR docs-only.

---

## 13. Deuda explícita heredada de la auditoría **[OBSERVADO]**

Esta convención **no resuelve** —solo enmarca— la deuda inventariada en la
auditoría §10, que se aborda en auditorías/PRs posteriores:

1. **147 tests "source-contract" del frontend (R2):** decidir por archivo si pasan
   a `architecture` guard, se convierten en render/e2e, o se retiran.
2. **Guards de diff (R4):** evaluar reemplazar la dependencia de `git diff` por
   allowlists estáticas o moverlos a CI-only.
3. **Registries de completitud con paths hardcodeados (R5):** evaluar generarlos
   por descubrimiento (glob) en vez de listas manuales.
4. **Snapshots platform-locked (R6):** definir política de visual regression
   (rutas mínimas, entorno único, job manual).
5. **`typecheck:test` acoplado a `server/**` (R8):** evaluar separar el typecheck
   de tests del de runtime.
6. **Bootstrap de env duplicado (R3):** centralizar en `shared/setup` idempotente.

---

*Fin de la convención. Documento normativo docs-only: define la organización
destino de la suite de tests VETNEB sin ejecutar movimientos, imports ni cambios
de runtime. La "convención oficial propuesta" descrita aquí no altera el "estado
actual observado" hasta que un PR de migración posterior la materialice.*
