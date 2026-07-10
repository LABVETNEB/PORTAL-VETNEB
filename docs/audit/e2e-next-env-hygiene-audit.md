# E2E Next Env Hygiene - Audit

## Estado base
- Fecha: 2026-07-10.
- Repo: `C:\PORTAL-VETNEB`.
- Rama recibida: `test-arch-113-codex-final-inspection`.
- Rama esperada por la tarea: `fix/e2e-next-env-hygiene`.
- Se verifico `git diff --stat main` sin salida y se creo `fix/e2e-next-env-hygiene` desde el HEAD limpio actual.
- HEAD auditado: `ac392cf docs(test): close root migration readme state (#1432)`.
- `git status --short --untracked-files=all`: limpio antes de implementar.
- `git diff --check`: sin salida antes de implementar.

## Scope incluido
- Tooling E2E de frontend.
- Guardrail nativo para higiene de `frontend/next-env.d.ts`.
- Documentacion minima de auditoria y entrega.

## Scope excluido
- Sin backend productivo.
- Sin API, auth, DB, migraciones, schema, cookies, CORS, CSP ni rate limits.
- Sin dependencias, `package.json`, `pnpm-lock.yaml`, CI, workflows, commits, push ni PR.
- Sin cambios en `frontend/src`.

## Auditoria previa
- `frontend/next-env.d.ts` ya estaba en ruta productiva:
  `./.next/types/routes.d.ts`.
- En este baseline de Next 16 el archivo usa `import "./.next/types/routes.d.ts";`; el contrato real protegido es la ruta productiva y la ausencia de `.next/dev`.
- El guardrail existente en `test/unit/infrastructure/login-rate-limit-ux-safety.test.ts` detectaba el estado final incorrecto, pero no restauraba el archivo tras Playwright.
- `frontend/playwright.config.ts` levantaba `pnpm dev --hostname 127.0.0.1` como `webServer`; ese `next dev` es el punto que puede regenerar `frontend/next-env.d.ts` hacia `.next/dev/types/routes.d.ts`.
- `frontend/.gitignore` ya cubre `test-results/`, `playwright-report/`, `blob-report/` y `.next/`, por lo que el riesgo auditado era el archivo versionado `frontend/next-env.d.ts`.

## Riesgos identificados
- Restaurar con `git restore` dentro del tooling descartaria cambios locales legitimos y quedaria acoplado a Git.
- Hardcodear todo el archivo `next-env.d.ts` podria romperse si Next cambia el encabezado generado.
- Dejar solo el guardrail nativo seguiria permitiendo que la corrida E2E ensucie el working tree antes de ejecutar `pnpm test`.

## Plan minimo aplicado
- Usar `globalTeardown` de Playwright para ejecutar higiene al final de cada corrida E2E.
- Normalizar solo la ruta `./.next/dev/types/routes.d.ts` hacia `./.next/types/routes.d.ts`.
- Agregar guardrail que valide la config de Playwright y ejercite el helper contra un archivo temporal.

## Validaciones realizadas
- `node --experimental-strip-types --experimental-specifier-resolution=node --test test/unit/infrastructure/next-env-hygiene.test.ts`: PASS, 3/3.
- `pnpm --dir frontend exec playwright test e2e/theme-mode.spec.ts --project=chromium --workers=1`: PASS, 2/2.
- `git status --short --untracked-files=all` post E2E: solo archivos intencionales de esta correccion; `frontend/next-env.d.ts` no aparece.
- `git diff --name-only` post E2E: solo `frontend/playwright.config.ts`; los archivos nuevos no aparecen por no estar stageados y `frontend/next-env.d.ts` no aparece.
- `pnpm test`: PASS, 2986/2986.
- `pnpm build`: PASS.
- `pnpm security:public-surface`: PASS.
- `pnpm --dir frontend lint`: PASS.
- `pnpm --dir frontend typecheck`: PASS.
- `pnpm --dir frontend build`: PASS.

## Resultado
- La causa raiz queda corregida en el flujo Playwright.
- `frontend/next-env.d.ts` no queda mutado tras el E2E validado.
- No se tocaron superficies productivas fuera del scope.

## Riesgo residual
- Bajo. El helper depende de la ruta conocida que Next escribe hoy para typed routes.
- Si Next cambia el nombre de la ruta generada en una version futura, el guardrail debera actualizarse junto con el helper.
