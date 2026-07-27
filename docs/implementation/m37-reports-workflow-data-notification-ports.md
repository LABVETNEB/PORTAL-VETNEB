# M37 — Reports workflow data + notification ports

## Identificación

- Milestone: M37.
- Rama:
  `refactor/backend-modularization-m37-reports-workflow-data-notification-ports`.
- Baseline exacto:
  `ce6f5753e20dbdc520c6c4c982829244ef25191a`.
- Predecesor: M36 / PR #1575 / merge `ce6f575`.
- Programa: Fase I Reports abierta.
- Riesgo: R2 estructural backend autorizado específicamente para M37.
- Git/GitHub: las escrituras quedan reservadas a Nico.

## Problema P2-B

`server/lib/report-workflow-communication.ts` mezclaba la orquestación de
application con DB, Drizzle, schema, consulta a `studyTrackingCases` e inserción
en `studyTrackingNotifications`. Su único consumidor runtime era
`server/db-report-workflow.ts`; el contrato source-aware de Reports leía la
implementación legacy.

La mezcla invertía la frontera de Reports y hacía imposible probar missing
tracking, mapping y propagación de errores sin persistencia real. M37 separa
esas responsabilidades preservando consultas, payloads, ordering, errores y
política best-effort exterior.

El inventario histórico proponía mover `db-report-workflow.ts` a infrastructure
en M37. El contrato actual del milestone especializa esa propuesta: el archivo
permanece en su path legacy hasta M38/M39 y sólo reapunta su import a
composition. No existe otro cambio normalizado en ese archivo.

## Arquitectura

```text
server/features/reports/
  domain/                                  # M36 intacto
  application/
    ports/
      report-workflow-data-port.ts
      report-workflow-notification-port.ts
      index.ts
    report-workflow-communication.ts
    index.ts
    README.md
  infrastructure/
    report-workflow-data-adapter.ts
    report-workflow-notification-adapter.ts
    index.ts
    README.md
  composition/
    report-workflow-communication-composition.ts
    index.ts
    README.md
```

- El data port recibe `reportId` y devuelve cero o un contexto mínimo:
  `studyTrackingCaseId`, `clinicId`, `reportId` nullable y
  `particularTokenId` nullable.
- El notification port recibe exclusivamente los campos de una notificación
  interna de Study Tracking y devuelve el ID creado o `null`.
- Application expone una factory explícita, depende sólo de ambos puertos y de
  `now: () => Date`, y no captura errores.
- Los adapters infrastructure son los únicos owners M37 de DB, Drizzle, schema,
  `studyTrackingCases` y `studyTrackingNotifications`.
- Composition instancia ambos adapters y el reloj, construye una sola operación
  y publica `createReportWorkflowNotification`.
- `server/lib/report-workflow-communication.ts` queda como shim exacto de una
  línea al barrel de composition; su retiro pertenece a M41.

Dependencias permitidas:

```text
composition -> application ports/factory
composition -> infrastructure adapters
infrastructure -> application ports
infrastructure -> db.ts / Drizzle / schema
application -> application ports
domain -> domain
```

Application y ports no pueden importar infrastructure, composition, DB,
Drizzle, schema, Fastify, routes, auth, audit, email, CORS, rate limits,
Supabase, filesystem, red ni process.

## Contratos

Input público:

```ts
{
  reportId: number;
  type: string;
  title: string;
  message: string;
}
```

Output público:

```ts
{
  notificationCreated: boolean;
  notificationId: number | null;
  warning: string | null;
}
```

Sin tracking context, el data port se invoca una vez, el notification port no
se invoca y se devuelve exactamente:

```text
notificationCreated: false
notificationId: null
warning: No existe seguimiento vinculado al informe; no se creó notificación interna.
```

Con tracking context se crea exactamente una notificación. El mapping conserva
`studyTrackingCaseId` y `clinicId`; usa el `reportId` del contexto o el input
original como fallback; preserva `particularTokenId` o `null`; copia
`type`/`title`/`message`; fija `isRead: false`, `readAt: null` y obtiene
`createdAt` del reloj inyectado.

El ID retornado puede ser `null` sin cambiar `notificationCreated: true`.
Errores de ambos puertos se propagan sin wrappers. El catch best-effort sigue
exclusivamente en `server/db-report-workflow.ts`.

## Equivalencia

El adapter de datos conserva:

- `db.select()` sobre `studyTrackingCases`;
- igualdad exacta `eq(studyTrackingCases.reportId, reportId)`;
- `limit(1)`;
- primera fila o `null`;
- cero writes.

El adapter de notificación conserva:

- insert en `studyTrackingNotifications`;
- IDs sin intercambio;
- fallback de `reportId` resuelto por application;
- `particularTokenId` nullable;
- textos sin reescritura;
- estado unread y timestamps exactos;
- `.returning({ id: studyTrackingNotifications.id })`;
- primer ID o `null`.

