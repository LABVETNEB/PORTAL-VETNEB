
# Clinics · bounded context

Contexto Clinics del backend. Abierto en M25 y con persistencia canónica
materializada en M26.

## Estado por capas (M26)

| Capa | Estado | Contenido |
|---|---|---|
| domain/ | con código | Validación y normalización puras. |
| infrastructure/ | con código | Repository Drizzle, SQL legacy, serialización y dos transacciones. |
| application/ | ausente | Diferido; no se anticipa capa. |
| routes/ | ausente | Las rutas permanecen en server/routes hasta M27. |

## Topología actual

~~~text
admin-clinics.fastify.ts
admin-users-roles.fastify.ts
  ├─ HTTP / CORS / auth / auditoría / error mapping
  ├─ features/clinics/domain
  └─ db-admin-clinics.ts
       └─ shim
            └─ features/clinics/infrastructure/index.ts
                 └─ admin-clinics-repository.ts
                      ├─ Drizzle / SQL / serialización
                      └─ 2 transacciones exactas
~~~

Las rutas conservan temporalmente el path legacy. La implementación real
existe en una única copia canónica dentro de infrastructure.

## Programa

- M25: dominio y validaciones — cerrado.
- M26: repository y persistencia — este milestone.
- M27: adelgazar rutas admin y retirar el shim.
- M28: adelgazar perfil público.
- M29: cierre y verificación cross-tenant.

## Fuera de alcance

M26 no modifica endpoints, payloads, status codes, CORS, auth, auditoría,
permisos, perfil público, schema, migraciones, dependencias, lockfiles,
frontend, scripts ni CI.
