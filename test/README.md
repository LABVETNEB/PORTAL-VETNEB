# VETNEB Enterprise Test Suite

Índice operativo de la suite de tests de Portal VETNEB. La norma vinculante está en [`docs/implementation/test-suite-enterprise-organization-convention.md`](../docs/implementation/test-suite-enterprise-organization-convention.md).

> **Estado consolidado:** la migración física de tests raíz fue completada. `test/*.test.ts` debe permanecer en **0**.

---

## 1. Contrato operativo

- Todo test backend ejecutable vive bajo una carpeta canónica de `test/**`.
- El runner `pnpm test` descubre recursivamente `test/**/*.test.ts`.
- Los helpers no ejecutables viven en `test/helpers/**` y no usan el sufijo `*.test.ts`.
- Playwright permanece físicamente en `frontend/e2e/**`.
- Un movimiento actualiza imports, registries, censos, paths y docs en el mismo PR.
- No se mezclan reorganizaciones con cambios de runtime.

---

## 2. Fuentes documentales

1. [`docs/implementation/test-suite-enterprise-organization-convention.md`](../docs/implementation/test-suite-enterprise-organization-convention.md) — **fuente normativa vigente**.
2. [`docs/audit/test-suite-enterprise-architecture-audit.md`](../docs/audit/test-suite-enterprise-architecture-audit.md) — diagnóstico y antecedentes.
3. Documentos `docs/implementation/test-arch-*.md` — evidencia histórica de cada bloque de migración.

Ante una discrepancia, prevalece la convención oficial vigente.

---

## 3. Estructura canónica

```text
test/
├── architecture/
│   ├── database/
│   └── security/
├── integration/
│   ├── adapters/
│   │   ├── controllers/
│   │   └── repositories/
│   └── external-services/
├── security/
├── unit/
│   ├── contracts/
│   ├── domain/
│   ├── infrastructure/
│   ├── migrations/
│   └── ui/
└── helpers/
```

Las carpetas se subdividen por dominio cuando aporta ownership: `admin`, `clinic`, `dashboard`, `frontend`, `logistics`, `particular`, `pricing`, `public`, `public-professionals`, `reports`, `study-tracking`, entre otros.

### E2E

```text
frontend/e2e/
├── helpers/
├── flows/       # opcional, para flujos multi-pantalla
├── features/    # opcional, para contratos de una feature
└── *.spec.ts
```

No se duplica Playwright bajo `test/e2e`.

---

## 4. Dónde ubicar un test

| Categoría | Uso canónico |
|---|---|
| `architecture/**` | Guards de estructura, filesystem, source, imports, configuración, registries y censos |
| `architecture/database/**` | Contratos estructurales de persistencia y reconciliación |
| `architecture/security/**` | Registries y fronteras estáticas/transversales de seguridad |
| `unit/domain/**` | Reglas puras sin I/O: tokens, serializers, timing, permisos, paginación y agregaciones |
| `unit/contracts/**` | Políticas y contratos aislados de rutas, middleware, sesiones y superficies por dominio |
| `unit/infrastructure/**` | Tooling, config, logging, email aislado, scripts y middleware con fakes |
| `unit/migrations/**` | Contratos estáticos de migraciones y schemas |
| `unit/ui/**` | Contratos estáticos de frontend, componentes, CSS, layout, configuración y source |
| `integration/adapters/controllers/**` | Fastify mediante `app.inject()` |
| `integration/adapters/repositories/**` | Acceso a datos con clientes fake o memoria |
| `integration/external-services/**` | Supabase, email, Gmail u otros proveedores mediante fakes |
| `security/**` | Invariantes conductuales de seguridad que cruzan componentes |
| `helpers/**` | Fixtures, factories, stubs, fakes, spies, setup y utilidades compartidas |
| `frontend/e2e/**` | Navegador real, responsive, navegación, scroll, accesibilidad y visual/interacción |

### Desempate

Clasificar por el colaborador de mayor peso de I/O:

**E2E > servicio externo > repository > controller > infraestructura/contrato > dominio.**

Los ejes `security`, `architecture` y `regression` complementan la clasificación; no justifican dejar un archivo fuera de la estructura canónica.

---

## 5. Reglas rápidas para PRs

