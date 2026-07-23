# M29 — Clinics phase closeout and cross-tenant evidence

## Identificación y baseline

- Milestone: M29, cierre de Fase F — Clinics.
- Rama:
  `test/backend-modularization-m29-clinics-cross-tenant-closeout`.
- Base y HEAD inicial:
  `4c7c041d626f9842bed5430699d628b4300c6dcb`.
- Árbol e índice iniciales: limpios.
- Naturaleza del cambio: tests y documentación; cero cambios runtime.

## Arquitectura final de Clinics

~~~text
server/routes/admin-clinics.fastify.ts
server/routes/admin-users-roles.fastify.ts
  ├─ HTTP / CORS / sesión admin / auditoría / error mapping
  ├─ features/clinics/domain/index.ts
  └─ features/clinics/admin-clinics-{query,command}-service.ts
       └─ carga lazy de features/clinics/infrastructure/index.ts
            └─ admin-clinics-repository.ts
                 ├─ Drizzle / SQL / serialización
                 └─ 2 transacciones exactas

server/routes/clinic-public-profile.fastify.ts
  ├─ HTTP / CORS / sesión clínica / permisos / multipart / timing / logging
  └─ features/clinics/clinic-public-profile-{query,command}-service.ts
       ├─ features/clinics/domain/index.ts
       ├─ public-professionals/infrastructure/index.ts
       └─ storage compartido lazy e inyectable
~~~

Clinics mantiene dominio puro, servicios directos e infraestructura canónica.
No existe `server/features/clinics/application/`. El shim legacy
`server/db-admin-clinics.ts` está ausente y ningún runtime activo depende de
ese path.

Admin Clinics es una superficie administrativa global autenticada mediante
sesión admin. No es una superficie tenant de clínica y una sesión de clínica no
se declara autorizada para consumirla.

## Milestones cerrados

- M25: dominio y validaciones reales — cerrado.
- M26: repository de infraestructura canónico — cerrado.
- M27: rutas admin delgadas y retiro del shim — cerrado.
- M28: perfil público delgado — cerrado.
- M29: evidencia cross-tenant y closeout — cerrado.

Con M29, la Fase F — Clinics queda cerrada. El siguiente milestone es M30.

## Evidencia cross-tenant por operación

El actor autenticado es una sesión de clínica A con `clinicId = 3`; el input
hostil intenta seleccionar clínica B con `clinicId = 999` y paths bajo
`avatars/999/`.

| Operación | Selectores hostiles | Evidencia ejecutable | Resultado exigido |
|---|---|---|---|
| GET `/api/clinic/profile` | query `clinicId` y `avatarStoragePath` | `clinic-public-profile.fastify.test.ts` + query service | snapshot con `3`; firma sólo del path leído para clínica 3; cero datos de 999 |
| PATCH `/api/clinic/profile` | query/body `clinicId`, `avatarStoragePath`, `storagePath` | Fastify + command service | lookup, snapshot, patch y sync reciben `3`; publicación y firma usan el avatar persistido de clínica 3; los selectores no llegan al patch |
| POST `/api/clinic/profile/avatar` | query y campos multipart con tenant/path extranjero | Fastify + command service | lookup, snapshot, upload, patch y sync reciben `3`; el path nuevo lo devuelve storage; delete y firma usan paths derivados del estado de clínica 3 |
| DELETE `/api/clinic/profile/avatar` | query/body con tenant/path extranjero | Fastify + command service | lookup, snapshot, remove y sync reciben `3`; storage sólo elimina el path retornado por persistencia para clínica 3 |

Los tests comprueban ausencia de persistencia, publicación, sync, firma,
upload o eliminación sobre el tenant seleccionado por input. Los paths de
avatar no forman parte de la entrada aceptada por los comandos: proceden del
snapshot persistido, del resultado de upload o del resultado de remove.

`CTIDOR-016` en
`test/architecture/security/security-cross-tenant-idor-contract.test.ts`
registra explícitamente Clinics y enlaza los tests Fastify, query service y
command service. El estado de readiness remoto continúa como
`pending_runtime_staging_evidence`: M29 no inventa evidencia de staging.

## Invariantes preservados

- Métodos, paths, prefijos, payloads, status codes y mensajes HTTP.
- Trusted origin antes de auth en mutaciones.
- Sesión clínica y permiso de management para PATCH y avatar.
- Sesión admin para la superficie administrativa global.
- CORS, cookies, auth realms, permisos, `no-store`, logging y timing.
- Orden de lectura, preview de publicación, persistencia, sync, storage, firma
  y mapping.
- Única persistencia canónica de Public Professionals y única infraestructura
  administrativa Clinics.
- Dos transacciones administrativas exactas.
- Fallos parciales documentados en M28; sin nuevas compensaciones ni retries.
- Schema, migraciones, frontend, dependencias, manifests, lockfile y CI.

M29 no afirma RLS, validación contra una DB real ni evidencia de staging.

## Allowlist real

- `docs/implementation/m29-clinics-phase-closeout.md`.
- `server/features/clinics/README.md`.
- `test/integration/adapters/controllers/clinic-public-profile.fastify.test.ts`.
- `test/unit/clinics/clinic-public-profile-query-service.test.ts`.
- `test/unit/clinics/clinic-public-profile-command-service.test.ts`.
- `test/architecture/security/security-cross-tenant-idor-contract.test.ts`.
- `test/architecture/security/security-resource-ownership-boundaries.test.ts`.

## Denylist respetada

- `server/routes/**`.
- `server/features/clinics/**/*.ts` de runtime.
- `server/lib/**`, `server/db.ts` y `server/fastify-app.ts`.
- Auth, sesiones, cookies, CORS y permisos.
- Schema, Drizzle y migraciones.
- Frontend.
- `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml` y dependencias.
- Workflows y CI.
- Documentos y archivos de M25–M28, salvo el README canónico permitido.

## Riesgos y rollback

- Riesgo: una prueba source-only podría quedar desalineada de la evidencia
  ejecutable. Mitigación: `CTIDOR-016` enlaza paths y nombres exactos de tests,
  y el guard de ownership verifica las cuatro delegaciones con
  `auth.clinicId`.
- Riesgo: confundir un 200 propio con autorización sobre el tenant solicitado.
  Mitigación: la matriz registra que el selector extranjero se ignora y que la
  respuesta pertenece al tenant autenticado.
- Riesgo residual: no se ejecutó una prueba cross-tenant contra staging ni se
  valida RLS en este milestone.
- Rollback: revertir el commit M29 elimina sólo tests y documentación. No
  requiere migración, compensación de storage ni rollback de runtime.

## Validación

La publicación de M29 exige, en este orden:

- cohorte dirigida de los cinco archivos solicitados;
- `pnpm typecheck`;
- `pnpm typecheck:test`;
- `pnpm validate:local`;
- `pnpm security:public-surface`;
- `git diff --check`;
- checks remotos del PR.

Los estados observados se registran en el PR y en el informe final; ningún gate
se declara `PASSED` sin exit code 0.

## Estado final

Fase F — Clinics: cerrada por evidencia local ejecutable y guardrails de
arquitectura, con runtime intacto y evidencia staging explícitamente pendiente.
Próximo milestone: M30.
