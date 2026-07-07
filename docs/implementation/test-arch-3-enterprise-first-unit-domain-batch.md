# TEST-ARCH-3 - Primer lote unit/domain enterprise

## Estado base

- Entorno: Windows, PowerShell, PNPM.
- Rama activa: `test/enterprise-first-unit-domain-batch`.
- HEAD observado: `472e04c docs(test): add enterprise test suite index (#1309)`.
- Working tree inicial: limpio (`git status --short --untracked-files=all` sin salida).
- Runner backend observado: `pnpm test` usa `node --experimental-strip-types --experimental-specifier-resolution=node --test test/**/*.test.ts`.
- `test/` inicial solo tenia `helpers/` como subdirectorio.

## Scope incluido

- Primer movimiento fisico minimo de tests hacia estructura enterprise.
- Categoria asignada: `test/unit/domain/`.
- Se movieron 2 archivos de test claramente unit/domain.
- Se ajustaron solo imports relativos afectados por el cambio de profundidad.
- Se creo esta nota de entrega requerida por protocolo VETNEB.

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

## Auditoria previa

Documentos leidos:

- `docs/audit/test-suite-enterprise-architecture-audit.md`
- `docs/implementation/test-suite-enterprise-organization-convention.md`
- `test/README.md`

Confirmaciones:

- El glob `test/**/*.test.ts` descubre tests en subcarpetas sin tocar scripts.
- `test/tsconfig.json` ya admite codigo anidado bajo `test/`.
- `runtime-timing.test.ts` y `rate-limit-store.test.ts` importan solo `node:test`, `node:assert/strict` y modulos puros de `server/lib`.
- No usan HTTP/server real.
- No usan DB real, Supabase ni red.
- No dependen de `.env` real ni credenciales.
- No requieren fixtures complejas.
- No se detectaron referencias hardcodeadas a `test/runtime-timing.test.ts` ni `test/rate-limit-store.test.ts` en los registries revisados.

Candidatos inspeccionados:

- `report-access-token.test.ts`: seguro como unit/domain, pero no elegido porque `reports-suite-completeness.test.ts` ancla `test/report-access-token.test.ts` y moverlo exigia tocar registry.
- `particular-token.test.ts`: seguro como unit/domain, pero no elegido porque `reports-suite-completeness.test.ts` ancla `test/particular-token.test.ts` y moverlo exigia tocar registry.
- `report-access-token-serializers.test.ts`: seguro como unit/domain, no elegido para mantener el primer lote mas chico.
- `logistics-pagination.test.ts`: seguro como unit/domain, no elegido porque existen notas historicas con `test/logistics-pagination.test.ts` como path exacto y no era necesario abrir ese frente en el primer lote.
- `runtime-timing.test.ts`: elegido por bajo riesgo, sin path hardcodeado detectado y sin I/O.
- `rate-limit-store.test.ts`: elegido por bajo riesgo, sin path hardcodeado detectado y con harness in-memory.

## Cambios

Archivos movidos:

| Origen | Destino |
| --- | --- |
| `test/runtime-timing.test.ts` | `test/unit/domain/runtime-timing.test.ts` |
| `test/rate-limit-store.test.ts` | `test/unit/domain/rate-limit-store.test.ts` |

Imports ajustados:

| Archivo | Cambio |
| --- | --- |
| `test/unit/domain/runtime-timing.test.ts` | `../server/lib/runtime-timing.ts` -> `../../../server/lib/runtime-timing.ts` |
| `test/unit/domain/rate-limit-store.test.ts` | `../server/lib/rate-limit-store.ts` -> `../../../server/lib/rate-limit-store.ts` |

## Validaciones

Ejecutadas:

| Comando | Resultado |
| --- | --- |
| `git diff --check` | Paso sin salida. |
| `git diff --stat` | Paso. Al no usar `git add`, muestra solo bajas tracked: `test/rate-limit-store.test.ts` y `test/runtime-timing.test.ts`. |
| `git diff --name-only` | Paso. Al no usar `git add`, muestra solo bajas tracked: `test/rate-limit-store.test.ts` y `test/runtime-timing.test.ts`. |
| `git status --short --untracked-files=all` | Paso. Muestra las 2 bajas tracked y las 3 rutas nuevas untracked esperadas. |
| `pnpm test` | Paso: 2983 tests, 2983 pass, 0 fail. |
| `pnpm build` | Paso: `dist/index.js 838.3kb`, build completado. |
| `pnpm security:public-surface` | Paso. Reejecutado luego de `frontend build`; sin findings de exposicion publica. |
| `pnpm --dir frontend lint` | Paso. |
| `pnpm --dir frontend typecheck` | Paso. |
| `pnpm --dir frontend build` | Paso. |

## Resultado

Primer lote fisico enterprise aplicado con 2 tests unit/domain movidos a
`test/unit/domain/`. El runner nativo descubre los nuevos paths y la suite
completa queda verde.

## Riesgo residual

- Bajo. El cambio es mecanico y limitado a 2 tests puros.
- El riesgo principal es import relativo incorrecto por nueva profundidad; queda cubierto por `pnpm test`.
- No se actualizaron registries porque los dos archivos elegidos no estaban anclados por path en la auditoria previa.

## Estado final

Working tree con cambios esperados:

- `D test/rate-limit-store.test.ts`
- `D test/runtime-timing.test.ts`
- `?? docs/implementation/test-arch-3-enterprise-first-unit-domain-batch.md`
- `?? test/unit/domain/rate-limit-store.test.ts`
- `?? test/unit/domain/runtime-timing.test.ts`

Nico conserva stage, commit, push, PR, checks y merge manuales.
