# Users/Roles bounded context

M43 cierra la Fase J con dominio puro, casos de uso, persistencia canónica y
composición lazy. La topología vigente es:

```text
admin-users-roles.fastify.ts
  ├─ HTTP / auth / CORS / parsing / status / audit
  └─ admin-users-roles-route-composition.ts
       ├─ application use cases
       │    ├─ domain
       │    └─ AdminUsersRolesRepository port
       ├─ infrastructure/admin-users-roles-repository.ts
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

La persistencia vive en
`server/features/users-roles/infrastructure/admin-users-roles-repository.ts`;
el path raíz fue retirado sin shim. La ruta consume únicamente la composición,
que resuelve defaults de forma lazy y preserva los overrides de
`AdminUsersRolesNativeRoutesOptions`.
