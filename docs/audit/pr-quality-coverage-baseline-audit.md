# PR-QUALITY-COVERAGE-BASELINE Audit

## Metadata

| Campo | Valor |
| --- | --- |
| Plan | Plan B slot 8/18 |
| PR consolidado | `PR-QUALITY-COVERAGE-BASELINE` |
| Absorbe | `PR-QUALITY-1` |
| Base exacta | `main@5da554cc55776dda275a990f62438fee35df45a9` |
| Rama | `chore/pr-quality-coverage-baseline` |
| Riesgo | R2 medio, autorizado para `package.json`, `test/**` y `docs/**` |
| Lifecycle status | ACTIVE |
| Estado local | `IMPLEMENTED_LOCALLY` |
| Fecha | 2026-07-30 |
| Owner | QA / Tech lead |

## Scope

Incluye un script `test:coverage` separado con cobertura nativa de Node, un contrato focal
positivo, mutaciones negativas en memoria y el baseline real observado.

Excluye dependencias, lockfile, workflows, runtime, frontend, DB, schema, migraciones, auth,
cookies, sesiones, API, Playwright, settings de GitHub y cualquier threshold o enforcement.

## Diagnóstico previo

El árbol estaba limpio en la base exacta y la rama remota partía del mismo commit. No había
stashes listados ni `AGENTS.md` anidados. El script original era literalmente:

```text
node --experimental-strip-types --experimental-specifier-resolution=node --test test/**/*.test.ts
```

`test:coverage` no existía. Node `v24.15.0` expuso
`--experimental-test-coverage` en `node --help`; PNPM observado fue `11.13.0`. El censo previo
encontró la ausencia operativa documentada, pero ningún script o paquete de cobertura activo.

## Implementación

Se agregó:

```text
node --experimental-strip-types --experimental-specifier-resolution=node --experimental-test-coverage --test test/**/*.test.ts
```

El script `test` permaneció idéntico. La implementación usa `node` directamente, conserva el
mismo glob y los mismos flags base, no invoca `pnpm test`, y no contiene pipes, redirecciones,
thresholds, tolerancia de errores ni herramientas externas.

## Metodología y baseline real

`pnpm test:coverage` se ejecutó una sola vez sobre la implementación final.

| Métrica | Valor |
| --- | ---: |
| Node | `v24.15.0` |
| Tests | 4.023 |
| Passed | 4.022 |
| Failed | 0 |
| Skipped | 1 |
| Line coverage | 81,70% |
| Branch coverage | 78,55% |
| Function coverage | 78,74% |
| Duración de pared | 152,9 s |
| Exit code | 0 |

Este baseline es informativo. `thresholds = 0`, `enforcement = 0` y la comparación histórica es
`NOT_AVAILABLE`, porque no existía un baseline previo observado. Los porcentajes no equivalen a
calidad funcional ni constituyen objetivos futuros dentro de este slot.

## Evidencia positiva y negativa

El contrato parsea `package.json` y exige el valor baseline exacto de `scripts.test`, el comando
exacto de `scripts.test:coverage`, invocación directa de Node, una sola aparición del flag de
cobertura, los flags originales, `--test`, el glob exacto y las superficies de dependencias.

Mutaciones locales en memoria demuestran rechazo determinista de `test:coverage` ausente, flag
ausente o duplicado, `test` alterado o convertido en alias, glob alterado, threshold, herramienta
externa, pipe y redirección. No se modificaron archivos reales para producir fallos.

## Validaciones locales

| Gate | Estado | Evidencia |
| --- | --- | --- |
| Contrato focal | PASSED | 2 tests, 2 pass, 0 fail; exit 0 |
| `pnpm audit --prod` | PASSED | Sin vulnerabilidades conocidas; exit 0 |
| `pnpm audit` | PASSED | Sin vulnerabilidades conocidas; exit 0 |
| `pnpm validate:local` | PASSED | typecheck, typecheck:test, 4.023 tests (4.022 pass, 1 skipped, 0 fail) y build; exit 0 |
| `pnpm test:coverage` | PASSED | Baseline anterior; exit 0 |
| DB local / `db:migrate` | NOT_RUN | No seleccionado; el slot no levanta DB |
| Playwright / E2E | NOT_RUN | Sin cambio funcional frontend |
| Frontend build local | NOT_RUN | Sin cambio frontend; el routing remoto aplica por `package.json` |

## Archivos, rollback y riesgo residual

El cambio queda limitado a `package.json`, el contrato focal y fuentes vivas bajo `docs/**`.
`pnpm-lock.yaml`, dependencias, workflows, runtime y frontend permanecen intactos. No se
versionaron outputs de cobertura.

Revertir el commit consolidado del slot elimina el script, el contrato y sus referencias
documentales conjuntamente. No existe migración, dependencia, artifact, dato ni configuración
externa que revertir.

La cobertura nativa continúa marcada experimental por Node y el baseline mide ejecución, no
calidad de assertions ni mutation strength. No existe enforcement ni comparación histórica. El
slot queda `IMPLEMENTED_LOCALLY`; la evidencia remota debe verificarse sobre el head publicado.

Los run IDs y job IDs remotos viven exclusivamente en el body de la PR. Este documento no los
inserta ni requiere un commit posterior para agregarlos.
