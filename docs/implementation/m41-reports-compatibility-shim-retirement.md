# M41 — Reports compatibility shim retirement

## Identificación

- Milestone: M41, cierre de Fase I Reports.
- Rama:
  `refactor/backend-modularization-m41-reports-compatibility-shim-retirement`.
- Baseline exacto:
  `791b526b10e66b2d48265b10f83ca2c06815822e`.
- Predecesor: M40 / PR #1579 / squash merge
  `791b526b10e66b2d48265b10f83ca2c06815822e`.
- Riesgo: R2 estructural backend autorizado específicamente para M41.
- Git/GitHub: stage, commit, amend, push, PR y merge reservados a Nico.

## Objetivo y scope

M41 retira la capa temporal de compatibilidad acumulada en M36–M40. La
arquitectura runtime queda:

```text
HTTP routes
  → Reports composition
    → Reports application
      → Reports ports
        → Reports infrastructure
```

El cambio elimina cinco forwarding modules, quita todos los reexports Reports
de `server/db.ts`, migra los consumidores residuales al owner canónico y
endurece los guards M36–M40. No modifica endpoints, Options, payloads, status
codes, mensajes, CORS, trusted origin, cookies, auth, permisos, aislamiento,
session last-access, timing, logging, serialización, auditoría, storage,
transiciones ni compare-and-set.

## Censo inicial

Paths de compatibilidad presentes al inicio:

1. `server/db-report-workflow.ts`;
2. `server/lib/report-workflow-communication.ts`;
3. `server/lib/report-status.ts`;
4. `server/lib/report-study-types.ts`;
5. `server/lib/reports.ts`.

`server/db.ts` reexportaba once nombres Reports: ocho operaciones query M40,
dos operaciones command M38 y `updateReportStatus` desde composition.

Consumidores runtime que todavía obtenían Reports como propiedades de
`server/db.ts`: seis archivos, con siete edges:

- `server/routes/admin-report-access-tokens.fastify.ts`:
  `getReportById`;
- `server/routes/admin-study-tracking.fastify.ts`: `getReportById`;
- `server/routes/particular-auth.fastify.ts`:
  `getClinicScopedReportById`;
- `server/routes/report-access-tokens.fastify.ts`:
  `getClinicScopedReportById`;
- `server/routes/study-tracking.fastify.ts`:
  `getClinicScopedReportById`;
- `server/features/particular-access/particular-access-route-composition.ts`:
  `getReportById` y `getClinicScopedReportById`.

Un test de integración importaba el tipo `AdminReportWorkflowItem` desde el
shim raíz. Los demás matches de paths legacy eran anchors source-aware o
documentación histórica, no consumidores runtime.

## Consumidores migrados y owners finales

Los seis consumidores runtime resuelven ahora
`server/features/reports/composition/index.ts`:

- reads sin scope administrativo → `report-command-composition.ts` →
  `findReportById` application → command port → command repository;
- reads clinic-scoped cross-context → `report-command-composition.ts` →
  `findClinicScopedReportById` application → command port → command repository.

La inyección por Options permanece intacta. El test de workflow importa su
tipo desde `server/features/reports/infrastructure/index.ts`.

## Compatibilidad retirada

Eliminados:

- `server/db-report-workflow.ts`;
- `server/lib/report-workflow-communication.ts`;
- `server/lib/report-status.ts`;
- `server/lib/report-study-types.ts`;
- `server/lib/reports.ts`.

Retirado de `server/db.ts`:

- `countReportsByClinicId`;
- `countSearchReports`;
- `getClinicScopedReportById`;
- `getReportsByClinicId`;
- `getReportStatusHistory`;
- `getReportById`;
- `getReportStudyTypes`;
- `getStudyTypes`;
- `searchReports`;
- `upsertReport`;
- `updateReportStatus`.

También se retiraron adapters públicos cuyo único propósito era sostener esos
forwarders: `updateReportStatus` de command composition, los wrappers
`getReportById`/`upsertReport` de command infrastructure y las cuatro
operaciones standalone de workflow route composition. Los owners factories y
casos de uso permanecen.

## Arquitectura antes y después

Antes:

```text
consumer → server/db.ts → Reports infrastructure/composition
consumer → shim → Reports barrel canónico
```

Después:

```text
consumer/route → Reports composition → application → port → infrastructure
```

