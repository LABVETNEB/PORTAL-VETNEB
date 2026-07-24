# M35 — Study Tracking phase closeout

## Identificación

- Milestone: M35, cierre de Fase G — Study Tracking.
- Rama: `refactor/backend-modularization-m35-study-tracking-phase-closeout`.
- Base exacta: `9ef2621875429b788a0260aae65dd7eb3753db23`
  (`refactor(study-tracking): thin admin route (#1567)`).
- Instrucciones aplicables: `AGENTS.md` raíz; no existen instrucciones
  anidadas.
- Naturaleza: tests, guards y documentación, más retiro de dos shims de dominio
  sin consumidores. Cero cambios de comportamiento en runtime.

M35 cierra M30, M31, M32 y M32b. Los PR históricos son #1564, #1565, #1566 y
#1567. No inicia M33, M34, M35b ni Reports.

## Censo legacy y decisión

El censo combinó `rg`, `git grep` y AST TypeScript sobre imports estáticos,
exports, `import()` y `require()`.

| Clase | Resultado |
| --- | --- |
| Runtime | Cero consumidores de los shims domain; tres consumidores externos del shim DB |
| Tests ejecutables | Dominio y application consumen sus barrels canónicos; ningún test necesita los shims domain |
| Guards source-only | El guard domain se invierte a path ausente; el guard M35 congela el resultado |
| Documentación canónica | Este documento y los README del feature reflejan el estado final |
| Menciones históricas | M30–M32b, auditorías y `docs/pr-history` se conservan como historia |
| Paths inexistentes/comentarios | No cuentan como consumidores runtime |

### Shims de dominio

Antes:

- `server/lib/study-tracking.ts`: reexport de una línea al barrel domain;
- `server/lib/token-study-tracking.ts`: el mismo reexport;
- consumidores ejecutables reales: 0.

Después: ambos paths están ausentes y los guards prohíben recrearlos o
importarlos. Los seis consumidores runtime del dominio ya usan
`server/features/study-tracking/domain/index.ts`.

### Shim de persistencia

`server/db-study-tracking.ts` se conserva sin cambios como reexport de una
línea:

```ts
export * from "./features/study-tracking/infrastructure/index.ts";
```

Allowlist residual exacta:

| Consumidor | Owner | Milestone de retiro |
| --- | --- | --- |
| `server/routes/admin-reports.fastify.ts` | Reports | M36 |

M33 retiró los dos consumidores Particular Access registrados al cierre M35.
No existe un segundo consumidor residual. Las tres rutas propias de Study Tracking tienen
cero imports del shim y cero imports directos de infrastructure.

La afirmación de cierre es: cero imports legacy dentro de las superficies
propias de Study Tracking y un shim DB residual controlado para consumidores
externos pendientes. No se afirma cero paths legacy globales.

## Arquitectura final

```text
server/features/study-tracking/
  domain/
    index.ts
    study-tracking.ts
    token-study-tracking.ts
  application/
    index.ts
    *-operations.ts
    *-use-cases.ts
    ports/*.ts
  infrastructure/
    index.ts
    study-tracking-repository.ts
  study-tracking-route-composition.ts
```

- Domain: reglas, schemas, fechas, etapas, serialización y coordinación pura
  con persistencia inyectada; cero Fastify, DB, Drizzle runtime, email,
  auditoría, application o infrastructure.
- Application: puertos type-only, casos de uso y operaciones por realm; cero
  Fastify, DB, Drizzle, schema o infrastructure concreta. Los side effects
  atraviesan únicamente los puertos de notificación y auditoría.
- Infrastructure: repository canónico único con 13 funciones públicas,
  queries, filtros, orden, paginación y timestamps preservados; cero HTTP,
  auth, email, auditoría o application. Transacciones: 0.
- Composition: único seam autorizado desde las rutas hacia el barrel de
  infrastructure. Exporta cargas clinic, particular y admin; no contiene
  queries, reglas, Fastify, auth, validación ni estado global mutable.

Inventario exacto del feature: 23 archivos (19 TypeScript y 4 README).

## Rutas, hashes, endpoints y Options

Los SHA-256 iniciales y finales deben coincidir:

| Ruta | SHA-256 |
| --- | --- |
| `server/routes/study-tracking.fastify.ts` | `2ce07bd8abb818b39bc2369095f71e19b5b1bd2a1dcba38f7848acaf349507b1` |
| `server/routes/particular-study-tracking.fastify.ts` | `ed7d3f4a949af488a9dab5a9a89ccc9e89d19399ddde7230a25a3189a32591fb` |
| `server/routes/admin-study-tracking.fastify.ts` | `c93824a2a7f2866c658e00304964927cbfc981b5b9c2046860657a6feb89c589` |

