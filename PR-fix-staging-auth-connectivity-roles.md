# PR fix staging auth connectivity roles

## 1. Rama
- `fix/staging-auth-connectivity-roles`

## 2. Causa raiz (hipotesis validada por codigo + smoke)
- El frontend ya tenia `rewrite` de Next para proxyar `"/api/:path*"` al backend (`frontend/next.config.ts`), pero el cliente API en browser llamaba directo a `NEXT_PUBLIC_API_URL` absoluto.
- Ese bypass del proxy provoca que `Set-Cookie` de login quede asociado al host del backend, no al host del frontend.
- El middleware de Next que protege `"/dashboard/*"` se ejecuta en el host del frontend y solo puede leer cookies de ese host; por eso `/dashboard/admin` sin cookie frontend sigue en `404`.
- Se aplico fix minimo para browser: usar base same-origin y dejar que el rewrite maneje `/api/*`.

## 3. Diagnostico admin
- `frontend/src/middleware.ts` mantiene contrato de seguridad: `/dashboard/admin` sin `admin_session_id` devuelve `404`.
- `server/routes/auth.fastify.ts` (login unificado) y `server/routes/admin-auth.fastify.ts` emiten `admin_session_id` con `Path=/`, `HttpOnly`, `SameSite` y `Secure` en prod.
- Si el login se hace cross-origin directo al backend, el cookie no queda en el host del frontend y el middleware no lo ve.

## 4. Diagnostico clinica
- `server/routes/auth.fastify.ts` emite `app_session_id` para clinica.
- `frontend/src/middleware.ts` exige `app_session_id` en `/dashboard`.
- El mismo problema de host de cookie aplica cuando browser llama directo a backend absoluto.

## 5. Diagnostico particular
- `server/routes/particular-auth.fastify.ts` emite `particular_session_id` y mantiene superficie separada.
- `frontend/src/components/public/ParticularesContent.tsx` usa endpoints particulares con `credentials: include`.
- Con fix same-origin en browser, tambien pasa por proxy de frontend y evita drift de host de cookie.

## 6. Cookies esperadas por rol
- Admin: `admin_session_id`
- Clinica: `app_session_id`
- Particular: `particular_session_id`
- Atributos esperados: `Path=/`, `HttpOnly`, `SameSite=None` en production, `Secure` en HTTPS.

## 7. CORS / credentials
- Smoke staging (sin credenciales privadas) valido:
  - Backend alive: OK
  - Frontend alive: OK
  - Preflight `OPTIONS /api/auth/login`: `204`, `Access-Control-Allow-Origin` exacto frontend staging, `Access-Control-Allow-Credentials=true`
  - Bad origin en unsafe route: bloqueado con `403`
- Verificacion manual adicional: respuestas `401` de login siguen exponiendo headers CORS correctos para origin permitido.

## 8. Middleware
- No se relajo seguridad:
  - `/dashboard/admin` sin cookie admin sigue `404`
  - `/dashboard` sin cookie clinica sigue redirect a `/login?next=...`
  - matcher sigue restringido a `"/dashboard/:path*"`

## 9. Implementaciones aplicadas
- `frontend/src/lib/api.ts`
  - Se agrego branch de runtime browser para usar base same-origin (`SAME_ORIGIN_API_BASE_URL`) y aprovechar el rewrite existente.
  - En runtime server-side se mantiene `NEXT_PUBLIC_API_URL` normalizado para fetch absoluto cuando corresponde.
- No se tocaron reglas de cookies backend, CORS, ni middleware de seguridad admin.

## 10. Tests agregados/reforzados
- `test/frontend-api-client-request.test.ts`
  - Se agrego contrato explicito para branch browser same-origin.
  - Se mantiene contrato de `NEXT_PUBLIC_API_URL` normalizado para runtime no-browser.
  - Se valida que el rewrite `/api/:path*` siga declarado en `next.config.ts`.

## 11. Validaciones ejecutadas
- `pnpm test`: OK (2027 pass, 0 fail, 1 skipped)
- `pnpm validate:local`: OK (`typecheck`, `typecheck:test`, `test`, `build`)
- `pnpm --dir frontend lint`: OK con 1 warning preexistente (`unused eslint-disable` en `frontend/src/app/api/security/csp-report/route.ts:177`)
- `pnpm --dir frontend typecheck`: OK
- `pnpm --dir frontend build`: OK

## 12. Riesgos residuales
- No se pudo ejecutar login real por rol en staging dentro de este entorno porque faltan variables opcionales de smoke (`SMOKE_ADMIN_*`, `SMOKE_CLINIC_*`, `SMOKE_PARTICULAR_TOKEN`).
- Aun hace falta validar manualmente en staging con credenciales reales que cada rol complete flujo E2E post-deploy.

## 13. Checklist manual staging
- [ ] login admin
- [ ] verificar `admin_session_id`
- [ ] abrir `/dashboard/admin`
- [ ] login clinica
- [ ] verificar `app_session_id`
- [ ] abrir `/dashboard`
- [ ] token particular
- [ ] verificar `particular_session_id`
- [ ] abrir caso particular

## 14. Respuestas a preguntas obligatorias
1. Frontend staging llama al backend correcto (`NEXT_PUBLIC_API_URL` en `.env.example` apunta a backend staging) y ahora en browser lo hace via same-origin + rewrite.
2. Si, fetch de auth usa `credentials: include` por defecto en `apiFetch`.
3. Si, backend CORS permite origen exacto cuando coincide con allowlist.
4. Si, backend responde `Access-Control-Allow-Credentials: true` para origen permitido.
5. Si, admin login emite `Set-Cookie` de `admin_session_id` por contrato de rutas.
6. Si, clinica login emite `Set-Cookie` de `app_session_id` por contrato de rutas.
7. Si, particular login emite `Set-Cookie` de `particular_session_id` por contrato de rutas.
8. Si, cookies usan `Path=/`.
9. Si, cookies son `Secure` en `NODE_ENV=production`.
10. Si, `SameSite` es `none` en production y `lax` fuera de production.
11. `Domain` se omite (host-only), y por eso era clave usar proxy same-origin para que middleware frontend pueda ver cookie.
12. `TRUST_PROXY` esta gobernado por ENV y usado en Fastify app (`trustProxy: ENV.trustProxy`).
13. Si, middleware frontend busca `admin_session_id` para admin y `app_session_id` para dashboard clinica; backend setea esos nombres.
14. No se observaron evidencias de SW/PWA cacheando auth en este analisis; el problema principal fue el bypass del proxy same-origin en browser.
