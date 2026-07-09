# PR-BE0 - Auditoria Backend/API/Auth/Mail/Tokens/Clinic Profile

Fecha: 2026-06-26
Rama: `audit/backend-api-global-incident-p0`
Base local: `47e5ddb fix(clinic): keep password CTA visible on mobile (#1150)`
Estado base antes de documentar: `git status --short` limpio, `git diff --stat` vacio.

## Resumen ejecutivo

El incidente reportado es transversal: login de clinicas, admin y particulares; contacto/mail; generacion de tokens; registro de clinicas; y modificacion de perfil de clinica. La hipotesis de causa raiz mas probable no es un endpoint aislado, sino el contrato frontend -> API en produccion:

1. El cliente browser resuelve llamadas API como same-origin (`/api/*`) y usa `credentials: "include"`.
2. El proxy/rewrite de Next depende de `NEXT_PUBLIC_API_URL`.
3. Si el frontend productivo no tiene `NEXT_PUBLIC_API_URL`, no fue reconstruido con ese valor, o el rewrite no esta activo, todas las llamadas browser a `/api/*` quedan en el frontend y fallan antes de llegar al backend.
4. El backend real (`https://api.vetneb.com.ar`) puede estar sano aunque el frontend no lo alcance. La evidencia aportada indica que `GET https://api.vetneb.com.ar/health` responde 200 y health reporta database/storage `up`.

La segunda hipotesis transversal es de topologia de cookies: si el navegador llama directo desde `https://vetneb.com.ar` a `https://api.vetneb.com.ar`, el backend setea cookies host-only sin `Domain`. Esas cookies pertenecen a `api.vetneb.com.ar` y el proxy/dashboard de Next en `vetneb.com.ar` no las puede leer. El contrato actual parece disenado para evitar eso usando rewrite same-origin.

No se implementaron fixes en PR-BE0. El fix minimo recomendado para PR-BE1 es validar y corregir configuracion/deploy del contrato API productivo (`NEXT_PUBLIC_API_URL`, rewrite `/api/*`, origen apex/www y smoke de preflight por rutas criticas), antes de tocar logica de negocio.

## Sintomas reportados

- No login en movil para clinicas.
- No login en movil para administrador.
- No login en movil para particulares.
- No envia mail por contacto.
- No genera token en ningun dispositivo.
- No registra clinicas.
- No modifica perfil de clinica.

## Scope incluido

- Inventario de rutas reales Backend/API/Auth/Mail/Tokens/Clinic Profile.
- Flujo frontend -> backend para API base URL, wrappers y credentials.
- Cookies, CORS, preflight y comportamiento cross-site.
- Contacto/mail y dependencias de transporte.
- Tokens particulares y report-access tokens.
- Registro de clinicas desde admin.
- Perfil publico de clinica y avatar/storage.
- Evidencia local por `git grep` y evidencia productiva aportada por Nico.

## Scope excluido

- No fixes de backend.
- No fixes de frontend visual/UX/dashboard.
- No cambios en dependencias, `package.json`, `pnpm-lock.yaml`.
- No cambios en CI/workflows.
- No cambios de DB, migraciones, RLS o schema.
- No lectura ni exposicion de `.env`, secretos, tokens, cookies reales, SMTP credentials ni datos personales.
- No stage, commit, push ni PR.

## Auditoria previa

Estado base:

- `git status --short`: limpio.
- `git branch --show-current`: `audit/backend-api-global-incident-p0`.
- `git log -1 --oneline`: `47e5ddb fix(clinic): keep password CTA visible on mobile (#1150)`.
- `git diff --stat`: vacio.
- `git diff --name-only`: vacio.

Busqueda requerida:

- Se ejecuto la busqueda solicitada con `git grep` sobre `backend frontend/src test`. En este repo el backend real no esta bajo `backend`; el codigo servidor esta bajo `server`.
- Se repitio el inventario equivalente sobre `server frontend/src test`.
- Por limitacion del wrapper de comandos, los OR con `|` se ejecutaron como multiples `-e` de `git grep`, equivalente para inventario.

## Inventario de endpoints criticos

Registro central observado en `server/fastify-app.ts`:

