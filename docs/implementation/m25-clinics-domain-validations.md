# M25 — Clinics domain / validaciones reales

> **Fase F del programa de modularización backend — primer milestone.**
> Extrae las reglas de dominio y validaciones reales de la administración de
> clínicas desde la ruta legacy hacia un dominio puro, tipado, testeado y
> protegido por un guard de arquitectura, sin cambiar ningún contrato HTTP ni
> comportamiento observable.

## Identificación

- **Milestone:** M25 (abre Fase F — Clinics).
- **Base exacta:** `0df8e07811add7e66b0748a8928428d01941df63`
  (`refactor(public-professionals): close phase and remove legacy shims (#1528)`).
- **Rama:** `refactor/backend-modularization-m25-clinics-domain-validations`.
- **Documento rector:**
  [backend-enterprise-modularization-program-audit](../audit/backend-enterprise-modularization-program-audit.md).

## Objetivo

Establecer la frontera canónica `server/features/clinics/domain/**` y hacer que
la ruta administrativa consuma las validaciones canónicas. M25 **no** mueve
persistencia (M26), **no** adelgaza la ruta (M27), **no** toca el perfil público
(M28), **no** agrega capa `application` y **no** cambia comportamiento.

## Arquitectura antes / después

**Antes:**

```
admin-clinics.fastify.ts (987 LOC)
  ├─ HTTP / CORS / auth / auditoría / error mapping
  ├─ validaciones y normalización INLINE (8 funciones)
  └─ db-admin-clinics.ts (persistencia)
```

**Después:**

```
admin-clinics.fastify.ts (695 LOC)
  ├─ HTTP / CORS / auth / auditoría / error mapping   (sin cambios)
  ├─ features/clinics/domain  → validación/normalización canónica
  └─ db-admin-clinics.ts (persistencia)               (sin cambios)

server/features/clinics/domain/
  ├─ clinic-management-validation.ts  (reglas puras, cero imports)
  └─ index.ts                         (barrel canónico)
```

## Matriz de reglas migradas

### CREATE — `parseClinicCreateInput` (precedencia exacta)

| # | Campo | Regla | Normalización | Mensaje / resultado |
|---|---|---|---|---|
| 1 | clinicName | requerido, string, ≤255 | trim | `Nombre de clínica es obligatorio.` / `Nombre de clínica excede 255 caracteres.` |
| 2 | contactEmail | requerido, string, ≤255 | trim | `Email de contacto es obligatorio.` / `…excede 255 caracteres.` |
| 3 | contactPhone | opcional, string si presente, ≤50 | trim, `""→null` | `Teléfono de contacto debe ser texto.` / `…excede 50 caracteres.` |
| 4 | username | requerido, string, ≤100 | trim | `Usuario es obligatorio.` / `…excede 100 caracteres.` |
| 5 | contactEmail | formato `^[^\s@]+@[^\s@]+\.[^\s@]+$` | — | `Email de contacto inválido.` |
| 6 | username | mínimo 3 | — | `Usuario debe tener al menos 3 caracteres.` |
| 7 | password | string ∧ `len≥8` ∧ `trim().len≥8` | **raw sin trim** | `La contraseña debe tener al menos 8 caracteres.` |
| 8 | role | ausente/null/`""` → `clinic_owner`; válidos `clinic_owner`,`clinic_staff` | — | `role inválido. Debe ser clinic_owner o clinic_staff.` |

### UPDATE — `parseClinicUpdateInput` (precedencia exacta)

| # | Campo | Regla | Normalización | Mensaje / resultado |
|---|---|---|---|---|
| 1 | clinicName | `undefined→omitido`; si presente = requerido (no se puede vaciar), ≤255 | trim | `Nombre de clínica es obligatorio.` / `…excede 255 caracteres.` |
| 2 | contactEmail | `undefined→omitido`; vacío/whitespace → `null`, ≤255 | trim, `""→null` | `Email de contacto debe ser texto.` / `…excede 255 caracteres.` |
| 3 | contactPhone | `undefined→omitido`; vacío/whitespace → `null`, ≤50 | trim, `""→null` | `Teléfono de contacto debe ser texto.` / `…excede 50 caracteres.` |
| 4 | contactEmail | formato, **sólo si queda string** (null no valida) | — | `Email de contacto inválido.` |
| 5 | body sin campos | tras construir `updatedFields` | — | `Debe enviar al menos un dato de clínica para actualizar.` |

`updatedFields` se construye en orden `clinicName, contactEmail, contactPhone`,
sólo con los campos `!== undefined`.

### DELETE — `parseClinicDeleteConfirmation` + `confirmClinicNameMatches`

| # | Paso | Regla | Capa | Resultado |
|---|---|---|---|---|
| 1 | confirmClinicName | requerido, string, trim, ≤255 | dominio | `Confirmación de clínica es obligatorio.` / `…excede 255 caracteres.` → 400 |
| 2 | lookup clínica | `getAdminClinicById` | ruta (IO) | `Clínica no encontrada.` → 404 |
| 3 | match nombre | `confirm === clinic.clinicName` (case-sensitive, sin normalización extra) | dominio (predicado) + ruta (emisión) | `La confirmación no coincide con el nombre exacto de la clínica.` → 400 |

