# M43 — Users/Roles repository + thin-route closeout

## 1. Identificación y baseline

- Milestone: M43 — repository, composición final y thin-route closeout.
- Rama:
  `refactor/backend-modularization-m43-users-roles-repository-thin-closeout`.
- Baseline y HEAD inicial:
  `da73eb1291bc89b4ec505d22e337b173dd01219e`.
- Working tree inicial: limpio.
- Riesgo: R2 estructural backend autorizado exclusivamente para M43.
- Terminal: una única Terminal 1; sin servidor, watcher ni proceso persistente.

## 2. Censo inicial

`server/db-admin-users-roles.ts` tenía un único consumidor productivo:
`server/routes/admin-users-roles.fastify.ts`, mediante carga runtime lazy.
Los anchors activos al path raíz estaban en el helper de scope Reports, los
contratos de search y paginación, el contrato global de performance y los
guards Users/Roles. Las menciones históricas en auditorías, propuestas y
documentación de milestones anteriores se preservan.

La ruta registraba seis endpoints, en este orden:

1. `OPTIONS /`;
2. `OPTIONS /clinic/:clinicUserId/role`;
3. `OPTIONS /clinic/:clinicUserId/credentials`;
4. `GET /`;
5. `PATCH /clinic/:clinicUserId/role`;
6. `PATCH /clinic/:clinicUserId/credentials`.

No apareció ningún consumidor productivo adicional que exigiera ampliar la
allowlist o conservar un shim.

## 3. Ownership antes y después

Antes, la ruta poseía el wiring lazy, resolvía defaults, componía los casos de
uso y conocía el repository raíz concreto. La persistencia vivía fuera del
bounded context.

Después:

- domain posee catálogos y parsers puros;
- application posee DTOs, el puerto mínimo y los dos casos de uso;
- infrastructure posee las consultas Drizzle y el mapping;
- composition resuelve defaults lazy, combina overrides y compone los casos de
  uso;
- la ruta conserva HTTP, auth administrativa, sesión/last-access, CORS,
  trusted origin, parsing, mensajes, status, payloads y auditoría;
- Clinics conserva el command y la persistencia de credenciales;
- `server/lib/permissions.ts` permanece como shared kernel.

## 4. Arquitectura final

```text
admin-users-roles.fastify.ts
  ├─ HTTP / auth / session / CORS / parsing / status / audit
  └─ admin-users-roles-route-composition.ts
       ├─ application/admin-users-roles-use-cases.ts
       │    ├─ domain/index.ts
       │    └─ AdminUsersRolesRepository
       ├─ infrastructure/index.ts
       │    └─ admin-users-roles-repository.ts
       ├─ Auth/security dependencies existentes
       ├─ audit writer existente
       └─ Clinics credentials command existente
```

## 5. Repository move

El contenido funcional de `server/db-admin-users-roles.ts` se movió completo a
`server/features/users-roles/infrastructure/admin-users-roles-repository.ts`.
Sólo cambiaron los imports por la nueva profundidad. Se conservaron consultas,
joins, filtros, `ilike`, counts, paginación, offsets, ordenamiento, ISO,
timestamps, motivos `not_found` / `last_clinic_owner`, `roleChanged` y `now`.

El baseline no contenía un `db.transaction()` en
`changeClinicUserRole`; M43 preserva ese límite transaccional existente —cero
wrappers explícitos— para no reescribir semántica bajo un move. El test del
repository fija expresamente esta realidad.

El path raíz fue eliminado sin compat layer, shim ni reexport.

## 6. Composition layer

`admin-users-roles-route-composition.ts` mantiene un único
`defaultDepsPromise` module-level. Los módulos DB, Auth/security, audit e
infrastructure se importan sólo al resolver defaults. Una inyección completa
evita esa carga; una parcial combina overrides con defaults.

`createAdminUsersRolesUseCases` se invoca exactamente una vez por composición.
La composición expone `resolveDeps`, los casos de uso, el clock y el command
Clinics cableado, sin SQL, Drizzle, Fastify, reglas HTTP ni permissions.

## 7. Thin route

La ruta dejó de contener `defaultDepsPromise`, `loadDefaultDeps`, imports al
repository raíz/concreto y composición inline de los casos de uso. Continúa
registrando los seis endpoints en el mismo orden y delega GET/PATCH role a
application mediante la composición.

## 8. Contratos HTTP preservados

Se preservan la firma pública `AdminUsersRolesNativeRoutesOptions`, inyección
parcial/completa, autenticación administrativa, cookie/sesión, last-access,
CORS, preflight, trusted origin, parsing de query/params/body, precedencia de
errores, status codes, mensajes, payloads, `checkedBy`, `changedBy`, metadata,
eventos de auditoría y `now: new Date(now())`.

