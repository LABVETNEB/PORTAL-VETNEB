# M38 — Reports create, edit and status transition use cases

## Identificación

- Milestone: M38.
- Rama:
  `refactor/backend-modularization-m38-reports-create-edit-transition-use-cases`.
- Baseline exacto: `d27fa22d1d98fa83b24a51a8521d7c634a7adeb4`.
- Predecesor: M37 / PR #1576 / merge
  `d27fa22d1d98fa83b24a51a8521d7c634a7adeb4`.
- Programa: Fase I Reports abierta.
- Riesgo: R2 estructural backend autorizado específicamente para M38.
- Git/GitHub: stage, commit, push, PR y merge reservados a Nico.
- Commit inicial M38: `2ec8829d9796a7af2d6bea3edd2cc370dd4fab3b`.
- PR #1577: abierto durante la corrección local P2.

## Corrección P2 posterior al commit inicial

Codex Review detectó una carrera TOCTOU válida en las transiciones. Dos
requests podían leer `uploaded`, validar contra el mismo estado y persistir en
orden inverso porque el UPDATE sólo filtraba por `reportId`. Así, después de
`uploaded → delivered`, un write obsoleto todavía podía ejecutar
`uploaded → ready` y registrar historial desde un estado fresco incorrecto.

La corrección local agrega compare-and-set sin modificar rutas, schema ni
payloads. No se ejecutan amend, commit, push, resolución del thread, CI final ni
merge desde Codex.

## Problema y censo inicial

Los writes generales de Reports residían en `server/db.ts`:
`upsertReport` concentraba creación/edición e historial inicial, mientras
`updateReportStatus` concentraba update e historial de transición. La regla
`canTransitionReportStatus` era ejecutada por
`server/routes/reports-status.fastify.ts`; no existía un resultado application
explícito para ausencia, mismo estado, rechazo o desaparición concurrente.

Consumidores runtime iniciales:

- `server/routes/admin-reports.fastify.ts`: `db.getReportById` y
  `db.upsertReport`;
- `server/routes/reports-status.fastify.ts`:
  `db.getClinicScopedReportById` y `db.updateReportStatus`;
- rutas y compositions de Admin Study Tracking, Particular Access y Report
  Access: `db.getReportById`;
- rutas clínicas, Particular Access, Report Access y Study Tracking:
  `db.getClinicScopedReportById`;
- `server/routes/reports.fastify.ts`: reads generales e historial.

Los tests de integración inyectan `getReportById`, `getClinicScopedReportById`,
`upsertReport` y `updateReportStatus` mediante Options. Los contratos de
catálogo y admin auth leen literalmente `server/db.ts`. Los guards de Reports
fijaban inventario, paths y ausencia temporal de M38; guards de seguridad y
auditoría fijan las llamadas de write en rutas, no las transacciones.
Documentos bajo `docs/audit`, `docs/changelog` y `docs/pr-history` son
históricos y no se reescriben.

## Arquitectura final

```text
server/features/reports/
  domain/                                      # M36 intacto
  application/
    ports/
      report-command-repository.ts
    report-command-use-cases.ts
  infrastructure/
    report-command-repository.ts
  composition/
    report-command-composition.ts
```

El puerto expone exclusivamente `findReportById`, `createOrEditReport` y
`persistReportStatusTransition`, con tipos application mínimos. La factory
`createReportCommandUseCases` delega creación/edición y modela transición con
resultados `not_found`, `same_status`, `transition_not_allowed`,
`concurrent_not_found` y `persisted`.

El input público de transición no contiene `expectedFromStatus`. Application
lo construye desde `report.currentStatus` después del read y la validación. El
comando interno de persistencia sí lo exige, impidiendo que un caller HTTP lo
controle.

Application importa sólo ports y el domain canónico. Infrastructure implementa
el puerto y es owner único de DB, Drizzle, tablas, transacciones y SQL M38.
Composition es el único bridge application → infrastructure; inyecta el reloj
runtime y no ejecuta queries durante import.

`server/db.ts` conserva compatibilidad temporal reexportando `getReportById` y
`upsertReport` desde infrastructure, y `updateReportStatus` desde composition.
Ese adapter legacy atraviesa application y traduce `persisted` a la fila; los
resultados ausentes, rechazados o concurrentes se traducen a `undefined`.
Composition construye el wiring de forma lazy para evitar queries y ciclos de
inicialización durante import. Las rutas continúan con las mismas Options y
dynamic imports.

