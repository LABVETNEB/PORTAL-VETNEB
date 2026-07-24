# M33 — Particular Access domain/repository/thin closeout

## Baseline y scope

- Repositorio: `C:\PORTAL-VETNEB`.
- Rama:
  `refactor/backend-modularization-m33-particular-access-domain-repository-thin-closeout`.
- Base y HEAD inicial:
  `be69a06fffb405ad6bd708090bf5282164f15159`.
- Working tree inicial: limpio.
- Incluido: arquitectura Particular Access, repository, application, composición,
  dos rutas propias, integración con Study Tracking, guards, seguridad y cierre.
- Excluido: Auth, Reports, schema, migraciones, frontend, manifests, lockfile,
  workflows, M34 y M35b.

## Censo antes/después

| Superficie | Antes | Después |
| --- | ---: | ---: |
| `features/particular-access` | 0 archivos | 13 archivos canónicos |
| `db-particular.ts` | 15 operaciones Drizzle | shim exacto de una línea |
| Consumidores runtime del shim Particular | 11 | 9 |
| Consumidores runtime del shim Study Tracking | 3 | 1 |
| `admin-particular-tokens.fastify.ts` | 868 LOC | 748 LOC |
| `particular-tokens.fastify.ts` | 872 LOC | 788 LOC |

Los dos consumidores retirados de cada shim son:

- `server/routes/admin-particular-tokens.fastify.ts`;
- `server/routes/particular-tokens.fastify.ts`.

## Arquitectura

```text
routes admin/clinic
  -> application/index.ts
  -> particular-access-route-composition.ts
      -> infrastructure/index.ts
      -> Study Tracking route composition
      -> dependencias existentes de auth, referencias y email
```

- `domain/`: ownership puro por clínica, presencia de informe vinculado y
  derivación literal de los últimos cuatro caracteres del token.
- `application/`: operaciones cohesionadas por autoridad y puertos estructurales
  mínimos. No importa Fastify, Drizzle, schema ni infraestructura concreta.
- `infrastructure/`: repository Drizzle trasladado sin reescribir queries.
- `particular-access-route-composition.ts`: único seam de las rutas propias hacia
  infraestructura. Se carga una vez por registro de cada plugin y conserva lazy
  loading.
- `server/lib/particular-token.ts`: conserva Zod, parsing y serializers HTTP;
  sólo delega la regla pura `hasLinkedReport` al domain.

## Operaciones application

Administración global:

- `createToken`;
- `listTokens`;
- `getToken`;
- `updateTokenReport`;
- `deleteToken` para DELETE y el PATCH `/revoke` cuyo contrato vigente es
  hard-delete.

Clínica autenticada:

- `createToken`;
- `listTokens`;
- `getToken`;
- `updateTokenReport`.

La revocación clínica no es un endpoint vigente. `revokeParticularToken`
permanece como compensación de creación cuando falla el email; no se agregó una
superficie HTTP nueva.

## Endpoints y OPTIONS

Admin, prefijo existente `/api/admin/particular-tokens`:

- `OPTIONS /`
- `OPTIONS /:tokenId`
- `OPTIONS /:tokenId/report`
- `OPTIONS /:tokenId/revoke`
- `POST /`
- `GET /`
- `GET /:tokenId`
- `PATCH /:tokenId/report`
- `DELETE /:tokenId`
- `PATCH /:tokenId/revoke`

Clínica, prefijo existente `/api/particular-tokens`:

- `OPTIONS /`
- `OPTIONS /:tokenId`
- `OPTIONS /:tokenId/report`
- `POST /`
- `GET /`
- `GET /:tokenId`
- `PATCH /:tokenId/report`

No cambian métodos, paths, prefijos, status, payloads, mensajes, CORS ni
precedencia observable.

## Options e inyección

`AdminParticularTokensNativeRoutesOptions` conserva sus 21 propiedades:
sesión/admin, generación y hash, clínica e informe, seis operaciones de token,
email, cinco operaciones de Study Tracking y `now`.

`ParticularTokensNativeRoutesOptions` conserva sus 19 propiedades:
sesión/usuario clínica, generación y hash, referencias global/scoped
compatibles con tests, cinco operaciones de token, email, cuatro operaciones de
Study Tracking y `now`.

La ruta sigue aceptando inyección parcial o completa. Si falta alguna
dependencia, carga una única composición lazy y combina exactamente los
overrides existentes.

## Repository equivalence

Las 15 operaciones se movieron a
`infrastructure/particular-access-repository.ts`:

- creación, lookup por id/hash, listado, vínculo de informe, revocación,
  eliminación y last-login de tokens;
- creación, lookup, last-access, eliminación y cleanup de sesiones;
- lookup sesión→token;
- lookup token clinic-scoped.

El guard normaliza únicamente los tres paths relativos cambiados por la nueva
ubicación y compara SHA-256 contra `server/db-particular.ts` de la base exacta.
El digest esperado es
`6a7f8fbe6ce08d281d928a0b5930dc3c408bb62c1df52ed8512dc876f712cbe2`.
No cambian filtros, joins, orden, paginación, timestamps, retornos,
transacciones ni schema.

## Shims y allowlists

`server/db-particular.ts`:

