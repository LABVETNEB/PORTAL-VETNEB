# M02b · Mover SLA breach y time-window al dominio Logistics

## Base exacta

- **Rama:** `refactor/backend-modularization-m02b-logistics-domain`.
- **HEAD base:** `7a382f172f229b35a0362396182bb9828aa09a1e` — `refactor(server): remove express-era orphan handlers (M02) (#1497)`.
- **Working tree inicial:** limpio.
- **Milestone:** Fase A — M02b.

## Objetivo

Migrar al bounded context Logistics dos módulos que hoy viven en
`server/lib/logistics/`:

- `time-window.ts` — dominio puro; se mueve a
  `server/features/logistics/domain/time-window.ts`.
- `sla-breach.ts` — **no** es íntegramente dominio puro; se separa en núcleo puro
  (`domain/sla-breach.ts`) y adaptador de DB
  (`infrastructure/sla-breach-db.ts`).

Preservando comportamiento observable, errores, defaults, payloads y orden de
side-effects; alineando imports y tests anclados en el mismo PR; manteniendo verde
el guard de frontera; sin tocar rutas, endpoints, schema, DB ni contratos públicos;
sin introducir dependencias.

## Censo de importadores (evidencia `git grep`)

Path legacy `lib/logistics/time-window`:

- Runtime: `server/db-logistics.ts` (import de `assertValidTimeWindowRange`,
  `normalizeTimeWindowTimezone`).
- Test: `test/unit/migrations/logistics/logistics-time-windows-schema.test.ts`.

Path legacy `lib/logistics/sla-breach`:

- Runtime: **ninguno.** `markOverdueSlaBreaches` y `markOverdueSlaBreachesWithDb`
  no se importan desde ninguna ruta ni módulo de `server/**` fuera del propio
  archivo.
- Test: `test/unit/infrastructure/logistics/logistics-sla-breach-runtime.test.ts`.

Símbolos:

- `assertValidTimeWindowRange`, `normalizeTimeWindowTimezone` — sólo `db-logistics.ts`
  (runtime) y el test de time-window.
- `markOverdueSlaBreaches`, `markOverdueSlaBreachesWithDb`,
  `MarkOverdueSlaBreachesDeps` — sólo el archivo legacy y su test de runtime.
- `MarkOverdueActiveClinicSlaInstancesBreachedParams`, `SlaInstance` — definidos en
  `db-logistics.ts`; el legacy `sla-breach.ts` los importaba como tipos.

Docs que referencian los paths legacy (fuera de scope, se dejan como baseline
histórico): `docs/architecture/shared-lib-boundary-inventory.md` y
`docs/logistics/ROLLING_ROADMAP.md`.

## Contradicción detectada

```text
CONTRADICTED:
la documentación M01/ARCH-4 (docs/architecture/shared-lib-boundary-inventory.md,
filas de sla-breach) clasifica sla-breach como módulo de dominio puro que importa
solamente el tipo SlaTargetType del schema, pero el código actual importa tipos
(MarkOverdueActiveClinicSlaInstancesBreachedParams, SlaInstance) y runtime
(import dinámico de markOverdueActiveClinicSlaInstancesBreached) desde
server/db-logistics.ts.
```

No se modificó el documento rector de auditoría ni el inventario para ocultar la
divergencia; se resolvió en el código separando núcleo puro y adaptador, y se dejó
constancia en `server/features/logistics/README.md` (§1, nota) y en este documento.

## Decisión shim / no-shim

Sin shim. El censo prueba que no hay consumidores runtime del path legacy
`lib/logistics/sla-breach`; conservar un re-export sólo por precaución habría sido
código muerto. Ambos archivos legacy se eliminan. El único consumidor runtime de
`time-window` (`db-logistics.ts`) se reapunta al barrel de `domain/`.

## Separación domain / infrastructure

- **`domain/sla-breach.ts`** — núcleo puro `markOverdueSlaBreaches` y sus tipos. No
  importa `db.ts`, `db-logistics.ts`, Drizzle runtime, Fastify, env ni I/O. Sólo
  importa el tipo `SlaTargetType` del shared kernel (`drizzle/schema.ts`).
- **Resolución de tipos sin `db-*`:** el dominio nunca lee campos de una instancia
  marcada (sólo la cuenta y la reenvía). Se resuelve con **parametrización genérica
  simple** (`TInstance`): el tipo de la fila es opaco para el dominio, evitando
  importar `SlaInstance` desde `db-logistics.ts` y sin duplicar el schema ni usar
  `any`. El contrato de parámetros de la dependencia inyectada se modela con un tipo
  estructural mínimo de dominio (`MarkOverdueSlaInstancesParams`).
- **`infrastructure/sla-breach-db.ts`** — adaptador transitorio
  `markOverdueSlaBreachesWithDb`. Importa el dominio por el barrel
  (`../domain/index.ts`), importa el tipo `SlaInstance` desde `db-logistics.ts`,
  mantiene el import dinámico (lazy) de `markOverdueActiveClinicSlaInstancesBreached`
  y delega en `markOverdueSlaBreaches` (con `TInstance = SlaInstance` inferido). No
  duplica lógica de negocio.
- **`domain/index.ts`** — el barrel re-exporta la API de dominio (time-window + SLA
  puro + lo previo), **no** el adaptador de infraestructura.

## Contratos preservados

- **time-window:** default `"UTC"`, `trim()` del timezone, cap exacto de 64,
  rango válido sólo si `start < end`, fechas inválidas → `false`, error exacto
  `windowStart must be earlier than windowEnd`.
