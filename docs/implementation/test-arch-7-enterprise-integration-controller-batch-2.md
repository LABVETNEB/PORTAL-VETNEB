# TEST-ARCH-7 - Enterprise integration controller batch 2

## Estado base

- Entorno: Windows, PowerShell, PNPM.
- Herramienta: Codex.
- Modelo usado: GPT-5 Codex.
- Effort usado: high.
- Rama esperada y observada: `test/enterprise-integration-controller-batch-2`.
- HEAD observado: `1d47a9d test(integration): move controller batch (#1313)`.
- Working tree inicial: limpio (`git status --short --untracked-files=all` sin salida).
- Movimiento fisico minimo: 2 archivos de test.
- Categoria enterprise asignada: `test/integration/adapters/controllers/`.

## Documentos leidos

- `C:\Users\Nico\.codex\attachments\2bd623c1-1ded-4015-b419-ca141c13e365\pasted-text-1.txt`
- `docs/audit/test-suite-enterprise-architecture-audit.md`
- `docs/implementation/test-suite-enterprise-organization-convention.md`
- `test/README.md`
- `docs/implementation/test-arch-3-enterprise-first-unit-domain-batch.md`
- `docs/implementation/test-arch-4-enterprise-architecture-security-guards-batch.md`
- `docs/implementation/test-arch-5-enterprise-security-invariants-batch.md`
- `docs/implementation/test-arch-6-enterprise-integration-controller-batch.md`
- `package.json`
- `frontend/package.json`

## Regla de lote aplicada

- Categoria del PR: `integration/controllers`.
- Regla operativa aplicada: mover 2 a 3 tests maximo.
- Decision: mover 2 archivos para mantener el lote minimo y no ampliar superficie aunque habia mas candidatos potenciales.
- No se mezclaron categorias enterprise.

## Scope incluido

- Segundo movimiento fisico minimo de tests claramente clasificables como `integration/adapters/controllers`.
- Uso del destino permitido: `test/integration/adapters/controllers/`.
- Movimiento de 2 archivos `*.fastify.test.ts`.
- Ajustes minimos de imports relativos afectados por la nueva profundidad.
- Creacion de esta nota de entrega requerida por protocolo VETNEB.

## Scope excluido

- No runtime.
- No cambios funcionales de produccion.
- No cambios de assertions.
- No `package.json`.
- No `pnpm-lock.yaml`.
- No dependencias.
- No CI/workflows.
- No backend runtime.
- No DB, schema ni migraciones.
- No auth, roles, permisos, cookies, CSRF, CSP ni rate limits.
- No stashes.
- No `.claude/worktrees`.
- No helpers, factories, mocks ni abstracciones nuevas.
- No tests que requieran DB real, Supabase real, red externa o env productivo.
- No e2e/UI tests.
- No repository/persistence tests.
- No security/architecture/unit/domain tests en este PR.

## Auditoria previa

Confirmaciones:

- El glob `test/**/*.test.ts` descubre tests en subcarpetas sin tocar scripts.
- `test/tsconfig.json` admite codigo anidado bajo `test/`.
- `test/integration/adapters/controllers/` ya existia por TEST-ARCH-6.
- Se detectaron 29 archivos `*.fastify.test.ts` bajo `test/`, incluyendo 2 ya migrados en el lote anterior.
- Los candidatos elegidos usan `Fastify`, `app.inject`, rutas `*.fastify.ts`, stubs locales y datos sinteticos.
- Los candidatos elegidos no requieren DB real, Supabase real, red externa ni credenciales reales.
- `Select-String` no encontro anchors en `test/**` para `admin-system-schema-health.fastify.test.ts` ni `admin-report-workflow.fastify.test.ts`.
- Las referencias detectadas en `docs/**` son historicas, matrices documentales o reporte del lote anterior y quedaron fuera de scope para evitar churn documental no requerido.
- `package.json` y `frontend/package.json` confirman scripts nativos reales para las validaciones ejecutadas.
- Un intento amplio de inventario con `Get-ChildItem -Recurse -Include` entro en `frontend/node_modules` y agoto tiempo por rutas inaccesibles; la inspeccion se acoto correctamente a `test/`, que es el scope del PR.

## Candidatos inspeccionados

| Candidato | Categoria evaluada | Decision | Razon |
| --- | --- | --- | --- |
| `test/admin-system-schema-health.fastify.test.ts` | Integration / controller | Elegido | Valida contrato HTTP de `adminSystemSchemaHealthNativeRoutes` con `Fastify` y `app.inject`, status codes, CORS, auth admin y payload de schema health usando snapshot stub local. |
| `test/admin-report-workflow.fastify.test.ts` | Integration / controller | Elegido | Valida contrato HTTP de `adminReportWorkflowNativeRoutes` con `Fastify` y `app.inject`, GET/PATCH, status codes, CORS, auth admin, auditoria y payloads usando stubs locales. |
| `test/reports-status.fastify.test.ts` | Integration / controller | No elegido | Candidato claro, pero tiene anchors en registries/guards de reports y seguridad; moverlo exigia actualizar demasiadas referencias en este lote. |
| `test/public-report-access.fastify.test.ts` | Integration / controller | No elegido | Candidato claro, pero tiene anchors en reports, storage y security guards; moverlo ampliaba el scope. |
| `test/clinic-public-profile.fastify.test.ts` | Integration / controller | No elegido | Candidato viable, pero tiene anchors en storage suite y mayor superficie por avatar/multipart; no era el lote mas mecanico. |
| `test/auth-authorization-integration.fastify.test.ts` | Integration / controller / cross-route integration | No elegido | Valida integracion entre auth y reports; menos mecanico que un controlador aislado. |
| `test/particular-audit.fastify.test.ts` | Integration / controller | No elegido | Candidato viable, pero tiene anchors en audit/security guards; moverlo exigia coordinar registries. |
| `test/clinic-audit.fastify.test.ts` | Integration / controller | No elegido | Candidato viable, pero tiene anchors en audit/security guards; moverlo exigia coordinar registries. |

