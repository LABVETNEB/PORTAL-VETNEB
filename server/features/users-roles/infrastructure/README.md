# Users/Roles infrastructure

Esta capa implementa el puerto `AdminUsersRolesRepository` con Drizzle y la
persistencia compartida existente.

`admin-users-roles-repository.ts` conserva las consultas, joins, filtros,
búsqueda `ilike`, conteos, paginación, ordenamiento, serialización ISO y
reglas de cambio de rol del repository raíz retirado en M43. El barrel
`index.ts` es la entrada canónica para la composición productiva.

Infrastructure no posee HTTP, Fastify, Auth, sesiones, CORS, auditoría,
credenciales, hashing ni reglas de Clinics. Tampoco importa el kernel
compartido `server/lib/permissions.ts`.