| Superficie | Prefijo real | Evidencia |
| --- | --- | --- |
| Admin auth | `/api/admin/auth` | `server/fastify-app.ts:433` |
| Admin clinicas | `/api/admin/clinics` | `server/fastify-app.ts:438` |
| Admin particular tokens | `/api/admin/particular-tokens` | `server/fastify-app.ts:453` |
| Admin report access tokens | `/api/admin/report-access-tokens` | `server/fastify-app.ts:468` |
| Clinic/unified auth | `/api/auth` | `server/fastify-app.ts:503` |
| Contacto | `/api/contact` | `server/fastify-app.ts:508` |
| Perfil clinica | `/api/clinic/profile` | `server/fastify-app.ts:518` |
| Particular auth | `/api/particular/auth` | `server/fastify-app.ts:528` |
| Clinic particular tokens | `/api/particular-tokens` | `server/fastify-app.ts:538` |
| Clinic report access tokens | `/api/report-access-tokens` | `server/fastify-app.ts:558` |
| Health publico | `/health`, `/api/health` | `server/fastify-app.ts:424-425` |

Matriz de endpoints:

| Superficie | Metodo/ruta | Frontend caller | Auth requerida | Cookie/credentials | Env/deps | Estado auditado |
| --- | --- | --- | --- | --- | --- | --- |
| Login unificado admin/clinica/particular | `POST /api/auth/login` | `loginUnified()` en `frontend/src/lib/api.ts:327-330`; `LoginContent` lo invoca en `frontend/src/components/public/LoginContent.tsx:109` | No previa | `apiFetch` con `credentials: "include"`; setea `admin_session_id`, `app_session_id` o `particular_session_id` segun candidato | DB, session TTL, CORS | Ruta existe; preflight existe; contrato depende de rewrite same-origin |
| Login clinica legacy/exportado | `POST /api/auth/login` | `loginClinic()` en `frontend/src/lib/api.ts:318-321` | No previa | `app_session_id`; `credentials: "include"` | DB, CORS | Exportado; login publico actual usa `loginUnified()` |
| Login admin standalone | `POST /api/admin/auth/login` | No caller directo encontrado en `frontend/src/lib/api.ts`; smoke lo documenta | No previa | `admin_session_id` | DB, CORS | Ruta existe; login publico actual usa unificado |
| Login particular standalone | `POST /api/particular/auth/login` | `loginParticular()` en `frontend/src/lib/api.ts:386-388` | Token/cred particular | `particular_session_id`; `credentials: "include"` | DB, CORS | Ruta existe; preflight existe |
| Current clinic user/session | `GET /api/auth/me` | `getClinicSession()` en `frontend/src/lib/api.ts:336-338` | Clinica | `app_session_id` | DB | Ruta existe |
| Current admin user/session | `GET /api/admin/auth/me` | Smoke staging lo documenta; admin server pages reenvian cookies | Admin | `admin_session_id` | DB | Ruta existe |
| Current particular user/session | `GET /api/particular/auth/me` | `getParticularSession()` en `frontend/src/lib/api.ts:401-403` | Particular | `particular_session_id` | DB | Ruta existe |
| Logout clinica | `POST /api/auth/logout` | `logout()` en `frontend/src/lib/api.ts:344-345` | Clinica | Limpia `app_session_id` | DB/session | Ruta existe |
| Logout admin | `POST /api/admin/auth/logout` | `logoutAdmin()` en `frontend/src/lib/api.ts:348-349` | Admin | Limpia `admin_session_id` | DB/session | Ruta existe |
| Logout particular | `POST /api/particular/auth/logout` | `logoutParticular()` en `frontend/src/lib/api.ts:416-417` | Particular | Limpia `particular_session_id` | DB/session | Ruta existe |
| Contacto/mail | `POST /api/contact` | `submitContactMessage()` en `frontend/src/lib/api.ts:1356-1360`; `ContactoContent` maneja `smtp_disabled` | Publica con origin confiable | `credentials: "include"` por wrapper, aunque no requiere sesion | `CONTACT_TO`; Gmail API o SMTP | Ruta existe; CORS/OPTIONS existe; mail puede fallar independiente |
| Admin particular token | `POST /api/admin/particular-tokens` | `createAdminParticularToken()` en `frontend/src/lib/api.ts:762-767` | Admin | `admin_session_id`; `credentials: "include"` | DB, mail para envio particular | Ruta existe; si mail falla devuelve error y no deja token activo |
| Clinic particular token | `POST /api/particular-tokens` | `createClinicParticularToken()` en `frontend/src/lib/api.ts:925-930` | Clinica con permiso | `app_session_id`; `credentials: "include"` | DB, mail para envio particular | Ruta existe; si mail falla devuelve error y no deja token activo |
| Admin report access token | `POST /api/admin/report-access-tokens` | No caller frontend directo encontrado | Admin | `admin_session_id` | DB | Ruta existe; genera raw token/hash |
| Clinic report access token | `POST /api/report-access-tokens` | No caller frontend directo encontrado | Clinica con permiso | `app_session_id` | DB | Ruta existe; genera raw token/hash |
| Registro/listado clinicas admin | `GET/POST /api/admin/clinics` | `getAdminClinics()`, `createAdminClinicWithUser()` en `frontend/src/lib/api.ts:1897-1906` | Admin | `admin_session_id`; `credentials: "include"` | DB, password hashing | Ruta existe; schema drift DB puede romper alta |
| Edicion/eliminacion clinicas admin | `PATCH/DELETE /api/admin/clinics/:clinicId` | `updateAdminClinic()`, `deleteAdminClinic()` en `frontend/src/lib/api.ts:1913-1955` | Admin | `admin_session_id` | DB | Ruta existe |
| Perfil clinica GET | `GET /api/clinic/profile` | `getClinicPublicProfile()` en `frontend/src/lib/api.ts:2149-2153` | Clinica | `app_session_id` | DB, signed storage URL si avatar | Ruta existe |
| Perfil clinica PATCH | `PATCH /api/clinic/profile` | `updateClinicPublicProfile()` en `frontend/src/lib/api.ts:2158-2163` | Clinica con permiso | `app_session_id` | DB, public search sync | Ruta existe |
| Avatar perfil clinica | `POST/DELETE /api/clinic/profile/avatar` | `uploadClinicProfileAvatar()`, `deleteClinicProfileAvatar()` en `frontend/src/lib/api.ts:2180-2193` | Clinica con permiso | `app_session_id` | Supabase storage bucket | Ruta existe |

