# TEST-ARCH-6 - Enterprise integration controller batch

## Estado base

- Entorno: Windows, PowerShell, PNPM.
- Herramienta: Codex.
- Modelo usado: GPT-5 Codex.
- Effort usado: high.
- Rama esperada y observada: `test/enterprise-integration-controller-batch`.
- HEAD observado: `3324186 test(security): move enterprise invariant batch (#1312)`.
- Working tree inicial: limpio (`git status --short --untracked-files=all` sin salida).
- Movimiento fisico minimo: 2 archivos de test.
- Categoria enterprise asignada: `test/integration/adapters/controllers/`.

## Documentos leidos

- `C:\Users\Nico\.codex\attachments\a5262405-b51a-45a3-931f-d4a2173aa420\pasted-text-1.txt`
- `docs/audit/test-suite-enterprise-architecture-audit.md`
- `docs/implementation/test-suite-enterprise-organization-convention.md`
- `test/README.md`
- `docs/implementation/test-arch-3-enterprise-first-unit-domain-batch.md`
- `docs/implementation/test-arch-4-enterprise-architecture-security-guards-batch.md`
- `docs/implementation/test-arch-5-enterprise-security-invariants-batch.md`
- `package.json`

## Scope incluido

- Movimiento fisico minimo de tests claramente clasificables como integration/adapters/controllers.
- Creacion de `test/integration/adapters/controllers/`.
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
- `test/integration/adapters/controllers/` no existia al inicio del lote.
- Se detectaron 29 candidatos `*.fastify.test.ts` en `test/`.
- Los candidatos elegidos usan `Fastify`, `app.inject`, rutas `*.fastify.ts`, stubs locales y datos sinteticos.
- Los candidatos elegidos no requieren DB real, Supabase real, red externa ni credenciales reales.
- `Select-String` no encontro anchors en `test/**` para `admin-system-maintenance.fastify.test.ts` ni `admin-system-health.fastify.test.ts`.
- Las referencias detectadas en `docs/**` son historicas o matrices documentales y quedaron fuera de scope para evitar churn no requerido.

## Candidatos inspeccionados

| Candidato | Categoria evaluada | Decision | Razon |
| --- | --- | --- | --- |
| `test/admin-system-maintenance.fastify.test.ts` | Integration / controller | Elegido | Valida contrato HTTP de `adminSystemMaintenanceNativeRoutes` con `Fastify` y `app.inject`, status codes, CORS, auth admin y payload de dry-run usando stubs locales. |
| `test/admin-system-health.fastify.test.ts` | Integration / controller | Elegido | Valida contrato HTTP de `adminSystemHealthNativeRoutes` con `Fastify` y `app.inject`, status codes, headers CORS, payload de salud y auth admin usando stubs locales. |
| `test/admin-system-schema-health.fastify.test.ts` | Integration / controller | No elegido | Candidato viable, pero se evito incluir schema-health para mantener el lote minimo y no abrir superficie nominal de schema en este PR. |
| `test/reports-status.fastify.test.ts` | Integration / controller | No elegido | Candidato claro, pero esta anclado por varios tests/registries de reports y seguridad; moverlo exigia actualizar demasiadas referencias. |
| `test/public-report-access.fastify.test.ts` | Integration / controller | No elegido | Candidato claro, pero esta anclado por varios tests/registries de reports, storage y seguridad; moverlo exigia actualizar demasiadas referencias. |
| `test/admin-report-workflow.fastify.test.ts` | Integration / controller | No elegido | Candidato viable, pero quedo fuera para mantener el lote en 2 archivos y evitar referencias documentales/security matrix no necesarias. |
| `test/auth.fastify.test.ts` | Integration / controller | No elegido | Candidato claro, pero el archivo es grande y de alta superficie; no era el lote mas bajo riesgo. |
| `test/clinic-public-profile.fastify.test.ts` | Integration / controller | No elegido | Candidato viable, pero mas grande y con multipart/avatar; se priorizaron controladores admin-system mas chicos. |
| `test/auth-authorization-integration.fastify.test.ts` | Integration / controller / cross-route integration | No elegido | Valida integracion entre auth y reports; menos mecanico que un controlador aislado. |
| `test/particular-audit.fastify.test.ts` | Integration / controller | No elegido | Candidato viable, pero se mantuvo el lote minimo en admin-system por menor superficie. |
| `test/clinic-audit.fastify.test.ts` | Integration / controller | No elegido | Candidato viable, pero se mantuvo el lote minimo en admin-system por menor superficie. |

