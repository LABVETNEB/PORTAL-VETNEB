# Users/Roles application

Materializa los dos casos de uso propios de M42:

- `listAdminUsersRoles(query)`;
- `changeClinicUserRole(input)`.

Ambos delegan exactamente una vez en `AdminUsersRolesRepository`, conservan
identidad de inputs y outputs, y propagan errores y resultados discriminados
sin traducción. El puerto mínimo deriva del seam
`AdminUsersRolesNativeRoutesOptions` y contiene únicamente esas dos
operaciones.

La capa sólo depende del barrel `../domain/index.ts` y de sus propios puertos.
No contiene Fastify, Drizzle, DB, auth, CORS, sesiones, auditoría, hashing ni
credenciales.