## Flujo frontend -> backend

Evidencia clave:

- `frontend/src/lib/api.ts:57` define `SAME_ORIGIN_API_BASE_URL = ""`.
- `frontend/src/lib/api.ts:86-102` resuelve runtime browser como same-origin antes de usar `NEXT_PUBLIC_API_URL`.
- `frontend/src/lib/api.ts:225` arma `apiBaseUrl` con `resolveApiBaseUrlForRuntime()`.
- `frontend/src/lib/api.ts:244` usa `credentials: options.credentials ?? "include"`.
- `frontend/next.config.ts:85-96` crea rewrite `/api/:path*` hacia `NEXT_PUBLIC_API_URL` solo si esa variable esta configurada.
- `frontend/.env.example:6` documenta `NEXT_PUBLIC_API_URL`.
- `test/production-env-contracts.test.ts:80-84` valida que `frontend/.env.example` tenga `NEXT_PUBLIC_API_URL`.
- `docs/implementation/public-auth-blocking-errors.md:78` advierte que si el deployment no sirve `/api/*` same-host ni configura rewrites con `NEXT_PUBLIC_API_URL`, las llamadas browser same-origin fallan como error real de backend/red.

Diagnostico:

- En browser productivo, el frontend no llama directamente a `https://api.vetneb.com.ar` desde `api.ts`; llama a `/api/*`.
- Para que eso llegue al backend, el deployment Next debe tener rewrite activo a `NEXT_PUBLIC_API_URL`.
- Una mala configuracion o deploy stale de `NEXT_PUBLIC_API_URL` explicaria todas las superficies reportadas porque todas comparten `apiFetch`.

Riesgo de drift documental:

