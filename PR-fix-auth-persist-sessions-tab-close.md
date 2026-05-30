# PR: fix(auth): persist sessions across tab closes

## Skills Claude utilizadas

- `vetneb-security-production-invariants`
  - Uso: validar cookies HttpOnly, Max-Age positivo, logout explícito, separación de dominios admin/clinic/particular y no regresión de auth.

- `vetneb-protocolos-comunicacion`
  - Uso: revisar contratos HTTP `Set-Cookie`, `Max-Age`, `Expires`, `SameSite`, `Secure`, CORS y persistencia cliente-servidor.

- `vetneb-staff-senior-full-stack-engineer`
  - Uso: implementar tests mínimos de contrato y mantener compatibilidad con Fastify, frontend y suite existente.

- `vetneb-bugs-errores-optimizacion-rutas`
  - Uso: auditar si había pérdida de sesión por rutas, middleware, redirects, recarga, cookies o estado frontend.

## Diagnóstico

El backend ya generaba cookies persistentes para los tres roles mediante `Max-Age = ENV.sessionTtlHours * 60 * 60`.

Roles auditados:

- Administrador: `admin_session_id`
- Clínica: `app_session_id`
- Particular: `particular_session_id`

También se verificó que el logout de cada rol limpia únicamente su cookie correspondiente con `Max-Age=0` y `Expires=Thu, 01 Jan 1970 00:00:00 GMT`.

No se encontró uso de `sessionStorage`, `localStorage`, `beforeunload`, `unload` ni `visibilitychange` como mecanismo de cierre de sesión al cerrar pestaña.

## Cambios realizados

- Se agregaron contratos de persistencia para cookies de login por rol.
- Se reforzaron tests runtime existentes para exigir `Max-Age` positivo en login.
- Se reforzó el guardrail de seguridad de cookies de sesión.
- Se agregó un test dedicado para evitar regresiones de cookies sin `Max-Age`, logout por cierre de pestaña y estado frontend como fuente de verdad de sesión.

## Archivos modificados

- `test/auth.fastify.test.ts`
- `test/admin-auth.fastify.test.ts`
- `test/particular-auth.fastify.test.ts`
- `test/security-session-cookie-boundaries.test.ts`
- `test/auth-cookie-persistence-contract.test.ts`

## Validación

```powershell
pnpm test
pnpm build
```

Resultado local:

```txt
pnpm test: 1965 pass / 0 fail / 1 skipped
pnpm build: OK
```

## Riesgos

- Bajo: no se cambia lógica productiva de auth; se agregan contratos para proteger comportamiento existente.
- Bajo: el TTL sigue dependiendo de `SESSION_TTL_HOURS`.
- Medio si se interpreta "solo logout" como sesión infinita: este PR no elimina expiración TTL por seguridad. Mantiene persistencia al cerrar pestaña mientras el TTL esté vigente.

## Evidencia de invariante

- Las cookies de login de admin, clínica y particular son persistentes porque incluyen `Max-Age` positivo.
- Cerrar pestaña o navegador no ejecuta logout.
- Logout explícito sigue limpiando solo la cookie del rol correspondiente.
- No se tocaron email, Gmail API, dominio propio, variables reales de producción ni permisos RBAC.
