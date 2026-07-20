# M11 — Guard de frontera application, suite global de casos de uso y cierre de Fase B (Logistics)

> Estado: **cerrado al merge (#1507)**. Squash SHA `bb320297df290cb64249ddf4eba4209967b18cfc`.
> **Fase B cerrada al merge de M11 (#1507).**
> M11 y la Fase B quedan cerrados: PR #1507 fusionado y `main` verde en ese SHA.

---

## 1. Base exacta

| Ítem | Valor |
|---|---|
| Rama base | `main` |
| HEAD / base | `04e6681de8ee220f66f6c6049df36a6796314a55` |
| Último commit | `04e6681 refactor(logistics): extract route-events application use cases (#1506)` |
| PR previo | **#1506 — MERGED**, squash SHA `04e6681de8ee220f66f6c6049df36a6796314a55` |
| Rama de trabajo | `test/backend-modularization-m11-logistics-application-phase-closeout` |
| Working tree inicial | limpio |
| Índice inicial | vacío |
| PRs abiertos al iniciar | 0 |

Instrucciones aplicables: `AGENTS.md` raíz (única superficie; `git ls-files "*AGENTS.md"`
devuelve una sola entrada). Rector del programa:
[`docs/audit/backend-enterprise-modularization-program-audit.md`](../audit/backend-enterprise-modularization-program-audit.md).

## 2. Autorización

Implementación **R2** autorizada explícitamente por Nico para esta tarea, acotada a una
allowlist cerrada de cinco paths. La autorización no se generaliza a ninguna tarea posterior
(`AGENTS.md` §3). Todas las escrituras Git/GitHub (stage, commit, push, creación de PR, merge,
`gh pr checks --watch`) quedan **[MANUAL-NICO]**: no se ejecutó ninguna.

## 3. Definición de M11 en el rector

- §8, secuencia de Fase B: `**M11** guard application + suite UCs + closeout de capa.`
- §7 Bloque 2, PR 19 → **M11**: `Sin framework de fakes paralelo; stubs por Options = fixture canónica`, prueba = `unit application nuevos`.
- §7 Bloque 2, PR 20 → **M11**: `Guard de dependencias application + closeout`, guard = `nuevo`, rollback = `revert`.
- §13 Architecture Guards: `application sin FastifyRequest/Reply ni infra concreta` · ubicación `<ctx>-application-boundary-guard` · patrón `node:test + readFileSync + regex de import — sin deps`.
- §12 Test Strategy, capa Aplicación: `por caso de uso: orden de puertos, errores, idempotencia; fakes tipados`.
- §10 R-12 (`Test insuficiente en capa application nueva`), PR responsable **M11**, señal de bloqueo `UC sin test de integración correlativo`.
- §18 DoD por fase: `censo de legacy = 0 · suite completa verde · guard endurecido · sección de docs del contexto actualizada · anotación en este documento (tabla §8) del estado real`.

## 4. Alcance exacto — cinco paths

| # | Path | Estado |
|---|---|---|
| 1 | `test/architecture/logistics-application-boundary-guard.test.ts` | **NUEVO** |
| 2 | `test/unit/application/logistics/logistics-application-use-case-suite-completeness.test.ts` | **NUEVO** |
| 3 | `docs/implementation/m11-logistics-application-phase-closeout.md` | **NUEVO** |
| 4 | `server/features/logistics/application/README.md` | MODIFICADO |
| 5 | `docs/audit/backend-enterprise-modularization-program-audit.md` | MODIFICADO |

## 5. Exclusiones respetadas (denylist)

No se modificó ninguno de: `server/routes/**` · `server/fastify-app.ts` · `server/db.ts` ·
`server/db-logistics.ts` · `server/features/logistics/application/*.ts` productivos ·
`server/features/logistics/application/ports/**` · `server/features/logistics/domain/**` ·
`server/features/logistics/infrastructure/**` · `server/lib/**` · `drizzle/**` ·
`migrations/**` · `frontend/**` · `package.json` · `frontend/package.json` ·
`pnpm-lock.yaml` · `pnpm-workspace.yaml` · `scripts/**` · `.github/**` ·
`test/architecture/audit-suite-completeness.test.ts` · `test/architecture/security/**` ·
`test/architecture/logistics-domain-boundary-guard.test.ts` · los nueve tests unitarios de
application existentes · los cuatro contratos source-anchored de Logistics · dependencias ·
CI/workflows · cualquier alcance M12+.

## 6. Inventario de application M06–M10 (estado auditado en HEAD)

19 archivos versionados: 10 top-level (9 módulos de caso de uso + barrel) y 9 puertos.

| Módulo | Factory | Operaciones | Puerto | Composición (adapter) | Test unitario | Origen |
|---|---|---|---|---|---|---|
| `list-overdue-active-sla-instances.ts` | `createListOverdueActiveSlaInstances` | 1 | `LogisticsSlaReadRepository` | `logistics-sla.fastify.ts` | `list-overdue-active-sla-instances.test.ts` | M06 |
| `route-plans-read-use-cases.ts` | `createRoutePlansReadUseCases` | `listRoutePlans`, `getRoutePlan`, `listRoutePlanStops` | `LogisticsRoutePlansReadRepository` | `logistics-route-plans.fastify.ts` | `route-plans-read-use-cases.test.ts` | M07 |
| `generate-heuristic-route-plan.ts` | `createGenerateHeuristicRoutePlan` | 1 | `LogisticsRoutePlanGenerator` | `logistics-route-plans.fastify.ts` | `generate-heuristic-route-plan.test.ts` | M07 |
| `route-plans-write-use-cases.ts` | `createRoutePlansWriteUseCases` | `createRoutePlan`, `updateRoutePlan` | `LogisticsRoutePlansWriteRepository` | `logistics-route-plans.fastify.ts` | `route-plans-write-use-cases.test.ts` | M08 |
| `route-stops-write-use-cases.ts` | `createRouteStopsWriteUseCases` | `createRouteStop`, `updateRouteStop` | `LogisticsRouteStopsWriteRepository` | `logistics-route-plans.fastify.ts` | `route-stops-write-use-cases.test.ts` | M08 |
| `cancel-route-plan.ts` | `createCancelRoutePlan` | 1 | `LogisticsRoutePlanCancelRepository` | `logistics-route-plans.fastify.ts` | `cancel-route-plan.test.ts` | M08 |
| `update-field-visit.ts` | `createUpdateFieldVisit` | 1 | `LogisticsFieldVisitUpdateRepository` | `logistics-field-visits.fastify.ts` | `update-field-visit.test.ts` | M09 |
| `create-route-event.ts` | `createCreateRouteEvent` | 1 | `LogisticsRouteEventWriteRepository` | `logistics-route-events.fastify.ts` | `create-route-event.test.ts` | M10 |
| `route-events-read-use-cases.ts` | `createRouteEventsReadUseCases` | `listRouteEvents`, `listRoutePlanEvents`, `pollRouteEvents` | `LogisticsRouteEventsReadRepository` | `logistics-route-events.fastify.ts` | `route-events-read-use-cases.test.ts` | M10 |

Imports externos en la capa: **cero**. Los nueve módulos importan exactamente un
`import type` a su puerto; los nueve puertos no importan nada; el barrel sólo re-exporta
relativos. Las cuatro rutas consumidoras importan **por el barrel** `application/index.ts`.

### Gap que M11 cierra

La frontera estaba fijada por **nueve listas literales** `APPLICATION_FILES`, una por test de
milestone, con `FORBIDDEN_IMPORT_RULES` duplicado nueve veces. Consecuencias: (a) un archivo
nuevo en la capa no quedaba cubierto por ningún contrato hasta agregarlo a mano; (b) nada
obligaba a que las nueve copias de reglas coincidieran; (c) no existía contrato que exigiera
que todo caso de uso tuviera test, ni que el consumo fuera por el barrel. Ningún guard del
repositorio referenciaba `test/unit/application/**`.

## 7. Artefacto 1 — Guard global de frontera

`test/architecture/logistics-application-boundary-guard.test.ts`

Mecanismo: `node:test` + `node:assert/strict` + `node:fs` + `node:path` + `node:url`, helpers
locales, **sin dependencias nuevas**. Clona el patrón validado por
`logistics-domain-boundary-guard.test.ts`.

**Discovery.** `walkTsFiles` recursivo sobre `server/features/logistics/application`: cubre
módulos de caso de uso, `ports/**`, `index.ts` y cualquier subdirectorio futuro. **No usa lista
literal de archivos.**

**Imports permitidos (cerrado).** Sólo: (1) imports relativos que resuelvan dentro de
`server/features/logistics/application/**`; (2) el barrel público de dominio
`server/features/logistics/domain/index.ts`, en forma value o type-only.

**Imports prohibidos.** Todo lo demás, por *default-deny*: la clasificación devuelve violación
para cualquier objetivo que no esté en la lista de permitidos, y las reglas sólo aportan la
etiqueta precisa. Etiquetas: `fastify` · `routes` · `server/db` · `db-*` concreto ·
`drizzle-orm` · `drizzle/**` (incluido `drizzle/schema`) · `infrastructure` · `server/lib` ·
auth/session/CORS/audit/email concretos · `supabase` · `frontend` · `env` ·
`fs`/`http`/`https`/`process` (con y sin prefijo `node:`) · archivo interno de `domain`
distinto del barrel · import relativo fuera de la capa · bare specifier no permitido.

**Type-only.** El guard **no exime** los `import type`: `drizzle/schema` queda prohibido
también como tipo. La capa habla con tipos estructurales genéricos o con el barrel público de
dominio, nunca con tipos del schema de persistencia.

**Formas de import cubiertas.** Las cinco del contrato: `import … from`, `export … from`,
`import()`, `require()`, `import "…"`. Verificadas por un auto-test del parser con fuentes
sintéticas locales (sin fixtures en otros archivos).

**Falsos positivos.** Un escáner de fuente local produce dos vistas: sin comentarios (para
extraer specifiers) y sólo-código (para patrones de runtime). Además registra los rangos de
literales y **descarta coincidencias que arrancan dentro de un string** — de modo que una
constante como `'import "supabase"'` no se contabiliza como import. El interior de las
interpolaciones `${…}` de un template **sí** se conserva como código, para que un template no
sirva de bypass de `process.*`.

**Resolución de relativos.** `.ts` explícito, extensión implícita, `index.ts` implícito, saltos
con `..` y separadores normalizados a `/` (Windows incluido). Verificado por auto-test.

**Patrones de fuente prohibidos.** `process.<prop>`, `fetch(` y accesos directos al filesystem
(`readFileSync`, `writeFileSync`, `existsSync`, `readdirSync`, `createReadStream`, …).

**Puertos.** Los archivos de `ports/**` no pueden exportar funciones, clases, valores
(`const`/`let`/`var`) ni `default`, ni instanciar clases, ni ejecutar side-effects. **No se
exige que tengan cero imports**: pueden importar tipos dentro de la capa o del barrel de
dominio, pero no runtime ni infraestructura.

**Consumo por barrel.** Escanea `server/**` excluyendo la propia capa: cualquier import que
resuelva bajo `application/` debe resolver **exactamente** a `application/index.ts`. Prohíbe
importar `update-field-visit.ts`, `create-route-event.ts`, `ports/**` o cualquier otro archivo
interno. **No** prohíbe que los adapters importen el barrel.

**Formato de violaciones.** Acumulación + `assert.deepEqual(violations, [])`, con entradas
`archivo: regla ("specifier")` — el formato canónico del rector §13.

**Violaciones observadas en HEAD: cero.** El guard es verde sin tocar un solo archivo
productivo.

## 8. Artefacto 2 — Suite global de casos de uso

`test/unit/application/logistics/logistics-application-use-case-suite-completeness.test.ts`

Es un **contrato de inventario**, no un runner agregador.

**No es un runner.** No importa ni reejecuta los nueve tests unitarios, no lanza procesos, no
invoca PNPM y no ejecuta tests hijos. `pnpm test` ya los descubre por glob
(`node --test test/**/*.test.ts`), de modo que un runner agregador sólo duplicaría la ejecución
y el conteo. Un test propio del archivo verifica esta propiedad: comprueba que su fuente no
contiene `spawn/exec/fork`, ni la cadena `pnpm`, ni `run({…})`, y que no importa ningún módulo
relativo del repositorio.

**Discovery dinámico (todo por `fs`).** Módulos top-level de application (excluido `index.ts`);
puertos de `ports/*.ts`; tests de `test/unit/application/logistics/*.test.ts` (excluido este
propio archivo); rutas `server/routes/logistics-*.fastify.ts`; exports del barrel por parseo de
`index.ts`.

**Censo.** Se asserta un **piso documentado** de la Fase B (≥ 9 módulos, ≥ 9 tests, ≥ 9
puertos, ≥ 9 factories) para impedir que la suite pase en vacío; el mapeo en sí es dinámico, de
modo que un caso de uso futuro no obliga a editar este archivo.

**Contratos verificados.**

1. Cada módulo de caso de uso tiene su test correlativo `<mismo-basename>.test.ts`.
2. No hay tests huérfanos (todo test corresponde a un módulo existente).
3. Cada **value export** del barrel (las factories) resuelve a un módulo descubierto y aparece
   referenciado en su test correlativo. El parseo distingue value exports de type exports
   (`export { X, type Y } from …` frente a `export type { … } from …`) y resuelve alias `as`.
4. Cada factory pública se compone **exactamente una vez** en el conjunto de rutas de
   Logistics. El conteo corre sobre la vista sólo-código: no cuentan imports sin invocación,
   strings, comentarios ni nombres parecidos. No se exige que cada método retornado por una
   factory se componga por separado.
5. Cada puerto está exportado como tipo por el barrel, es consumido por al menos un módulo de
   caso de uso (por resolución de import, no por lista manual) y sus tipos están referenciados
   por al menos un test unitario.
6. Higiene: cada test importa `node:test` y `node:assert/strict`, no exporta símbolos y no
   importa Fastify, DB, Drizzle ni rutas concretas.

**Mensajes de fallo.** Precisos y por categoría: módulo sin test · test huérfano · factory que
no resuelve a un módulo · factory sin test · test que no referencia su factory · factory sin
composición · factory compuesta N veces (con los archivos) · puerto no exportado como tipo ·
puerto sin caso de uso consumidor · puerto sin referencia en tests · test sin higiene mínima.
Ningún assert fue debilitado.

## 9. Relación con los contratos existentes

**Nueve tests unitarios de M06–M10 — intactos.** Cada uno conserva su bloque
`APPLICATION_FILES` + `FORBIDDEN_IMPORT_RULES` por milestone. El guard global los **subsume**
(cubre los mismos archivos y más, por auto-discovery) pero **no los reemplaza**: siguen siendo
la prueba de comportamiento por caso de uso (delegación única, identidad del resultado,
propagación del error original).

**Cuatro contratos source-anchored — intactos.**
`logistics-sla-routes-api.test.ts`, `logistics-route-plans-api.test.ts`,
`logistics-field-visits-api.test.ts` y `logistics-route-events-api.test.ts` siguen anclando los
paths de application y la delegación de cada handler. M11 no toca sus anclas.

**`audit-suite-completeness.test.ts` — intacto, sin cambios necesarios.** Su descubrimiento
está acotado por construcción a `basename(path).includes("audit")` y compara con
`assert.deepEqual(actualFiles, expectedFiles)` (igualdad exacta). Los dos basenames nuevos no
contienen `audit`, de modo que **no entran** en `actualFiles`; registrarlos habría roto la
igualdad en sentido contrario. Verificado en verde tras el cambio.

**`security-boundary-suite-completeness.test.ts` — intacto.** Auto-descubre por
`/^security-.*-boundaries\.test\.ts$/` sobre todo `test/**`. Los basenames nuevos no matchean
ese patrón. Verificado en verde tras el cambio.

**`logistics-domain-boundary-guard.test.ts` — intacto.** M11 clona su mecanismo; no lo edita.

## 10. Cero cambios runtime · cero cambios de manifiestos

- **Runtime productivo: cero.** No se modificó ningún `.ts` bajo `server/**`. Los 19 archivos
  de la capa application, las 4 rutas de Logistics, `fastify-app.ts`, `db-logistics.ts`,
  `domain/**`, `infrastructure/**` y `lib/**` quedan byte-idénticos.
- **`package.json`: intacto.** No hizo falta: `pnpm test` descubre por glob
  `test/**/*.test.ts`. No se agregó script, runner ni entrada de censo.
- **`scripts/**`: intactos.** Ningún script del repositorio enumera suites de tests.
- **Dependencias: cero.** Sólo builtins de Node y `node:test`. No se agregó ESLint ni tooling.
- **CI/workflows: intactos** (rector §15: `no se modifican workflows`).
- **Schema/migraciones/DB: cero cambios.**
- **Frontend: cero cambios.**

## 11. Riesgos y mitigaciones

| Riesgo | Sev. | Mitigación aplicada |
|---|---|---|
| Guard demasiado estricto (prohibir `domain` o romper M06–M10) | ALTA | `domain/index.ts` explícitamente permitido; guard verde en HEAD sin tocar producción |
| Guard demasiado permisivo (bare specifier no contemplado) | ALTA | *Default-deny*: lo no permitido es violación; las reglas sólo etiquetan |
| Falso positivo por texto en comentarios o strings | MEDIA | Escáner que elimina comentarios y descarta matches dentro de literales; auto-test dedicado |
| Falso positivo por `db-` en nombres de puertos/cache | MEDIA | Patrón anclado a segmento de path (`(^|/)db-…$`); `logistics-route-plans-cache.ts` y `*-repository.ts` no matchean |
| Bypass por import dinámico o `require` | ALTA | Las cinco formas cubiertas + auto-test del parser |
| Bypass por `import type` | MEDIA | Los prohibidos lo son también como tipos; `drizzle/schema` incluido |
| Bypass por interpolación de template | MEDIA | El interior de `${…}` se conserva como código en la vista sólo-código; auto-test dedicado |
| Suite global que duplique ejecución | ALTA | Contrato de inventario, no runner; test propio que lo verifica |
| Suite global que cuente archivos sin validar exports | MEDIA | Valida value exports, cobertura en test y composición única, no sólo existencia |
| Suite global que pase en vacío | MEDIA | Piso documentado ≥ 9 antes de los `deepEqual` |
| Composición contada de más (imports, strings, comentarios) | MEDIA | Conteo sobre vista sólo-código con `\bnombre\s*\(` |
| Romper `audit-suite-completeness` o `security-boundary-suite-completeness` | ALTA | Basenames verificados contra ambos filtros; ambos censos ejecutados en verde |
| Anclar la ubicación futura de infraestructura (adelantar M12) | ALTA | `db-logistics` se prohíbe por **nombre de módulo**, no por path: válido antes y después del move |
| Dependencia de nombres frágiles / no cubrir UCs futuros | MEDIA | Discovery por `readdirSync` en ambos artefactos; cero listas cerradas de archivos |
| Declarar cerrada la Fase B sin evidencia | ALTA | Cierre respaldado por evidencia post-merge real: PR #1507 MERGED (squash SHA `bb320297df290cb64249ddf4eba4209967b18cfc`), CI final verde, `main` sincronizado con `origin/main` y `origin/HEAD`, rama técnica `test/backend-modularization-m11-logistics-application-phase-closeout` eliminada local y remotamente, cero PRs abiertos |

## 12. Rollback

Rector §14: `Guard nuevo | revert del test; nunca bloquea rollback de código`. M11 es
revertible de forma **independiente**: los cinco paths son dos tests nuevos y tres archivos
markdown. Revertir el PR no exige revertir M10 ni ningún milestone previo, y no altera runtime,
contratos HTTP, transacciones ni comportamiento observable. No hay shim que expirar.

## 13. Validaciones

Ejecutadas secuencialmente, fail-fast, sin tareas pesadas concurrentes (`AGENTS.md` §8).

| Fase | Comando | Tests | Pass | Fail | Skip | Exit | Estado |
|---|---|---:|---:|---:|---:|---:|---|
| 1a | `pnpm exec tsx --test test/architecture/logistics-application-boundary-guard.test.ts` | 10 | 10 | 0 | 0 | 0 | **PASSED** |
| 1b | `pnpm exec tsx --test test/unit/application/logistics/logistics-application-use-case-suite-completeness.test.ts` | 8 | 8 | 0 | 0 | 0 | **PASSED** |
| 2 | `pnpm exec tsx --test` sobre `audit-suite-completeness` + `security-boundary-suite-completeness` | 13 | 13 | 0 | 0 | 0 | **PASSED** |
| 3 | `pnpm exec tsx --test` sobre los 9 unitarios de application M06–M10 + la suite global | 63 | 63 | 0 | 0 | 0 | **PASSED** |
| 4 | `pnpm exec tsx --test` sobre los 4 contratos source-anchored + domain guard + application guard | 90 | 90 | 0 | 0 | 0 | **PASSED** |
| 5 | `pnpm validate:local` (`typecheck && typecheck:test && test && build`) | — | — | — | — | 0 | **PASSED** |

No se re-ejecutaron `typecheck`, `typecheck:test`, `pnpm test` ni `build` por separado después
de `validate:local`.

- `pnpm security:public-surface` — **NOT_RUN**. M11 no toca superficie pública ni frontend.
- `pnpm validate:local:schema` — **NOT_RUN**. No hay cambios de DB, schema ni migraciones.
- Escrituras Git/GitHub — **BLOCKED** para Nico: no se ejecutó ninguna.

## 14. Cierre de Fase B

Contra el DoD por fase del rector §18:

| Criterio | Estado |
|---|---|
| Censo de legacy = 0 | ✅ `server/lib/logistics/` retirado en M05; sin imports legacy nuevos |
| Suite completa verde | ✅ `pnpm validate:local` PASSED |
| Guard endurecido | ✅ guard global de frontera nuevo, con auto-discovery de la capa |
| Sección de docs del contexto actualizada | ✅ `application/README.md` |
| Anotación del estado real en la tabla §8 del rector | ✅ M10 cerrado mediante PR #1506; M11 cerrado mediante PR #1507 (squash SHA `bb320297df290cb64249ddf4eba4209967b18cfc`); Fase B cerrada; M12 pendiente |

**Cierre confirmado:** M11 — `cerrado al merge (#1507)`, squash SHA `bb320297df290cb64249ddf4eba4209967b18cfc`;
**Fase B cerrada**. Evidencia final: PR #1507 MERGED, CI final verde, `main` sincronizado
con `origin/main` y `origin/HEAD` en ese SHA; rama técnica
`test/backend-modularization-m11-logistics-application-phase-closeout` eliminada local y
remotamente; cero PRs abiertos.

## 15. M12 — pendiente

Siguiente milestone: **M12**, mover `db-logistics.ts` completo (1.295 LOC) a
`infrastructure`, con transacciones intactas y shim documentado (rector §8, Fase C; PR 21–22 →
M12, dependencia `M11`). M11 **no adelanta** nada de M12: no toca `db-logistics.ts`, no crea
capa de infraestructura y no ancla su ubicación futura — el guard prohíbe `db-logistics` por
nombre de módulo, lo que sigue siendo correcto después del move.

## 16. Estado final

El PR técnico #1507 tuvo un diff de exactamente cinco paths: tres nuevos y dos modificados.
Cero cambios runtime, de manifiestos, dependencias o CI; denylist intacta y sin artefactos.
PR #1507 fue fusionado (squash SHA `bb320297df290cb64249ddf4eba4209967b18cfc`): M11 queda
cerrado. **M12 — pendiente** (mover `db-logistics.ts` completo a `infrastructure`).

Este closeout documental modifica únicamente los dos archivos Markdown allowlisted. No modifica
runtime, tests, DB, frontend, dependencias ni CI.