```ts
export * from "./features/particular-access/infrastructure/index.ts";
```

Allowlist residual exacta, owner y retiro:

| Consumidor | Owner | Retiro |
| --- | --- | --- |
| `server/preflight.ts` | Bootstrap | futuro milestone del consumidor |
| `server/middlewares/particular-auth.ts` | Auth | futuro milestone Auth |
| `server/routes/particular-auth.fastify.ts` | Auth | futuro milestone Auth |
| `server/routes/auth.fastify.ts` | Auth | futuro milestone Auth |
| `server/routes/particular-audit.fastify.ts` | Particular Audit | futuro milestone del consumidor |
| `server/routes/particular-study-tracking.fastify.ts` | Study Tracking/Auth | futuro milestone del consumidor |
| `server/routes/study-tracking.fastify.ts` | Study Tracking/Auth | futuro milestone del consumidor |
| `server/routes/admin-study-tracking.fastify.ts` | Study Tracking/Auth | futuro milestone del consumidor |
| `server/routes/admin-reports.fastify.ts` | Reports | M36 |

No se permiten consumidores nuevos.

`server/db-study-tracking.ts` conserva su shim de una línea. Allowlist antes:
las dos rutas M33 y `admin-reports.fastify.ts`. Allowlist después:
exclusivamente `admin-reports.fastify.ts` (Reports, M36).

## Autoridad, cross-tenant y anti-enumeración

- Admin conserva lookup global y autoridad global.
- Clínica deriva `clinicId` exclusivamente de la sesión autenticada.
- Body, query y params no pueden sustituir el scope de sesión.
- Listado, detalle y mutación clínica usan repository/lookups clinic-scoped.
- Informe ajeno e inexistente producen el mismo `404` y payload.
- Token ajeno e inexistente producen el mismo `404` y payload en GET y PATCH.
- No se exponen `tokenHash`, sesiones, stack, SQL ni identificadores de otro
  tenant.
- `tokenLast4`, hashing, cookies, auth y rate limiting permanecen sin cambios.
- No se afirma RLS.

## Orden de side effects y cleanup

Creación admin/clínica:

1. validar referencias/ownership;
2. generar token y hash;
3. persistir token;
4. enviar email al destinatario vigente;
5. si email no está disponible o lanza error, revocar el token creado;
6. si email fue enviado, asegurar el caso Study Tracking;
7. sólo admin crea la notificación `token_created`, como antes.

Los fallos de cleanup, tracking o notificación conservan logging seguro en la
ruta. El error original de email se devuelve internamente por identidad para
que la ruta aplique la metadata segura existente; nunca se serializa al cliente.

## Tests y guards

- Unitarios Particular Access: domain, autoridad global, ownership, scope de
  sesión, spoofing, anti-enumeración, orden de side effects y cleanup.
- Wrapper Study Tracking: delegación token-scoped e identidad de error.
- Integración admin/clínica: endpoints, Options indirectos, status, payloads,
  paginación, CORS, email, safe report disclosure y cross-tenant.
- Guard M33: inventario, pureza, boundaries, repository equivalence,
  composición, Options/endpoints, shims/allowlists, Auth/Reports congelados.
- Guards Study Tracking y seguridad actualizados para anclar la nueva
  ubicación canónica, sin eliminar invariantes.

## Riesgos y rollback

- Riesgo residual: nueve consumidores externos aún dependen del shim Particular;
  mitigación: allowlist exacta default-deny con owner documentado.
- Riesgo residual: Reports conserva el shim Study Tracking hasta M36.
- El aislamiento depende de queries/application clinic-scoped; no existe ni se
  afirma RLS.
- Rollback: revertir los archivos M33 restaura las rutas y
  `server/db-particular.ts`. No requiere migración, cambio de schema,
  transacción compensatoria ni modificación de datos.

## Validación

| Gate | Estado | Resultado |
| --- | --- | --- |
| Unitarios nuevos Particular Access | PASSED | 7/7 |
| Guard M33 + guards Study Tracking iniciales | PASSED | 35/35 |
| Integraciones admin + clínica | PASSED | 24/24 finales |
| Study Tracking afectado | PASSED | 36/36 finales |
| Seguridad/auth/cookies/email/audit | PASSED | 101/101 finales |
| `pnpm typecheck` | PASSED | exit code 0, corrida final |
| `pnpm typecheck:test` | PASSED | exit code 0, corrida final |
| `pnpm validate:local` | PASSED | 3.704 tests: 3.703 pass, 1 skip, 0 fail; build incluido |
| `pnpm security:public-surface` | PASSED | cero findings públicos; dos markers server-only esperados |
| `pnpm audit --prod` | PASSED | cero vulnerabilidades conocidas |
| `pnpm audit` | PASSED | cero vulnerabilidades conocidas |
| `git diff --check` | PASSED | exit code 0 |

Las primeras corridas de Study Tracking, seguridad y `validate:local` tuvieron
fallos source-only por anclas históricas que buscaban coordinación inline en
rutas o implementación dentro de los shims. Los guards se actualizaron a las
ubicaciones canónicas y las repeticiones exactas quedaron PASSED. No hubo fallo
runtime.

## Estado

M33 implementado localmente y sin stage. M34 y M35b no fueron iniciados.
