# Entrega: email automatico de token particular

## Resumen

Se agrego `recipientEmail` al contrato de generacion de tokens particulares para admin y clinica. El backend valida el email, genera el token como antes, guarda solo hash y ultimos 4 caracteres, envia el token por email usando el transporte SMTP/Gmail existente y conserva el token visible una sola vez en la respuesta exitosa.

Si el envio automatico no esta disponible o falla, el backend desactiva el token creado y responde con error controlado sin devolver el token raw.

## Archivos modificados

- `server/lib/particular-token.ts`
- `server/lib/email.ts`
- `server/routes/admin-particular-tokens.fastify.ts`
- `server/routes/particular-tokens.fastify.ts`
- `frontend/src/lib/api.ts`
- `frontend/src/app/dashboard/admin/AdminParticularTokensCard.tsx`
- `frontend/src/components/dashboard/ClinicParticularTokensCard.tsx`
- `test/admin-particular-token-schema.test.ts`
- `test/admin-particular-tokens.fastify.test.ts`
- `test/particular-token.test.ts`
- `test/particular-token-edge.test.ts`
- `test/particular-tokens.fastify.test.ts`
- `test/email-success.test.ts`
- `test/frontend-admin-particular-tokens.test.ts`
- `test/frontend-dashboard-clinic-tokens.test.ts`
- `test/fastify-app.test.ts`

## Validaciones ejecutadas

- `pnpm exec node --experimental-strip-types --experimental-specifier-resolution=node --test test/admin-particular-tokens.fastify.test.ts test/particular-tokens.fastify.test.ts test/particular-token.test.ts test/particular-token-edge.test.ts test/admin-particular-token-schema.test.ts test/email-success.test.ts test/frontend-admin-particular-tokens.test.ts test/frontend-dashboard-clinic-tokens.test.ts`
- `pnpm test` - 1934 tests, 0 fallos
- `pnpm build`

## Decision sobre persistencia de recipientEmail

`recipientEmail` no se persiste en base de datos. No existe un campo explicito para ese dato en `particular_tokens`, y este PR lo usa solo como destinatario operativo del envio automatico. Los tests de rutas verifican que `recipientEmail` no se entregue al helper de persistencia `createParticularToken`.

## Riesgos y resguardos

- El email contiene el token raw porque es el canal de entrega solicitado. El token no se guarda en claro y no se registra al particular como usuario.
- Los logs del envio no imprimen el token raw. Las pruebas cubren que el template incluye el token en el cuerpo del email y que no aparece en logs de envio.
- Si el envio falla o SMTP/Gmail no esta configurado, la respuesta no es success: el token creado se desactiva y el backend no devuelve el token raw.
- No se tocaron migraciones, `.env`, login/auth, CSP/security, package.json ni lockfile.
