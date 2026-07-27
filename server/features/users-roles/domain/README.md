# Users/Roles domain

Contiene el catálogo y los parsers puros de realms y roles visibles por la
superficie administrativa. No conoce Fastify, Drizzle, persistencia, HTTP,
auditoría, sesiones ni el kernel compartido de permisos.

`index.ts` es el único entrypoint productivo. Expone:

- user types: `admin | clinic`;
- roles de filtro: `admin | clinic_owner | clinic_staff`;
- roles mutables de clínica: `clinic_owner | clinic_staff`;
- predicates y parsers determinísticos, sin normalización implícita.

La matriz cross-context de autorización permanece en
`server/lib/permissions.ts`; no pertenece a este dominio.
