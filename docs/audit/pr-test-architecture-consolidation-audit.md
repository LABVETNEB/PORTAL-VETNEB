# PR-TEST-ARCHITECTURE-CONSOLIDATION Audit

## Metadata

| Campo | Valor |
| --- | --- |
| Fecha | 2026-07-30 |
| Plan | Plan B slot 7/18 |
| PR consolidado | `PR-TEST-ARCHITECTURE-CONSOLIDATION` |
| Absorbe | `PR-TEST-ARCH-1`, `PR-TEST-ARCH-2`, `PR-TEST-ARCH-3` |
| Base | `main@c40c92f8415418f42ee4733671379eb72774ae70` |
| Rama | `test/pr-test-architecture-consolidation` |
| Scope | test-only + docs soporte |
| Riesgo | R1 medio-alto |
| Estado | IMPLEMENTED_LOCALLY |

## Baseline

La rama remota autorizada partió exactamente del SHA base, con working tree limpio,
diff vacío y cuatro stashes históricos preservados. En ese HEAD existían 517 archivos
`*.test.ts`, ninguno en `test/` raíz.

## Scope incluido y excluido

Se incluyen el censo reproducible, la clasificación de acoplamientos, la migración
del soporte de report access y public professionals, el walker recursivo canónico,
contratos positivos/negativos y documentación. Se excluyen runtime, `server/**`,
`frontend/**`, Drizzle, DB, schema, migraciones, dependencias, manifiestos,
lockfiles, workflows, Playwright, settings, el trío `reports`/`admin-reports`/
`reports-status` y `TEST-ARCH-15-b`.

## Metodología y definiciones

El baseline se obtuvo con `rg --files`, `git grep` sobre el SHA base para imports
`node:fs` y `rg` para `readdirSync`. El criterio source-coupled es conservador:
todo test ejecutable que importa `node:fs`.

- `LEGITIMATE_GUARD`: source, filesystem, registry o configuración es el objeto.
- `ACCIDENTAL_COUPLING`: un test funcional depende innecesariamente de forma física.
- `MIXED`: combina conducta e inspección, o usa un censo que debe consolidarse.

El inventario path por path está en el
[anexo exhaustivo](./pr-test-architecture-consolidation-source-coupled-inventory.md).

## Inventario exacto

| Métrica | Baseline | Resultado local |
| --- | ---: | ---: |
| `*.test.ts` | 517 | 518 |
| `test/*.test.ts` | 0 | 0 |
| Tests source-coupled (`node:fs`) | 370 | 371 |
| `LEGITIMATE_GUARD` baseline | 332 | n/a |
| `MIXED` baseline | 38 | n/a |
| `ACCIDENTAL_COUPLING` confirmado | 0 | 0 |
| `MIGRATE_TO_CANONICAL_HELPER` | 2 | 2 migrados |
| Ocurrencias textuales `readdirSync` | 134 | 135 |
| Archivos con `readdirSync` | 64 | 65 |

Las 134 ocurrencias baseline mezclan imports, 69 llamadas ejecutables y un
sentinel regex. El resultado agrega un sentinel negativo, por lo que el conteo
textual no equivale a deuda. Se preservan walkers recursivos correctos y
enumeraciones inmediatas donde profundidad 1 es contractual.

## Decisiones

| Decisión | Alcance |
| --- | --- |
| `KEEP` | Guards legítimos, walkers recursivos existentes y enumeraciones inmediatas deliberadas |
| `MIGRATE_TO_CANONICAL_HELPER` | `login-rate-limit-ux-safety` y `frontend-visual-consistency` |
| `OUT_OF_SCOPE` | Trío reports protegido, `TEST-ARCH-15-b`, runtime, CI, dependencias y Playwright |

## Implementación

- Report access se separa en fixture inmutable y factory configurables.
- Public professionals se separa en factory de datos y mock conductual.
- Todos los imports apuntan a `test/fixtures`, `test/factories` o `test/mocks`;
  no quedan shims, duplicados ni rutas legacy.
- `listSourceFiles(root, options)` recorre un root explícito, ordena, normaliza
  `/`, filtra extensiones, excluye generados, no sigue symlinks y falla si falta
  el root. El inventario tracked conserva su API y deriva el repo de
  `import.meta.url`, sin `cwd` implícito.

## Evidencia positiva y negativa local

La fixture temporal prueba raíz, nested y deep, orden estable, `/`, exclusión de
`node_modules`/`dist` y filtro `.ts`. La enumeración plana de control solo ve el
archivo raíz; un root inexistente falla; `.txt` no entra; las rutas legacy no
existen; y reaparecer imports legacy o walkers ad hoc en los dos censos
migrados hace fallar el contrato.

## Archivos modificados

El diff queda limitado a `test/**` y `docs/**`: soporte canónico, consumidores,
contratos, helper de source files, este closeout y sus índices.

## Validaciones

| Gate | Estado |
| --- | --- |
| Selección focal, 71 tests | PASSED |
| Meta-guards diagnósticos tras corrección, 26 tests | PASSED |
| `pnpm validate:local` (`typecheck`, `typecheck:test`, 4.019 pass + 1 skip, build) | PASSED |
| Frontend lint/typecheck/build | NOT_RUN |
| Playwright | NOT_RUN |
| `security:public-surface` | NOT_RUN |
| Schema/migrations | NOT_RUN |
| Dependency audit | NOT_RUN |

## Riesgo residual y rollback

Los guards source-based legítimos siguen sensibles a cambios físicos por diseño.
Si una enumeración inmediata pasa a cubrir un árbol deberá migrarse. Cobertura,
mutation testing y `TEST-ARCH-15-b` siguen separados. El rollback consiste en
revertir el único commit consolidado; no toca runtime, datos ni configuración.

## Estado del slot

Implementación, focales y validación general local completas. Los run IDs, job IDs y resultados
remotos finales viven exclusivamente en el body de la PR.
