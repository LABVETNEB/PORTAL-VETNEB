# M36 — Reports domain moves + path-aware catalog census

## Identificación

- Milestone: M36.
- Programa: apertura de Fase I — Reports.
- Repositorio: `LABVETNEB/PORTAL-VETNEB`.
- Rama:
  `refactor/backend-modularization-m36-reports-domain-moves-catalog-census`.
- Baseline exacto:
  `20ae28b72607c2a0b9aeeac8aa142a1dbf68753f`.
- Predecesor: M35b / PR #1574.
- Riesgo: R2 estructural backend, autorizado específicamente para M36.
- Git/GitHub: no se ejecutaron escrituras.

## Scope

M36 mueve sin reescritura funcional:

- `server/lib/report-status.ts` a
  `server/features/reports/domain/report-status.ts`;
- `server/lib/report-study-types.ts` a
  `server/features/reports/domain/report-study-types.ts`;
- `server/lib/reports.ts` a
  `server/features/reports/domain/reports.ts`.

También establece `domain/index.ts` como barrel público único, conserva tres
shims legacy de una línea, reapunta consumidores runtime y tests de
comportamiento, hace path-aware el contrato del catálogo, agrega el guard de
dominio Reports y realinea los guards source-aware afectados.

## Exclusiones

No se implementan M37–M41. Permanecen fuera del scope y sin refactor:

- `server/lib/report-workflow-communication.ts`;
- `server/db-report-workflow.ts`;
- capas `application`, `infrastructure` y `composition`;
- puertos, casos de uso, adapters, repositories, services y factories;
- thin routes y registro Fastify;
- Report Access, Particular Access y Study Tracking repository/shims;
- auth, cookies, sesiones, permisos, CORS y rate limits;
- storage, auditoría y email;
- schema, migraciones, frontend, dependencias y CI.

`server/fastify-app.ts` permanece fuera del diff y conserva el doble registro
ordenado de `/api/reports`.

## Arquitectura resultante

```text
server/features/reports/
  README.md
  domain/
    README.md
    index.ts
    report-status.ts
    report-study-types.ts
    reports.ts

server/lib/report-status.ts       -> domain/index.ts
server/lib/report-study-types.ts  -> domain/index.ts
server/lib/reports.ts             -> domain/index.ts
```

El dominio sólo depende de archivos internos de su capa y de
`drizzle/schema.ts` mediante `import type`. No contiene Fastify, Drizzle
runtime, DB, routes, application, infrastructure, auth, sesiones, permisos,
CORS, rate limits, audit, email, Supabase, filesystem, red, procesos, fetch,
timers con side effects ni estado global mutable nuevo.

## Evidencia de equivalencia

Los LOC se cuentan como líneas de contenido, sin contar una línea vacía
implícita al final del archivo. Los SHA-256 son digests exactos de los bytes
antes y después del move.

| Módulo | LOC inicial | LOC final | SHA-256 inicial | SHA-256 final |
| --- | ---: | ---: | --- | --- |
| `report-status.ts` | 64 | 64 | `82e98044a50c17416439a9da8b630380bd480097cc78d9bbf15d2bdd9baa42da` | `c68c05f127eda8a7131abe0bbed73f5168c8e21a2e01fd5faee01bf8853c3e93` |
| `report-study-types.ts` | 70 | 70 | `d373dbbe2a71ae67477f0415f9e85060fee15496bb6c0537908c0cff8dbf9ac1` | `cbf1d8a00744c157892749cb061cc8bbf3fbafbe5cba4a12c3f09df6a3033b7c` |
| `reports.ts` | 105 | 105 | `4860751377ea39e73b7944c6b92c541a2cb4619f17412012976c2332de3dfe6f` | `95cbea463a8ee3a7b6bc1bf7a4b36fa7638e243a1d276a8883acfca9336c1403` |

La comparación normalizada por líneas es exacta después de descontar
exclusivamente estos dos cambios de specifier:

```text
report-status.ts
  ../../drizzle/schema.ts
  -> ../../../../drizzle/schema.ts

reports.ts
  ../../drizzle/schema.ts
  -> ../../../../drizzle/schema.ts
```