## Equivalencia de persistencia

### Create y edit

El lookup continúa por igualdad exacta de `storagePath` con `limit(1)`.
Si existe, sólo actualiza `uploadDate`, `studyType`, `patientName`, `fileName`
y `updatedAt`, usando `?? null`, y devuelve la primera fila de `returning()`.
No crea historial ni altera clínica, path, estado o autoría.

Si no existe, inserta clínica, metadatos nullable, path, URLs nulas, estado
`uploaded`, autoría y un único timestamp para `statusChangedAt`, `createdAt` y
`updatedAt`. En la misma transacción crea exactamente un historial con estado
previo nulo, estado destino `uploaded` y nota
`Informe cargado inicialmente`.

### Transition

La application lee el informe, rechaza mismo estado y usa exclusivamente
`canTransitionReportStatus`. Una transición válida delega un write. El
repository abre una transacción, relee por ID con `limit(1)`, evita writes ante
ausencia y compara el estado fresco con `expectedFromStatus`. Luego ejecuta un
UPDATE CAS cuyo predicado combina `reportId` y `currentStatus =
expectedFromStatus`. Si el estado fresco difiere o `returning()` no devuelve
fila, retorna ausencia concurrente sin historial. Sólo después de un CAS
exitoso inserta historial y devuelve la fila actualizada.

### Historial, reloj y errores

Create y transition conservan el INSERT SQL compatible con columnas legacy y
nuevas de `report_status_history`, el orden de valores y
`createdAt.toISOString()`. La prioridad de actor sigue siendo clinic user,
admin user y system, con tipos exactos `clinic_user`, `admin_user` y `system`.
`note` usa `?? null`; update e historial comparten el mismo timestamp. El
`fromStatus` del historial exitoso procede de `expectedFromStatus`.

Sólo el error PostgreSQL `42703` activa el fallback Drizzle con `reportId`,
`fromStatus`, `toStatus`, ambos IDs de autor, nota y `createdAt`. Cualquier otro
error se relanza. Application y infrastructure no capturan errores generales,
no auditan, no envían email, no usan storage y no registran console.

## Referencias finales

- `upsertReport` y `getReportById`: implementación canónica en infrastructure
  y reexports compatibility en `server/db.ts`;
- `updateReportStatus`: compatibility desde composition, siempre atravesando
  application y el CAS del repository;
- `getClinicScopedReportById`, `getReportStatusHistory` y reads generales:
  permanecen en `server/db.ts`;
- `REPORT_STATUSES` y `canTransitionReportStatus`: permanecen en domain M36;
- Options y rutas: intactos;
- tests application, infrastructure y persistence contract: owners M38;
- guard M38: inventario y frontera default-deny;
- docs históricas: intactas.

## Rutas y superficies intactas

La revisión final exige diff vacío para:

- `server/routes/admin-reports.fastify.ts`;
- `server/routes/reports.fastify.ts`;
- `server/routes/reports-status.fastify.ts`;
- `server/routes/admin-report-workflow.fastify.ts`;
- `server/fastify-app.ts`;
- `server/features/reports/domain/**`;
- `server/db-report-workflow.ts`;
- `server/lib/report-workflow-communication.ts`.

Los guards evitan depender de hashes raw sensibles a EOL y fijan Options,
imports, exports y anchors runtime por path resuelto.

## Guards

Clasificación prevista de archivos source-aware:

- A: realineaciones temporales de
  `reports-domain-boundary-guard.test.ts`,
  `reports-workflow-ports-boundary-guard.test.ts`,
  `reports-suite-completeness.test.ts`,
  `report-access-m34-closeout.test.ts` y
  `token-access-m35b-closeout.test.ts`;
- B: nuevos tests application, infrastructure, persistence contract y guard
  M38;
- C: 0.

Los guards de seguridad/auditoría se auditan y sólo se modifican si el move
cambia un anchor. Como las rutas permanecen intactas, sus anchors de auth,
permissions, trusted origin, auditoría posterior al write y superficie única
de upload no cambian.

## Exclusiones

