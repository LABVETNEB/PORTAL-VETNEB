# PR-QUALITY-BACKEND-LINT-BASELINE Audit

## Metadata

| Campo | Valor |
| --- | --- |
| Plan | Plan B slot 9/18 |
| PR consolidado | `PR-QUALITY-BACKEND-LINT-BASELINE` |
| Absorbe | `PR-QUALITY-2` |
| Base exacta | `main@360fde6d1d987c5d34af0456b2a68c636ca7f502` |
| Rama | `chore/pr-quality-backend-lint-baseline` |
| Riesgo | R2 medio-alto, autorizado para tooling, lockfile, contrato y documentación |
| Lifecycle status | ACTIVE |
| Estado local | `IMPLEMENTED_LOCALLY` |
| Fecha | 2026-07-30 |
| Owner | Backend / QA / Tech lead |

## Scope y exclusiones

El baseline aplica exclusivamente a archivos JavaScript/TypeScript versionados bajo
`server/**`, `scripts/**` y `drizzle/**`. Agrega una flat config raíz independiente, un comando
explícito, las cinco dependencias de desarrollo mínimas y un contrato focal positivo/negativo.

Quedan excluidos `frontend/**`, `test/**`, runtime productivo, workflows, DB, schema, migraciones,
auth, API, sesiones, cookies, CORS, CSP, Playwright y CI enforcement. No se ejecutó autofix,
`--fix-dry-run`, formateo automático ni edición de findings productivos.

## Diagnóstico y toolchain

La base y la rama remota partían del mismo commit, con árbol limpio, cero stashes observados y
sin `AGENTS.md` anidados. El root no tenía `lint:backend`, `eslint.config.mjs` ni dependencia
directa de ESLint. El frontend ya resolvía ESLint `10.7.0` con configuración Next separada; esa
config no se importa ni se reutiliza.

| Componente | Versión observada o declarada |
| --- | --- |
| Node | `v24.15.0` |
| PNPM | `11.13.0` |
| TypeScript raíz | `^5.9.3` (resuelto `5.9.3`) |
| ESLint raíz | `^10.7.0` |
| `@eslint/js` | `^10.0.1` |
| `@typescript-eslint/parser` | `8.62.0` |
| `@typescript-eslint/eslint-plugin` | `8.62.0` |
| `globals` | `16.4.0` |

No se agregó `eslint-config-next`, Prettier ni plugins de imports, stylistic, unicorn, sonar o
security. PNPM reutilizó resoluciones existentes y agregó un único paquete físico.

## Censo reproducible

El censo usa `git ls-files` y admite `.ts`, `.mts`, `.cts`, `.js`, `.mjs` y `.cjs`; el árbol
observado contiene solo `.ts`, `.mts` y `.mjs` dentro del scope.

| Directorio | Archivos |
| --- | ---: |
| `server/**` | 227 |
| `scripts/**` | 24 |
| `drizzle/**` | 2 |
| **Total** | **253** |

| Extensión | Archivos |
| --- | ---: |
| `.ts` | 230 |
| `.mts` | 5 |
| `.mjs` | 18 |

Se excluyen deliberadamente SQL y JSON de migraciones, PowerShell, Markdown y cualquier otro
archivo sin extensión compatible. Los artefactos `dist`, `coverage`, `playwright-report`,
`test-results` y `node_modules` también están ignorados. No existe exclusión path-by-path de
archivos lintables para fabricar cero findings.

## Configuración y contrato

El script invoca `eslint` directamente con tres globs citados y limitados a las extensiones
observadas. No usa `.`, pipes, redirecciones, tolerancia de fallo, `--fix`, `--fix-dry-run` ni
`--max-warnings=0`.

La flat config usa `ecmaVersion: "latest"`, módulos y globals Node. JavaScript conserva el parser
nativo; TypeScript usa `@typescript-eslint/parser` sin `project` ni `projectService`. Las reglas
recommended core y TypeScript sintácticas se convierten a warnings; en TypeScript se desactiva
la regla base `no-unused-vars` y se activa su equivalente TypeScript.

El contrato conserva literalmente `test` y `test:coverage`, verifica dependencias por presencia
sin congelar el manifiesto completo y ejecuta mutaciones negativas en memoria para scope faltante,
frontend, `.`, glob sin comillas, flags de fix, tolerancia, pipes, redirección, reglas vacías,
alias y cambios de ambos scripts de test.

## Baseline real de findings

| Métrica | Valor |
| --- | ---: |
| Archivos analizados | 253 |
| Errores de configuración/parser | 0 |
| Errors ESLint | 0 |
| Warnings ESLint | 52 |
| Exit code | 0 |
| Duración corrida normal | 8,974 s |
| Duración corrida JSON en memoria | 6,496 s |
| Autofix / archivos reformateados | 0 |

### Findings por regla

| Regla | Warnings |
| --- | ---: |
| `@typescript-eslint/no-unused-vars` | 19 |
| `@typescript-eslint/no-explicit-any` | 13 |
| `no-useless-assignment` | 7 |
| `no-useless-escape` | 5 |
| `no-unused-vars` | 4 |
| `preserve-caught-error` | 2 |
| `no-control-regex` | 1 |
| `no-fallthrough` | 1 |

### Findings por directorio

| Directorio | Archivos | Errors | Warnings |
| --- | ---: | ---: | ---: |
| `server` | 227 | 0 | 43 |
| `scripts` | 24 | 0 | 9 |
| `drizzle` | 2 | 0 | 0 |

Ejemplos sanitizados incluyen imports o constantes no usados, asignaciones inmediatamente
sobrescritas, tipos `any`, escapes redundantes y un fallthrough. Son evidencia diagnóstica; no
se modificó código productivo para reducir el conteo. Cada warning observado está representado
por los agregados anteriores.

## Validaciones locales

| Gate | Estado | Evidencia |
| --- | --- | --- |
| `pnpm audit --prod` | PASSED | Sin vulnerabilidades conocidas; exit 0 |
| `pnpm audit` | PASSED | Sin vulnerabilidades conocidas; exit 0 |
| Contrato focal | PASSED | 2 tests, 2 pass, 0 fail; exit 0 |
| `pnpm lint:backend` | PASSED | 253 archivos, 0 errors, 52 warnings; exit 0 |
| `pnpm validate:local` | PASSED | typecheck, typecheck:test, 4.025 tests (4.024 pass, 1 skipped) y build; exit 0 |
| `pnpm --dir frontend lint` | PASSED | exit 0 |
| `pnpm --dir frontend typecheck` | PASSED | exit 0 |
| `pnpm --dir frontend build` | PASSED | Next.js 16.2.11, 25 páginas; exit 0 |
| `pnpm security:public-surface` | PASSED | 0 findings públicos; exit 0 |
| Playwright local | NOT_RUN | Excluido explícitamente |
| DB local / `db:migrate` | NOT_RUN | Excluido explícitamente |
| `test:coverage` | NOT_RUN | Baseline del slot 08, no gate de este cambio |

## Rollback y riesgo residual

Revertir el único commit del slot elimina conjuntamente dependencias directas, lockfile, script,
config, contrato y referencias documentales. No existe migración, dato, workflow, setting remoto
ni artefacto generado que revertir.

El riesgo residual son 52 warnings conocidos sin enforcement. El comando diagnóstico puede pasar
con warnings; errores de configuración o parser siguen fallando. Mutation, complejidad,
duplicación, dead-code, reglas frontend pendientes y cualquier threshold o gate CI quedan fuera
de scope. Los run IDs y job IDs remotos viven exclusivamente en el body de la PR.
