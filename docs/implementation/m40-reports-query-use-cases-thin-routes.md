# M40 — Reports query use cases + clinic thin routes

## Identificación

- Milestone: M40.
- Rama:
  `refactor/backend-modularization-m40-reports-query-use-cases-thin-routes`.
- Baseline exacto: `9e1664ee6c73f02a2a484ec2a697831e40225013`.
- Predecesor: M39 / PR #1578 / squash merge
  `9e1664ee6c73f02a2a484ec2a697831e40225013`.
- Riesgo: R2 estructural backend autorizado específicamente para M40.
- Git/GitHub: stage, commit, amend, push, PR y merge reservados a Nico.
- M41: `NOT_RUN`.

## Censo inicial

Las ocho queries generales residían en la sección Reports de `server/db.ts`:
lookup clinic-scoped, historial, listado, count de listado, búsqueda, count de
búsqueda y los dos nombres públicos del catálogo. `reports.fastify.ts`
cargaba `db.ts` y Supabase, coordinaba list+count, ownership, historial y
signed URLs. `reports-status.fastify.ts` cargaba los mismos defaults,
duplicaba validación de transición M38 y llamaba el adapter compatibility
`db.updateReportStatus`.

Consumidores runtime directos: las dos rutas clínicas, seis superficies
legacy que consumen `getClinicScopedReportById` mediante `db.ts` y los
consumidores de `getReportById` M38. Tests de integración inyectaban todas las
Options. Guards M36–M39, catálogo, persistencia, seguridad, auditoría,
ownership, disclosure, timing y sesión leían fuentes por path.

Clasificación:

- A: guards y contracts source-aware que apuntaban a `server/db.ts`, a
  coordinación en rutas o exigían M40 ausente;
- B: unit de query use cases, contract de repository y guard M40;
- C: integraciones HTTP, auth, CORS/preflight, sesión, timing/logging,
  transición/CAS, auditoría, cross-tenant/IDOR, disclosure, ownership,
  suite completeness y closeouts previos; no se redujeron assertions.

## Arquitectura antes y después

Antes:

```text
route HTTP -> server/db.ts + Supabase + lógica inline
```

Después:

```text
route HTTP
  -> report-query-composition.ts (lazy)
    -> report-query-use-cases.ts
      -> report-query-repository port
        -> report-query-repository.ts (Drizzle)
```

Application modela listados paginados, búsqueda, catálogo, lookup
clinic-scoped, historial, preview, download y lookup previo a transición. Usa
la serialización segura del domain, resultados `not_found`, no captura errores
generales y no conoce framework, DB, Drizzle, schema, storage ni audit
concretos.

Composition adapta las Options históricas a puertos M40. La inyección completa
evita defaults; el fallback `getReportById` valida `clinicId`. El runtime
default de status reutiliza `transitionReportStatus` M38. La compatibilidad
inyectada de `updateReportStatus` se adapta mediante
`createReportCommandUseCases`, por lo que la validación de transición sigue
teniendo owner único.

## Persistencia y equivalencia

`report-query-repository.ts` es owner único de:

- `getClinicScopedReportById`;
- `getReportStatusHistory`;
- `getReportsByClinicId`;
- `countReportsByClinicId`;
- `searchReports`;
- `countSearchReports`;
- `getReportStudyTypes`;
- `getStudyTypes`.

Se preservan filtros simultáneos report/clinic, `limit(1)`, orden de historial
por `createdAt` e `id` descendentes, filtros opcionales, orden de informes,
limit/offset, `ilike` sobre los tres campos con patrón `%query%`, equivalencia
query/count, `count(*)`, conversión numérica y catálogo domain sin consulta DB.

`server/db.ts` conserva sólo reexports temporales de estas operaciones hasta
M41. No conserva queries, filtros, orden, paginación, SQL de counts ni catálogo
duplicado en su sección Reports.

## Contratos HTTP preservados

`ReportsNativeRoutesOptions` y `ReportsStatusNativeRoutesOptions` conservan
todos sus campos y firmas, incluidos `getReportById`,
`getClinicScopedReportById` y `updateReportStatus`.

Se preservan los seis OPTIONS y seis GET de reads, además de OPTIONS/PATCH de
status; métodos, paths, orden de registro, parsing, defaults 50/100/0, filtros,
payloads, mensajes, status codes, CORS, cookies, auth, session-last-access,
permisos, timing y logging.

La transición status mantiene trusted origin antes de auth/write, ownership
antes de M38, resultados `not_found`, `same_status`,
`transition_not_allowed`, `concurrent_not_found` y `persisted`, CAS M38 y
auditoría `REPORT_STATUS_CHANGED` después de persistir y antes de responder.

`server/fastify-app.ts` no se modifica. Su doble registro permanece exactamente
en este orden:

1. `reportsNativeRoutes`, prefix `/api/reports`;
2. `reportsStatusNativeRoutes`, prefix `/api/reports`.

## Archivos

Creados:

- `server/features/reports/application/ports/report-query-repository.ts`;
- `server/features/reports/application/report-query-use-cases.ts`;
- `server/features/reports/infrastructure/report-query-repository.ts`;
- `server/features/reports/composition/report-query-composition.ts`;
- `test/unit/application/reports/report-query-use-cases.test.ts`;
- `test/unit/infrastructure/reports/report-query-repository-contract.test.ts`;
- `test/architecture/reports-query-use-cases-boundary-guard.test.ts`;
- este documento.

Modificados: barrels y READMEs de Reports, `server/db.ts`, las dos rutas
clínicas, guards A y registry de suite. Eliminados: ninguno.

Permanecen para M41: `server/db-report-workflow.ts`,
`server/lib/report-workflow-communication.ts`,
`server/lib/report-status.ts`, `server/lib/report-study-types.ts`,
`server/lib/reports.ts` y reexports compatibility en `server/db.ts`.

## Side effects

Reads no agregan side effects. History, preview y download sólo ejecutan su
operación posterior después de ownership. Status ejecuta lookup tenant-scoped,
comando M38, auditoría y respuesta en ese orden. Errores de DB, storage o audit
se propagan; no se agregan retries, cache, queue, outbox ni compensación.

## Validación

Estados canónicos: `PASSED`, `FAILED`, `NOT_RUN`, `NOT_AVAILABLE`, `BLOCKED`.

Secuencia fail-fast real:

- primer `pnpm typecheck`: `FAILED`, exit code 2, por colisión del alias
  `getReportStudyTypes`; corregido sin avanzar a gates dependientes;
- `pnpm typecheck` repetido: `PASSED`, exit code 0;
- integraciones reads+status: `PASSED`, exit code 0, 29/29;
- tests B M40 iniciales: `FAILED`, exit code 1, 18/19 por regex del propio
  contract de `count(*)`; runtime intacto;
- tests B M40 finales: `PASSED`, exit code 0, 19/19;
- guards A iniciales: `FAILED`, exit code 1, 42/60, por anchors que exigían
  M40 ausente o owners legacy;
- guards A+B finales: `PASSED`, exit code 0, 79/79;
- contratos C iniciales: `FAILED`, exit code 1, 132/141, por nueve anchors
  source-aware legacy;
- contratos C focales finales: `PASSED`, exit code 0, 55/55;
- cohorte acumulativa inicial: `FAILED`, exit code 1, 299/301, por dos anchors
  restantes; repetición focal: `PASSED`, exit code 0, 15/15;
- cohorte acumulativa final M36–M40: `PASSED`, exit code 0, 301/301;
- `pnpm typecheck` final: `PASSED`, exit code 0;
- `pnpm typecheck:test` final: `PASSED`, exit code 0;
- primer `pnpm validate:local`: `FAILED`, exit code 1, 3.847 pass, 1 skip,
  1 fail, por registry global con `getAuthorizedReport` legacy;
- guard global repetido: `PASSED`, exit code 0, 6/6;
- segundo `pnpm validate:local`: `FAILED`, exit code 1, 3.819 pass, 1 skip,
  1 fail al cargar un test Logistics ajeno; repetición aislada:
  `PASSED`, exit code 0, 29/29, sin cambios fuera de scope;
- `pnpm validate:local` final: `PASSED`, exit code 0, 3.848 pass, 1 skip,
  0 fail y build completado;
- `pnpm security:public-surface`: `PASSED`, exit code 0, sin findings
  públicos y dos markers server-only esperados;
- `pnpm audit --prod`: `PASSED`, exit code 0, sin vulnerabilidades conocidas;
- `pnpm audit`: `PASSED`, exit code 0, sin vulnerabilidades conocidas.
- `git diff --check`: `PASSED`, exit code 0, sin errores de whitespace;
- revisión de scope y artefactos: `PASSED`, `server/fastify-app.ts` intacto,
  cero paths fuera de scope y cero artefactos Playwright/Next.

## Exclusiones, riesgos y rollback

Schema, migraciones, DB real, frontend, Playwright, dependencias, CI,
workflows, auth compartida, staging, producción, dev servers y watchers:
`NOT_RUN`. `server/fastify-app.ts`: intacto. M41: `NOT_RUN`.

Riesgo residual: equivalencia del wiring lazy y mantenimiento de los shims
hasta M41. Los contratos application/infrastructure, integraciones HTTP y
guards source-aware cubren el riesgo local; no se ejecuta DB real.

Rollback: restaurar las ocho implementaciones en `server/db.ts`, devolver la
resolución y coordinación a las dos rutas, retirar puerto/use cases/repository/
composition M40 y revertir sólo guards, READMEs y documento M40. No requiere
schema, migraciones ni compensación de datos.