`report-study-types.ts` no cambia ninguna línea de implementación.
`reports.ts` conserva su import interno `./report-status.ts`. No existe ninguna
otra diferencia de contenido normalizado.

Exports preservados:

- status: `REPORT_STATUSES`, `isReportStatus`, `normalizeReportStatus`,
  `canTransitionReportStatus`;
- catálogo: `REPORT_STUDY_TYPES`, `ReportStudyType`,
  `REPORT_STUDY_TYPE_LABELS`, `isReportStudyType`,
  `getReportStudyTypes`, `serializeReportStudyType`,
  `parseReportStudyType`;
- helpers: `parsePositiveInt`, `parseOffset`, `normalizeSearchText`,
  `normalizeOptionalNote`, `parseOptionalDate`, `parseClinicId`,
  `parseReportStatus`, `getReadClinicScope`, `parseReportId`,
  `serializeSafeReport`.

## Censo de consumidores

### Runtime inicial

Se encontraron seis archivos y diez edges hacia los paths legacy:

| Consumidor | Imports M36 iniciales | Resultado |
| --- | ---: | --- |
| `server/routes/admin-reports.fastify.ts` | 2 | Un import al barrel. |
| `server/routes/reports.fastify.ts` | 3 | Un import al barrel. |
| `server/routes/reports-status.fastify.ts` | 2 | Un import al barrel. |
| `server/db.ts` | 1 | Un import al barrel. |
| `server/lib/particular-token.ts` | 1 | Un import al barrel. |
| `server/lib/report-access-token.ts` | 1 | Un import al barrel. |

Los dos serializers de token fueron descubiertos por el guard default-deny
después del primer censo textual: usaban `./reports.ts`, no un path que
incluyera el stem `server/lib`. El censo final resuelve specifiers y evita esa
clase de falso negativo.

### Tests y anclas

Cuatro imports de comportamiento pasaron al barrel:

- `test/unit/domain/reports/reports.test.ts`;
- `test/unit/contracts/reports/permissions-and-report-status.test.ts`;
- `test/unit/contracts/public-professionals/professional-bank-eligibility.test.ts`;
- `test/integration/adapters/controllers/global-storage-report-safety-contract.test.ts`.

Anclas source-aware realineadas o extendidas:

- `test/architecture/reports-suite-completeness.test.ts`;
- `test/architecture/security/security-validation-cutoff-boundaries.test.ts`;
- `test/architecture/particular-access-m33-closeout.test.ts`;
- `test/architecture/report-access-m34-closeout.test.ts`;
- `test/unit/contracts/reports/report-study-types-catalog.test.ts`;
- `test/architecture/reports-domain-boundary-guard.test.ts` (nuevo).

Se conservaron sin edición seis documentos históricos que mencionan
explícitamente los paths legacy: dos auditorías de arquitectura, el inventario
rector, M21 y dos archivos bajo `docs/pr-history`.

### Shims

Los tres shims contienen exactamente:

```ts
export * from "../features/reports/domain/index.ts";
```

No tienen consumidores runtime ni tests de comportamiento. Su owner de retiro
es el closeout final de Fase I (M41), condicionado a un censo final con cero
consumidores; M36 no los elimina.

## Catálogo path-aware

El contrato fija como canónico
`server/features/reports/domain/report-study-types.ts` y comprueba su existencia
por path resuelto. El test importa comportamiento por el barrel y verifica:

- valores internos exactos: `citologia`, `histopatologia`, `hemoparasitos`;
- labels exactas: `Citología`, `Histopatología`, `Hemoparásitos`;
- type guard, copia de catálogo, parser y serializer;
- `null`/`undefined`/vacío;
- error `Tipo de estudio inválido`, statusCode `400` y
  `details.allowedValues`;
- rechazo de valores legacy y free-text;
- consumo del barrel por admin reports, clinic reports y DB;
- ausencia de consumo del shim;
- shim legacy exacto de una línea;
- matriz explícita de cuatro tests críticos, resuelta contra la taxonomía
  actual de `test/`.

La matriz conserva el inventario explícito sin depender de que el catálogo viva
bajo `server/lib` ni degradarse a un grep global.

