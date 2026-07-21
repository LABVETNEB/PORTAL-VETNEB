# Public Professionals — bounded context

> **Tipo:** Frontera de módulo del contexto Public Professionals. **Primera
> materialización real** del contexto en M21: la regla pura de elegibilidad del
> banco de profesionales pasa a vivir en `domain/`.
> **Origen:** [ARCH-1](../../../docs/audit/repository-domain-architecture-audit.md) · [ARCH-2](../../../docs/architecture/backend-boundary-adr.md) · [ARCH-3](../../../docs/architecture/shared-lib-boundary-inventory.md).
> **ID:** **M21 (Fase E — apertura: dominio de elegibilidad)**.
>
> **Estado:** M21 **listo para integración** (no mergeado). **Fase E abierta.**
> **M22 (persistencia) no iniciado.**

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
db-public-professionals → domain barrel (features/public-professionals/domain/index.ts)
```

`server/db-public-professionals.ts` consume la elegibilidad **por el barrel
canónico**, nunca por un archivo interno del dominio ni por el path legacy.

## 3. Qué NO mueve M21

- **Persistencia** — `server/db-public-professionals.ts` sigue en su path legacy
  (queries, templates SQL, mappings y filtros intactos byte por byte). Su
  traslado a `infrastructure/` está reservado para **M22 (no iniciado)**.
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

Verificado por
`test/architecture/public-professionals-domain-boundary-guard.test.ts`.

## 6. Estado de la migración

- **M21 — apertura de Fase E (listo para integración, no mergeado)** — move de
  la regla de elegibilidad a `domain/` con barrel público, reapuntado del
  consumidor runtime y del test de dominio al barrel, shim temporal en el path
  legacy, guard de frontera nuevo y documentación. **Cero cambios** en SQL,
  rutas, rate limits, schema, migraciones, auth ni CORS.
- **M22 (no iniciado)** — persistencia de Public Professionals a
  `infrastructure/`.
- **M23 (no iniciado)** — ruta y rate limit.
- **M24 (no iniciado)** — cierre de Fase E y retiro del shim legacy.

## 7. Documentos rectores

- [ARCH-1 — Repository Domain Architecture Audit](../../../docs/audit/repository-domain-architecture-audit.md) — clasifica Public Professionals como candidato temprano.
- [ARCH-2 — Backend Domain Boundary ADR](../../../docs/architecture/backend-boundary-adr.md) — reglas de dependencia por capa.
- [ARCH-3 — Shared / Lib Boundary Inventory](../../../docs/architecture/shared-lib-boundary-inventory.md) — inventario a nivel de archivo del terreno a migrar.
- [Nota de implementación — M21](../../../docs/implementation/m21-public-professionals-domain.md) — mueve la regla de elegibilidad a `domain/` con shim temporal.
