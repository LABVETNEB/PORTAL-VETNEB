# M32 — Study Tracking: thin routes de clínica y particular

**Estado:** implementado y validado localmente; pendiente de publicación y
checks remotos.

- **Rama:**
  `refactor/backend-modularization-m32-study-tracking-clinic-particular-thin-routes`
- **Base exacta:** `c17b263ca6571e067e524d6eff685dcedac28c99`
  (`refactor(study-tracking): add use cases and repository (#1565)`)
- **Programa:** Fase G, milestone M32
- **AGENTS aplicable:** sólo `AGENTS.md` raíz
- **Riesgo:** R2 estructural backend, autorizado expresamente para M32

## 1. Objetivo y exclusiones

M32 convierte las rutas de clínica y particular de Study Tracking en adapters
HTTP finos. La coordinación posterior a auth/parsing se traslada a operaciones
cohesivas de application. Las rutas conservan Fastify, request/reply,
trusted-origin, auth/sesiones, permisos, validación HTTP, status, mensajes,
payloads, serialización, CORS, timers y logging.

Quedan fuera:

- M32b: `server/routes/admin-study-tracking.fastify.ts` permanece
  byte-identical;
- M33 y milestones posteriores;
- domain, infrastructure, shim `server/db-study-tracking.ts`,
  `server/db-particular.ts`, DB, email/audit concretos, auth, CORS, permisos,
  schema, migraciones, frontend, dependencias, scripts y workflows.

No se introduce RLS y no se afirma que exista. Tampoco se agregan
transacciones, retries, outbox, queues, compensaciones ni cambios de datos.

## 2. Baseline e inventario

El árbol inicial estaba limpio. Rama, `HEAD`, `main` y `origin/main` apuntaban a
la base exacta. M31 estaba cerrado en PR #1565.

| Métrica | Clínica baseline | Particular baseline |
| --- | ---: | ---: |
| LOC | 1.072 | 595 |
| Imports | 11 | 9 |
| Tipos locales | 8 | 6 |
| Helpers top-level | 10 | 9 |
| Options públicas | 22 | 10 |
| Endpoints funcionales | 6 | 4 |
| OPTIONS | 5 | 4 |
| Calls directas a repository desde handlers | 8 | 4 |
| SHA-256 | `678909a1b819dd8ac09b1462ced9c9b4d3e2ed9a32fdccf6058384985a34aeae` | `e420834571555ac46c85e053e253d0639ef5d2e8d64e6193c328637b28434094` |

El censo se realizó con AST de TypeScript para imports, tipos, helpers,
Options, métodos/paths y calls de handlers; `rg` se usó como apoyo, no como
única evidencia.

## 3. Superficie HTTP preservada

### Clínica

| Método | Path |
| --- | --- |
| GET | `/` |
| GET | `/:trackingCaseId` |
| GET | `/notifications` |
| PATCH | `/notifications/:notificationId/read` |
| PATCH | `/notifications/read-all` |
| POST | `/` |
| OPTIONS | `/`, `/:trackingCaseId`, `/notifications`, `/notifications/:notificationId/read`, `/notifications/read-all` |

### Particular

| Método | Path |
| --- | --- |
| GET | `/me` |
| GET | `/notifications` |
| PATCH | `/notifications/:notificationId/read` |
| PATCH | `/notifications/read-all` |
| OPTIONS | `/me`, `/notifications`, `/notifications/:notificationId/read`, `/notifications/read-all` |

No cambian métodos, paths, orden de precedencia, status, mensajes, payloads,
headers, cookies, realms, trusted-origin, CORS, paginación 50/100,
`unreadOnly`, offset ni serialización.

El POST clínico conserva el permiso preexistente que responde 403 antes de
parsing. El workflow extraído permanece disponible detrás de ese contrato sin
“corregir” su condición actualmente inalcanzable.

## 4. Arquitectura resultante

