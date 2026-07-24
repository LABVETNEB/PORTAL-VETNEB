# Particular Access application

`createAdminParticularAccessOperations` coordina la autoridad global admin.
`createClinicParticularAccessOperations` exige `clinicId` proveniente de la
sesión y usa lookups clinic-scoped. Los puertos son los contratos mínimos
derivados de `Options`; no conocen Fastify, Drizzle ni infraestructura concreta.
