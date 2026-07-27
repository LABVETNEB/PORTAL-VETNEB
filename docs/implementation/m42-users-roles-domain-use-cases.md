# M42 — Users/Roles domain + application use cases

## 1. Identificación y baseline

- Milestone: **M42 — Users/Roles domain + application use cases**.
- Rama:
  `refactor/backend-modularization-m42-users-roles-domain-use-cases`.
- Baseline y HEAD inicial:
  `a5d35a2c28bd35305e7607a58d9663bcac7b20b8`.
- Predecesor: M41 / PR #1580 / squash merge del mismo SHA.
- Working tree inicial: limpio.
- PRs abiertos al iniciar: 0 según la identificación de la tarea; no se hizo
  consulta remota.
- Riesgo: R2 estructural backend autorizado exclusivamente para M42.
- Git/GitHub de escritura: `NOT_RUN`.

## 2. Censo inicial

### Persistencia, imports y tipos

`server/db-admin-users-roles.ts` tenía un consumidor productivo:
`server/routes/admin-users-roles.fastify.ts`, con import type estático y carga
runtime lazy. Su único consumidor type-only en tests era
`test/integration/adapters/controllers/admin-users-roles.fastify.test.ts`.

Todos los tipos Users/Roles exportados por el archivo raíz
(`AdminRoleUserType`, `AdminRoleUserRole`, `AdminRoleUserSummary`,
`AdminUsersRolesQuery`, `AdminUsersRolesSnapshot`,
`AdminClinicUserRoleChangeInput`, `AdminClinicUserRoleChangeResult`) se
consumían únicamente desde esa ruta y ese test. No apareció un consumidor
inesperado; por eso no se conserva reexport type-only ni compatibilidad.

`getAdminUsersRolesSnapshot` y `changeClinicUserRole` tenían como único
consumidor productivo la ruta: superficie inyectable en
`AdminUsersRolesNativeRoutesOptions`, defaults desde la carga lazy del módulo
raíz y llamadas directas desde los handlers. El test Fastify aportaba stubs
para ambas operaciones.

### Anchors source-aware

- Path de ruta, 11 archivos:
  guard de infrastructure Clinics; cinco contratos de auth/security
  (`global-auth`, suite completeness, critical registry, cross-auth y cookie
  boundaries); helper de scope Reports; integración Fastify; CSRF mutation
  coverage; auth de credenciales Clinics; search contract.
- Path de DB, 5 archivos: helper de scope Reports; integración Fastify; search;
  heavy-list pagination; global performance/resilience.
- Funciones inline de parsing de roles: ningún test existente fijaba
  `parseUserType`, `parseRole` o `parseClinicUserRole`.
- Llamadas directas `deps.getAdminUsersRolesSnapshot` /
  `deps.changeClinicUserRole`: ningún test las fijaba; eran implementación
  directa de la ruta.

### Permissions kernel

Fan-in productivo real de `server/lib/permissions.ts`: **14 archivos**:

- `server/db.ts`;
- `server/middlewares/auth.ts`;
- rutas `auth`, `clinic-audit`, `clinic-public-profile`,
  `logistics-field-visits`, `logistics-route-events`,
  `logistics-route-plans`, `logistics-sla`, `particular-tokens`,
  `report-access-tokens`, `reports`, `reports-status` y `study-tracking`.

El fan-in cruza Auth, Clinics, Logistics, Reports y otros contextos. No había
ningún consumidor Users/Roles.

### Feature, endpoints y tests

`server/features/users-roles` no existía. La ruta registraba, y conserva, este
orden:

1. `OPTIONS /`;
2. `OPTIONS /clinic/:clinicUserId/role`;
3. `OPTIONS /clinic/:clinicUserId/credentials`;
4. `GET /`;
5. `PATCH /clinic/:clinicUserId/role`;
6. `PATCH /clinic/:clinicUserId/credentials`.

El censo de nombres directamente relacionados encontró 5 archivos y 46 tests:
21 backend (15 integración + 6 search) y 25 frontend (6 density + 6 API + 13
card). El frontend queda fuera del diff.

## 3. Ownership antes y después

Antes, la ruta poseía parsing de roles y orquestaba directamente las dos
operaciones de persistencia; el archivo DB era owner conceptual de los DTOs.

