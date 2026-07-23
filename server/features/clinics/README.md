# Clinics · bounded context

> Contexto **Clinics** del backend. Abierto en **M25** (Fase F del programa de
> modularización). Ver el contrato de fronteras en
> [ARCH-2](../../../docs/architecture/backend-boundary-adr.md) y el estado del
> programa en
> [audit](../../../docs/audit/backend-enterprise-modularization-program-audit.md).

## Estado por capas (M25)

| Capa | Estado | Contenido |
|---|---|---|
| `domain/` | **con código** | Reglas puras de validación/normalización de administración de clínicas. |
| `application/` | ausente | Diferido; no se anticipa capa (guard lo prohíbe). |
| `infrastructure/` | ausente | Persistencia sigue en `server/db-admin-clinics.ts` hasta **M26**. |
| `routes/` | ausente | La ruta admin sigue en `server/routes/admin-clinics.fastify.ts` (no-thin hasta **M27**). |

## Topología actual de la administración de clínicas

```
admin-clinics.fastify.ts
  ├─ HTTP / Fastify / CORS / auth / trusted-origin / auditoría / error mapping
  ├─ features/clinics/domain  → validación y normalización semántica
  └─ db-admin-clinics.ts (legacy)  → persistencia (tx, SQL, serialización)
```

La ruta convierte el resultado del dominio en las respuestas HTTP existentes; el
dominio no conoce transporte ni persistencia.

## Alcance del contexto en el programa

- **M25** · domain / validaciones reales (este milestone).
- **M26** · repositorio (mover `db-admin-clinics.ts` a `infrastructure/`, tx exactas).
- **M27** · adelgazar ruta admin (consultas + comandos).
- **M28** · adelgazar perfil público (`clinic-public-profile.fastify.ts`, disclosure).
- **M29** · cierre + cross-tenant.

## Qué NO vive aquí (todavía)

Perfil público de clínica, avatar/uploads, `mapLink`, sync de búsqueda pública,
auditoría de clínica y permisos: pertenecen a otras superficies/milestones y no
se tocan en M25.