- `docs/PRODUCTION_PROGRESS_INVARIANTS.md:30-31` dice que `resolveApiBaseUrlForRuntime` no puede retornar `""` si `NEXT_PUBLIC_API_URL` es valido.
- El codigo actual retorna `""` en browser para preservar same-origin/proxy. Esto no se corrige en PR-BE0, pero debe alinearse en PR-BE1 o documentarse como contrato vigente.

## Cookies, sesion y mobile

Evidencia:

- `server/lib/env.ts:160-162` define `COOKIE_NAME`, `ADMIN_COOKIE_NAME`, `PARTICULAR_COOKIE_NAME` con defaults `app_session_id`, `admin_session_id`, `particular_session_id`.
- `server/lib/env.ts:166-167` usa `cookieSecure` en produccion y `cookieSameSite = "none"` en produccion, `"lax"` fuera de produccion.
- `server/routes/auth.fastify.ts:518-521`, `server/routes/admin-auth.fastify.ts:358-361`, `server/routes/particular-auth.fastify.ts:370-373` serializan `Path=/`, `HttpOnly`, `SameSite` y `Secure` condicional.
- No se encontro `Domain=` en los builders de cookies auditados. Por lo tanto son cookies host-only.
- `frontend/src/proxy.ts` usa cookies del host frontend para proteger `/dashboard` y `/dashboard/admin`: `app_session_id` para clinica y `admin_session_id` para admin.

Matriz cookies/sesion:

| Escenario | Resultado esperado | Riesgo |
| --- | --- | --- |
| Browser llama `https://vetneb.com.ar/api/auth/login` y Next rewrite proxyfowardea al backend | `Set-Cookie` vuelve al navegador bajo host frontend; proxy Next puede leer cookie host-only | Contrato deseado |
| Browser llama directo `https://api.vetneb.com.ar/api/auth/login` desde `https://vetneb.com.ar` | Cookie host-only queda asociada a `api.vetneb.com.ar`; proxy Next en `vetneb.com.ar` no la ve | Login aparenta fallar o entra en loop |
| Mobile Safari/Chrome con cross-site directo | `SameSite=None; Secure` es necesario pero no suficiente; politicas anti-tracking/third-party cookies pueden interferir | Mas visible en movil si se evita el rewrite same-origin |
| Frontend servido desde `www.vetneb.com.ar` con CORS solo para apex | Backend puede rechazar preflight o no reflejar ACAO para `www` | Fallas por origin segun host real del usuario |

Conclusiones:

- Cambiar a llamadas absolutas directas al API no es un fix seguro sin redisenar cookies/proxy.
- El contrato mas seguro de bajo impacto es mantener same-origin y corregir deploy/rewrite/origins.

## CORS y preflight

Evidencia backend:

- `server/lib/env.ts:122-131` parsea `CORS_ORIGIN`, lo exige en produccion y agrega origins locales solo fuera de produccion.
- `.env.example:31` documenta `CORS_ORIGIN` con el origin apex. No se observa `www` en esa linea de ejemplo.
- Las rutas criticas aplican `access-control-allow-origin` y `access-control-allow-credentials: true` cuando el origin esta permitido:
  - Auth clinica/unificado: `server/routes/auth.fastify.ts:426-427`.
  - Auth admin: `server/routes/admin-auth.fastify.ts:313-314`.
  - Auth particular: `server/routes/particular-auth.fastify.ts:276-277`.
  - Contacto: `server/routes/contact.fastify.ts:186-187`.
  - Admin clinicas: `server/routes/admin-clinics.fastify.ts:272-273`.
  - Perfil clinica: `server/routes/clinic-public-profile.fastify.ts:350-351`.
  - Tokens: `server/routes/particular-tokens.fastify.ts:296-297`, `server/routes/admin-particular-tokens.fastify.ts:308-309`, `server/routes/report-access-tokens.fastify.ts:298-299`, `server/routes/admin-report-access-tokens.fastify.ts:266-267`.
- OPTIONS handlers existen para rutas criticas:
  - Auth: `server/routes/auth.fastify.ts:1055-1058`, `server/routes/admin-auth.fastify.ts:614-617`, `server/routes/particular-auth.fastify.ts:643-647`.
  - Contacto: `server/routes/contact.fastify.ts:391`.
  - Admin clinicas: `server/routes/admin-clinics.fastify.ts:739-740`.
  - Perfil clinica: `server/routes/clinic-public-profile.fastify.ts:1037-1038`.
  - Tokens: `server/routes/particular-tokens.fastify.ts:676-678`, `server/routes/admin-particular-tokens.fastify.ts:535-538`, `server/routes/report-access-tokens.fastify.ts:678-680`, `server/routes/admin-report-access-tokens.fastify.ts:474-476`.