### Clínica

Endpoints: `GET /`, `GET /:trackingCaseId`, `POST /`, `GET /notifications`,
`PATCH /notifications/:notificationId/read`,
`PATCH /notifications/read-all` y cinco OPTIONS.

Options (22): `deleteActiveSession`, `getActiveSessionByToken`,
`getClinicUserById`, `updateSessionLastAccess`, `hashSessionToken`,
`getClinicById`, `getReportById`, `getClinicScopedReportById`,
`getParticularTokenById`, `updateParticularTokenReport`,
`createStudyTrackingCase`, `updateStudyTrackingCase`,
`getClinicScopedStudyTrackingCase`, `listStudyTrackingCases`,
`createStudyTrackingNotification`, `listStudyTrackingNotifications`,
`markStudyTrackingNotificationReadScoped`,
`markAllStudyTrackingNotificationsReadScoped`,
`sendSpecialStainRequiredEmail`, `writeAuditLog`, `now`, `createDate`.

### Particular

Endpoints: `GET /me`, `GET /notifications`,
`PATCH /notifications/:notificationId/read`,
`PATCH /notifications/read-all` y cuatro OPTIONS.

Options (10): `deleteParticularSession`, `getParticularSessionByToken`,
`getParticularTokenById`, `updateParticularSessionLastAccess`,
`hashSessionToken`, `getParticularStudyTrackingCase`,
`listStudyTrackingNotifications`,
`markStudyTrackingNotificationReadScoped`,
`markAllStudyTrackingNotificationsReadScoped`, `now`.

### Admin

Endpoints: `GET /`, `GET /:trackingCaseId`, `POST /`,
`PATCH /:trackingCaseId`, `GET /notifications`,
`PATCH /notifications/:notificationId/read`,
`PATCH /notifications/read-all` y cinco OPTIONS.

Options (22): `deleteAdminSession`, `getAdminSessionByToken`,
`getAdminUserById`, `updateAdminSessionLastAccess`, `hashSessionToken`,
`getClinicById`, `getReportById`, `getParticularTokenById`,
`updateParticularTokenReport`, `createStudyTrackingCase`,
`updateStudyTrackingCase`, `getClinicScopedStudyTrackingCase`,
`getStudyTrackingCaseById`, `listStudyTrackingCases`,
`createStudyTrackingNotification`, `listStudyTrackingNotifications`,
`markStudyTrackingNotificationRead`,
`markAllStudyTrackingNotificationsRead`,
`sendSpecialStainRequiredEmail`, `writeAuditLog`, `now`, `createDate`.

## Operations application

- Clínica: list cases, get case, create case, list notifications, mark one,
  mark all.
- Particular: `/me`, list notifications, mark one, mark all.
- Admin: list/get/create/update cases, list notifications, mark one, mark all.

Las diez factories públicas de query, command, side effects y operaciones de
alto nivel tienen export por barrel, consumidor runtime/application y test
unitario. Los guards thin fijan las operaciones exactas invocadas por cada
handler.

## Matriz de autoridad y evidencia cross-tenant

| Realm | Autoridad | Evidencia |
| --- | --- | --- |
| Clínica | `clinicId` sólo desde sesión clínica | list/get/notificaciones y acknowledgements reciben `auth.clinicId`; report y token se validan clinic-scoped; input `clinicId=999` no reemplaza al actor |
| Particular | `particularTokenId` sólo desde sesión particular | `/me` y notificaciones reciben el token autenticado; clínica/report derivan del token persistido; input `particularTokenId=999` no reemplaza al actor |
| Admin | autoridad global con filtro `clinicId` opcional | queries globales o clinic-scoped, ownership report/token, create/update y PATCH body sobre query |
| Cross-realm | cookies y autenticadores separados | cada integración rechaza con 401 cookies de los otros dos realms |

`CTIDOR-017` enlaza evidencia ejecutable de clínica, particular y admin,
incluidos los 404 genéricos de notification ownership y los tests unitarios de
scope. La evidencia de staging queda
`pending_runtime_staging_evidence`. No se afirma RLS.

## Side effects y auditoría

Create clínica conserva:

1. referencias y ownership;
2. cálculo de entrega;
3. creación;
4. vínculo token/report;
5. notificación;
6. timestamp;
7. email best-effort;
8. auditoría del caso;
9. auditoría de notificación;
10. respuesta.

