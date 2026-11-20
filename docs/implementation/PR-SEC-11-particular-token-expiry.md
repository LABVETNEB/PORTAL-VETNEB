# PR-SEC-11 — Expiración del token credencial de particulares (V-12)

Estado base: `828b8440` (`origin/main`). Scope: backend runtime (R2, auth). Decisión de alcance: Nico, 2026-11-18 (candidato V-12 de `docs/audit/SEGURIDAD_DRIVE_REA_VETNEB_2026-11-10.md`). El número SEC-11 es una asignación operativa; la hoja de ruta original no está en el repositorio.

## Problema (F-1 / V-12)

`particular_tokens` no tiene vencimiento propio. La sesión expira (`SESSION_TTL_HOURS`, máximo 24 h, PR-SEC-09), pero mientras el token siga `is_active` puede abrir sesiones nuevas indefinidamente. Un token filtrado daba acceso sin límite temporal al informe y a los datos del caso.

## Cambio

- `isParticularTokenExpired(createdAt, ttlDays, nowMs)` (`server/lib/session-expiry.ts`, junto a `isSessionExpired`; función pura sin `ENV`): vencido cuando `nowMs >= createdAt + ttlDays × 24 h` (UTC, epoch). Fecha no `Date`, inválida, TTL no finito o ≤ 0, o reloj no finito ⇒ vencido (fail-closed).
- `PARTICULAR_TOKEN_TTL_DAYS` (`server/lib/env.ts`, `.env.example`): **obligatoria**, entero 1–365, **sin valor por defecto en runtime**. Ausente, vacía, solo espacios o inválida (decimal, ≤ 0, > 365, no numérica) ⇒ el arranque aborta en cualquier `NODE_ENV` (error de validación que nombra la variable). `.env.example` documenta el valor operativo elegido: 90. No existe modo «sin vencimiento».
- Preload exclusivo del runner de tests: `test/helpers/test-env-preload.mjs` (`process.env.PARTICULAR_TOKEN_TTL_DAYS ??= "90"`), cargado con `--import` en los scripts `test` y `test:coverage` de `package.json`. Solo fija esa variable, solo si está `undefined` (un valor explícito, vacío o inválido no se enmascara) y no participa de `dev`, `build` ni `start`. Los tests que arrancan procesos hijos con entorno propio (sin preload) verifican el rechazo real.
- Aplicado en los cinco puntos que aceptan el token: login de `particular-auth`, el candidato particular del login unificado de `auth` (`POST /api/auth/login`, mismo error genérico «Credenciales inválidas») y la autenticación de sesión de `particular-auth`, `particular-audit` y `particular-study-tracking`. Un token vencido invalida también las sesiones vivas: 401, sesión borrada y cookie limpiada.
- Sin migración, sin cambios de esquema ni de datos. Sin renovación automática ni periodo de gracia.

## Contrato HTTP

Login con token vencido ⇒ 401 `Token inválido` (login unificado: `Credenciales inválidas`), idéntico al de token inexistente, alterado o inactivo (se registra como `invalid_credentials`, bajo el rate limit existente). Sesión con token vencido ⇒ 401 `Token particular inválido o inactivo`, el mismo mensaje del token inactivo. No se agregan campos ni cabeceras.

## Tests

`test/security/particular-token-ttl.test.ts` (24 casos) y un caso en `auth.fastify.test.ts` para el login unificado (vigente, borde exacto, vencido, fecha inválida): helper (vigente, borde exacto, vencido, fechas/TTL/reloj inválidos), cada superficie (vigente, vencido, 1 ms antes, `createdAt` inválido, inactivo, inexistente/cookie reutilizada), login (vencido, inactivo, inexistente indistinguibles; vigente conserva el contrato), aislamiento por clínica (informe ajeno ⇒ 404) y configuración en procesos aislados sin preload (ausente o vacío abortan en development, test y production; valores válidos se respetan; inválidos abortan). Verificado por mutación: sin el control fallan 5 casos.