Matriz CORS/preflight:

| Superficie | OPTIONS | Methods permitidos observados | Credentials | Riesgo |
| --- | --- | --- | --- | --- |
| `/api/auth/*` | Si | `GET,POST,OPTIONS` | Si | Depende de `CORS_ORIGIN` si llamada directa |
| `/api/admin/auth/*` | Si | `GET,POST,OPTIONS` | Si | Idem |
| `/api/particular/auth/*` | Si | `GET,POST,OPTIONS` | Si | Idem |
| `/api/contact` | Si | `POST,OPTIONS` | Si | Contacto falla si origin no permitido |
| `/api/admin/clinics` | Si | `GET,POST,PATCH,DELETE,OPTIONS` | Si | Registro/edicion falla si origin no permitido |
| `/api/clinic/profile` | Si | `GET,PATCH,POST,DELETE,OPTIONS` | Si | Perfil/avatar falla si origin no permitido |
| `/api/particular-tokens` | Si | `GET,POST,PATCH,OPTIONS` | Si | Tokens clinica fallan si origin no permitido |
| `/api/admin/particular-tokens` | Si | `GET,POST,PATCH,DELETE,OPTIONS` | Si | Tokens admin fallan si origin no permitido |
| `/api/report-access-tokens` | Si | `GET,POST,PATCH,OPTIONS` | Si | Report access tokens clinica |
| `/api/admin/report-access-tokens` | Si | `GET,POST,PATCH,OPTIONS` | Si | Report access tokens admin |
| `/health` | No observado | GET publico | No aplica | `OPTIONS /health` 404 no prueba endpoints criticos |

Evidencia productiva aportada:

- `GET https://api.vetneb.com.ar/health` responde 200.
- Health reporta database/storage `up`.
- `OPTIONS /health` respondio 404 para origins de produccion/local.

Interpretacion:

- `OPTIONS /health` 404 no prueba que CORS este roto en rutas criticas, porque `/health` solo registra GET.
- Si justifica auditar preflight global y rutas criticas, especialmente `POST /api/auth/login`, `POST /api/contact`, `POST /api/admin/clinics`, `POST /api/particular-tokens`, `PATCH /api/clinic/profile`.

## Contacto/mail

Ruta y caller:

- Backend: `POST /api/contact` registrado en `server/fastify-app.ts:508`, implementado en `server/routes/contact.fastify.ts:393`.
- Frontend: `submitContactMessage()` en `frontend/src/lib/api.ts:1356-1360`.
- UI: `ContactoContent` maneja `smtp_disabled` en `frontend/src/components/public/ContactoContent.tsx:128`.

Dependencias:

- `server/lib/env.ts:75-97` declara SMTP, Gmail API y `CONTACT_TO`.
- `server/lib/env.ts:134-145` activa SMTP/Gmail API solo si las variables requeridas estan completas.
- `server/lib/email.ts:1` usa `nodemailer`; `server/lib/email.ts:166` crea transporter SMTP.
- `server/lib/email.ts:838-872` maneja `sendContactMessageEmail()` y retorna `smtp_disabled` si faltan recipients/transporte.
- `server/routes/contact.fastify.ts:458-472` llama email y devuelve `email_delivery_failed` en error, sin exponer credenciales.

Diagnostico:

- Contacto puede fallar por el mismo problema transversal de `/api/*`.
- Si la llamada llega al backend, puede responder `smtp_disabled` si `CONTACT_TO` o transporte Gmail/SMTP no estan completos.
- Si SMTP/Gmail falla en runtime, contacto devuelve error seguro `email_delivery_failed`.

## Tokens

Particular tokens:

