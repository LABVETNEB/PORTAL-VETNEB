# Reports infrastructure

M37 implementa aquí los dos puertos de workflow communication. El adapter de
datos consulta el contexto de Study Tracking por `reportId`; el adapter de
notificación inserta una notificación interna y devuelve su ID o `null`.

Esta capa es la única superficie M37 que importa DB, Drizzle, schema y tablas
de Study Tracking. No contiene email, auditoría, auth ni transporte HTTP.