## Candidatos elegidos

| Archivo destino | Categoria asignada | Por que califica |
| --- | --- | --- |
| `test/integration/adapters/controllers/admin-system-maintenance.fastify.test.ts` | `integration/adapters/controllers` | Construye app Fastify controlada, registra una ruta Fastify con stubs y valida request/response, status codes, CORS y auth mediante `app.inject`. |
| `test/integration/adapters/controllers/admin-system-health.fastify.test.ts` | `integration/adapters/controllers` | Construye app Fastify controlada, registra una ruta Fastify con stubs y valida request/response, status codes, headers CORS y payload mediante `app.inject`. |

## Archivos movidos

| Origen | Destino |
| --- | --- |
| `test/admin-system-maintenance.fastify.test.ts` | `test/integration/adapters/controllers/admin-system-maintenance.fastify.test.ts` |
| `test/admin-system-health.fastify.test.ts` | `test/integration/adapters/controllers/admin-system-health.fastify.test.ts` |

## Imports ajustados

| Archivo | Cambio |
| --- | --- |
| `test/integration/adapters/controllers/admin-system-maintenance.fastify.test.ts` | `../server/lib/env.ts` -> `../../../../server/lib/env.ts` |
| `test/integration/adapters/controllers/admin-system-maintenance.fastify.test.ts` | `../server/routes/admin-system-maintenance.fastify.ts` -> `../../../../server/routes/admin-system-maintenance.fastify.ts` |
| `test/integration/adapters/controllers/admin-system-health.fastify.test.ts` | `../server/lib/env.ts` -> `../../../../server/lib/env.ts` |
| `test/integration/adapters/controllers/admin-system-health.fastify.test.ts` | `../server/routes/admin-system-health.fastify.ts` -> `../../../../server/routes/admin-system-health.fastify.ts` |

## Validaciones

Ejecutadas:

| Comando | Resultado |
| --- | --- |
| `git diff --check` | Paso sin salida. |
| `git diff --stat` | Paso. Al no usar `git add`, muestra solo bajas tracked: `test/admin-system-health.fastify.test.ts` y `test/admin-system-maintenance.fastify.test.ts`. |
| `git diff --name-only` | Paso. Al no usar `git add`, muestra solo las 2 bajas tracked esperadas. |
| `git status --short --untracked-files=all` | Paso. Muestra las 2 bajas tracked, los 2 destinos nuevos en `test/integration/adapters/controllers/` y este reporte untracked. |
| `pnpm test` | Primer intento con shim Codex aborto antes del runner por `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`; reejecutado con PNPM 10.8.1 de Corepack (`C:\Program Files\nodejs\pnpm.cmd`) y paso: 2983 tests, 2983 pass, 0 fail. |
| `pnpm build` | Paso con PNPM 10.8.1 de Corepack: `dist/index.js 838.3kb`, `Done in 18ms`. |
| `pnpm security:public-surface` | Paso: `PASS security/public-surface`; mantuvo findings `server-only` esperados para identificadores de cookies en `frontend/src/proxy.ts`. |
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
- El riesgo principal es import relativo incorrecto por nueva profundidad; queda cubierto por `pnpm test`.
- Las referencias en `docs/**` quedan historicas y no afectan el runner.

## Estado final

Working tree con cambios esperados:

- `D test/admin-system-health.fastify.test.ts`
- `D test/admin-system-maintenance.fastify.test.ts`
- `?? docs/implementation/test-arch-6-enterprise-integration-controller-batch.md`
- `?? test/integration/adapters/controllers/admin-system-health.fastify.test.ts`
- `?? test/integration/adapters/controllers/admin-system-maintenance.fastify.test.ts`

Nico conserva stage, commit, push, PR, checks y merge manuales.
