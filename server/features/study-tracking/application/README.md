# Study Tracking · application

M31 introdujo casos de uso de delegación por superficie:

- consultas de clínica, admin y particular;
- comandos de clínica, admin y particular;
- efectos reales de email de tinción especial y auditoría mediante puertos.

M32 conserva esas factories para compatibilidad con admin y las compone en dos
superficies de alto nivel:

- `createClinicStudyTrackingOperations`: lecturas y acknowledgements
  clinic-scoped, validación de referencias, cálculo de entrega, creación del
  caso, vínculo token/informe, tinción especial, email best-effort y auditoría;
- `createParticularStudyTrackingOperations`: lectura y acknowledgements
  derivados exclusivamente del token particular autenticado.

Los puertos query, command, notification y audit de M31 se reutilizan. El único
puerto nuevo agrupa las referencias de negocio indispensables para el workflow
clínico: clínica, informe clinic-scoped, token particular y su vínculo con el
informe. `createDate` permanece como dependencia funcional inyectada.

Las rutas siguen siendo responsables de autenticación, sesiones, permisos,
trusted origin, parsing/validación HTTP, status, mensajes, payloads,
serialización, CORS, timers y logging. Application no conoce Fastify ni decide
contratos HTTP.

La capa sólo puede importar archivos internos de `application/` y el barrel
público de `domain/`. No depende de Fastify, Drizzle, repositorios concretos,
auth, CORS, email ni auditoría concreta. No contiene estado global mutable,
retries, transacciones, outbox, queues ni compensaciones.