## Seguridad y contratos

El move conserva:

- scoping por clínica autenticada y bloqueo de selector ajeno;
- catálogo y matriz de transiciones, incluido rechazo del mismo estado;
- normalización y fallback de estados;
- nota opcional limitada a 2000 caracteres;
- parsing de fechas, paginación e IDs;
- serialización `status`/`currentStatus`;
- `hasFile` derivado de `storagePath`, sin exponer `storagePath`;
- semántica `null`/`undefined`;
- paths, métodos, payloads, status codes, mensajes, Options y orden de side
  effects HTTP.

No hay cambios de auth, permisos, CORS, rate limits, storage, auditoría, email,
queries, transacciones ni registro Fastify.

## Guards y clasificación

Clasificación final de guards/tests source-aware modificados:

- A = 4:
  - `security-validation-cutoff-boundaries.test.ts`: reanchor de `reports.ts`;
  - `particular-access-m33-closeout.test.ts`: hash de ruta reapuntado tras el
    único cambio de import M36;
  - `report-access-m34-closeout.test.ts`: progreso de milestone, manteniendo
    M34 aislado y M37 ausente;
  - `global-storage-report-safety-contract.test.ts`: import de comportamiento
    al barrel, mismas expectativas.
- B = 3:
  - `reports-domain-boundary-guard.test.ts`: frontera M36 default-deny;
  - `report-study-types-catalog.test.ts`: censo path-aware y contratos runtime;
  - `reports-suite-completeness.test.ts`: paths canónicos y registro del nuevo
    guard, sin cambiar slugs ni retirar owners.
- C = 0.

## Validación

| Gate | Estado | Exit code | Conteo / resultado |
| --- | --- | ---: | --- |
| Cohorte inicial M36, primera corrida | FAILED | 1 | 35/38; detectó dos consumidores legacy y dos markers desalineados. |
| Repetición de los tres tests fallidos | PASSED | 0 | 27/27. |
| Cohorte inicial M36 completa | PASSED | 0 | 39/39. |
| Integraciones Reports | PASSED | 0 | 46/46. |
| Guards/seguridad/storage iniciales | PASSED | 0 | 50/50. |
| `pnpm typecheck` | PASSED | 0 | TypeScript backend sin errores. |
| `pnpm typecheck:test` | PASSED | 0 | TypeScript tests sin errores. |
| `pnpm validate:local`, primera corrida | FAILED | 1 | 3.745 pass, 1 skip, 2 fail; dos guards históricos de milestone. |
| Repetición de guards M33/M34 | PASSED | 0 | 14/14. |
| Todos los guards afectados, seguridad y storage | PASSED | 0 | 64/64. |
| `pnpm validate:local`, corrida final | PASSED | 0 | 3.747 pass, 1 skip, 0 fail; build completado. |
| `pnpm security:public-surface` | PASSED | 0 | Sin findings públicos; dos markers server-only esperados. |
| `pnpm audit --prod` | PASSED | 0 | Sin vulnerabilidades conocidas. |
| `pnpm audit` | PASSED | 0 | Sin vulnerabilidades conocidas. |
| `git diff --check` | PASSED | 0 | Sin errores de whitespace. |

Playwright, migraciones, DB real, staging y producción: NOT_RUN por exclusión
explícita de M36. No se ejecutaron watchers ni dev servers.

## Riesgo residual y rollback

El riesgo residual se limita a resolución de imports/barrel y a la permanencia
temporal de tres shims. Guards recursivos, typechecks, tests de dominio,
integraciones, suite completa, build y censo path-aware cubren ese riesgo.

El rollback es estructural: devolver los tres módulos completos a `server/lib`,
restaurar los imports previos y retirar feature, guard y documentación M36. No
requiere rollback de schema, migraciones, datos ni side effects.

## Estado final

- Fase I Reports: abierta.
- M36: implementado localmente.
- M37: no iniciado.
- Working tree: modificado únicamente por el scope M36; stage vacío.
- Denylist M36: salida vacía.
- PR, merge, push y CI remoto: no ejecutados ni afirmados.