```text
routes/
  study-tracking.fastify.ts
  particular-study-tracking.fastify.ts
        │ auth/session + HTTP
        ▼
features/study-tracking/application/
  clinic-study-tracking-operations.ts
  particular-study-tracking-operations.ts
  ports/clinic-study-tracking-reference-repository.ts
        │ puertos M31 + referencia clínica
        ▼
features/study-tracking/study-tracking-route-composition.ts
        │ selección de exports; sin queries ni reglas
        ▼
features/study-tracking/infrastructure/index.ts
```

Las rutas consumen application exclusivamente por su barrel. No importan
infrastructure ni `server/db-study-tracking.ts`. Application no importa HTTP,
infrastructure, DB, Drizzle, schema, auth, sesiones, CORS, email o auditoría
concretos.

El archivo de composición feature-level fue indispensable fuera de la lista
productiva inicial para satisfacer simultáneamente tres invariantes: rutas sin
shim/infrastructure directo, application sin infrastructure y denylist de
infrastructure sin cambios. Sólo selecciona exports canónicos existentes; no
contiene queries, adapters con persistencia ni lógica de negocio.

## 5. Operaciones application

`createClinicStudyTrackingOperations` expone seis operaciones:

1. listar notificaciones clinic-scoped;
2. marcar una notificación clinic-scoped;
3. marcar todas las notificaciones clinic-scoped;
4. listar casos clinic-scoped;
5. obtener un caso clinic-scoped;
6. crear seguimiento desde clínica.

`createParticularStudyTrackingOperations` expone cuatro operaciones:

1. obtener el seguimiento del token autenticado;
2. listar notificaciones particular-token-scoped;
3. marcar una notificación particular-token-scoped;
4. marcar todas las notificaciones particular-token-scoped.

Las diez operaciones tienen un consumidor runtime y cobertura unitaria. Se
reutilizan las cinco composiciones M31 aplicables: query/command clínica,
query/command particular y side-effects. Los exports admin M31 permanecen
intactos y la ruta admin continúa consumiéndolos directamente.

## 6. Puertos y composición

Puertos M31 reutilizados:

- `ClinicStudyTrackingQueryRepository`;
- `ParticularStudyTrackingQueryRepository`;
- `ClinicStudyTrackingCommandRepository`;
- `ParticularStudyTrackingCommandRepository`;
- `StudyTrackingNotificationPort`;
- `StudyTrackingAuditPort`.

Se agrega sólo `ClinicStudyTrackingReferenceRepository`, con las referencias
reales que necesita el workflow clínico: clínica, informe clinic-scoped, token
particular y vínculo token/informe. No es un repository CRUD genérico.
`createDate` permanece como dependencia funcional inyectada.

Todas las Options existentes siguen aceptando inyección. Con Options completas
no se cargan defaults.

- Clínica compone una vez durante el registro del plugin.
- Particular conserva carga lazy: una promesa local al registro del plugin se
  crea en el primer handler y se memoiza. No existe estado global mutable ni
  composición repetida por request.
- Los errores de carga, repositorio y auditoría conservan identidad.

## 7. Tenant scopes y side effects

### Clínica

`clinicId` proviene exclusivamente de la sesión autenticada. List/get/create y
acknowledgements se parametrizan desde ese actor. El informe se consulta
clinic-scoped y el token particular debe pertenecer a la misma clínica.

Orden exacto del create con tinción especial:

1. validar existencia de clínica;
2. validar informe clinic-scoped cuando existe `reportId`;
3. validar token y su `clinicId` cuando existe `particularTokenId`;
4. calcular entrega con domain;
5. crear el caso;
6. vincular token particular con informe cuando ambos existen;
7. crear la notificación;
8. actualizar `specialStainNotifiedAt` con clock inyectado;
9. releer clínica y enviar email best-effort;
10. auditar creación del caso;
11. auditar creación de notificación;
12. devolver el caso actualizado o el caso creado si update devuelve
    `null`/`undefined`.