Create admin conserva validación de referencias, creación, vínculo,
notificación opcional, timestamp, email best-effort y las dos auditorías antes
de responder.

Update admin conserva update simple, stage change, tinción requerida, tinción
resuelta, combinación stage+tinción, vínculo, fallback de timestamp y múltiples
auditorías. Los payloads, eventos, `createdVia`, `updatedVia`, `fromStage`,
`toStage`, metadata, null/undefined y errores por identidad permanecen
protegidos por unit tests e integración.

Sólo SMTP se aísla como best-effort. No hay retry, compensación, outbox,
transacción nueva ni cambio de destinatarios. El warning por clínica ausente y
la metadata segura se preservan. Auditoría mantiene actor por realm, event
names, clinic/report, metadata y propagación de errores.

## Tests y guards M35

- Nuevo `test/architecture/study-tracking-phase-closeout.test.ts`: inventario
  exacto; shims domain ausentes; shim DB y allowlist; owners/milestones; hashes
  de rutas; seam de composición; consumers/tests de application; separación de
  realms; guards existentes y ausencia de M33.
- Guard domain: invertido de shim existente a paths ausentes y cero imports
  globales.
- Suite completeness: registra el guard M35.
- Integraciones clínica/particular/admin: agregan selectores hostiles y
  separación cross-realm.
- Cross-tenant IDOR: agrega `CTIDOR-017` con paths y nombres de evidencia
  ejecutable.

Los guards existentes de application, infrastructure, thin clinic/particular y
thin admin mantienen sus invariantes sin duplicarlos en M35.

## Allowlist y denylist

El cambio se limita a shims domain, README canónicos, documento M35, guard M35,
guard domain, suite completeness, cross-tenant IDOR y las tres integraciones
Study Tracking. El README infrastructure cambia porque su inventario de
consumidores estaba desactualizado.

Permanecen sin cambios: tres rutas propias, domain canónico, application,
repository/infrastructure TypeScript, composition, shim DB, consumidores
externos, Reports, Particular Access, Report Access, auth, email, auditoría,
CORS, permisos, schema, migraciones, frontend, manifests, lockfile, scripts,
workflows y configuración productiva.

## Riesgos, rollback y readiness

- Riesgo residual: tras M33, el shim DB sigue siendo dependencia externa de
  Reports hasta M36.
  Mitigación: contenido exacto y allowlist default-deny.
- Riesgo residual: aislamiento multi-tenant depende de aplicación, no de RLS.
  Mitigación: integración por realm, operations unitarias, ownership y
  `CTIDOR-017`.
- Rollback: revertir el commit M35 restaura únicamente los dos reexports
  domain y retira tests/docs M35. No requiere migración, schema, compensación o
  cambio de datos.
- Evidencia local: se completa en la sección de validación.
- Runtime staging: pendiente.
- DB/schema real: no validada en M35.
- Producción: no ejecutada.

## Validación

| Gate | Estado | Resultado |
| --- | --- | --- |
| Guard M35 | PASSED | 9/9, 0 skip/fail, exit code 0 |
| Guards domain/application/infrastructure + completeness + IDOR | PASSED | 52/52 final, 0 skip/fail, exit code 0 |
| Cohorte dirigida | PASSED | 42 archivos, 313/313, 0 skip/fail, exit code 0 |
| `pnpm typecheck` | PASSED | exit code 0 |
| `pnpm typecheck:test` | PASSED | exit code 0 |
| `pnpm validate:local` | PASSED | 3.684 tests: 3.683 pass, 1 skip, 0 fail; exit code 0 |
| Build | PASSED | esbuild, incluido en `validate:local`, exit code 0 |
| `pnpm security:public-surface` | PASSED | cero findings públicos; dos markers server-only esperados; exit code 0 |
| `git diff --check` | PASSED | exit code 0 |

La primera corrida de la etapa dirigida terminó FAILED sólo porque el contrato
completeness exige que su propio source sea ASCII-only y un marcador nuevo
contenía una letra acentuada. El marcador se normalizó a ASCII; la repetición
exacta quedó 52/52 PASSED. No hubo fallo runtime ni cambio productivo.

Audits de dependencias, schema/migraciones y frontend E2E no se seleccionan
porque el diff no modifica esos dominios.

## Estado final

Fase G quedó cerrada por evidencia local ejecutable. M33 actualiza únicamente
la allowlist residual: Particular Access ya no consume el shim y Reports/M36
permanece pendiente. M35 no afirma merge.
