# Study Tracking · application

M31 introduce casos de uso de delegación por superficie:

- consultas de clínica, admin y particular;
- comandos de clínica, admin y particular;
- efectos reales de email de tinción especial y auditoría mediante puertos.

Las factories reciben datos ya autenticados, validados y scoped por las rutas.
Cada operación delega una sola vez, conserva argumentos, resultados y errores,
y no agrega defaults, serialización ni política HTTP.

La capa sólo puede importar archivos internos de `application/` y el barrel
público de `domain/`. No depende de Fastify, Drizzle, repositorios concretos,
auth, CORS, email ni auditoría concreta.