`server/db.ts` vuelve a ser exclusivamente el kernel compartido de conexión y
operaciones de otros bounded contexts; no importa, exporta ni cataloga Reports.

## Clasificación A/B/C

- A — anchors source-aware realineados: guards M36, M37, M38, M39 y M40;
  catálogo de study types; persistencia command; workflow communication;
  registry de suite; import type del workflow.
- B — guard específico nuevo:
  `test/architecture/reports-compatibility-shim-retirement.test.ts`.
- C — contratos de comportamiento preservados: domain, command/query use
  cases, route service, workflow communication, repositories, adapters,
  integraciones admin/clínica, auth/autorización, CORS, sesión, timing/logging,
  auditoría, CAS, ownership/IDOR, disclosure, catálogo y closeouts M34/M35b.

No se eliminaron assertions conductuales ni se redujeron conteos. Los cambios
de A invierten únicamente la expectativa temporal de compatibilidad.

## Guard M41

El guard exige:

- ausencia física de los cinco shims;
- ausencia de Reports en `server/db.ts`;
- cero imports estáticos, dinámicos o `require` a paths retirados;
- consumidores residuales apuntando a composition;
- barrels exactos por capa;
- application default-deny;
- Drizzle en infrastructure y cero imports runtime ascendentes;
- composition como único bridge application/infrastructure;
- rutas Reports thin;
- doble registro `/api/reports` en orden;
- inventarios M36–M40 completos;
- cero reemplazos `compat`, `legacy`, `shim` o forwarding modules.

## Contratos preservados

Se preservan los cuatro módulos de rutas Reports, su orden de registro y todos
los contratos HTTP. Los reads cross-context mantienen las mismas funciones y
valores `null`/`undefined` observables mediante el wiring default; las Options
inyectadas no cambian. Persistencia, SQL, transacciones, historial, CAS, orden
de auditoría/notificación y signed URLs no se reescriben.

## Validación

| Gate | Estado | Evidencia |
| --- | --- | --- |
| guard M41 aislado | PASSED | exit 0; 9/9 |
| guards M36–M41, suite Reports y security completeness | PASSED | exit 0; 68/68 |
| cohorte dirigida Reports | PASSED | exit 0; 200/200 |
| contratos de seguridad y auditoría | PASSED | exit 0; 241/241 |
| `pnpm typecheck` | PASSED | exit 0 |
| `pnpm typecheck:test` | PASSED | exit 0 |
| `pnpm validate:local` | PASSED | exit 0; 3859 pass, 1 skip, 0 fail; build exitoso |
| `pnpm security:public-surface` | PASSED | exit 0; cero findings públicos |
| `pnpm audit --prod` | PASSED | exit 0; cero vulnerabilidades conocidas |
| `pnpm audit` | PASSED | exit 0; cero vulnerabilidades conocidas |
| `git diff --check` | PASSED | exit 0 |

Fail-fast detectó y corrigió tres grupos de contratos:

1. dos anchors M39/M40 todavía exigían wrappers retirados por M41;
2. el primer lookup clinic-scoped devolvía una proyección M40 incompleta para
   consumidores cross-context; se movió a command application/composition
   sobre el agregado completo;
3. guards históricos M32–M35b y su registry conservaban hashes/nombres/cutoff
   anteriores a la migración autorizada M41.

Cada gate fallido se corrigió y reintentó antes de continuar. El tercer intento
de `validate:local` pasó completo.

## Exclusiones

Frontend, Playwright, schema, migraciones, DB real, dependencias, lockfiles,
CI, workflows, staging, producción, dev servers, watchers y
`server/fastify-app.ts` quedan fuera del diff. No se inicia otro milestone.

## Riesgos y rollback

Riesgo residual esperado: anchors source-aware externos a la cohorte Reports o
un consumidor default omitido por el censo inicial. El guard M41 resuelve
imports y la suite global cubre ambos riesgos.

Rollback estructural: restaurar los cinco shims y los reexports de
`server/db.ts`, devolver los siete edges runtime a `db`, restaurar los adapters
compatibility retirados y revertir los anchors M41. No requiere schema,
migraciones, datos ni compensación de side effects.

## Estado

- M41: implementación local completa.
- Fase I Reports: compatibilidad temporal retirada; gates funcionales,
  arquitectónicos, seguridad, auditoría, compilación y build en PASSED.
- Siguiente milestone: `NOT_RUN`.
- Commit, amend, push, PR y merge: `NOT_RUN`.
