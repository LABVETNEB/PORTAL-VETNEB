# PR: chore(csp-report): lint cleanup

## Resumen

Se limpia el warning preexistente de ESLint en `frontend/src/app/api/security/csp-report/route.ts`.

El cambio elimina un `eslint-disable-next-line no-console` que ya no era necesario. La ruta mantiene el mismo comportamiento: en desarrollo sigue emitiendo `console.warn` con el payload sanitizado y en produccion no registra el reporte.

## Archivos tocados

- `frontend/src/app/api/security/csp-report/route.ts`
- `docs/pr-history/PR-chore-csp-report-lint-cleanup.md`

## Implementacion

- Se elimino unicamente el comentario `// eslint-disable-next-line no-console` sobre `console.warn("[csp-report]", sanitized)`.
- No se cambio logica CSP.
- No se cambiaron headers.
- No se paso CSP a enforcing.
- No se toco backend.
- No se tocaron auth, cookies, CORS, CSRF, `storagePath`, signed URLs, DB schema, indices ni WebAuthn.
- No se agregaron tests: el cambio es de lint y no modifica contrato runtime.

## Tests/comandos

- `pnpm --dir frontend lint`
- `pnpm --dir frontend typecheck`
- `pnpm typecheck`
- `pnpm typecheck:test`
- `pnpm test`
- `pnpm build`
- `pnpm security:public-surface`

## Resultados

- `pnpm --dir frontend lint`: OK. ESLint queda en `0` errores / `0` warnings.
- `pnpm --dir frontend typecheck`: OK.
- `pnpm typecheck`: OK.
- `pnpm typecheck:test`: OK.
- `pnpm test`: OK. `2147` tests, `2146` pass, `1` skipped, `0` fail.
- `pnpm build`: OK. Bundle backend generado por `esbuild` en `dist/index.js`.
- `pnpm security:public-surface`: OK. `PASS security/public-surface: no public devtools exposure findings.`

No se ejecuto `pnpm --dir frontend build`.

## Riesgos

- Riesgo bajo: el cambio solo elimina una directiva de ESLint inutil.
- El comportamiento observable del endpoint CSP report queda igual.

## Rollback

- Revertir el cambio en `frontend/src/app/api/security/csp-report/route.ts`.
- El rollback reintroduciria el warning `Unused eslint-disable directive no-console`.
- Revertir este archivo de historial si se desea eliminar la documentacion asociada.

## Estado final

Implementacion completa y validada. `frontend lint` queda confirmado en `0` errores / `0` warnings.

No se hizo `git add`, commit, push, PR ni merge.