## 9. Credenciales permanecen en Clinics

`PATCH /clinic/:clinicUserId/credentials` sigue ejecutando parse → hash →
persistencia → audit → response mediante
`updateAdminClinicUserCredentialsCommand`. La composición sólo cablea el
command externo y sus dependencias existentes. Domain, application e
infrastructure Users/Roles no contienen password, credenciales, hashing,
repository ni caso de uso de credenciales.

## 10. Permissions permanece shared kernel

`server/lib/permissions.ts` no fue modificado, movido, copiado, envuelto ni
reexportado. Ninguna capa Users/Roles ni su composición lo importa. Auth,
sesiones, cookies, tokens y el authorization kernel quedaron fuera de M43.

## 11. Anchors A/B/C

- A — realineados: helper de scope Reports; domain/application guards; search;
  heavy-list pagination; performance/resilience; Clinics infrastructure y
  secuencia M35b.
- B — agregados: infrastructure boundary guard, M43 closeout guard, test
  source-aware del repository y discovery de infrastructure en suite
  completeness.
- C — preservados: integración Fastify, contratos admin auth/security/CSRF,
  permisos, endpoints, mensajes, auditoría y opciones de inyección.

## 12. Guards

Los guards fijan: infrastructure y barrel reales; dos operaciones exactas del
puerto; imports canónicos; ausencia de Fastify/HTTP/Auth/Clinics/credenciales
en infrastructure; ruta sin repository concreto; composition conectada a
application e infrastructure; path raíz ausente; ausencia de shim; permissions
sin duplicación; discovery de tests de infrastructure y closeout M43.

## 13. Validación

| Comando | Estado | Exit | Evidencia |
| --- | --- | ---: | --- |
| `pnpm typecheck` (gate temprano) | PASSED | 0 | `tsc --noEmit` |
| cohorte preliminar M43 | PASSED | 0 | 77 pass, 0 fail |
| cohorte dirigida M43 | PASSED | 0 | 151 pass, 0 fail |
| `pnpm typecheck` (gate final) | PASSED | 0 | `tsc --noEmit` |
| `pnpm typecheck:test` | PASSED | 0 | `tsc -p ./test/tsconfig.json --noEmit` |
| `pnpm test` | PASSED | 0 | 3903 tests; 3902 pass, 1 skip, 0 fail |
| `pnpm build` | PASSED | 0 | esbuild generó `dist/index.js` |
| `pnpm security:public-surface` | PASSED | 0 | cero exposición pública |
| `pnpm audit --prod` | PASSED | 0 | sin vulnerabilidades conocidas |
| `pnpm audit` | PASSED | 0 | sin vulnerabilidades conocidas |
| `pnpm validate:local` | PASSED | 0 | typechecks + 3903/3902/1/0 + build |
| guards de closeout reejecutados | PASSED | 0 | 13 pass, 0 fail |
| `git diff --check` | PASSED | 0 | sin whitespace errors |
| `git diff --cached --check` | PASSED | 0 | índice vacío, sin errores |

No se ejecuta DB real ni migraciones. La integración con Postgres corresponde
a CI; el test local del adapter es source-aware y no simula Drizzle.

## 14. Fail-fast y reintentos

No hubo fallos de implementación ni validación. Todos los comandos ejecutados
terminaron con exit code 0; no se requirieron reintentos.

## 15. Riesgos

Riesgo principal: regresión contractual al mover persistencia y wiring.
Mitigación: move 1:1, composición lazy, options intactas, guards source-aware,
integración Fastify y suites amplias. Riesgo residual: la semántica preexistente
del cambio de rol no usa una transacción explícita; M43 no la altera.

## 16. Rollback

Revertir M43 restaura `server/db-admin-users-roles.ts`, devuelve el wiring lazy
y la factory de casos de uso a la ruta, elimina composition/infrastructure y
reapunta los anchors al path raíz. No requiere rollback de schema, migraciones,
datos, credenciales, Auth ni permissions.

## 17. Exclusiones

Sin cambios en frontend, schema, migraciones, seed, Supabase, manifests,
lockfile, dependencias, scripts, CI/workflows, Docker, email, infraestructura
global de auditoría, helpers CORS/session, API pública, `server/fastify-app.ts`,
Auth ni worktrees/ramas ajenos.

## 18. Git/GitHub y estado de Fase J

Stage, commit, amend, push, PR y merge: `NOT_RUN`; son operaciones manuales de
Nico. No se ejecutó ningún comando Git/GitHub de escritura.

M43: cerrado. La Fase J queda cerrada localmente con repository canónico,
composition final, ruta thin, anchors realineados y gates amplios aprobados.
