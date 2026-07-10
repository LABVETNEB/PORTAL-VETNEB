# VETNEB Enterprise Test Suite

Punto de entrada operativo para la suite de tests de Portal VETNEB. Este README es
un **índice**: dice dónde vive cada familia de tests y cómo decidir su ubicación en
PRs futuros. **No es** la convención completa (ver Fuentes normativas) ni una
segunda especificación.

> **[OBSERVADO]** La migración física de tests raíz fue completada por el bloque
> TEST-ARCH root migration.
> **[OBSERVADO]** `test/*.test.ts` queda en **0**.
> **[OBSERVADO]** Los tests antes ubicados en raíz ahora viven en carpetas
> enterprise bajo `test/architecture/**` y `test/unit/**`.

---

## 1. Propósito

`test/` es el destino operativo de la suite enterprise. Los tests se organizan por
tipo de contrato y por el colaborador de mayor peso de I/O, sin mezclar movimientos
con cambios funcionales de runtime.

La raíz `test/*.test.ts` debe permanecer vacía. Cualquier test nuevo debe ubicarse
directamente en una carpeta enterprise apropiada, o agregarse junto con una
justificación explícita en el PR.

## 2. Fuentes normativas

Este índice **resume**; la norma vinculante está en:

- [`docs/audit/test-suite-enterprise-architecture-audit.md`](../docs/audit/test-suite-enterprise-architecture-audit.md) — diagnóstico y plan.
- [`docs/implementation/test-suite-enterprise-organization-convention.md`](../docs/implementation/test-suite-enterprise-organization-convention.md) — convención oficial. **Fuente de verdad.**

Ante cualquier discrepancia, mandan esos documentos, no este README.

## 3. Estructura objetivo adoptada

La raíz `test/*.test.ts` queda vacía. Las carpetas enterprise se adoptan como ubicación canónica:

```text
test/
|-- architecture/
|   |-- database/
|   `-- security/
|-- unit/
|   |-- domain/
|   |-- infrastructure/
|   `-- ui/
|-- integration/
|   |-- adapters/
|   |   |-- controllers/
|   |   `-- repositories/
|   `-- external-services/
|-- security/
`-- helpers/
```

> **Nota [OBSERVADO]:** `test/e2e/` es conceptual. El e2e físico permanece en
> `frontend/e2e` (tiene su propio `playwright.config.ts`, `webServer` y snapshots);
> `flows/` y `features/` se adoptan como subcarpetas dentro de `frontend/e2e`
> cuando corresponda.

## 4. Cómo decidir dónde va un test

| Categoría | Propósito | Dependencia permitida | Dependencia prohibida |
|-----------|-----------|-----------------------|-----------------------|
| `unit/domain` | Reglas puras (tokens, timing, permissions, pagination, serializers) | `node:assert`, módulo bajo test, `shared/**`, fakes en memoria | `fastify`, DB/red real, `fs` runtime, `git` |
| `unit/use-cases` | Orquestación de casos de uso (application layer) | Dominio puro, fakes/stubs de puertos, `shared/**` | `app.inject()`, red, DB real |
| `unit/ui/frontend` | Contratos estáticos de UI/frontend | Lectura de source, componentes, CSS, config frontend | Red, navegador real, snapshots frágiles |
| `integration/adapters/controllers` | Rutas Fastify vía `app.inject()` (`*.fastify.test.ts`) | `fastify`, `createFastifyTestApp()`, stubs, `shared/**` | Red externa real, DB productiva, Playwright |
| `integration/adapters/repositories` | Acceso a datos / `infrastructure` con fake de DB | Fakes de cliente de datos, `shared/**` | Postgres/Supabase reales, red |
| `integration/external-services` | Adaptadores externos (Supabase, email, gmail) con fakes | Fakes/servidores locales, `shared/**` | Endpoints reales, credenciales reales |
| `e2e/flows` | Flujo de usuario end-to-end (Playwright) | Page objects, `webServer` fake, fixtures e2e | Backend productivo, datos reales |
| `e2e/features` | Contrato visual/interacción de una feature | Page objects, contratos, snapshots aprobados | Snapshots frágiles en el gate por defecto |
| `helpers` | Setup y utilidades existentes compartidas | Helpers idempotentes, fakes y utilidades reutilizables | Estado global frágil, red real, secretos |
| Architecture guard *(eje)* | Enforcea estructura leyendo FS/config, no comportamiento | Lectura de source/config, registries | Paths legacy de raíz, acoplamiento al árbol git como fuente única |
| Security invariant *(eje)* | Fronteras de seguridad (sesiones, disclosure, CORS, IDOR, redaction) | Aserciones sobre respuestas/headers/cookies/logs/source | Secretos reales en fixtures, red externa |
| Regression guard *(eje)* | Congela un contrato roto/sensible (timing, last-access, parity) | Aserciones sobre el contrato congelado | Fragilidad platform-locked injustificada |

> **Desempate:** clasificar por el colaborador de mayor peso de I/O.
> Orden: **E2E > External-service > Repository > Controller > Use-case > Domain**.
> Los ejes (security / regression / architecture) se **etiquetan además** del tipo.

## 5. Reglas rápidas para PRs futuros

- No agregar tests en raíz (`test/*.test.ts` debe seguir en 0).
- Un grupo pequeño por PR (subdividir por dominio: admin / logistics / public / particular).
- No mezclar movimientos con reescrituras funcionales: un move es solo rename/move.
- No mover tests junto con cambios de runtime (`server/**`, `frontend/src/**`).
- No tocar CI / deps / lockfiles salvo instrucción explícita.
- Validar `pnpm test`, `pnpm build` y `pnpm security:public-surface` antes de mergear.
- Actualizar registries de completitud y referencias documentales cuando un path canónico cambie.
- Rollback lógico claro: `git restore`/revert devuelve los paths y referencias del PR.

## 6. Guardrails VETNEB

Invariantes que ningún PR de reorg puede violar:

- No mezclar `admin_session_id` con `app_session_id`.
- No exponer secrets, tokens, hashes, cookies ni signed URLs.
- No usar fixtures con datos productivos reales (solo sintéticos/seguros).
- No cachear dashboards privados ni APIs privadas.
- No depender de red externa en unit tests (I/O solo con fakes en `integration/external-services`).
- No depender de orden global de ejecución.
- No snapshots visuales frágiles sin aprobación explícita (job manual, no el gate por defecto).

## 7. Comandos mínimos

```powershell
git diff --check
git diff --stat
git diff --name-only
pnpm test
pnpm build
pnpm security:public-surface
```

## 8. Estado post root migration

El bloque TEST-ARCH root migration dejó el repositorio en este contrato:

- `test/*.test.ts`: 0 archivos.
- Tests raíz históricos migrados:
  - `test/architecture/security/global-auth-boundary-contract.test.ts`
  - `test/unit/ui/frontend/frontend-visual-consistency.test.ts`
  - `test/architecture/database/reconcile-public-profile-db-contract.test.ts`
  - `test/architecture/security/security-boundary-suite-completeness.test.ts`
  - `test/architecture/security/security-docs-matrix-drift-guard.test.ts`
- Validaciones de cierre:
  - `pnpm test`
  - `pnpm build`
  - `pnpm security:public-surface`
