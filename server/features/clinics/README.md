
# Clinics · bounded context

Contexto Clinics del backend. Abierto en M25, con persistencia canónica
materializada en M26, administración adelgazada en M27, perfil público
adelgazado en M28 y cierre cross-tenant completado en M29.

## Estado por capas (M29)

| Capa | Estado | Contenido |
|---|---|---|
| domain/ | con código | Validación y normalización puras de administración y perfil público. |
| infrastructure/ | con código | Repository Drizzle, SQL legacy, serialización y dos transacciones. |
| servicios directos | con código | Servicios admin y de perfil público, sin capa application. |
| application/ | ausente | No se necesita para el corte actual. |
| routes/ | externas al contexto | Conservan exclusivamente responsabilidades HTTP y operativas. |

## Topología actual

~~~text
admin-clinics.fastify.ts
admin-users-roles.fastify.ts
  ├─ HTTP / CORS / auth / auditoría / error mapping
  ├─ features/clinics/domain
  └─ features/clinics/admin-clinics-{query,command}-service.ts
       └─ carga lazy de features/clinics/infrastructure/index.ts
            └─ admin-clinics-repository.ts
                 ├─ Drizzle / SQL / serialización
                 └─ 2 transacciones exactas

clinic-public-profile.fastify.ts
  ├─ HTTP / CORS / auth / permisos / multipart / timing / logging
  └─ clinic-public-profile-{query,command}-service.ts
       ├─ domain/index.ts (PATCH, mapa y avatar)
       ├─ carga lazy de Public Professionals infrastructure/index.ts
       └─ storage compartido inyectable (lib/supabase.ts por default lazy)
~~~

Los servicios coordinan consultas y comandos administrativos sin Fastify,
auth, CORS ni auditoría. Los servicios de perfil público preservan el orden de
lectura, publicación, persistencia, sync, storage y mapping; consumen
exclusivamente el barrel canónico de Public Professionals. Las rutas preservan
los seams de inyección usados por tests y la implementación persiste en una
única copia canónica.

El perfil público de clínica deriva `clinicId` exclusivamente del usuario de la
sesión. GET, PATCH, POST avatar y DELETE avatar ignoran selectores tenant y
paths de storage enviados por query, JSON o multipart. La evidencia ejecutable
está en los tests Fastify y de servicios enlazados por
`security-cross-tenant-idor-contract.test.ts`.

Admin Clinics es una superficie administrativa global protegida por sesión
admin. No pertenece a la sesión de clínica ni se declara accesible desde ella.

## Programa

- M25: dominio y validaciones — cerrado.
- M26: repository y persistencia — cerrado.
- M27: adelgazar rutas admin y retirar el shim — cerrado.
- M28: adelgazar perfil público — cerrado.
- M29: cierre y verificación cross-tenant — cerrado.
- Fase F — Clinics: cerrada.
- Próximo milestone: M30.

## Fuera de alcance

M29 no modifica runtime, endpoints, payloads, status codes, CORS, auth,
sesiones, cookies, permisos, persistencia canónica de Public Professionals,
storage compartido, schema, migraciones, dependencias, lockfiles, frontend,
scripts ni CI. El cierre no afirma RLS ni evidencia de staging no ejecutada.
