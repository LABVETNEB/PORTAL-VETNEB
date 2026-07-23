
# Clinics · infrastructure

Capa de persistencia canónica del contexto Clinics, materializada en M26.

## Contenido

- admin-clinics-repository.ts: consultas, comandos, SQL, serialización y transacciones.
- index.ts: barrel público de la capa.

## Dependencias permitidas

- drizzle-orm.
- server/db.ts.
- drizzle/schema.ts.
- server/lib/list-pagination.ts.

La capa no depende de Fastify, rutas, auth, CORS, auditoría, frontend,
Supabase, middlewares ni una capa application.

## Contratos preservados

- Dos fronteras db.transaction exactas.
- Creación atómica de clínica y usuario.
- Compatibilidad con clinic_id legacy.
- Paginación, búsqueda y orden estable.
- Serialización ISO.
- Actualización de credenciales.
- Cascada transaccional de eliminación en el mismo orden.
- Superficie pública histórica.

server/db-admin-clinics.ts permanece como shim temporal de un único re-export.
Las rutas serán reapuntadas y el shim será retirado en M27.