## Candidatos elegidos

| Archivo destino | Categoria asignada | Por que califica |
| --- | --- | --- |
| `test/integration/adapters/controllers/admin-system-schema-health.fastify.test.ts` | `integration/adapters/controllers` | Construye app Fastify controlada, registra una ruta Fastify con stubs y valida request/response, status codes, CORS, auth y payloads mediante `app.inject`. |
| `test/integration/adapters/controllers/admin-report-workflow.fastify.test.ts` | `integration/adapters/controllers` | Construye app Fastify controlada, registra una ruta Fastify con stubs y valida request/response, status codes, CORS, auditoria y mutaciones mediante `app.inject`. |

## Archivos movidos

| Origen | Destino |
| --- | --- |
| `test/admin-system-schema-health.fastify.test.ts` | `test/integration/adapters/controllers/admin-system-schema-health.fastify.test.ts` |
| `test/admin-report-workflow.fastify.test.ts` | `test/integration/adapters/controllers/admin-report-workflow.fastify.test.ts` |

## Imports ajustados

| Archivo | Cambio |
| --- | --- |
| `test/integration/adapters/controllers/admin-system-schema-health.fastify.test.ts` | `../server/lib/env.ts` -> `../../../../server/lib/env.ts` |
| `test/integration/adapters/controllers/admin-system-schema-health.fastify.test.ts` | `../server/routes/admin-system-schema-health.fastify.ts` -> `../../../../server/routes/admin-system-schema-health.fastify.ts` |
| `test/integration/adapters/controllers/admin-report-workflow.fastify.test.ts` | `../server/lib/env.ts` -> `../../../../server/lib/env.ts` |
| `test/integration/adapters/controllers/admin-report-workflow.fastify.test.ts` | `../server/lib/audit.ts` -> `../../../../server/lib/audit.ts` |
| `test/integration/adapters/controllers/admin-report-workflow.fastify.test.ts` | `../server/routes/admin-report-workflow.fastify.ts` -> `../../../../server/routes/admin-report-workflow.fastify.ts` |
| `test/integration/adapters/controllers/admin-report-workflow.fastify.test.ts` | `../server/db-report-workflow.ts` -> `../../../../server/db-report-workflow.ts` |

## Validaciones ejecutadas

| Comando | Resultado |
| --- | --- |
| `git diff --check` | Paso sin salida antes del reporte. Revalidado al final del lote. |
| `git diff --stat` | Paso. Al no usar `git add`, muestra solo bajas tracked de los 2 archivos movidos; los destinos nuevos se ven en `git status`. |
| `git diff --name-only` | Paso. Al no usar `git add`, muestra solo las 2 bajas tracked esperadas. |
| `git status --short --untracked-files=all` | Paso. Muestra las 2 bajas tracked, los 2 destinos nuevos en `test/integration/adapters/controllers/` y este reporte untracked. |
| `pnpm typecheck:test` | Primer intento con shim Codex aborto antes del script por `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`; reejecutado con PNPM 10.8.1 de Corepack (`C:\Program Files\nodejs\pnpm.cmd`) y paso. |
| `pnpm test` | Paso con PNPM 10.8.1 de Corepack: 2983 tests, 2983 pass, 0 fail. |
| `pnpm build` | Paso con PNPM 10.8.1 de Corepack: `dist/index.js 838.3kb`, `Done in 16ms`. |
| `pnpm security:public-surface` | Paso: `PASS security/public-surface`; sin public devtools exposure findings; mantuvo findings `server-only` esperados para identificadores de cookies en `frontend/src/proxy.ts`. |
| `pnpm --dir frontend lint` | Paso. |
| `pnpm --dir frontend typecheck` | Paso. |
| `pnpm --dir frontend build` | Paso. |

## Confirmacion de scope

- No se toco runtime (`server/**`, `frontend/src/**`).
- No se tocaron deps, lockfile, package manifests, CI, DB, schema, migrations, stashes ni `.claude/worktrees`.
- No se cambiaron assertions ni logica de tests.
- El cambio es mecanico: mover 2 tests a `test/integration/adapters/controllers/`, ajustar paths relativos y documentar el lote.

## Riesgo residual

- Bajo. Los dos tests elegidos no tenian anchors en `test/**`.
- El riesgo principal es import relativo incorrecto por nueva profundidad; queda cubierto por `pnpm typecheck:test` y `pnpm test`.
- Las referencias en `docs/**` quedan historicas o documentales y no afectan el runner.

## Estado final

Working tree con cambios esperados:

- `D test/admin-report-workflow.fastify.test.ts`
- `D test/admin-system-schema-health.fastify.test.ts`
- `?? docs/implementation/test-arch-7-enterprise-integration-controller-batch-2.md`
- `?? test/integration/adapters/controllers/admin-report-workflow.fastify.test.ts`
- `?? test/integration/adapters/controllers/admin-system-schema-health.fastify.test.ts`

Nico conserva stage, commit, push, PR, checks y merge manuales.
