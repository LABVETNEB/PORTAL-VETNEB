# VETNEB Enterprise Test Suite

Punto de entrada operativo para la suite de tests de Portal VETNEB. Este README es
un **índice**: dice dónde vivirá cada test y cómo decidir su ubicación en los PRs
de migración futuros. **No es** la convención completa (ver Fuentes normativas) ni
una segunda especificación.

> **[OBSERVADO]** La migración física todavía **no** comenzó.
> **[OBSERVADO]** Los tests existentes siguen en sus ubicaciones actuales
> (directorio plano `test/*.test.ts`; único subdirectorio real hoy: `test/helpers/`).
> **[PROPUESTO]** Este README define el punto de entrada para migraciones futuras.
> La existencia de este archivo **no** implica que ningún test ya esté migrado.

---

## 1. Propósito

`test/` será el destino **incremental** de la suite enterprise. Los tests se mueven
archivo por archivo, en PRs pequeños y revertibles, sin reescritura funcional. Hasta
que un PR de migración lo cambie, el estado plano actual sigue siendo válido.

## 2. Fuentes normativas

Este índice **resume**; la norma vinculante está en:

- [`docs/audit/test-suite-enterprise-architecture-audit.md`](../docs/audit/test-suite-enterprise-architecture-audit.md) — diagnóstico y plan.
- [`docs/implementation/test-suite-enterprise-organization-convention.md`](../docs/implementation/test-suite-enterprise-organization-convention.md) — convención oficial (606 líneas). **Fuente de verdad.**

Ante cualquier discrepancia, mandan esos documentos, no este README.

## 3. Estructura objetivo **[PROPUESTO]**

Ninguna de estas carpetas existe hoy salvo `test/helpers/`. Se adoptan por PR:

```
test/
├── unit/
│   ├── domain/
│   └── use-cases/
├── integration/
│   ├── adapters/
│   │   ├── controllers/
│   │   └── repositories/
│   └── external-services/
├── e2e/
│   ├── flows/
│   └── features/
└── shared/
    ├── fixtures/
    ├── factories/
    ├── mocks/
    └── setup/
```

> **Nota [OBSERVADO]:** `test/e2e/` es conceptual. El e2e físico permanece en
> `frontend/e2e` (tiene su propio `playwright.config.ts`, `webServer` y snapshots);
> `flows/` y `features/` se adoptan como subcarpetas dentro de `frontend/e2e`.

## 4. Cómo decidir dónde va un test

| Categoría | Propósito | Dependencia permitida | Dependencia prohibida |
|-----------|-----------|-----------------------|-----------------------|
| `unit/domain` | Reglas puras (tokens, timing, permissions, pagination, serializers) | `node:assert`, módulo bajo test, `shared/**`, fakes en memoria | `fastify`, DB/red real, `fs` runtime, `git` |
| `unit/use-cases` | Orquestación de casos de uso (application layer) | Dominio puro, fakes/stubs de puertos, `shared/**` | `app.inject()`, red, DB real |
| `integration/adapters/controllers` | Rutas Fastify vía `app.inject()` (`*.fastify.test.ts`) | `fastify`, `createFastifyTestApp()`, stubs, `shared/**` | Red externa real, DB productiva, Playwright |
| `integration/adapters/repositories` | Acceso a datos / `infrastructure` con fake de DB | Fakes de cliente de datos, `shared/**` | Postgres/Supabase reales, red |
| `integration/external-services` | Adaptadores externos (Supabase, email, gmail) con fakes | Fakes/servidores locales, `shared/**` | Endpoints reales, credenciales reales |
| `e2e/flows` | Flujo de usuario end-to-end (Playwright) | Page objects, `webServer` fake, fixtures e2e | Backend productivo, datos reales |
| `e2e/features` | Contrato visual/interacción de una feature | Page objects, contratos, snapshots aprobados | Snapshots frágiles en el gate por defecto |
| `shared/fixtures` | Datos de ejemplo inmutables y seguros | Literales sintéticos, JSON/TS estáticos | `.env` real, secretos/PII reales |
| `shared/factories` | Test Data Builders / Object Mothers | Tipos de dominio/DTO, `shared/fixtures` | I/O, red, dependencia de otro test |
| `shared/mocks` | Stubs / fakes / spies reutilizables | Implementaciones ligeras en memoria, closures | Red real, orden global |
| `shared/setup` | Bootstrap idempotente de env, app Fastify de test, root-resolve | `process.env ??=` con defaults seguros | Secretos reales, efectos por orden de import |
| Architecture guard *(eje)* | Enforcea estructura leyendo FS/config, no comportamiento | Lectura de source/config, glob, registries | Acoplar a estado del árbol git (R4), paths frágiles (R5) |
| Security invariant *(eje)* | Fronteras de seguridad (sesiones, disclosure, CORS, IDOR, redaction) | Aserciones sobre respuestas/headers/cookies/logs | Secretos reales en fixtures, red externa |
| Regression guard *(eje)* | Congela un contrato roto/sensible (timing, last-access, parity) | Aserciones sobre el contrato congelado | Fragilidad platform-locked injustificada |

> **Desempate:** clasificar por el colaborador de mayor peso de I/O.
> Orden: **E2E > External-service > Repository > Controller > Use-case > Domain**.
> Los ejes (security / regression / architecture) se **etiquetan además** del tipo.

## 5. Reglas rápidas para PRs futuros

- Un grupo pequeño por PR (subdividir por dominio: admin / logistics / public / particular).
- No mezclar movimientos con reescrituras funcionales: un move es solo rename/move.
- No mover tests junto con cambios de runtime (`server/**`, `frontend/src/**`).
- No tocar CI / deps / lockfiles salvo instrucción explícita.
- Validar `pnpm test` y `pnpm build` (verde obligatorio antes de merge).
- Actualizar registries de completitud (R5) y prefijos de scope-guard (R4) en el **mismo PR**.
- Rollback lógico claro: `git restore`/revert devuelve los paths; los shims de re-export mantienen compatibilidad.

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
pnpm test
pnpm build
git diff --check
git diff --stat
git diff --name-only
```

## 8. Próximos PRs

- **TEST-ARCH-3:** identificar el primer lote mínimo — helpers/factories/mocks
  compartidos o `unit/domain` puro — y prepararlo de forma aditiva.
- **TEST-ARCH-4+:** migraciones mecánicas por categoría, sin mezclar runtime,
  acotando volumen y actualizando registries/guards en cada PR.