Después de M42:

- domain posee realms, roles, catálogos y parsers puros;
- application posee DTOs, puerto y casos de uso;
- la ruta posee HTTP, auth, CORS, parsing no-domain, status, auditoría y wiring;
- `server/db-admin-users-roles.ts` conserva toda la persistencia;
- Clinics conserva credenciales y hashing;
- `server/lib/permissions.ts` conserva autorización cross-context.

## 4. Arquitectura M42

```text
admin-users-roles Fastify route
  ├─ HTTP / auth / CORS / parsing / status / audit
  ├─ Users/Roles application use cases
  │    ├─ Users/Roles domain
  │    └─ AdminUsersRolesRepository
  ├─ existing server/db-admin-users-roles.ts
  └─ existing Clinics credentials command
```

La composición ruta → persistencia raíz está permitida hasta M43.

## 5. Módulos creados

- Feature y README de capas.
- Domain: `user-role-policy.ts` + barrel.
- Application: `admin-users-roles-use-cases.ts`, puerto mínimo y barrels.
- Tres guards M42.
- Tests unitarios de domain/application y suite completeness dinámica.

No se creó `infrastructure/`, composition layer ni adapter forwarding.

## 6. Tipos canonicalizados

Domain:

- `AdminRoleUserType`;
- `AdminRoleUserRole`;
- `AdminClinicUserRole`.

Application/ports:

- `AdminRoleUserSummary`;
- `AdminUsersRolesQuery`;
- `AdminUsersRolesSnapshot`;
- `AdminClinicUserRoleChangeInput`;
- `AdminClinicUserRoleChangeResult`.

La ruta y el test de integración apuntan a los owners canónicos. Persistencia
usa imports exclusivamente type-only. El archivo raíz DB ya no exporta tipos.

## 7. Puerto

`AdminUsersRolesRepository` deriva del seam real de Options y contiene sólo:

- `getAdminUsersRolesSnapshot`;
- `changeClinicUserRole`.

No incluye Auth, sesiones, CORS, auditoría, hashing, credenciales, clock ni
operaciones especulativas.

## 8. Casos de uso

`createAdminUsersRolesUseCases(repository)` expone:

- `listAdminUsersRoles(query)`;
- `changeClinicUserRole(input)`.

Cada operación delega exactamente una vez, conserva identidad de input/output,
no captura errores, no agrega validaciones, retries ni wrappers, y preserva
`not_found`, `last_clinic_owner` y `roleChanged: false`.

## 9. Wiring de ruta

Los parsers de user type, role de filtro y role mutable se consumen desde
`domain/index.ts`. La factory application se compone una vez sobre adapters
que preservan la resolución lazy de las dependencias existentes. GET y PATCH
role delegan a application; los handlers no llaman directamente
`deps.getAdminUsersRolesSnapshot` ni `deps.changeClinicUserRole`.

Se preservan Options, inyección de tests, `defaultDepsPromise`, auth,
last-access, CORS/preflight/trusted-origin, enteros, search, clamps, mensajes,
status, payloads, `checkedBy`, `changedBy`, auditoría, metadata y
`now: new Date(now())`.

## 10. Credenciales Clinics

`PATCH /clinic/:clinicUserId/credentials` sigue delegando en
`updateAdminClinicUserCredentialsCommand`. Se preserva el orden
parse → hash → persistence → audit → response. Users/Roles no contiene
credenciales, hashing ni un puerto alternativo.

## 11. Permissions como shared kernel

`server/lib/permissions.ts` permanece físicamente y byte-idéntico, con su API
pública intacta. Users/Roles administra identidades, catálogo de roles y
operaciones administrativas; el kernel resuelve autorización cross-context.

Moverlo dentro de Users/Roles produciría dependencias inversas desde
Logistics, Clinics, Reports y otros contextos hacia una feature
administrativa. Una eventual reclasificación pertenece a Fase K, no a M42.

## 12. Clasificación de anchors A/B/C

- A — realineados: imports type-only del test Fastify y owner de
  `AdminUsersRolesQuery` en el search contract.
- B — agregados: guards de domain, application y permissions kernel, más suite
  completeness dinámica.