No forman parte de M38: M39–M41, route thinning, upload/storage, Particular
Token, Study Tracking, auditoría, auth, sesiones, permisos, CORS, rate limits,
email, schema, migraciones, frontend, dependencias, CI, DB real, staging o
producción. Tampoco se mueven reads generales de Reports.

## Validación

Estados canónicos usados: PASSED, FAILED, NOT_RUN, NOT_AVAILABLE y BLOCKED.

Evidencia final:

- application M38: PASSED, exit code 0, 14/14;
- infrastructure + persistence contract, primera corrida: FAILED, exit code 1,
  8/9 por un falso positivo del test sobre `storagePath`;
- repetición del test fallido: PASSED, exit code 0, 1/1;
- infrastructure + persistence contract final: PASSED, exit code 0, 9/9;
- guards Reports, primera corrida: FAILED, exit code 1, 37/39 por dos
  realineaciones incompletas de tests;
- repetición de ambos tests fallidos: PASSED, exit code 0, 2/2;
- guards Reports final: PASSED, exit code 0, 39/39;
- guards históricos M34/M35b: PASSED, exit code 0, 11/11;
- integraciones Admin Reports, Reports Status y ownership: PASSED, exit code 0,
  29/29;
- seguridad y auditoría materialmente afectadas: PASSED, exit code 0, 41/41;
- cohorte acumulativa: PASSED, exit code 0, 73/73;
- `pnpm typecheck`, primera corrida: FAILED, exit code 2, firma compatibility
  de `getReportById` demasiado amplia;
- `pnpm typecheck` final: PASSED, exit code 0;
- `pnpm typecheck:test`: PASSED, exit code 0;
- `pnpm validate:local`: PASSED, exit code 0, 3.801 pass, 1 skip, 0 fail y
  build completado;
- `pnpm security:public-surface`: PASSED, exit code 0, sin findings públicos y
  dos markers server-only esperados;
- `pnpm audit --prod`: PASSED, exit code 0, sin vulnerabilidades conocidas;
- `pnpm audit`: PASSED, exit code 0, sin vulnerabilidades conocidas;
- `git diff --check`: PASSED, exit code 0, sin errores de whitespace.

Evidencia de la corrección P2 posterior a `2ec8829`:

- application con `expectedFromStatus`: PASSED, exit code 0, 15/15;
- infrastructure + persistence contract, primera corrida: FAILED, exit code 1,
  12/13 por una expectativa source-aware que todavía permitía el import
  type-only infrastructure → application;
- repetición del test fallido: PASSED, exit code 0, 1/1;
- infrastructure + persistence contract final: PASSED, exit code 0, 13/13;
- guards Reports: PASSED, exit code 0, 39/39;
- integraciones Admin Reports, Reports Status y ownership: PASSED, exit code 0,
  29/29;
- cohorte acumulativa P2: PASSED, exit code 0, 67/67;
- `pnpm typecheck`, primera corrida: FAILED, exit code 2, una anotación
  `Report` resolvió al tipo DOM después de retirar schema de composition;
- `pnpm typecheck` final: PASSED, exit code 0;
- `pnpm typecheck:test`: PASSED, exit code 0;
- `pnpm validate:local`: PASSED, exit code 0, 3.806 pass, 1 skip, 0 fail y
  build completado;
- `pnpm security:public-surface`: PASSED, exit code 0, sin findings públicos;
- `pnpm audit --prod`: PASSED, exit code 0, sin vulnerabilidades conocidas;
- `pnpm audit`: PASSED, exit code 0, sin vulnerabilidades conocidas.

Playwright, migraciones, DB real, staging, producción, dev servers y watchers:
NOT_RUN por exclusión explícita.

## Riesgo residual y rollback

Las rutas aún consumen exports temporales de `server/db.ts`; reads generales
siguen legacy y M39/M40 permanecen pendientes. DB real, staging y producción no
se ejecutan en M38.

El rollback es estructural y no requiere schema ni datos: restaurar las tres
implementaciones en la sección Reports de `server/db.ts`, retirar puerto,
application, repository, composition, pruebas, guard y documentación M38, y
revertir sólo las realineaciones temporales de guards.

## Estado final

M38 queda implementado localmente con los gates seleccionados PASSED. M39 no se
inicia. Commit, push, PR, CI remoto y merge no se ejecutan ni se afirman.