Sin tinción se omiten notificación, update de timestamp y email. El vínculo se
omite si falta token o informe. Sólo el error SMTP dentro del envío es
best-effort; errores de lookup, repository o auditoría se propagan. No hay
retry, compensación ni transacción nueva.

### Particular

`particularTokenId` proviene exclusivamente de la sesión particular.
`clinicId` y `reportId` se derivan del token autenticado. `/me`, list,
acknowledgement y read-all no aceptan selectores de tenant del cliente ni
fallback global.

## 8. Options preservadas

Clínica conserva exactamente 22 keys:

`deleteActiveSession`, `getActiveSessionByToken`, `getClinicUserById`,
`updateSessionLastAccess`, `hashSessionToken`, `getClinicById`,
`getReportById`, `getClinicScopedReportById`, `getParticularTokenById`,
`updateParticularTokenReport`, `createStudyTrackingCase`,
`updateStudyTrackingCase`, `getClinicScopedStudyTrackingCase`,
`listStudyTrackingCases`, `createStudyTrackingNotification`,
`listStudyTrackingNotifications`,
`markStudyTrackingNotificationReadScoped`,
`markAllStudyTrackingNotificationsReadScoped`,
`sendSpecialStainRequiredEmail`, `writeAuditLog`, `now` y `createDate`.

Particular conserva exactamente 10 keys:

`deleteParticularSession`, `getParticularSessionByToken`,
`getParticularTokenById`, `updateParticularSessionLastAccess`,
`hashSessionToken`, `getParticularStudyTrackingCase`,
`listStudyTrackingNotifications`,
`markStudyTrackingNotificationReadScoped`,
`markAllStudyTrackingNotificationsReadScoped` y `now`.

El guard AST verifica sets exactos, endpoint registry, calls de handlers,
imports, laziness local y SHA de admin.

## 9. Métricas finales

| Métrica | Clínica antes | Clínica después | Particular antes | Particular después |
| --- | ---: | ---: | ---: | ---: |
| LOC | 1.072 | 904 | 595 | 587 |
| Imports | 11 | 11 | 9 | 9 |
| Tipos locales | 8 | 7 | 6 | 6 |
| Helpers top-level | 10 | 9 | 9 | 10 |
| Calls directas a repository desde handlers | 8 | 0 | 4 | 0 |
| Operaciones application de alto nivel | 0 | 6 | 0 | 4 |

- Clínica: -168 LOC, **-15,67 %**.
- Particular: -8 LOC, **-1,34 %**.
- Total de adapters objetivo: 1.667 → 1.491 LOC; -176,
  **-10,56 %**.
- Calls directas a repository desde handlers: 12 → 0.

La reducción proviene de extraer coordinación real. No se minifica, comprime ni
oculta lógica.

Admin conserva 1.244 LOC y SHA-256
`74ffd1c81ea673020439f3cdc1b49dc9edc8ab613b3c5ae7f306cdac70b948cc`,
idéntico al baseline.

## 10. Tests y guards

- Dos unit tests nuevos cubren forwarding, identidad de resultados/errores,
  `null`, `undefined`, arrays vacíos, no mutación, scopes, precondiciones,
  vínculo token/informe, timestamp, combinación/ausencia de side effects,
  email exitoso/fallido, auditoría y orden exacto.
- El guard thin usa AST de TypeScript; no usa comentarios como evidencia.
- Los guards application/infrastructure verifican barrels, dependencias,
  composición única, ports type-only y consumidores legacy.
- Completeness registra módulos, exports, consumers, tests y guards nuevos.
- Ownership, actor relationship, write attribution, validation cutoff,
  mutation permission, critical route y auditoría leen la nueva frontera
  route/application sin debilitar invariantes.

Tres archivos fuera de la lista inicial de tests resultaron indispensables y
pertenecen a M32:

- `test/architecture/audit-study-tracking-gaps.test.ts`;
- `test/architecture/security/security-actor-relationship-boundaries.test.ts`;
- `test/architecture/security/security-write-attribution-boundaries.test.ts`.

