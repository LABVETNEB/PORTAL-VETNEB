# ADR: Backend Domain Boundaries

> **Tipo:** ADR **docs-only**. No implementa, no mueve código, no toca CSS, tests,
> `package.json`, lockfiles, CI ni schema. Un único archivo nuevo bajo
> `docs/architecture/`.
> **Base:** `main` limpio · **HEAD:** `25bfdec` docs(architecture): audit repository domain boundaries (#1296).
> **Documento rector:** [`docs/audit/repository-domain-architecture-audit.md`](../audit/repository-domain-architecture-audit.md) (ARCH-1).
> **Modelo / esfuerzo:** Claude Opus 4.8 · high.
> **ID:** ARCH-2.

## Status

**Proposed.**

Estas reglas de frontera se proponen como contrato de dependencia para los PRs de
migración posteriores (ARCH-3 en adelante). No hay todavía ninguna migración
ejecutada que las valide en código; por eso el estado es *Proposed* y no
*Accepted*. Pasa a **Accepted** cuando el primer PR piloto (ARCH-4, Logistics)
demuestre la frontera detrás de contratos con tests verdes.

## Date

2026-07-06

## Context

Este ADR materializa el hallazgo **P3-A** de ARCH-1 ("sin ADRs de frontera
backend"): existe `docs/governance/adr-template.md`, pero no había un ADR que
fijara las reglas de dependencia del backend como sí hace
`frontend/src/features/dashboard/README.md` para el frontend.

Hallazgos de ARCH-1 que fundamentan la decisión:

- **Backend Package by Layer dominante.** La estructura raíz (`server/routes/`,
  `server/db-*.ts`, `server/lib/`, `server/middlewares/`) está organizada por
  capa técnica, no por dominio.
- **Feature sólo por naming.** La pertenencia a un contexto vive en el prefijo del
  nombre (`admin-clinics.fastify.ts` ↔ `db-admin-clinics.ts` ↔
  `test/admin-clinics.fastify.test.ts`), no en carpetas. El único sub-paquete de
  dominio real es `server/lib/logistics/`.
- **Falta la capa application.** La lógica de negocio (validación, orquestación,
  reglas) vive inline dentro de handlers HTTP grandes; los handlers importan
  `db-*` directamente, sin servicio intermedio (P1-A).
- **Handlers HTTP grandes (god-handlers).** 7 rutas superan 1.000 LOC
  (`logistics-route-plans.fastify.ts` = 2.241, `auth.fastify.ts` = 1.514,
  `logistics-field-visits.fastify.ts` = 1.421, `clinic-public-profile.fastify.ts`
  = 1.316, `admin-study-tracking.fastify.ts` = 1.205).
- **`db-*` mezcla persistencia + mapping + validación (P1-B).** Los ~5.1k LOC de
  `db-*.ts` combinan queries Drizzle con mapeo y validación de dominio; no hay
  puerto/repositorio explícito. Cada `db-*` es auto-contenido (ninguno importa a
  otro), lo que mantiene bajo el acoplamiento entre contextos.
- **Seam frontend↔backend limpio.** `frontend/**` no importa `server/` ni `db` en
  ningún archivo; toda comunicación pasa por HTTP (`@/lib/api`) y Server Actions.
  Este eje horizontal ya está sano y no se toca.
- **Sin P0.** ARCH-1 no detectó dependencia rota, fuga de seguridad estructural ni
  riesgo de build derivado de la arquitectura.
- **P1 relevantes.** P1-A (ausencia de capa application), P1-B (feature sólo por
  naming, sin frontera de módulo backend) y P1-C (blueprint `features/` frontend
  aplicado a un solo dominio) son la deuda que este ADR y su secuencia de PRs
  buscan reducir de forma incremental.

**Restricciones (de `AGENTS.md` y de los guardrails de ARCH-1):** reorganizar, no
reescribir; 1 contexto por PR; siempre detrás de contratos existentes; sin
big-bang; no fragmentar `drizzle/schema.ts`; no tocar auth/security/middlewares
salvo PR dedicado; no romper rutas públicas.

**Nivel de riesgo:** este ADR es docs-only (riesgo nulo). Fija el contrato que
reduce el riesgo de los PRs de migración posteriores.

## Decision

Se definen las siguientes reglas para **futuros PRs** de migración backend. No se
aplica ningún cambio de código en este PR.

- `server/features/<domain>/` está permitido **sólo para migraciones piloto**
  aprobadas contexto por contexto; no se crea de forma masiva ni especulativa.
- La capa **domain** no importa Fastify, el runtime de Drizzle, `env`, `http`,
  middleware de auth ni React/Next. Sólo tipos (p.ej. tipos de
  `drizzle/schema.ts`) y lógica pura.
- La capa **application** orquesta casos de uso y se comunica con el exterior a
  través de **puertos** (interfaces), no de implementaciones concretas.
- La capa **infrastructure** implementa esos puertos (repositorios sobre Drizzle,
  clientes de email, cache).
- La capa **routes/http** adapta request/response: parseo, autorización y
  delegación al service; sin reglas de negocio inline.
- `drizzle/schema.ts` sigue siendo **shared kernel temporal**; no se fragmenta por
  contexto (rompería Drizzle y las migraciones 0000–0030).
- Los `db-*` actuales **no se mueven masivamente**; migran contexto por contexto,
  detrás de contratos, y sólo con tests verdes.
- **No se introduce event bus** todavía (ver ARCH-1 *Event-driven suitability*).
- **No hay cambios de DB/schema** ni de migraciones.
- **No se rompen rutas públicas** (`public-*`, `contact`, perfiles): paths y
  contratos estables.
- **No se cambia auth/security** sin un PR dedicado con auditoría de seguridad.

Este ADR **aplica a**: la organización interna del backend (`server/**`) y las
reglas de dependencia entre capas de un contexto migrado.

Este ADR **no aplica a**: el schema/DB, el eje HTTP frontend↔backend (ya limpio),
auth/security/middlewares, ni el rediseño visual.

## Dependency rules

Dirección permitida: `routes/http → application → domain`; `application` habla con
`infrastructure` **por puertos**; `infrastructure` implementa esos puertos.
`shared kernel` (schema/tipos) puede ser importado por cualquier capa; nunca al
revés.

| Layer | Puede importar | No puede importar | Ejemplo permitido | Ejemplo prohibido |
| --- | --- | --- | --- | --- |
| **routes/http** | application, domain (tipos), shared kernel, adaptadores http (`lib/http`), middlewares | `db-*` directo, Drizzle runtime, reglas de negocio inline | `routes/logistics-*` → `application/planRouteService` | `routes/logistics-*` → `../db-logistics` con lógica de negocio en el handler |
| **application** | domain, puertos (interfaces), shared kernel | Fastify, `db-*` concreto, Drizzle runtime, React/Next, `http` | `application/planRouteService` → `domain/route-planning` + `LogisticsRepositoryPort` | `application/*` → `import { db } from '../db'` |
| **domain** | shared kernel (sólo tipos), otras utilidades puras de su propio contexto | Fastify, Drizzle runtime, `env`, `http`, auth middleware, React/Next, `db-*` | `domain/sla-breach` → `import type { RoutePlan } from 'drizzle/schema'` | `domain/sla-breach` → `import Fastify from 'fastify'` |
| **infrastructure** | domain (para implementar puertos), shared kernel, Drizzle runtime, clientes externos (`lib/infra`) | routes/http, application (no invierte la dirección) | `infrastructure/logisticsRepository` implementa `LogisticsRepositoryPort` sobre `db-logistics` | `infrastructure/*` → `import { planRouteService } from '../application'` |
| **shared kernel** | nada del backend por-contexto (es hoja) | cualquier `features/<domain>/**`, routes, application, infrastructure | `drizzle/schema.ts` define entidades/tipos consumidos por todos | `drizzle/schema.ts` → `import ... from 'server/features/logistics'` |

Regla transversal: **la dependencia siempre apunta hacia adentro** (routes →
application → domain). `infrastructure` depende de `domain` (implementa sus
puertos), nunca al revés. Ningún módulo de `domain` conoce el transporte HTTP ni
el motor de persistencia.

## Folder target

Target **realista y opcional** por contexto, materializado sólo cuando hay código
real que habite cada capa (no carpetas vacías):

```
server/features/<domain>/
  domain/          # reglas puras — sin fastify, sólo tipos de schema
  application/     # services / casos de uso — orquesta vía puertos
  infrastructure/  # implementación de puertos (repositorio sobre db-*, cache, clientes)
  routes/          # thin handlers: parseo + auth + delegación al service
  index.ts         # superficie pública del contexto (barrel controlado)
```

**Esta estructura no se aplica masivamente.** Crear las cuatro carpetas en todos
los contextos de una vez sería *abstracción vacía* (anti-patrón prohibido por los
guardrails de ARCH-1). Se materializa **contexto por contexto**, empezando por el
piloto, y sólo cuando cada capa tiene código real.

## Pilot candidate

**Logistics** es el piloto recomendado, siguiendo la clasificación de ARCH-1
(cohesión *muy alta*, acoplamiento *bajo*, riesgo *bajo*). Razones:

- **Mayor subpaquete de dominio real ya existente.** Es el único contexto con
  lógica de dominio sub-paquetada: `server/lib/logistics/{metrics,route-planning,
  sla-breach,time-window}`, más `db-logistics` y `docs/logistics/MVP_DOMAIN.md`.
- **Fan-out claro.** Rutas (`logistics-route-plans`, `logistics-field-visits`,
  `logistics-route-events`, …), datos (`db-logistics`), dominio (`lib/logistics/*`)
  y cache (`logistics-route-plans-cache`) están alineados end-to-end por naming,
  lo que hace el mapeo a capas directo.
- **Valor operativo.** Concentra los god-handlers más grandes
  (`logistics-route-plans.fastify.ts` = 2.241 LOC), donde extraer application/domain
  tiene el mayor retorno de mantenibilidad.
- **Permite PRs chicos.** Al ser auto-contenido (su `db-*` no importa a otros) se
  puede migrar en pasos pequeños, cada uno detrás de los contratos por-ruta
  existentes, sin big-bang.

Contextos transversales (**Auth, Permissions, Audit, Email**) quedan **excluidos**
del piloto: son kernel/cross-cutting y sólo se tocan con PR dedicado.

## Migration sequence

PRs chicos, uno por paso, siempre detrás de contratos:

- **ARCH-3 — Triaje de naming.** Reagrupar `server/lib` por naming
  (`domain | infra | http`) y triaje de `frontend/src/lib`. Sin mover dominio
  fuera de su contexto todavía; re-exports + guardrails actualizados. Bajo riesgo.
- **ARCH-4 — Logistics read-only domain shell.** Crear
  `server/features/logistics/` con `index.ts` y re-exports de lo ya existente
  (`lib/logistics/*`, `db-logistics`), **sin cambiar rutas ni lógica**. Establece
  la frontera de módulo.
- **ARCH-5 — Extraer 1 helper de dominio puro de logística.** Mover un helper puro
  a `features/logistics/domain/` con su test, comportamiento idéntico. Valida la
  regla "domain sin framework".
- **ARCH-6 — Extraer 1 application service detrás de una ruta existente.** Sacar un
  caso de uso de un god-handler a `features/logistics/application/`, detrás del
  contrato por-ruta existente; el handler queda thin. Valida la regla
  "routes/http delega".
- **ARCH-7 — Auditoría de eventos (opcional).** Sólo si ARCH-4..6 revelan fan-out
  real. Si no aparece, documentar "no eventos" y cerrar (coherente con la
  conclusión event-driven de ARCH-1).

## Testing matrix

Para cada PR de la secuencia:

| Check | Cuándo aplica |
| --- | --- |
| `pnpm test` | Siempre. |
| `pnpm build` | Siempre. |
| Backend route tests (contract por-ruta) | Si el PR toca `server/routes/**` o mueve lógica detrás de una ruta. |
| E2E (Playwright) | Sólo si el PR toca frontend. |
| Guardrail de literal-de-fuente | Si el PR mueve un literal fijado por un test; se actualiza en el **mismo PR** (P2-D). |
| **No** lockfiles / deps / CI | Ningún PR de esta secuencia toca `package.json`, lockfiles ni workflows. |

Los contratos por-ruta existentes (audit, session-last-access, runtime-timing) son
la red de seguridad que habilita reorganizar sin cambiar comportamiento.

## Alternatives considered

| Alternative | Pros | Cons | Reason rejected or deferred |
| --- | --- | --- | --- |
| Big-bang: reestructurar todo `server/` a `features/` de una vez | Coherencia inmediata | Alto riesgo, PRs enormes, tests frágiles, freeze largo | Rechazada: viola "1 contexto por PR" y crearía abstracciones vacías. |
| Introducir event bus / outbox para auditoría y email | Desacopla side-effects | Rompe contratos por-ruta; sin fan-out real hoy; capa sin retorno | Diferida: sólo si ARCH-7 revela fan-out real y medido. |
| Fragmentar `drizzle/schema.ts` por contexto | Kernel por dominio | Rompe Drizzle y migraciones 0000–0030 | Rechazada: schema es shared kernel legítimo. |
| No hacer ADR y migrar ad-hoc | Menos ceremonia | Sin contrato explícito; acoplamiento silencioso a futuro | Rechazada: P3-A pide exactamente este ADR. |

## Consequences

### Positive

- **Más claridad de fronteras.** Regla de dependencia explícita por capa, espejo
  del `README` del dashboard frontend.
- **Menos god-handlers.** La lógica de negocio se vuelve reutilizable y testeable
  fuera de HTTP a medida que se extraen services.
- **Migración incremental y reversible.** PRs chicos, cada uno detrás de contratos,
  sin big-bang.

### Negative / tradeoffs

- **Riesgo de abstracciones vacías** si se crean capas sin código real que las
  habite. Mitigación: materializar una carpeta sólo cuando hay código para ella.
- **Riesgo de migración parcial** (un contexto migrado, el resto por naming),
  dejando dos estilos conviviendo. Mitigación: PRs chicos y una secuencia clara;
  es un estado transitorio aceptado, no un fin.
- **Costo de mantener guardrails.** Mover literales fijados por tests obliga a
  actualizarlos en el mismo PR (P2-D).

### Operational impact

- Nulo en este PR (docs-only). Los PRs posteriores no cambian rutas públicas ni
  comportamiento observable; sólo reorganizan código detrás de contratos verdes.

### Security / data impact

- Nulo en este PR. Auth/security/middlewares y `drizzle/schema.ts` quedan
  explícitamente fuera de alcance; cualquier cambio ahí exige PR dedicado con
  auditoría de seguridad.

### Rollback or supersession path

- Al ser docs-only, revertir es borrar/editar este archivo. Cada PR posterior es
  reversible de forma independiente (re-exports y moves behavior-preserving). Este
  ADR puede ser *Superseded* por otro si un piloto demuestra que las reglas
  necesitan ajuste.

## Non-goals

- **No** reestructurar todo `server/`.
- **No** introducir event bus / outbox.
- **No** cambiar el schema de DB ni las migraciones.
- **No** refactorizar auth/security ni middlewares.
- **No** cambiar la API pública (paths ni contratos).
- **No** tocar frontend visual / CSS.

## Guardrails

- **docs-only para este ADR:** sin código, sin CSS, sin tests, sin deps, sin
  lockfiles, sin CI, sin stashes, sin `.claude`, sin worktrees.
- Todo PR posterior: 1 contexto por PR, detrás de contratos, con tests verdes y
  guardrail de literal actualizado en el mismo PR.
- No mezclar rediseño visual con arquitectura.
- No crear abstracciones vacías (carpetas/barrels por dogma).
- No fragmentar `drizzle/schema.ts`; no tocar migraciones.
- No romper rutas públicas.

## Validation

- Revisión de documentación (docs review).
- `git diff --check`, `git status`, `git diff --stat`, `git diff --name-only`
  confirman que el único cambio es este archivo bajo `docs/architecture/`.
- Los tests reales se ejercitan en los PRs de migración (ARCH-3+), no aquí.

## Related PRs / documents

- [`docs/audit/repository-domain-architecture-audit.md`](../audit/repository-domain-architecture-audit.md) — ARCH-1, documento rector.
- [`docs/governance/adr-template.md`](../governance/adr-template.md) — plantilla de ADR de la casa.
- `frontend/src/features/dashboard/README.md` — reglas de frontera espejo en frontend.
- Próximos: ARCH-3 (triaje `lib`), ARCH-4 (Logistics shell), ARCH-5 (helper de
  dominio), ARCH-6 (application service), ARCH-7 (auditoría de eventos, opcional).