- No agregar tests en `test/` raíz.
- No duplicar un test para conservar un path legacy.
- No mover tests junto con cambios en `server/**` o `frontend/src/**`.
- No reescribir assertions en un PR de movimiento mecánico.
- No tocar runner, CI, dependencias ni lockfiles sin autorización explícita.
- Actualizar registries, suite-completeness, censos y referencias documentales cuando cambia un path.
- Los censos deben ser recursivos y los registries deben usar rutas canónicas completas.
- Validar búsqueda de referencias legacy antes de cerrar el PR.

---

## 6. Guardrails VETNEB

- No mezclar `admin_session_id` con `app_session_id`.
- No exponer secrets, tokens, hashes, cookies, signed URLs ni stack traces productivos.
- No cachear dashboards privados ni APIs privadas.
- No usar fixtures con datos productivos reales.
- No depender de producción, staging, credenciales reales o red externa.
- No depender del orden global de ejecución.
- No debilitar IDOR, tenant isolation, CORS, trusted-origin, rate limits ni redacción de logs.
- No agregar snapshots visuales frágiles al gate general por defecto.

---

## 7. Comandos mínimos

```powershell
git diff --check
git diff --stat
git diff --name-only
pnpm typecheck:test
pnpm test
pnpm build
pnpm security:public-surface
```

Para cambios de frontend o E2E, agregar lint, typecheck, build y la suite Playwright focal correspondiente.

<!-- quality-gate-taxonomy:start -->
_Generated from `scripts/governance/quality-gate-impact-policy.mjs`. Do not edit this block manually._

| Suite ID | Purpose | Gate | Package scope | Commands | Representative paths | Requirement |
| --- | --- | --- | --- | --- | --- | --- |
| `backend-build` | Backend production bundle check. | `backend-ci` (conditional, non-required) | `root` | `pnpm build` | `server/**`<br>`package.json` | `mandatory` |
| `backend-test-typecheck` | TypeScript contract for the Node test suite. | `backend-ci` (conditional, non-required) | `root` | `pnpm typecheck:test` | `test/**/*.test.ts`<br>`test/tsconfig.json` | `mandatory` |
| `backend-tests` | Recursive Node test suite for backend, architecture, security, contracts and static frontend source contracts. | `backend-ci` (conditional, non-required) | `root` | `pnpm test` | `test/**/*.test.ts` | `mandatory` |
| `backend-typecheck` | TypeScript contract for backend runtime and shared test-facing types. | `backend-ci` (conditional, non-required) | `root` | `pnpm typecheck` | `server/**`<br>`test/**/*.test.ts`<br>`tsconfig.json` | `mandatory` |
| `frontend-build` | Next.js production build contract. | `frontend-ci` (conditional, non-required) | `frontend` | `pnpm --dir frontend build` | `frontend/**`<br>`frontend/package.json` | `conditional` |
| `frontend-e2e-ci` | Single catalog-backed Playwright invocation for the complete frontend CI browser gate. | `frontend-ci` (conditional, non-required) | `frontend` | `pnpm --dir frontend e2e:ci` | `frontend/e2e/**`<br>`frontend/src/**` | `conditional` |
| `frontend-lint` | ESLint contract for the Next.js frontend workspace. | `frontend-ci` (conditional, non-required) | `frontend` | `pnpm --dir frontend lint` | `frontend/**` | `conditional` |
| `frontend-typecheck` | TypeScript contract for the Next.js frontend workspace. | `frontend-ci` (conditional, non-required) | `frontend` | `pnpm --dir frontend typecheck` | `frontend/**` | `conditional` |
| `public-surface-audit` | Audit of the built public surface for unintended devtools exposure. | `frontend-ci` (conditional, non-required) | `root` | `pnpm security:public-surface` | `frontend/**`<br>`scripts/security/**` | `conditional` |
<!-- quality-gate-taxonomy:end -->

---

## 8. Estado post-migración

Contrato vigente:

- `test/*.test.ts`: **0 archivos**.
- `unit/contracts`, `unit/infrastructure`, `unit/migrations` y `unit/ui` son categorías oficiales.
- `architecture/database` y `architecture/security` son subdivisiones oficiales.
- `helpers` es la ubicación canónica del soporte compartido existente.
- `frontend/e2e` es la ubicación física exclusiva de Playwright.
- El glob recursivo de `pnpm test` cubre las carpetas backend sin scripts adicionales.
- Los registries/censos no pueden depender de una raíz plana ni de basenames ambiguos.

La deuda de diseño de algunos source-contracts, registries manuales o fixtures duplicadas se trata en PRs separados; no cambia esta taxonomía física.
