# Public Professionals — bounded context

> **Tipo:** Frontera de módulo del contexto Public Professionals. La regla pura
> de elegibilidad vive en `domain/` (M21) y la persistencia + mapping en
> `infrastructure/` (M22).
> **Origen:** [ARCH-1](../../../docs/audit/repository-domain-architecture-audit.md) · [ARCH-2](../../../docs/architecture/backend-boundary-adr.md) · [ARCH-3](../../../docs/architecture/shared-lib-boundary-inventory.md).
> **ID:** **M22 (Fase E — persistencia a `infrastructure/`)**.
>
> **Estado:** M21 mergeado. **M22 listo para integración** (no mergeado).
> **Fase E abierta. M23 (ruta + rate limit) no iniciado.**

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

```text
routes (public-professionals, clinic-public-profile)
  → shim legacy (server/db-public-professionals.ts, un solo re-export)
    → infrastructure barrel (features/public-professionals/infrastructure/index.ts)
        ├─ public-professionals-mapping.ts     (puro; sólo tipos del shared kernel)
        └─ public-professionals-repository.ts  → domain barrel (features/.../domain/index.ts)
```

- **`infrastructure/`** — persistencia y mapping movidos desde
  `server/db-public-professionals.ts` en **M22**: `public-professionals-mapping.ts`
  (lógica pura) + `public-professionals-repository.ts` (Drizzle, `pgClient.unsafe`,
  SQL de elegibilidad) tras un barrel. Ver
  [`infrastructure/README.md`](./infrastructure/README.md).
- El **repository** consume la elegibilidad **por el domain barrel canónico**,
  nunca por un archivo interno del dominio ni por el path legacy.
- El **shim legacy** `server/db-public-professionals.ts` queda como un único
  `export *` hacia el barrel de infrastructure porque las rutas todavía consumen
  el path legacy en M22 (su reapunte/retiro es M23/M24).

## 3. Qué NO mueve M22

- **Ruta y rate limit** — `server/routes/public-professionals.fastify.ts` y
  `server/lib/public-professionals-rate-limit.ts` quedan **intactos** hasta
  **M23**.
- **Catálogo de Reports** — `server/lib/report-study-types.ts` pertenece al
  contexto Reports (move reservado para **M36**). El dominio canónico **no**
  depende de él en runtime; la relación contractual (histopatología ∈ catálogo)
  se preserva por test.

## 4. Shim legacy temporal

`server/lib/professional-bank-eligibility.ts` se conserva como **shim mínimo**
(`export *` hacia el barrel canónico), sólo por compatibilidad temporal del
programa. Tras M21 **no tiene consumidores runtime**; **expira en M24**, tras el
censo final de Fase E.

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
- **M22 — persistencia a `infrastructure/` (listo para integración, no
  mergeado)** — split de `server/db-public-professionals.ts` en
  `infrastructure/{public-professionals-mapping,public-professionals-repository}.ts`
  tras un barrel, shim legacy de un solo re-export en el path legacy, guard de
  infraestructura nuevo, reapunte de los tests SQL al repository canónico y del
  guard de dominio al repository. **Cero cambios** en SQL, rutas, rate limits,
  schema, migraciones, auth ni CORS. Ver
  [Nota de implementación — M22](../../../docs/implementation/m22-public-professionals-infrastructure.md).
- **M23 (no iniciado)** — ruta y rate limit.
- **M24 (no iniciado)** — cierre de Fase E y retiro de los shims legacy.

## 7. Documentos rectores

- [ARCH-1 — Repository Domain Architecture Audit](../../../docs/audit/repository-domain-architecture-audit.md) — clasifica Public Professionals como candidato temprano.
- [ARCH-2 — Backend Domain Boundary ADR](../../../docs/architecture/backend-boundary-adr.md) — reglas de dependencia por capa.
- [ARCH-3 — Shared / Lib Boundary Inventory](../../../docs/architecture/shared-lib-boundary-inventory.md) — inventario a nivel de archivo del terreno a migrar.
- [Nota de implementación — M21](../../../docs/implementation/m21-public-professionals-domain.md) — mueve la regla de elegibilidad a `domain/` con shim temporal.
- [Nota de implementación — M22](../../../docs/implementation/m22-public-professionals-infrastructure.md) — mueve la persistencia + mapping a `infrastructure/` con shim legacy.
