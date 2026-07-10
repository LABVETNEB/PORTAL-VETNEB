# fix(e2e): next-env hygiene for Playwright

## Estado base
- Rama de trabajo final: `fix/e2e-next-env-hygiene`.
- HEAD: `ac392cf docs(test): close root migration readme state (#1432)`.
- Base inicial limpia: `git status --short --untracked-files=all` sin salida.
- `git diff --check` inicial sin salida.

## Scope incluido
- Configuracion Playwright de frontend.
- Helper E2E para restaurar la referencia de rutas de `next-env.d.ts`.
- Test nativo de infraestructura para prevenir regresion.
- Markdown de auditoria y entrega.

## Scope excluido
- Backend productivo, API, auth, DB, migraciones, schema, dependencias, lockfiles, CI, workflows, commits, push y PR.
- Tests eliminados o guardrails relajados: ninguno.

## Causa raiz
- El `webServer` de Playwright ejecuta `pnpm dev --hostname 127.0.0.1`.
- `next dev` puede regenerar `frontend/next-env.d.ts` apuntando a `./.next/dev/types/routes.d.ts`.
- Ese archivo esta versionado, por lo que la corrida E2E puede dejar el working tree sucio y hacer fallar guardrails de `pnpm test`.

## Correccion aplicada
- `frontend/playwright.config.ts` ahora declara:
  `globalTeardown: "./e2e/helpers/restore-next-env-hygiene.mjs"`.
- `frontend/e2e/helpers/restore-next-env-hygiene.mjs` normaliza solo:
  `./.next/dev/types/routes.d.ts` -> `./.next/types/routes.d.ts`.
- No usa Git y no reemplaza el archivo completo; conserva el formato generado por Next.
- `test/unit/infrastructure/next-env-hygiene.test.ts` valida:
  - `frontend/next-env.d.ts` mantiene ruta productiva.
  - Playwright conserva el teardown de higiene.
  - El helper restaura un archivo temporal con ruta dev.

## Archivos modificados
- `frontend/playwright.config.ts`
- `frontend/e2e/helpers/restore-next-env-hygiene.mjs`
- `test/unit/infrastructure/next-env-hygiene.test.ts`
- `docs/audit/e2e-next-env-hygiene-audit.md`
- `docs/implementation/e2e-next-env-hygiene.md`

## Validaciones
- `node --experimental-strip-types --experimental-specifier-resolution=node --test test/unit/infrastructure/next-env-hygiene.test.ts`: PASS, 3/3.
- `pnpm --dir frontend exec playwright test e2e/theme-mode.spec.ts --project=chromium --workers=1`: PASS, 2/2.
- `git status --short --untracked-files=all` post E2E: solo archivos intencionales; `frontend/next-env.d.ts` no aparece.
- `git diff --name-only` post E2E: `frontend/next-env.d.ts` no aparece.
- `pnpm test`: PASS, 2986/2986.
- `pnpm build`: PASS.
- `pnpm security:public-surface`: PASS.
- `pnpm --dir frontend lint`: PASS.
- `pnpm --dir frontend typecheck`: PASS.
- `pnpm --dir frontend build`: PASS.

## Resultado
- El flujo E2E validado ya no deja `frontend/next-env.d.ts` en ruta dev.
- `frontend/next-env.d.ts` queda con `./.next/types/routes.d.ts`.
- No hay cambios fuera de scope.

## Riesgo residual
- Bajo. El guardrail cubre la configuracion y el comportamiento del helper.
- Si Next cambia la ruta generada de typed routes, actualizar constantes y test en la misma pasada.

## Estado final esperado
- Working tree con solo los archivos intencionales de esta correccion hasta que Nico haga stage/commit.
- Sin commit, push ni PR realizados por el agente.
