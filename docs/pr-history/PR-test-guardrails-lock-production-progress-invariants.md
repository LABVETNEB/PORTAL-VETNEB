# PR: test(guardrails): lock production progress invariants

## Objetivo
Bloquear regresiones sobre avances de producción cerrados en PRs #769, #770, #771, #772 y #773, sin frenar nuevas features.

## Alcance aplicado (estricto)
- Solo se agregó/reforzó documentación y tests de contrato.
- No se modificó lógica productiva.
- No se tocaron rutas productivas, auth productivo, email productivo, DB ni env vars reales.
- No se agregaron dependencias.

## Archivos creados/modificados
- `docs/PRODUCTION_PROGRESS_INVARIANTS.md` (nuevo)
- `test/progress-production-invariants.test.ts` (nuevo)

## Invariantes bloqueados

### 1) Email HTML branded
- `multipart/alternative` preservado.
- Gmail API y SMTP mantienen soporte HTML cuando existe.
- Email particular sin `script`, `onclick`, `javascript:`.
- Token particular no aparece en `href` ni query/path.
- CTA particular fijado en `Abrir Portal VETNEB`.

### 2) Sesiones persistentes
- Cookies de `admin`, `clínica` y `particular` con `Max-Age` positivo en login.
- Logout explícito limpia cookie con `Max-Age=0` + `Expires` epoch.

### 3) Tokens particulares
- Hard delete en capa DB (`delete(particularTokens)`).
- `PATCH /api/admin/particular-tokens/:tokenId/revoke` también hard-deletea.
- Respuestas de delete/revoke no exponen `tokenHash`/`tokenLast4`.
- `particular_sessions` invalidadas por FK `ON DELETE CASCADE`.
- `AdminParticularTokensCard` no contiene `Token inactivo` ni `Revocar token`.
- Formularios sensibles admin/clinic mantienen `autoComplete="off"`.

### 4) Precios públicos
- `resolveApiBaseUrlForRuntime` no retorna `""` con `NEXT_PUBLIC_API_URL` válido.
- Retorno explícito de `normalizeApiBaseUrl(nextPublicApiUrl)`.
- `/precios` conserva flujo de `success/categories/items`.
- Backend `/api/public/pricing` mantiene `success: true` con `categories`.

## Validaciones ejecutadas

1. `pnpm test`
- Resultado: OK
- Resumen: `1982` pass, `0` fail, `1` skipped.

2. `pnpm build`
- Resultado: OK

3. `pnpm --dir frontend lint`
- Resultado: OK con warning preexistente.
- Warning: `frontend/src/app/api/security/csp-report/route.ts:177` (`Unused eslint-disable directive`).

4. `pnpm --dir frontend typecheck`
- Primer intento en paralelo con build: falla por ausencia temporal de `.next/types`.
- Re-ejecución secuencial post-build: OK.

5. `pnpm --dir frontend build`
- Resultado: OK.

## Riesgos
- Riesgo funcional: bajo. Son guardrails de source-contract y documentación.
- Riesgo de mantenimiento: bajo. Si se refactorizan rutas/markers críticos, este test pedirá actualizar contratos explícitamente.

## Confirmación de no impacto en lógica productiva
Este PR no altera código de ejecución productiva. Solo agrega:
- documentación de invariantes,
- test de guardrails para detectar regresiones.