- Admin: `POST /api/admin/particular-tokens`, caller `createAdminParticularToken()` en `frontend/src/lib/api.ts:762-767`.
- Clinica: `POST /api/particular-tokens`, caller `createClinicParticularToken()` en `frontend/src/lib/api.ts:925-930`.
- Ambas rutas generan token con `generateSessionToken`, guardan hash y envian email al particular.
- Evidencia email:
  - Admin token: `server/routes/admin-particular-tokens.fastify.ts:604`, `:631`, `:658`.
  - Clinica token: `server/routes/particular-tokens.fastify.ts:734`, `:761`, `:788`.

Riesgo:

- Si la API no es alcanzable, no se genera token.
- Si mail esta deshabilitado o falla, los tokens particulares no quedan como alta exitosa. Esto puede explicar "no genera token" aun cuando auth/CORS este corregido.

Report access tokens:

- Admin: `POST /api/admin/report-access-tokens`, `server/routes/admin-report-access-tokens.fastify.ts:528`, genera raw token en `:583` y crea DB record en `:586`.
- Clinica: `POST /api/report-access-tokens`, `server/routes/report-access-tokens.fastify.ts:732`, genera raw token en `:777` y crea DB record en `:780`.
- No se encontro caller frontend directo en el inventario reducido.

## Registro de clinicas

Ruta y caller:

- Backend: `POST /api/admin/clinics`, implementado en `server/routes/admin-clinics.fastify.ts:775`.
- Frontend: `createAdminClinicWithUser()` en `frontend/src/lib/api.ts:1902-1906`; UI admin llama alta en `AdminClinicsManagementCard`.
- Auth: admin session (`admin_session_id`) y origin confiable.

Dependencias y riesgos:

- `server/db-admin-clinics.ts:313` implementa `createAdminClinicWithUser()`.
- La ruta crea clinica y usuario, con hashing de password.
- Hay manejo de incompatibilidad de schema al crear clinica en runtime; una deriva de DB puede romper registro aunque health database este `up`.
- Esto no explicaria por si solo los logins/contacto, por eso queda por debajo de la hipotesis API/rewrite.

## Perfil clinica

Rutas y callers:

- `GET /api/clinic/profile`: `server/routes/clinic-public-profile.fastify.ts:1040`, frontend `getClinicPublicProfile()` en `frontend/src/lib/api.ts:2149-2153`.
- `PATCH /api/clinic/profile`: `server/routes/clinic-public-profile.fastify.ts:1073`, frontend `updateClinicPublicProfile()` en `frontend/src/lib/api.ts:2158-2163`.
- `POST /api/clinic/profile/avatar`: `server/routes/clinic-public-profile.fastify.ts:1212`, frontend `uploadClinicProfileAvatar()` en `frontend/src/lib/api.ts:2180`.
- `DELETE /api/clinic/profile/avatar`: `server/routes/clinic-public-profile.fastify.ts:1313`, frontend `deleteClinicProfileAvatar()` en `frontend/src/lib/api.ts:2193`.

Dependencias:

- Auth clinica (`app_session_id`) y permiso de gestion para mutaciones.
- DB de perfiles/public search: `server/db-public-professionals.ts:324`, `:417`.
- Storage Supabase para avatar: `server/routes/clinic-public-profile.fastify.ts:1279`.

Riesgos:

- Si auth cookie no llega al host frontend o API/rewrite falla, GET/PATCH fallan con 401/red.
- Si DB/profile tables o storage bucket estan desalineados, perfil/avatar puede fallar aunque login funcione.

## Variables de entorno necesarias

Solo nombres:

| Grupo | Variables |
| --- | --- |
| Frontend/API routing | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL` |
| Runtime backend | `NODE_ENV`, `PORT`, `TRUST_PROXY`, `CORS_ORIGIN` |
| Cookies/sesion | `COOKIE_NAME`, `ADMIN_COOKIE_NAME`, `PARTICULAR_COOKIE_NAME`, `SESSION_TTL_HOURS` |
| DB/Supabase | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `DATABASE_URL` |
| Storage | `SUPABASE_STORAGE_BUCKET`, `SUPABASE_SIGNED_URL_EXPIRES_IN_SECONDS` |
| Mail Gmail API | `GMAIL_API_CLIENT_ID`, `GMAIL_API_CLIENT_SECRET`, `GMAIL_API_REFRESH_TOKEN`, `GMAIL_API_FROM` |
| Mail SMTP | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` |
| Contacto | `CONTACT_TO` |

