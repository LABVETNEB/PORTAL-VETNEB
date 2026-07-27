# Users/Roles bounded context

M42 abre la Fase J con dominio puro, DTOs y casos de uso de application. La
topología vigente es:

```text
admin-users-roles.fastify.ts
  ├─ HTTP / auth / CORS / parsing / status / audit
  ├─ application use cases
  │    ├─ domain
  │    └─ AdminUsersRolesRepository port
  ├─ server/db-admin-users-roles.ts
  └─ Clinics credentials command
```

Users/Roles administra identidades, catálogo de roles y operaciones
administrativas. `server/lib/permissions.ts` sigue siendo el kernel compartido
de autorización cross-context; moverlo aquí invertiría dependencias desde
Logistics, Clinics, Reports y otros contextos hacia una feature
administrativa. Su eventual reclasificación corresponde a Fase K.

El cambio de credenciales conserva ownership en Clinics mediante
`updateAdminClinicUserCredentialsCommand`. Users/Roles no posee hashing ni
persistencia de credenciales.

La persistencia raíz permanece en `server/db-admin-users-roles.ts`. Su move,
composition final y thin-route closeout corresponden exclusivamente a M43.
