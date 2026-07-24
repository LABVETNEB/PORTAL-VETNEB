# Study Tracking · application

M31 introdujo casos de uso de delegación por superficie:

- consultas de clínica, admin y particular;
- comandos de clínica, admin y particular;
- efectos reales de email de tinción especial y auditoría mediante puertos.

M32/M32b conservan esas factories y las componen en tres superficies de alto
nivel:

- `createClinicStudyTrackingOperations`: lecturas y acknowledgements
  clinic-scoped, validación de referencias, cálculo de entrega, creación del
  caso, vínculo token/informe, tinción especial, email best-effort y auditoría;
- `createParticularStudyTrackingOperations`: lectura y acknowledgements
  derivados exclusivamente del token particular autenticado;
- `createAdminStudyTrackingOperations`: consultas globales o clinic-scoped,
  acknowledgements, validación de referencias globales, creación y
  actualización con actor admin, vínculo token/informe, notificaciones, email
  best-effort y auditoría en el orden observable existente.
- `createTokenStudyTrackingOperations`: seam token-scoped agregado en M33 para
  que Particular Access coordine el caso asociado mediante el barrel
  application, sin consumir el shim DB desde sus rutas.

Los puertos query, command, notification y audit de M31 se reutilizan. Los
puertos de referencias son deliberadamente distintos:

- `ClinicStudyTrackingReferenceRepository` expone informe clinic-scoped y
  atribución clínica;
- `AdminStudyTrackingReferenceRepository` expone clínica, informe global,
  token particular y actualización del vínculo token/informe.

`createDate` permanece como dependencia funcional inyectada. Application no
impone tenant scope al admin: sin `clinicId` resuelve globalmente y con
`clinicId` usa la consulta clinic-scoped.

Las rutas siguen siendo responsables de autenticación, sesiones, permisos,
trusted origin, parsing/validación HTTP, status, mensajes, payloads,
serialización, CORS, timers y logging. Application no conoce Fastify ni decide
contratos HTTP. En PATCH admin, la ruta resuelve el target antes de validar el
body con Zod para preservar el 404 anterior al 400; sólo la coordinación
posterior vive en application.

La capa sólo puede importar archivos internos de `application/` y el barrel
público de `domain/`. No depende de Fastify, Drizzle, repositorios concretos,
auth, CORS, email ni auditoría concreta. No contiene estado global mutable,
retries, transacciones, outbox, queues ni compensaciones.