Se realinearon los fixtures de token de siete tests existentes (carecían de `createdAt` o lo tenían fuera de la ventana de 90 días respecto de su reloj) y los guards de arquitectura que anclan literales de estas rutas (`security-write-attribution-boundaries`: allowlist de imports, sandbox del autenticador y conteo exacto de `deleteParticularSession` de 2 a 3; hashes de `particular-auth` y `particular-study-tracking` en M33 y en los tres guards de study-tracking; censo LOC M48 —`server/routes` 22.150, total 50.368— y su documento). Por el preload y la variable obligatoria se realinearon además las constantes exactas del script `test`/`test:coverage` en cinco tests de contrato de `package.json` y el entorno del proceso hijo de `env-db-pool.test.ts`. Ninguna aserción se debilitó ni se marcó como skip: las comparaciones siguen siendo de igualdad exacta.

## Validación (local, Windows, sin `DATABASE_URL`)

- `pnpm typecheck` y `pnpm typecheck:test`: PASSED. `pnpm build`: PASSED.
- `pnpm test` (corrida completa): 5935 tests, 5922 pass, 12 fail, 1 skipped. Los 12 fallos no se relacionan con SEC-11:
  - 9 archivos Postgres (`e2e-global-03b`, cuatro `global-search-*`, `login-rate-limit-reset`, `password-change-session-revocation`, `public-professionals-rate-limit`, `report-by-id-postgres-isolation`): exigen `DATABASE_URL`/`SUPABASE_DB_URL` hacia la DB aislada `portal_vetneb_ci` (mensaje explícito) ⇒ BLOCKED en este entorno.
  - 3 pruebas de la auditoría de superficie pública: los marcadores `NEED_PASSWORD`/`INCORRECT_PASSWORD` provienen de `frontend/.next/static/chunks/…` (build local viejo, ignorado por Git; ausentes en `frontend/src`) ⇒ artefacto del entorno local, no del diff.
- La evidencia autoritativa es el CI de GitHub sobre el head que se publique (§5.7).

## Impacto sobre Render (NO desplegar sin decisión)

`PARTICULAR_TOKEN_TTL_DAYS` es obligatoria: **si un servicio de Render que ejecuta este backend (producción y staging) no la define antes del despliegue, el proceso no arranca**. Debe cargarse antes de promover el build, con el valor de la opción de transición elegida (ver abajo). Este PR no modifica Render ni producción.

## Tokens históricos — impacto (NO desplegar sin decisión)

Con TTL 90, el token vence a los 90 días de `created_at`. Todo token emitido hace 90 días o más deja de funcionar en el primer despliegue: el login responde 401 y las sesiones vivas caen en su siguiente request. No hay forma de saber cuántos son sin leer la base (R3, no ejecutado). Efecto: invalidación masiva de enlaces ya enviados por correo; el particular debe pedir uno nuevo a su clínica y la clínica no puede reemitir sobre el mismo caso sin crear otro token.

Opciones de transición:

1. **Corte directo (el de este PR).** Más simple y seguro; riesgo de soporte el día del despliegue.
2. **TTL inicial ampliado (p. ej. 365) y reducción gradual hasta 90.** Sin código nuevo: sólo configuración. Cada paso es un redeploy de variable, y es visible, acotado y reversible.
3. **Columna `expires_at` con backfill** (`created_at` + 90 d, mínimo `now + N`): permite gracia por token y extensión puntual. Es R2 con migración y rollback propios, y R3 al ejecutarla.

Recomendación: opción 2, precedida de una consulta de sólo lectura (R3, autorizada aparte) que cuente tokens activos por tramo de antigüedad. Antes de habilitar 90 en producción: ese recuento, aviso a las clínicas con tokens por vencer y confirmación de que el flujo de reemisión existe.

## Riesgos residuales

- Tokens ya emitidos y filtrados siguen válidos hasta su vencimiento (no hay revocación por la clínica; fuera de alcance).
- El vencimiento se mide desde `created_at`: no se puede extender ni acortar por token sin migración.
- `createdAt` posterior al reloj del servidor no se trata como vencido (desfase de reloj tolerado).
- URLs firmadas ya emitidas siguen vigentes hasta su caducidad (15 min por defecto), condición preexistente.
- Condición de carrera sub-segundo entre vencimiento y una petición en vuelo: aceptada.

## Fuera de alcance

Login/logout general (PR-SEC-13), rate limiting (SEC-10), RLS, CSP, `report_access_tokens`, revocación por la clínica, frontend, migraciones.

## Rollback

Revert del commit. Sin migraciones ni datos. Alternativa operativa sin revert: fijar `PARTICULAR_TOKEN_TTL_DAYS=365`. Tras un revert, la variable ya definida en Render se ignora.