- C — preservados sin debilitar: integración Fastify; SQL/search; heavy-list
  pagination; auth admin; sesión/cookies; trusted origin/CSRF; CORS;
  auditoría; disclosure/no-secrets; performance; security y audit
  completeness; route registry.

## 13. Guards

- Domain boundary: auto-descubre los módulos TS, fija inventario/barrel,
  pureza, imports prohibidos, catálogos exactos, ausencia de enums/permisos
  duplicados y consumo productivo por barrel.
- Application boundary: default-deny hacia el propio application y
  `domain/index.ts`; fija puerto mínimo, factory consumida, delegación de
  handlers, ownership Clinics de credenciales y ausencia de M43.
- Permissions kernel: fija path/API canónicos, ausencia de copias/reexports o
  imports desde Users/Roles y fan-in cross-context de 14.
- Suite completeness: descubre módulos/tests, detecta huérfanos, verifica
  barrels/puertos/casos de uso y evita duplicación de credenciales.

## 14. Validación

| Comando | Estado | Exit | Evidencia |
| --- | --- | ---: | --- |
| tests M42 aislados, intento 1 | FAILED | 1 | 25 pass, 1 fail |
| tests M42 aislados, reintento | PASSED | 0 | 26/26 |
| cohorte dirigida M42 + contratos | PASSED | 0 | 156/156 |
| `pnpm typecheck` | PASSED | 0 | TypeScript producción |
| `pnpm typecheck:test` | PASSED | 0 | TypeScript tests |
| `pnpm test` | PASSED | 0 | 3885 pass, 1 skip, 0 fail |
| `pnpm build` | PASSED | 0 | esbuild, `dist/index.js` |
| `pnpm security:public-surface` | PASSED | 0 | cero findings públicos |
| `pnpm audit --prod` | PASSED | 0 | cero vulnerabilidades conocidas |
| `pnpm audit` | PASSED | 0 | cero vulnerabilidades conocidas |
| `pnpm validate:local` | PASSED | 0 | typechecks + 3885/1/0 + build |
| `git diff --check` | PASSED | 0 | sin whitespace errors |

No se ejecutó DB real ni migraciones. CI con Postgres cubrirá posteriormente
la integración de persistencia.

## 15. Fail-fast

El primer gate M42 falló porque el guard de permissions interpretaba las
menciones documentales obligatorias al path canónico como imports
productivos. Se ajustó el guard para detectar copias por nombre en todo el
feature y analizar duplicación/imports únicamente en archivos `.ts`. El mismo
gate se reejecutó completo y pasó 26/26 antes de continuar.

No hubo otros fallos de implementación o validación.

## 16. Riesgos

Riesgo residual: M42 conserva composición hacia la persistencia raíz y la ruta
todavía coordina HTTP/auditoría. Es deuda explícita y acotada para M43, no una
regresión. La doble resolución liviana de deps en GET/PATCH role conserva el
lazy default y no duplica ninguna operación de repository.

## 17. Rollback

Revertir los archivos del feature y sus tests/guards, devolver los tipos a
`server/db-admin-users-roles.ts`, restaurar los tres parsers inline y las dos
llamadas directas de handlers, y realinear los dos anchors type/source. No
requiere schema, migraciones, datos ni compensación de side effects.

## 18. Exclusiones

Sin cambios en Auth, `server/lib/permissions.ts`, command Clinics,
`server/fastify-app.ts`, schema, migraciones, frontend, dependencias,
lockfiles, package manifests, scripts, CI/workflows, Supabase, email, audit
infrastructure, CORS/session helpers, SQL funcional ni transacciones.

No se ejecutaron frontend gates, Playwright, DB real, staging, producción,
servidores, watchers, Git de escritura ni GitHub. No se crearon shims,
compat/legacy, nuevos endpoints, repositorio infrastructure, service locator,
unit of work ni event bus.

## 19. Deuda M43 y estado

M43 queda responsable del move del repository, composition final, retiro del
path raíz y thin-route closeout. Ninguna parte de ese milestone fue iniciada.

- M42: implementación local completa.
- Git/GitHub: `NOT_RUN`.
- Stage / commit / amend / push / PR / merge: `NOT_RUN`.
- M43: `NOT_RUN`.