## Hipotesis de causa raiz por probabilidad

1. **P0 - Frontend production API rewrite/env ausente o stale.** Todas las superficies usan `/api/*` same-origin en browser y dependen de rewrite a `NEXT_PUBLIC_API_URL`. Explica login, contacto, tokens, registro y perfil en un solo punto.
2. **P0/P1 - Topologia cross-subdomain incompatible con cookies host-only y proxy Next.** Si algun cambio/deploy hizo que el browser llame directo a `api.vetneb.com.ar`, las cookies no quedan disponibles para `vetneb.com.ar`.
3. **P1 - Origin `www` no permitido.** `.env.example` documenta solo apex para `CORS_ORIGIN`; si usuarios entran por `www.vetneb.com.ar`, preflight puede fallar cuando hay llamada cross-origin.
4. **P1 - Mail incompleto o transporte bloqueado.** Contacto y particular tokens dependen de `CONTACT_TO` + Gmail API o SMTP. Token particular puede no quedar activo si mail falla.
5. **P1 - Drift DB/schema en admin clinics o profile tables.** Puede explicar registro/perfil, pero no login/contacto.
6. **P2 - `OPTIONS /health` 404 mal interpretado.** No es prueba de CORS roto en rutas criticas, pero evidencia que el smoke debe probar OPTIONS por endpoint real.
7. **P2 - Drift documental de API base URL.** Documentacion de invariantes y codigo actual no dicen exactamente lo mismo sobre `resolveApiBaseUrlForRuntime`.

## Hallazgos

### P0

- Contrato API productivo fragil: browser usa `/api/*`, rewrite depende de `NEXT_PUBLIC_API_URL`; si falta, el backend puede estar sano y aun asi todo el portal falla.
- Llamar directo al subdominio API desde browser no es equivalente al rewrite same-origin porque las cookies son host-only y el proxy/dashboard lee cookies del host frontend.

### P1

- `CORS_ORIGIN` productivo debe confirmar `https://vetneb.com.ar` y `https://www.vetneb.com.ar` si ambos hosts sirven usuarios reales.
- Contacto y particular tokens comparten dependencia de mail; si Gmail API/SMTP/CONTACT_TO no estan completos, contacto o generacion de tokens pueden fallar aunque auth ya funcione.
- Registro de clinicas y perfil pueden fallar por schema/storage especifico despues de resolver conectividad/auth.

### P2

- `OPTIONS /health` 404 debe quedar documentado como no concluyente.
- Hay drift documental entre invariantes de progreso y comportamiento actual del resolver API browser.
- No se encontro caller frontend directo para report access token admin/clinica en el inventario reducido; parecen superficies backend disponibles o cubiertas por smoke/tests.

## Evidencia local y productiva

Local:

- Inventario con `git grep` sobre `server frontend/src test`.
- Rutas registradas en `server/fastify-app.ts`.
- Callers frontend centralizados en `frontend/src/lib/api.ts`.
- OPTIONS/CORS por rutas criticas en `server/routes/*.fastify.ts`.
- Tests existentes relevantes:
  - `test/smoke-staging-script-contract.test.ts` cubre endpoints auth/clinic profile/tokens y flags de cookies.
  - `test/security-trusted-origin-cors-boundaries.test.ts` cubre origen confiable/CORS por superficies criticas.
  - `test/architecture/security/security-sensitive-log-redaction-boundaries.test.ts` cubre no exposicion de secretos SMTP/tokens/cookies en logs.
  - `test/supabase-storage-boundaries.test.ts` cubre storage privado/signed URLs.

Productiva aportada por Nico:

- `GET https://api.vetneb.com.ar/health` -> 200.
- Health reporta database/storage `up`.
- `OPTIONS /health` -> 404 para origins de produccion/local.

No se ejecutaron requests productivos con credenciales reales ni payloads con datos personales.

## Smokes reproducibles sin secretos

Terminal 1, PowerShell, sin credenciales:

```powershell
Invoke-WebRequest -UseBasicParsing -Uri "https://api.vetneb.com.ar/health"
```

Preflight directo por endpoint critico y origin apex:

```powershell
Invoke-WebRequest -UseBasicParsing `
  -Method Options `
  -Uri "https://api.vetneb.com.ar/api/auth/login" `
  -Headers @{
    Origin = "https://vetneb.com.ar"
    "Access-Control-Request-Method" = "POST"
    "Access-Control-Request-Headers" = "content-type"
  }
```

Repetir para `https://www.vetneb.com.ar`:

```powershell
Invoke-WebRequest -UseBasicParsing `
  -Method Options `
  -Uri "https://api.vetneb.com.ar/api/auth/login" `
  -Headers @{
    Origin = "https://www.vetneb.com.ar"
    "Access-Control-Request-Method" = "POST"
    "Access-Control-Request-Headers" = "content-type"
  }
```

Probar rewrite same-origin del frontend productivo:

```powershell
Invoke-WebRequest -UseBasicParsing -Uri "https://vetneb.com.ar/api/health"
Invoke-WebRequest -UseBasicParsing -Uri "https://www.vetneb.com.ar/api/health"
```

No ejecutar contacto real ni login real sin credenciales controladas y autorizacion explicita.

## Plan de fixes por PR pequeno

### PR-BE1 - Contrato API/Auth/CORS productivo

Objetivo: resolver la causa transversal mas probable.

- Confirmar en hosting frontend que `NEXT_PUBLIC_API_URL` existe, es HTTPS y apunta al backend productivo.
- Confirmar que el frontend fue rebuild/redeploy despues de setear `NEXT_PUBLIC_API_URL`.
- Validar que `https://vetneb.com.ar/api/health` y, si aplica, `https://www.vetneb.com.ar/api/health` llegan al backend por rewrite.
- Ejecutar preflight en rutas reales: `/api/auth/login`, `/api/admin/auth/login`, `/api/particular/auth/login`, `/api/contact`, `/api/admin/clinics`, `/api/clinic/profile`, `/api/particular-tokens`.
- Confirmar si `www` es host productivo soportado. Si si, agregarlo a `CORS_ORIGIN` por configuracion/deploy; no requiere cambio de codigo si `CORS_ORIGIN` acepta lista.
- No cambiar `Domain` de cookies sin revision de seguridad. Primero preservar same-origin rewrite.

### PR-BE2 - Mail/contacto/tokens particulares

Objetivo: aislar fallas de mail luego de recuperar conectividad/auth.

- Confirmar `CONTACT_TO`.
- Confirmar Gmail API completa o SMTP completo.
- Priorizar Gmail API HTTPS si SMTP del proveedor presenta timeouts.
- Smoke controlado de `POST /api/contact` con datos de prueba y sin secretos impresos.
- Smoke controlado de token particular con email de prueba, validando respuesta sin exponer token en logs.

### PR-BE3 - Registro de clinicas, perfil y tokens con DB/storage

Objetivo: validar superficies de negocio luego de auth/API.

- Ejecutar schema health admin.
- Validar alta admin clinic contra schema actual.
- Validar `GET/PATCH /api/clinic/profile` con clinica de prueba.
- Validar avatar/storage solo si el bucket y permisos estan correctos.
- Revisar report access token surfaces si se confirma caller funcional/productivo.

## Validaciones

Ejecutadas desde raiz en Terminal 1. El runner PowerShell fallo antes de ejecutar algunos procesos con `CreateProcessAsUserW failed: 1920`; se reintento con `cmd.exe /c` manteniendo el mismo comando funcional.

- `cmd.exe /c corepack pnpm test`: PASO. Resultado: 2841 tests, 0 fallas, 0 skipped, 0 todo.
- `cmd.exe /c corepack pnpm build`: PASO. Resultado: bundle backend `dist/index.js`.
- `cmd.exe /c corepack pnpm security:public-surface`: PASO. Resultado: `PASS security/public-surface: no public devtools exposure findings`.

No se ejecutan validaciones frontend separadas porque no se modifico `frontend/`.

## Estado final de PR-BE0

- Unico archivo agregado/modificado: `docs/audit/backend-api-global-incident-p0.md`.
- Sin fixes de runtime.
- Sin stage.
- Diagnostico reproducible y plan de PRs pequenos.