- **sla-breach:** validación de `clinicId`; validación de fechas; llamada única al
  clock inyectado para los defaults; `dueAtOrBefore`/`breachedAt`; paso de
  `targetType`; escritura antes de notificación; notificación sólo cuando hay
  breaches; sin notificación cuando el resultado es vacío; payload de notificación
  idéntico; mensajes `clinicId debe ser un entero positivo`, `now invalido`,
  `dueAtOrBefore invalido`, `breachedAt invalido`.
- **db-logistics.ts:** sólo cambian imports (consume time-window por el barrel).
  Queries, tipos de entrada, mapping, transacciones y orden de operaciones intactos.

## Archivos

| Archivo | Cambio |
| --- | --- |
| `server/features/logistics/domain/time-window.ts` | **CREATED.** Copia literal del dominio puro. |
| `server/features/logistics/domain/sla-breach.ts` | **CREATED.** Núcleo puro genérico + tipos de dominio. |
| `server/features/logistics/infrastructure/sla-breach-db.ts` | **CREATED.** Adaptador de DB transitorio. |
| `server/features/logistics/domain/index.ts` | **MODIFIED.** Barrel re-exporta time-window y SLA puro. |
| `server/db-logistics.ts` | **MODIFIED.** Import de time-window vía barrel (sólo imports). |
| `server/lib/logistics/time-window.ts` | **DELETED.** |
| `server/lib/logistics/sla-breach.ts` | **DELETED.** |
| `test/unit/domain/logistics/logistics-sla-breach.test.ts` | **CREATED.** 6 casos puros vía barrel. |
| `test/unit/infrastructure/logistics/logistics-sla-breach-runtime.test.ts` | **MODIFIED.** Adaptador vía infra; regex lazy import `../../../db-logistics.ts`. |
| `test/unit/migrations/logistics/logistics-time-windows-schema.test.ts` | **MODIFIED.** Import vía barrel. |
| `test/unit/domain/logistics/logistics-domain-barrel.test.ts` | **MODIFIED.** Cobertura de time-window y SLA puro. |
| `server/features/logistics/README.md` | **MODIFIED.** Estado real post-M02b. |
| `server/features/logistics/domain/README.md` | **MODIFIED.** Lista archivos y barrel. |
| `server/features/logistics/infrastructure/README.md` | **MODIFIED.** Adaptador transitorio. |
| `docs/implementation/m02b-logistics-sla-time-window-domain-move.md` | **CREATED.** Este documento. |

## Tests anclados

- `test/architecture/logistics-domain-boundary-guard.test.ts` — verde sin cambios;
  cubre automáticamente los archivos nuevos de `domain/` y exige que el adaptador de
  `infrastructure/` importe el dominio por el barrel.
- `test/unit/domain/logistics/logistics-domain-barrel.test.ts` — +2 casos (time-window
  y SLA puro).
- `test/unit/domain/logistics/logistics-sla-breach.test.ts` — 6 casos de comportamiento
  puro migrados desde el runtime test, consumidos por el barrel.
- `test/unit/infrastructure/logistics/logistics-sla-breach-runtime.test.ts` — conserva
  el caso del lazy import + delegación (adaptado al nuevo archivo) y añade un caso que
  fija el consumo del dominio por el barrel.
- `test/unit/migrations/logistics/logistics-time-windows-schema.test.ts` — mismos 8
  casos, import reapuntado al barrel.
- `test/unit/infrastructure/logistics/logistics-db.test.ts` — sin cambios (el import
  del barrel y los call-sites de time-window siguen intactos).

**Reconciliación de casos:** SLA runtime 7 → domain 6 + infra 2 = 8 (no reduce, +1);
barrel 2 → 4 (+2); time-window 8 → 8; db sin cambios. M02b no elimina ningún caso.

## Validaciones

Ver la sección de validaciones del reporte de ejecución (gates dirigidos con
`pnpm exec tsx --test`, luego `pnpm validate:local`, luego `git diff --check`).

## Riesgos residuales

- Bajo. El cambio preserva comportamiento y está cubierto por el guard de frontera y
  por los tests de dominio, adaptador y db.
- Referencias a los paths legacy quedan en `shared-lib-boundary-inventory.md` (no
  modificable en esta tarea) y `docs/logistics/ROLLING_ROADMAP.md` (fuera de scope):
  staleza documental, no rompe build/tests/guards. Se reconcilia en un pase de docs
  posterior.

## Rollback independiente

Revertir el PR restaura los dos archivos legacy y sus imports/tests; no hay cambios
de schema, migraciones ni contratos que compliquen el revert.

## Exclusiones

Sin cambios en `server/routes/**`, `server/fastify-app.ts`, `drizzle/**`,
`migrations/**`, schema, auth/sesiones/cookies/CORS/CSP/rate-limits/headers,
`frontend/**`, `package.json`, lockfiles, `.github/**`, `scripts/**`. No se inició
M03–M06. No se modificaron `docs/audit/backend-enterprise-modularization-program-audit.md`
ni `docs/architecture/shared-lib-boundary-inventory.md`.

## Readiness para M03

`route-planning.ts` y `metrics.ts` siguen en `server/lib/logistics/`; ambos importan
sólo tipos de schema. El patrón M02b (mover a `domain/`, re-exportar por el barrel,
alinear el consumidor `db-logistics.ts` y los tests) es directamente reutilizable
para ellos.