Orden HTTP preservado: **parse 400 → lookup DB → not found 404 → mismatch 400 → delete**.

## API canónica del dominio

```ts
export type ClinicUserRole = "clinic_owner" | "clinic_staff";
export type ClinicValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
export type ClinicCreateInput = { clinicName; contactEmail; contactPhone: string|null; username; password; role: ClinicUserRole };
export type ClinicUpdateInput = { clinicName?; contactEmail?: string|null; contactPhone?: string|null; updatedFields: string[] };

export function parseClinicUserRole(value: unknown): ClinicUserRole | null;
export function parseClinicCreateInput(body: unknown): ClinicValidationResult<ClinicCreateInput>;
export function parseClinicUpdateInput(body: unknown): ClinicValidationResult<ClinicUpdateInput>;
export function parseClinicDeleteConfirmation(body: unknown):
  | { ok: true; confirmClinicName: string } | { ok: false; error: string };
export function confirmClinicNameMatches(confirmation: string, actualClinicName: string): boolean;
```

## Frontera

`test/architecture/clinics-domain-boundary-guard.test.ts` verifica, por censo
estructural de imports y archivos:

- dominio con código real + barrel; módulo canónico con **cero imports**;
- prohibición de `fastify`, `drizzle`/`drizzle-orm` (incluso type-only),
  `db`/`server/db-*`, `env`, `infrastructure`, `application`, `routes`,
  `middlewares`, auth/CORS, Supabase, `fs/http/https/net/child_process`,
  `process.*`, `fetch`;
- ausencia de `FastifyRequest`/`FastifyReply`, `request`/`reply`, SQL,
  `transaction` y status codes HTTP en el código del dominio;
- la ruta importa el barrel (no el archivo interno);
- ningún runtime importa el archivo interno del dominio;
- las 8 funciones migradas no se redefinen inline en la ruta;
- `server/features/clinics/application` no existe.

## Invariantes preservados

Endpoints, métodos, prefijo `/api/admin/clinics`, status codes, payloads de
éxito y error, mensajes en español (tildes/signos intactos), orden de
validación, trimming, defaults, `role` por defecto sin campo visible, CORS,
trusted origin, auth admin, auditoría (orden y best-effort tras persistencia),
mapping `23505/23502/23503`, comportamiento 409/500, transacciones, SQL, orden
de delete, paginación, search, serialización ISO, no exposición de
`passwordHash`/`password`/`authProId`, compatibilidad `clinic_id` legacy.

## Exclusiones (no tocado en M25)

`server/db-admin-clinics.ts` (runtime), `server/db.ts`, `server/index.ts`,
`server/fastify-app.ts`, `admin-users-roles.fastify.ts`,
`clinic-public-profile.fastify.ts` (M28), `clinic-audit.fastify.ts`,
`server/lib/clinic-audit.ts`, `clinic-permissions.ts`, `frontend/**`,
`drizzle/**`, `.github/**`, `package.json`, `pnpm-lock.yaml`.

## Tests

- **Dominio (nuevo):** `test/unit/domain/clinics/clinic-management-validation.test.ts`
  (79 casos: create/update/delete, precedencia, normalización, límites, roles,
  password raw, mismatch por casing/espacio).
- **Guard (nuevo):** `test/architecture/clinics-domain-boundary-guard.test.ts`.
- **Comportamiento HTTP (sin cambios, verde):**
  `test/integration/adapters/controllers/admin-clinics.fastify.test.ts`.
- **Contratos (sin cambios, verdes):** `admin-clinics-auth-contract`,
  `admin-clinics-db-contract`, `security-csrf-mutating-route-coverage`,
  `global-auth-boundary-contract`, `api-production-session-contract`.

## Validación final

`pnpm typecheck` · `pnpm typecheck:test` · suite dirigida (138 tests) ·
`pnpm validate:local` · `pnpm build` · `pnpm security:public-surface` ·
`git diff --check`. Resultados adjuntos en el PR.

## Riesgos y rollback

- **Riesgo:** cambio sutil de precedencia/mensajes. **Mitigación:** extracción
  1:1 y tests de caracterización que fijan orden y texto exacto antes del cambio.
- **Riesgo:** `ClinicUserRole` autónomo diverge del schema. **Mitigación:** unión
  literal idéntica; `pnpm typecheck` garantiza asignabilidad con
  `AdminClinicCreateInput.role`.
- **Rollback:** revert del PR. El dominio es aditivo; la ruta vuelve a sus
  funciones inline. Sin cambios de schema, migraciones, deps ni persistencia →
  revert independiente y seguro.

## Relación con M26–M29

- **M26** · mover `db-admin-clinics.ts` a `clinics/infrastructure/` (tx exactas).
- **M27** · adelgazar ruta admin (consultas + comandos) consumiendo el repo.
- **M28** · adelgazar perfil público (disclosure verde).
- **M29** · cierre de Fase F + cross-tenant.
