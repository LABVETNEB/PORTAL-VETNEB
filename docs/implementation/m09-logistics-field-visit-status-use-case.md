# M09 — Caso de uso de actualización de field visit (Fase B de Logistics)

> **Tipo:** Extracción de caso de uso application + puerto mínimo detrás del
> contrato HTTP existente.
> **Scope primario:** backend runtime, tests y documentación proporcional.

## 1. Baseline

- Rama: `refactor/backend-modularization-m09-logistics-field-visit-status-use-case`.
- Base: `b0b853f8881e5ead85d6fc3aec09c22ab607d52d` — cierre M08 (#1504).
- Working tree e índice iniciales: limpios.
- `AGENTS.md` raíz leído completo; no existen instrucciones anidadas versionadas.

## 2. Autorización R2

Nico autorizó exclusivamente la extracción de
`updateClinicScopedFieldVisit(id, clinicId, input)` a application, su composición
desde el seam `LogisticsFieldVisitsNativeRoutesOptions` y la delegación desde
`PATCH /api/logistics/field-visits/:fieldVisitId`, con allowlist cerrada de diez
paths. No se autorizó ninguna otra operación Git/GitHub ni cambio de backend.

## 3. Scope incluido

- Puerto mínimo `LogisticsFieldVisitUpdateRepository`.
- Caso de uso factory `createUpdateFieldVisit`.
- Composición desde `deps.updateClinicScopedFieldVisit` antes de los handlers.
- Sustitución exclusiva de la llamada persistente del PATCH por el caso de uso.
- Test unitario, contrato de fuente y test runtime Fastify sin DB real.
- Barrel, README application y status del rector.

## 4. Scope excluido

- `GET /`, `POST /`, location, time-windows y OPTIONS.
- Route plans, route stops, route events, SLA y cache.
- DB, queries, transacciones, schema y migraciones.
- Auth, sesiones, permisos, CORS, trusted-origin, cookies y rate limits.
- Frontend, dependencias, lockfiles y CI.
- Guard global application (M11) y thin-route completo (M15).

## 5. Resolución de “asignación”

No existe endpoint `/assign` en `logistics-field-visits.fastify.ts`. La asignación
manual de una visita a una ruta se representa mediante route stops; la generación
automática, mediante la generación heurística de stops. Esos flujos ya fueron
extraídos en M08 y M07 respectivamente.

M09 no agrega endpoints, reasignación, unassign, DELETE, unicidad, idempotencia ni
código adicional de asignación.

## 6. Significado preservado de estados

Los valores continúan siendo exactamente `pending`, `scheduled`, `in_progress`,
`done`, `canceled` y `no_show`. El PATCH sigue aceptando status junto con los
demás campos actualizables y los envía en una única operación.

No se agregó máquina de estados, transición permitida/prohibida, compare-and-set,
optimistic locking, auditoría, route event, side-effect, sincronización con route
stops, idempotencia ni rechazo del mismo estado.

## 7. Diseño

### Puerto

`LogisticsFieldVisitUpdateRepository<TFieldVisit, TUpdateInput>` expone una sola
operación:

```text
updateClinicScopedFieldVisit(id, clinicId, input)
  -> Promise<TFieldVisit | null | undefined>
```

Es estructural y genérico: no importa Fastify, `db-logistics.ts`, Drizzle, schema
ni infraestructura concreta.

### Caso de uso

`createUpdateFieldVisit(repository)` devuelve una función que recibe `id`,
`clinicId` e input, delega exactamente una vez y devuelve la promesa del puerto
sin transformar resultado ni error. No inspecciona ni fragmenta el input.

### Composición y handler

La ruta compone una vez:

```text
createUpdateFieldVisit({
  updateClinicScopedFieldVisit: deps.updateClinicScopedFieldVisit
})
```

El PATCH conserva la secuencia observable:

```text
trusted-origin -> auth/sesión -> permiso -> parse id -> parse body
-> update clinic-scoped -> 404 o 200 -> mensaje -> serialización
```

La carga default desde `db-logistics.ts` y el tipo `Options` permanecen intactos.

## 8. Archivos

### Nuevos

- `server/features/logistics/application/ports/logistics-field-visit-update-repository.ts`.
- `server/features/logistics/application/update-field-visit.ts`.
- `test/unit/application/logistics/update-field-visit.test.ts`.
- `test/integration/adapters/controllers/logistics-field-visits-integration.fastify.test.ts`.
- `docs/implementation/m09-logistics-field-visit-status-use-case.md`.

### Modificados

- `server/features/logistics/application/index.ts`.
- `server/features/logistics/application/README.md`.
- `server/routes/logistics-field-visits.fastify.ts`.
- `test/integration/adapters/controllers/logistics-field-visits-api.test.ts`.
- `docs/audit/backend-enterprise-modularization-program-audit.md`.

## 9. Contratos preservados

- Mismos endpoint, método, prefijo, payload y respuesta.
- Mismos 400, 401, 403, 404 y 200 con los mismos mensajes.
- Mismos trusted-origin, auth, sesión y permiso.
- Mismo `clinicId` proveniente de la sesión y mismo 404 para resultado ausente.
- Mismos parsing, validaciones y `serializeFieldVisit`.
- Misma dependencia DB, query y ausencia de transacción en update.
- Mismos estados y posibilidad de actualizar status junto con otros campos.

## 10. Tests

El unitario cubre forwarding exacto, llamada única, identidad, null, undefined,
error original e input combinado. El contrato de fuente fija import, composición,
delegación exclusiva del PATCH, persistencia de las dependencias directas fuera
de scope y frontera de imports.

El runtime Fastify cubre éxito status-only, éxito combinado, 400 por status/body/id,
404 para null/undefined, 403 por permiso/origen, clinicId de sesión y dos PATCH
iguales como dos delegaciones independientes. No usa DB real.

## 11. Validaciones

| Gate | Estado |
|---|---|
| Test dirigido M09 | PASSED — 98/98, exit code 0 |
| `pnpm validate:local` | PASSED — 3205 tests, 3204 pass, 1 skipped, exit code 0 |
| `pnpm security:public-surface` | PASSED — sin exposición pública, exit code 0 |
| Diff/allowlist/denylist | PASSED — match exacto, índice vacío, exit code 0 |
| Artefactos Playwright | BLOCKED — existen directorios ignorados preexistentes del 2026-07-18 bajo `frontend/`; la denylist M09 prohíbe modificarlos |

## 12. Riesgos y mitigaciones

- **Contrato HTTP:** mitigado al sustituir sólo la llamada persistente y cubrir
  status/mensajes en runtime.
- **Cross-tenant:** mitigado al reenviar el clinicId autenticado sin aceptar el
  valor del body.
- **Separación artificial de status:** evitada; el input completo se delega una
  sola vez.
- **Scope creep a asignación/M10/M11/M15:** bloqueado por allowlist y tests de
  dependencias fuera de scope.
- **Tests source-anchored:** realineados sin eliminar asserts de seguridad.

## 13. Rollback independiente

Un revert único restaura la llamada directa del PATCH, retira los dos archivos
application M09 y sus tests, y revierte barrel/docs. No requiere revertir M06–M08.

## 14. Estado final

Implementación y gates funcionales completados dentro de la allowlist. La
revisión final queda bloqueada únicamente por artefactos Playwright ignorados y
preexistentes fuera de la autorización M09.
