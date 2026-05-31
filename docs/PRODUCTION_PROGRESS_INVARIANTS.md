# Production Progress Invariants

Este documento fija invariantes de producción que no deben romperse en regresiones futuras. El alcance de estos guardrails es preservar avances cerrados en PRs #769, #770, #771, #772 y #773, permitiendo evolución funcional sin retroceder contratos críticos.

## 1) Email HTML branded

- Los envíos con HTML deben conservar `multipart/alternative` (texto + HTML).
- Gmail API y SMTP deben aceptar y enviar HTML cuando esté disponible.
- Los emails no deben incluir `script`, `onclick` ni `javascript:`.
- El token particular no debe aparecer en `href`, query string ni path.
- El CTA para particular debe ser exactamente: `Abrir Portal VETNEB`.

## 2) Sesiones persistentes

- `admin`, `clínica` y `particular` deben usar cookies persistentes con `Max-Age` positivo en login.
- Cerrar pestaña o navegador no debe ejecutar logout implícito.
- El logout explícito debe limpiar cookie con `Max-Age=0` y `Expires` epoch.

## 3) Tokens particulares

- Eliminar token debe ejecutar hard delete.
- `PATCH /revoke` legacy debe hard-deletear también.
- El listado admin no debe mostrar tokens eliminados.
- La respuesta de delete/revoke no debe exponer `tokenHash` ni `tokenLast4`.
- Las sesiones particulares asociadas deben invalidarse por `ON DELETE CASCADE`.
- Formularios sensibles de tokens deben mantener `autoComplete="off"`.

## 4) Precios públicos

- `resolveApiBaseUrlForRuntime` no puede retornar `""` si `NEXT_PUBLIC_API_URL` es válido.
- Con `NEXT_PUBLIC_API_URL` válido, debe retornar `normalizeApiBaseUrl(nextPublicApiUrl)`.
- `/precios` no debe renderizar error si `getPublicPricing` retorna `success: true`.
- `/precios` debe renderizar categorías e items cuando existan.
- Backend `GET /api/public/pricing` debe mantener `success: true` con `categories`.

## Cobertura de guardrails

La suite `test/progress-production-invariants.test.ts` verifica estos contratos a nivel source-contract (marcadores críticos), complementando tests runtime ya existentes.
