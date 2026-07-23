# Clinics · domain (reglas puras)

> Capa **domain** del contexto Clinics. **Contiene código** desde M25. Ver la
> frontera del contexto en [`../README.md`](../README.md) y el contrato en
> [ARCH-2](../../../../docs/architecture/backend-boundary-adr.md).

## Responsabilidad

Validación y normalización semántica **pura** de la administración de clínicas:
create, update y confirmación de borrado. Sin efectos secundarios, sin I/O, sin
framework, sin DB. Recibe `unknown` o estructuras puras y devuelve datos
normalizados o un error puro. Determinista y testeable en aislamiento.

## Exports públicos

`clinic-management-validation.ts` (consumido por el barrel `index.ts`):

- **Tipos:** `ClinicUserRole`, `ClinicValidationResult<T>`, `ClinicCreateInput`,
  `ClinicUpdateInput`.
- **Funciones:** `parseClinicUserRole`, `parseClinicCreateInput`,
  `parseClinicUpdateInput`, `parseClinicDeleteConfirmation`,
  `confirmClinicNameMatches`.

Los helpers `parseRequiredString`, `parseOptionalString`,
`parseOptionalRequiredString` e `isValidEmail` son **privados** del módulo: no se
exportan ni desde el archivo ni desde el barrel.

## Tipo `ClinicUserRole` (autónomo, sin drizzle)

El dominio define su propia unión literal:

```ts
export type ClinicUserRole = "clinic_owner" | "clinic_staff";
```

Es estructuralmente compatible con los consumidores actuales. **No** se importa
desde `drizzle/schema` ni desde ningún módulo de persistencia — ni siquiera como
tipo. El guard prohíbe todo import desde `drizzle/**`.

## Semántica preservada (sin cambios de comportamiento)

Extraída 1:1 desde `server/routes/admin-clinics.fastify.ts`. Se preservan
mensajes exactos (con tildes y signos), precedencia de errores, trimming,
defaults y la distinción entre campo ausente / null / vacío / tipo inválido.

- **CREATE** · precedencia: `clinicName → contactEmail → contactPhone →
  username → formato email → username mínimo (≥3) → password → role`.
  `contactPhone` opcional (vacío → `null`, máx 50); `password` se valida
  (`len ≥ 8` y `trim().length ≥ 8`) pero se devuelve **raw sin trim**; `role`
  ausente/null/`""` → `clinic_owner`.
- **UPDATE** · precedencia: `clinicName → contactEmail → contactPhone → formato
  email → body sin campos`. `clinicName` presente **no puede quedar vacío**;
  `contactEmail`/`contactPhone` vacíos → `null`; `updatedFields` en orden
  `clinicName, contactEmail, contactPhone`.
- **DELETE** · `parseClinicDeleteConfirmation` valida `confirmClinicName`
  (requerido, trim, máx 255). `confirmClinicNameMatches` es la comparación
  **case-sensitive** de la confirmación (ya trimmeada) contra el nombre real de
  la clínica (sin normalización adicional). La lectura del body y la emisión de
  400/404 quedan en la ruta.

## Barrel obligatorio

`index.ts` re-exporta únicamente la API canónica y es el **único** punto de
entrada del dominio. Consumidores runtime y tests importan el barrel, nunca el
archivo interno (garantizado por el guard).

## Regla de dependencia

- **Puede importar:** utilidades puras relativas del propio contexto (por ahora,
  ninguna: el módulo canónico tiene cero imports).
- **No puede importar:** `fastify`, `drizzle`/`drizzle-orm` (ni type-only),
  cualquier `db-*` / `server/db`, `env`, `infrastructure`, `application`,
  `routes`, `middlewares`, auth/CORS, Supabase, I/O de Node
  (`fs/http/https/net/child_process`), `process.*` ni `fetch`.
- El dominio no conoce `FastifyRequest`/`FastifyReply`, `request`/`reply`, SQL,
  transacciones ni status codes HTTP.

Verificado por
`test/architecture/clinics-domain-boundary-guard.test.ts`, que exige cero imports
en el módulo canónico, consumo por barrel, ausencia de capa `application` y que
las 8 funciones migradas no se redefinan inline en la ruta.

## Qué NO hacer

No importar `db-*`, Drizzle (runtime ni tipos), `fastify`, `env` ni I/O. No
exportar los helpers privados. No crear stubs, barrels vacíos ni capa
`application` anticipada.