`server/db-report-workflow.ts` tiene un diff normalizado de una sola línea: el
import legacy cambia de `./lib/report-workflow-communication.ts` a
`./features/reports/composition/index.ts`. Permanecen intactos exports,
selection, SQL, joins, ordering, paginación, serialización, updates, reload,
mensajes, títulos y tipos stage/special-stain.

El orden observable continúa:

```text
update -> reload -> communication -> return
```

La comunicación sólo ocurre después de un update exitoso y un reporte
recargado. Missing report no comunica. Missing tracking produce warning seguro.
Los errores se capturan fuera de application, no revierten la mutación y el log
expone sólo `errorName`, nunca message, stack, token o payload.

`server/routes/admin-report-workflow.fastify.ts` y
`server/fastify-app.ts` no cambian: mismos Options, GET/PATCH/OPTIONS,
trusted-origin, auth, auditoría, status codes, payloads y registro.

## Censo

Estado inicial:

- runtime: un import desde `server/db-report-workflow.ts` al módulo legacy;
- test behavior/contract: un contrato leía el módulo legacy;
- guard: M36 exigía ausencia de M37;
- documentación vigente: inventarios M37 y M36 mencionaban el path legacy;
- documentación histórica: menciones en auditorías y `docs/pr-history`, sin
  edición.

Estado final:

- runtime: `server/db-report-workflow.ts` importa el barrel canónico de
  composition;
- application: una factory y dos puertos separados;
- infrastructure: dos adapters concretos;
- composition: un bridge y una operación runtime;
- tests: unit application, contrato path-aware y contrato source-aware de
  adapters;
- guards: guard M37 default-deny, guard M36 realineado y owners registrados;
- shim: existe, una línea, cero consumidores runtime y cero tests de
  comportamiento;
- documentación histórica: se conserva sin reescritura de hechos pasados.

## Guards

Clasificación de archivos source-aware modificados o creados:

- A = 4:
  - `test/unit/contracts/reports/report-workflow-communication-contract.test.ts`;
  - `test/architecture/reports-domain-boundary-guard.test.ts`;
  - `test/architecture/report-access-m34-closeout.test.ts`;
  - `test/architecture/token-access-m35b-closeout.test.ts`.
- B = 4:
  - `test/unit/application/reports/report-workflow-communication.test.ts`;
  - `test/unit/infrastructure/reports/report-workflow-adapters-contract.test.ts`;
  - `test/architecture/reports-workflow-ports-boundary-guard.test.ts`;
  - `test/architecture/reports-suite-completeness.test.ts`.
- C = 0.

El guard histórico M33 fue auditado y no requirió cambios materiales.

## Exclusiones

Permanecen fuera:

- M38–M41 y casos de uso generales de Reports;
- thin routes y move de `db-report-workflow.ts`;
- repositorio general de Reports;
- registro Fastify y domain M36;
- Report Access, Particular Access y Study Tracking existentes;
- auth, cookies, sesiones, CORS, rate limits, audit y email;
- storage/Supabase, schema, migraciones, frontend, dependencias y CI.

No se agregan email, push, webhooks, outbox, compensación ni auditoría.

## Validación

Evidencia final de la secuencia fail-fast:

- tests application: PASSED, exit code 0, 6/6;
- contrato y guard M37: PASSED, exit code 0, 18/18;
- guards Reports: PASSED, exit code 0, 19/19;
- guards históricos modificados: PASSED, exit code 0, 11/11;
- integración admin workflow: PASSED, exit code 0, 13/13;
- test infrastructure: PASSED, exit code 0, 2/2;
- cohorte acumulativa: PASSED, exit code 0, 56/56;
- `pnpm typecheck`: PASSED, exit code 0;
- `pnpm typecheck:test`: PASSED, exit code 0;
- `pnpm validate:local`: PASSED, exit code 0, 3.770 pass, 1 skip,
  0 fail y build completado;
- `pnpm security:public-surface`: PASSED, exit code 0, sin findings
  públicos y dos markers server-only esperados;
- `pnpm audit --prod`: PASSED, exit code 0, sin vulnerabilidades conocidas;
- `pnpm audit`: PASSED, exit code 0, sin vulnerabilidades conocidas;
- `git diff --check`: PASSED, exit code 0, sin errores de whitespace.

Playwright, migraciones, DB real, staging, producción, dev servers y watchers:
NOT_RUN por exclusión explícita.

## Riesgo residual y rollback

`server/db-report-workflow.ts` permanece legacy hasta M38/M39; la ruta continúa
no-thin hasta M39; los shims Reports permanecen hasta M41. DB real, staging y
producción no se ejecutan en M37.

El rollback es estructural y no toca schema ni datos: restaurar la
implementación legacy del shim, devolver el import de `db-report-workflow.ts`,
retirar las tres capas M37 y sus pruebas/guards/documentación. No requiere
migraciones ni compensación de side effects.

## Estado final

- M37: implementado y validado localmente; revisión final del diff PASSED.
- M38: no iniciado.
- Commit, push, PR, CI remoto y merge: no ejecutados ni afirmados.
