# M28 — Clinics public profile thin route

## Identificación y baseline

- Milestone: M28, Fase F — Clinics.
- Rama: `refactor/backend-modularization-m28-clinics-public-profile`.
- Base/HEAD inicial: `6e1a91f539e8d70674da0a2b356e539f3b6ac2fd`.
- Ruta R0: `server/routes/clinic-public-profile.fastify.ts`.
- Blob R0: `5ba42952ebbac6cbee0f09cbf9f8d493217918f7`.
- LOC R0: 1316.
- LOC M28: 804.
- Árbol e índice iniciales: limpios.
- PRs abiertos iniciales: 0.

## Objetivo y resultado

M28 adelgaza la ruta clínica de perfil público mediante extracción y
delegación conservadora. No rediseña el contrato HTTP, la publicación, la
persistencia ni storage.

Antes:

~~~text
clinic-public-profile.fastify.ts
  ├─ HTTP / CORS / auth / permisos / multipart / timing / logging
  ├─ validación PATCH y avatar
  ├─ orquestación query/patch/upload/delete
  ├─ Public Professionals infrastructure
  └─ Supabase storage
~~~

Después:

~~~text
clinic-public-profile.fastify.ts
  ├─ HTTP / CORS / auth / permisos / multipart / timing / logging
  ├─ clinic-public-profile-query-service.ts
  └─ clinic-public-profile-command-service.ts
       ├─ clinics/domain/index.ts
       ├─ public-professionals/infrastructure/index.ts
       └─ storage compartido inyectable
~~~

No se crea `application/`, puertos genéricos, factories, clases, repositorios
duplicados ni infraestructura Clinics paralela.

## Ownership

Clinics posee:

- autenticación/autorización de su superficie HTTP;
- normalización y validación pura de su entrada;
- orquestación directa de query, PATCH y avatar;
- adaptación final a status, mensajes y envelopes HTTP.

Public Professionals conserva como única fuente de verdad:

- `evaluateClinicPublicProfilePublication`;
- `buildClinicPublicProfileResponse`;
- mapping y scoring;
- repository, patch y sync de búsqueda pública.

Los servicios Clinics consumen únicamente el barrel público de esa
infraestructura. El cliente compartido de storage permanece en
`server/lib/supabase.ts` y llega por dependencias inyectables o por carga default
lazy.

## Dominio puro

`clinic-public-profile-validation.ts` contiene:

- límites y normalización del PATCH;
- booleanos históricos;
- rechazo de HTML;
- URL HTTPS y allowlist real de mapas;
- MIME/extensiones y tamaño de avatar;
- lectura de dimensiones PNG/JPEG/WebP;
- límites 160–1024 y ratio 0.85–1.15;
- validación de contenido coherente con MIME.

Tiene cero imports y no depende de Fastify, DB, Drizzle, Supabase, env, auth,
CORS, logging, `process`, filesystem o red.

## Superficie HTTP preservada

Bajo `/api/clinic/profile`:

- `OPTIONS /`
- `GET /`
- `PATCH /`
- `OPTIONS /avatar`
- `POST /avatar`
- `DELETE /avatar`

Se preservan status codes, payloads, mensajes, content types, cookie de sesión,
headers/CORS, no-store global, requestId global, trusted-origin, orden de hooks,
timing, logging, refresh de sesión, permiso de management y errores finales.
`ClinicPublicProfileNativeRoutesOptions` conserva sus 17 propiedades públicas.

## Órdenes contractuales

PATCH:

1. clínica autenticada resuelta por la ruta;
2. perfil actual;
3. normalización y validación;
4. preview de publicación;
5. patch DB;
6. sync de public search;
7. signed URL si hay avatar;
8. mapper canónico.

Upload/reemplazo:

1. clínica autenticada resuelta y multipart adaptado por la ruta;
2. validación real del avatar;
3. perfil actual;
4. upload del objeto nuevo;
5. patch DB;
6. sync de public search;
7. delete anterior sólo cuando existe y difiere;
8. signed URL;
9. mapper canónico.

Delete:

1. clínica autenticada resuelta;
2. perfil actual;
3. preview con avatar `null`;
4. remove en DB;
5. sync de public search;
6. delete del objeto anterior;
7. mapper canónico.

## Disclosure inmutable

El scorer canónico permanece intacto:

- mínimo 75;
- required: displayName 2, specialty 3, locality 2, country 2;
- supplement: avatar o about 40 o services 20 o email 5 o phone 5;
- scoring: displayName 15, specialty 18/25, locality 15, country 15,
  about 8/12, services 8/12, email 5, phone 5, avatar 5;
- `isSearchEligible = isPublic && required && supplement && score >= 75`.

Un perfil privado incompleto puede guardarse. Perfil guardado, `isPublic`,
elegibilidad de búsqueda, fila de search y visibilidad final no se equiparan.
La elegibilidad reciente por histopatología continúa fuera de este flujo.

## Seguridad y tenant

`clinicId` se toma exclusivamente del usuario de la sesión autenticada. Body y
query no pueden seleccionar tenant. GET exige sesión válida; mutaciones
ejecutan trusted-origin antes de auth y requieren management permission.
`clinic_staff` recibe 403 antes de cualquier mutación. Multipart conserva
errores sanitizados y las respuestas privadas continúan bajo no-store global.

M29 conserva el ownership de la certificación cross-tenant de cierre; M28 sólo
agrega caracterización runtime y no declara esa fase cerrada.

## Fallos parciales preservados

No se agregan transacciones, retries, cleanup best-effort ni compensaciones:

