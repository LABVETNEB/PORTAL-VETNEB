# Public Professionals — bounded context

> **Tipo:** Frontera de módulo del contexto Public Professionals. La regla pura
> de elegibilidad vive en `domain/` (M21) y la persistencia + mapping en
> `infrastructure/` (M22).
> **Origen:** [ARCH-1](../../../docs/audit/repository-domain-architecture-audit.md) · [ARCH-2](../../../docs/architecture/backend-boundary-adr.md) · [ARCH-3](../../../docs/architecture/shared-lib-boundary-inventory.md).
> **ID:** **M22 (Fase E — persistencia a `infrastructure/`)**.
>
> **Estado:** M21 y M22 mergeados. **M23 listo para integración** (no mergeado).
> **Fase E abierta. M24 no iniciado.**

Este directorio es la **frontera** del contexto Public Professionals: el
directorio público de profesionales del portal (perfil público de clínica,
búsqueda pública y detalle público, más la elegibilidad por actividad reciente
de histopatología). Según
[ARCH-1](../../../docs/audit/repository-domain-architecture-audit.md) es un
**candidato temprano** de migración (cohesión alta, acoplamiento bajo, riesgo
bajo).

## 1. Qué materializa M21

M21 mueve la **única regla de dominio real** del contexto —la elegibilidad del
banco de profesionales— desde `server/lib/professional-bank-eligibility.ts` a
`server/features/public-professionals/domain/professional-bank-eligibility.ts`,
detrás de un barrel público, sin cambiar comportamiento observable.

- **`domain/`** — reglas puras con barrel público (`index.ts`): ventana rolling
  UTC de tres meses, semántica de histopatología, selección de la última entrega
  admin y payload de elegibilidad. **Cero imports** (100% puro). Ver
  [`domain/README.md`](./domain/README.md).

## 2. Arquitectura actual

~~~text
public-professionals.fastify.ts
  ├─ HTTP, parsing, CORS, logging y rate-limit wiring
  ├─ public-professionals-query-service.ts
  │  ├─ búsqueda y detalle
  │  ├─ serialización pública
  │  ├─ firma opcional de avatar
  │  └─ infrastructure/index.ts + lib/supabase.ts
  └─ infrastructure/public-professionals-rate-limit.ts
     └─ constantes del rate limit público

clinic-public-profile.fastify.ts
  └─ infrastructure/index.ts

infrastructure/index.ts
  ├─ public-professionals-mapping.ts
  └─ public-professionals-repository.ts
     └─ domain/index.ts
~~~

- **`public-professionals-query-service.ts`** — query service directo sin capa
  `application`. Resuelve dependencias, consulta búsqueda/detalle, serializa el
  payload público y firma avatares de forma opcional.
- **`infrastructure/`** — mapping, repository y constantes del rate limit
  público. El store genérico permanece en `server/lib/rate-limit-store.ts`.
- **La ruta pública** conserva únicamente responsabilidades HTTP y
  cross-cutting: parsing, validación, CORS, logging, status codes, payloads y
  wiring del rate limit.
- **La ruta clínica** consume directamente el barrel canónico de
  infrastructure.
- Los paths legacy permanecen como shims mínimos hasta M24, pero ya no tienen
  consumidores operativos en M23.
## 3. Qué materializa M23

- Adelgaza `server/routes/public-professionals.fastify.ts`.
- Extrae búsqueda, detalle, serialización y firma opcional de avatar al query
  service directo del contexto.
- Mueve `server/lib/public-professionals-rate-limit.ts` a
  `infrastructure/public-professionals-rate-limit.ts`.
- Mantiene `server/lib/rate-limit-store.ts` como infraestructura compartida.
- Reapunta `clinic-public-profile.fastify.ts` al barrel canónico.
- Conserva los seams inyectables utilizados por los tests.
- No modifica paths, métodos, payloads, status codes, CORS, logging, SQL, auth,
  schema ni migraciones.
## 4. Shims legacy temporales

Permanecen hasta el cierre M24:

- `server/db-public-professionals.ts`
- `server/lib/public-professionals-rate-limit.ts`
- `server/lib/professional-bank-eligibility.ts`

Los tres son re-exports mínimos. M23 elimina sus consumidores operativos; M24
realizará el censo final y su retiro.
## 5. Reglas de dependencia

La dependencia **siempre apunta hacia adentro**. `domain/` es puro: no conoce
transporte HTTP ni motor de persistencia.

| Capa | Rol | Puede importar | No puede importar |
| --- | --- | --- | --- |
| **[domain](./domain/README.md)** | Reglas puras. | shared kernel (sólo tipos), utilidades puras relativas del propio contexto | `fastify`, Drizzle runtime, `env`, `http`, auth/CORS, `db-*`, `infrastructure`, `routes`, Supabase, I/O de Node, otros `server/lib/**`, `report-study-types` |
| **[infrastructure · mapping](./infrastructure/README.md)** | Lógica pura de mapping/evaluación. | shared kernel (sólo tipos), la propia capa | DB, Drizzle runtime, `fastify`, `routes`, `application`, auth/CORS/env, rate limit, Supabase, I/O |
| **[infrastructure · repository](./infrastructure/README.md)** | Persistencia y consultas. | `drizzle-orm`, `server/db.ts`, `drizzle/schema.ts`, el domain barrel, la propia capa | `routes`, `application`, `fastify`, auth/CORS/audit/email, Supabase, `server/lib/**`, frontend |

Verificado por
`test/architecture/public-professionals-domain-boundary-guard.test.ts` (domain) y
`test/architecture/public-professionals-infrastructure-boundary-guard.test.ts`
(infrastructure).

## 6. Estado de la migración

- **M21 — apertura de Fase E (mergeado)** — move de la regla de elegibilidad a
  `domain/` con barrel público, reapuntado del consumidor runtime y del test de
  dominio al barrel, shim temporal en el path legacy `server/lib/...`, guard de
  frontera y documentación.
- **M22 — mergeado** — persistencia y mapping movidos a
  `infrastructure/`, barrel canónico y shim DB mínimo.
- **M23 — listo para integración** — query service directo, ruta pública thin, rate-limit wrapper canónico, rutas reapuntadas y contratos preservados. Ver [Nota de implementación — M23](../../../docs/implementation/m23-public-professionals-thin-route.md).
- **M24 (no iniciado)** — cierre de Fase E, censo final y retiro de los tres shims legacy.

## 7. Documentos rectores

- [ARCH-1 — Repository Domain Architecture Audit](../../../docs/audit/repository-domain-architecture-audit.md) — clasifica Public Professionals como candidato temprano.
- [ARCH-2 — Backend Domain Boundary ADR](../../../docs/architecture/backend-boundary-adr.md) — reglas de dependencia por capa.
- [ARCH-3 — Shared / Lib Boundary Inventory](../../../docs/architecture/shared-lib-boundary-inventory.md) — inventario a nivel de archivo del terreno a migrar.
- [Nota de implementación — M21](../../../docs/implementation/m21-public-professionals-domain.md) — mueve la regla de elegibilidad a `domain/` con shim temporal.
- [Nota de implementación — M22](../../../docs/implementation/m22-public-professionals-infrastructure.md) — mueve la persistencia + mapping a `infrastructure/` con shim legacy.
