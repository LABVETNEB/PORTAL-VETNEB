# TEST-ARCH-4 - Enterprise architecture/security guards batch

## Estado base

- Entorno: Windows, PowerShell, PNPM.
- Rama esperada: `test/enterprise-architecture-security-guards-batch`.
- HEAD observado: `c6abbcb test(architecture): move first enterprise test batch (#1310)`.
- Working tree inicial: limpio (`git status --short --untracked-files=all` sin salida).
- Movimiento fisico minimo: 3 archivos de test.
- Categoria enterprise asignada: `test/architecture/`.

## Documentos normativos leidos

- `docs/audit/test-suite-enterprise-architecture-audit.md`
- `docs/implementation/test-suite-enterprise-organization-convention.md`
- `test/README.md`
- `docs/implementation/test-arch-3-enterprise-first-unit-domain-batch.md`

## Scope incluido

- Segundo movimiento fisico minimo de tests hacia estructura enterprise.
- Se priorizaron architecture guards sobre security invariants porque habia candidatos 100% seguros, sin imports relativos ni registries de test anclando sus paths.
- Se creo `test/architecture/`.
- Se movieron 3 tests claramente clasificables como architecture guards.
- No hubo ajustes de imports porque los tres tests resuelven el repo desde `process.cwd()` y no importan modulos relativos.
- Se creo esta nota de entrega requerida por protocolo VETNEB.

## Scope excluido

- No runtime.
- No cambios funcionales de produccion.
- No cambios de assertions.
- No `package.json`.
- No `pnpm-lock.yaml`.
- No dependencias.
- No CI/workflows.
- No DB, schema ni migraciones.
- No stashes.
- No `.claude/worktrees`.
- No helpers, factories, mocks ni abstracciones nuevas.
- No tests que requieran HTTP real, DB real, Supabase, red externa o env productivo.

## Candidatos inspeccionados

| Candidato | Categoria evaluada | Decision | Razon |
| --- | --- | --- | --- |
| `test/fastify-only-guardrail.test.ts` | Architecture guard | Elegido | Valida frontera Fastify-only, ausencia de Express directo, tipos Node y documentacion/config; usa FS local desde `process.cwd()` y no requiere runtime real. |
| `test/logistics-domain-boundary-guard.test.ts` | Architecture guard | Elegido | Valida pureza de `server/features/logistics/domain` y consumo del barrel publico; guard estatico/semiestatico, sin HTTP, DB, red ni env productivo. |
| `test/toolchain-contract.test.ts` | Architecture guard | Elegido | Valida pin de PNPM/Node y orden de setup del workflow backend como contrato de toolchain; lectura local de config, sin tocar CI. |
| `test/package-scripts-contract.test.ts` | Architecture guard | No elegido | Candidato viable, pero se mantuvo el lote en 3 archivos y se prefirieron guards mas directamente alineados con arquitectura/runtime boundaries. |
| `test/security-session-cookie-boundaries.test.ts` | Security invariant | No elegido | Candidato claro, pero su path esta anclado por registries/guards de seguridad; moverlo exigia actualizar varios paths coordinados. |
| `test/security-boundary-suite-completeness.test.ts` | Security invariant / suite completeness | No elegido | Candidato claro, pero es un registry de completitud que ancla la suite security; moverlo ampliaba el alcance mas que los architecture guards seguros. |

## Candidatos elegidos

| Archivo | Categoria asignada | Por que califica |
| --- | --- | --- |
| `test/architecture/fastify-only-guardrail.test.ts` | Architecture guard | Enforcea estructura backend Fastify-only, dependencias prohibidas y separacion backend/frontend leyendo archivos fuente/config. |
| `test/architecture/logistics-domain-boundary-guard.test.ts` | Architecture guard | Enforcea limites de import, capas y barrel publico del dominio logistics. |
| `test/architecture/toolchain-contract.test.ts` | Architecture guard | Enforcea contrato de toolchain y workflow backend sin ejecutar CI ni modificar configuracion. |

## Archivos movidos

| Origen | Destino |
| --- | --- |
| `test/fastify-only-guardrail.test.ts` | `test/architecture/fastify-only-guardrail.test.ts` |
| `test/logistics-domain-boundary-guard.test.ts` | `test/architecture/logistics-domain-boundary-guard.test.ts` |
| `test/toolchain-contract.test.ts` | `test/architecture/toolchain-contract.test.ts` |

## Imports ajustados

- Ninguno.
- Confirmacion: los tres archivos movidos usan imports de Node (`node:test`, `node:assert/strict`, `node:fs`, `node:path`) y resuelven archivos del repo con `process.cwd()`.
- `Select-String` sobre los archivos movidos no encontro imports relativos que ajustar.

## Registries y anchors

- `Select-String` sobre `test/**/*.test.ts` no encontro referencias a:
  - `fastify-only-guardrail.test.ts`
  - `logistics-domain-boundary-guard.test.ts`
  - `toolchain-contract.test.ts`
- No se actualizaron registries porque no habia anchors de test que bloquearan estos tres movimientos.
- Referencias historicas en `docs/**` quedaron fuera de scope para evitar churn documental no requerido.

## Razon de fallback

- No aplica.
- Habia tres candidatos architecture guard 100% seguros, asi que no se uso fallback `test/unit/domain/`.

## Validaciones ejecutadas

| Comando | Resultado |
| --- | --- |
| `git diff --check` | Paso sin salida. |
| `git diff --stat` | Paso. Al no usar `git add`, muestra solo bajas tracked: `test/fastify-only-guardrail.test.ts`, `test/logistics-domain-boundary-guard.test.ts` y `test/toolchain-contract.test.ts`. |
| `git diff --name-only` | Paso. Al no usar `git add`, muestra solo las 3 bajas tracked esperadas. |
| `git status --short --untracked-files=all` | Paso. Muestra las 3 bajas tracked, los 3 destinos nuevos en `test/architecture/` y este reporte untracked. |
| `pnpm test` | Primer intento con shim Codex aborto antes del runner por `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`; reejecutado con PNPM 10.8.1 de Corepack (`C:\Program Files\nodejs\pnpm.cmd`) y paso: 2983 tests, 2983 pass, 0 fail. |
| `pnpm build` | Paso con PNPM 10.8.1 de Corepack: `dist/index.js 838.3kb`, `Done in 16ms`. |

## Confirmacion de scope

- No se toco runtime (`server/**`, `frontend/src/**`).
- No se tocaron deps, lockfile, package manifests, CI, DB, schema, migrations, stashes ni `.claude/worktrees`.
- No se cambiaron assertions ni logica de tests.
- El cambio es mecanico: mover 3 tests a `test/architecture/` y documentar el lote.