Eran contratos source-only de Study Tracking anclados a coordinación inline.
La primera corrida completa los identificó; sólo se reapuntaron a la operación
application. No se alteraron expectativas runtime.

## 11. Allowlist real

### Runtime y documentación de feature

- `server/routes/study-tracking.fastify.ts`
- `server/routes/particular-study-tracking.fastify.ts`
- `server/features/study-tracking/README.md`
- `server/features/study-tracking/application/README.md`
- `server/features/study-tracking/application/index.ts`
- `server/features/study-tracking/application/clinic-study-tracking-operations.ts`
- `server/features/study-tracking/application/particular-study-tracking-operations.ts`
- `server/features/study-tracking/application/ports/clinic-study-tracking-reference-repository.ts`
- `server/features/study-tracking/study-tracking-route-composition.ts`

### Tests

- `test/unit/application/study-tracking/clinic-study-tracking-operations.test.ts`
- `test/unit/application/study-tracking/particular-study-tracking-operations.test.ts`
- `test/unit/contracts/study-tracking/study-tracking-suite-completeness.test.ts`
- `test/architecture/study-tracking-application-boundary-guard.test.ts`
- `test/architecture/study-tracking-infrastructure-boundary-guard.test.ts`
- `test/architecture/study-tracking-clinic-particular-thin-routes.test.ts`
- `test/architecture/audit-study-tracking-gaps.test.ts`
- `test/architecture/security/security-actor-relationship-boundaries.test.ts`
- `test/architecture/security/security-critical-route-surface-registry.test.ts`
- `test/architecture/security/security-mutation-permission-surface.test.ts`
- `test/architecture/security/security-resource-ownership-boundaries.test.ts`
- `test/architecture/security/security-validation-cutoff-boundaries.test.ts`
- `test/architecture/security/security-write-attribution-boundaries.test.ts`

### Documento

- `docs/implementation/m32-study-tracking-clinic-particular-thin-routes.md`

## 12. Validaciones observadas

| Gate | Estado | Evidencia |
| --- | --- | --- |
| Unit tests M32 | **PASSED** | 10/10, exit code 0 |
| Guards M32/application/infrastructure | **PASSED** | 22/22 final, exit code 0 |
| Rutas clínica + particular + admin | **PASSED** | 35/35, exit code 0 |
| Cohorte dirigida | **PASSED** | 244/244, exit code 0 |
| `pnpm typecheck` | **PASSED** | exit code 0 |
| `pnpm typecheck:test` | **PASSED** | exit code 0 |
| Primer `pnpm validate:local` | **FAILED** | 3 guards source-only desactualizados; 3.632 pass, 3 fail, 1 skip |
| Guards reapuntados | **PASSED** | 10/10, exit code 0 |
| `pnpm validate:local` final | **PASSED** | typechecks + 3.636 tests: 3.635 pass, 1 skip preexistente, 0 fail + build; exit code 0 |
| Build backend | **PASSED** | incluido en `validate:local`; esbuild completó, exit code 0 |
| `pnpm security:public-surface` | **PASSED** | sin findings públicos; exit code 0 |
| `git diff --check` | **PASSED** | exit code 0 |

No se seleccionaron audits de dependencias, schema, migraciones, frontend ni
E2E porque no se modifican sus dominios.

## 13. Riesgo residual y rollback

El riesgo residual se concentra en composición y source guards. Queda cubierto
por Options inyectadas, lazy local, unit tests de orden/errores, integración de
los tres realms, guard AST, suite completa, typechecks, build y auditoría de
superficie pública.

Rollback: revertir el commit M32 restaura coordinación inline en las dos rutas
y retira operaciones/puerto/composición nuevos. No requiere migración,
compensación, rollback de schema ni cambios de datos.

## 14. Estado de milestones

- M31: cerrado en PR #1565.
- M32: implementado y validado localmente.
- M32b: no iniciado; admin byte-identical.
- M33+: no iniciado.
- Deploy/staging: no ejecutados.
- Merge: no ejecutado.