- un fallo tras upload puede dejar el objeto nuevo huérfano;
- un fallo de sync puede dejar perfil e índice divergentes;
- un fallo al borrar storage se propaga después de modificar DB/search;
- perfil, search y storage siguen sin formar una operación atómica.

## Hashes protegidos

| Archivo | Inicial | Final |
|---|---|---|
| `public-professionals/infrastructure/index.ts` | `9eab9d12076ef33a28a6406f5435865031ac62e0` | `9eab9d12076ef33a28a6406f5435865031ac62e0` |
| `public-professionals-mapping.ts` | `efd7ce4b2ab9557e5330ae5abd8aa0b54968ced7` | `efd7ce4b2ab9557e5330ae5abd8aa0b54968ced7` |
| `public-professionals-repository.ts` | `72a1175d813c2f2de09af8fdfc0c799841552bce` | `72a1175d813c2f2de09af8fdfc0c799841552bce` |
| `server/lib/supabase.ts` | `897efb3db613c88566f18f89a26653d037056ffd` | `897efb3db613c88566f18f89a26653d037056ffd` |
| `server/fastify-app.ts` | `2ca22141a05488bde631b064defb2b18dfc2debf` | `2ca22141a05488bde631b064defb2b18dfc2debf` |
| `admin-clinics-query-service.ts` | `0d0d73a585751726647d164fb03424d1046bf9e7` | `0d0d73a585751726647d164fb03424d1046bf9e7` |
| `admin-clinics-command-service.ts` | `5ba675c73d70bb8b2f94d1340c894b7bdbcc1854` | `5ba675c73d70bb8b2f94d1340c894b7bdbcc1854` |
| `admin-clinics-repository.ts` | `7d9437d49e461536a742a95f9fa13794814dafd0` | `7d9437d49e461536a742a95f9fa13794814dafd0` |

## Allowlist real

- `docs/implementation/m28-clinics-public-profile-thin-route.md`
- `server/features/clinics/README.md`
- `server/features/clinics/domain/README.md`
- `server/features/clinics/domain/index.ts`
- `server/features/clinics/domain/clinic-public-profile-validation.ts`
- `server/features/clinics/clinic-public-profile-query-service.ts`
- `server/features/clinics/clinic-public-profile-command-service.ts`
- `server/routes/clinic-public-profile.fastify.ts`
- `test/unit/domain/clinics/clinic-public-profile-validation.test.ts`
- `test/unit/clinics/clinic-public-profile-query-service.test.ts`
- `test/unit/clinics/clinic-public-profile-command-service.test.ts`
- `test/unit/contracts/public-professionals/clinic-public-profile-disclosure.test.ts`
- `test/integration/adapters/controllers/clinic-public-profile.fastify.test.ts`
- `test/architecture/clinics-domain-boundary-guard.test.ts`
- `test/architecture/clinics-infrastructure-boundary-guard.test.ts`
- `test/architecture/public-professionals-infrastructure-boundary-guard.test.ts`
- `test/architecture/security/security-critical-route-surface-registry.test.ts`
- `test/architecture/security/security-mutation-permission-surface.test.ts`
- `test/architecture/storage-suite-completeness.test.ts`

El test de disclosure amplía la hipótesis inicial porque caracteriza el mapper
canónico sin modificarlo. Los tres contratos source-only adicionales mantienen
su cobertura original, pero trasladan sus anclas desde la orquestación inline
hacia la delegación de la ruta y los servicios canónicos extraídos.

## Denylist respetada

Permanecen sin cambios:

- dominio, mapping, repository y barrel de Public Professionals;
- servicios admin M27 e infraestructura Clinics;
- Supabase, DB, auth, CORS, permisos, sesión, timing, logging y Fastify app;
- shared kernels, cookies, auth realms, rate limits y schema;
- Drizzle, migraciones, frontend, manifests, lockfile, workspace, CI, workflows
  y scripts;
- M29.

La comprobación final de paths modificados no encontró ningún archivo de esta
denylist.

## Tests y validación

- Dominio: normalización completa, precedencia, límites, HTML, booleanos, mapas,
  MIME/extensión/tamaño, PNG/JPEG/WebP, mismatch de contenido, dimensiones,
  ratios y buffers truncados.
- Query: found/not-found, perfil/avatar ausentes, signed URL, orden, clinicId,
  mapper y propagación de errores.
- Command: órdenes completos y fallos de PATCH/upload/delete, sin compensación.
- Disclosure: umbral 74/75, required, supplement, missing lists,
  publicationErrors y perfil guardado versus search eligible.
- Fastify: trusted-origin/auth/RBAC, sesión como tenant, PATCH privado/público,
  órdenes completos, signed URL, multipart sanitizado y fallos parciales.
- Guards: pureza, servicios, ausencia de `application/`, barrels, imports,
  ciclos locales, Options y registro Fastify.

Resultados observados:

- cohorte dirigida M28: PASSED, 178/178;
- contratos source-only reajustados: PASSED, 17/17;
- `pnpm validate:local`: PASSED en el reintento; typecheck, typecheck:test,
  suite completa (3578 passed, 1 skipped, 0 failed) y build;
- `pnpm security:public-surface`: PASSED, sin hallazgos de exposición pública;
- `git diff --check`: PASSED.

## Rollback

Revertir M28 restaura la validación y orquestación inline en la ruta y elimina
los módulos/tests aditivos. No requiere migración de datos, rollback de schema,
reversión de infraestructura, compensación de storage ni cambios de
configuración.

## Fuera de alcance

M29, schema, migraciones, frontend, auth/cookies, CORS compartido, permisos,
rate limits, CI, dependencias, lockfiles, scripts y los módulos canónicos de
Public Professionals permanecen fuera de alcance.
