# E2E-ORG-CI — Single Playwright invocation in frontend CI

## Estado base

- Base: `main` en `2b82fa052a02219d7008c0e424122a3f8e280516`.
- El workflow frontend ejecutaba cuatro comandos Playwright secuenciales:
  `e2e:smoke`, `e2e:admin-mobile`, `e2e:visual-contract` y
  `e2e:public-clinic`.
- Cada comando iniciaba un ciclo independiente de los servidores administrados
  por Playwright.
- La unión efectiva del gate contenía 42 specs y 562 tests.
- `dashboard-logout-private-cache.spec.ts`, contrato P1 de logout y `no-store`,
  permanecía fuera de CI.

## Scope incluido

- Sustituir las cuatro ejecuciones del workflow por
  `pnpm --dir frontend e2e:ci`.
- Mantener el runner y el catálogo como fuente única de selección.
- Promover `dashboard-logout-private-cache.spec.ts` a `smoke` y `ci`.
- Consolidar la taxonomy ejecutable de frontend E2E en una única suite
  `frontend-e2e-ci`.
- Regenerar el bloque canónico de `test/README.md`.
- Actualizar los contratos de arquitectura, workflow, readiness y governance.
- Revisar el workflow con el validador de seguridad parser-backed y actualizar
  su digest SHA-256 canónico únicamente después de aprobar la diferencia exacta.

## Scope excluido

- Sin cambios en runtime frontend.
- Sin cambios en backend, API, auth, cookies, base de datos o schema.
- Sin cambios en dependencias, manifiestos o lockfiles.
- Sin cambios en `frontend/e2e/scripts/run-cohort.mjs`.
- Sin cambios en `frontend/package.json` ni `frontend/playwright.config.ts`.
- Sin cambios en assertions Playwright, fixtures, helpers, snapshots o
  baselines.
- Sin adelantar E2E-PROD-RUNNER ni corregir el P1 de Informes.

## Implementación

1. `.github/workflows/frontend-ci.yml` ejecuta una única vez
   `pnpm --dir frontend e2e:ci`.
2. El catálogo mueve `dashboard-logout-private-cache.spec.ts` desde
   `extended` hacia `smoke`/`ci`.
3. La membresía resultante es:
   - `smoke`: 8 specs.
   - `ci`: 43 specs.
   - `extended`: 24 specs.
   - `full`: 72 specs.
4. La policy QGA se actualiza a `QGA-2.2` y representa el browser gate mediante
   una única suite `frontend-e2e-ci`.
5. `test/README.md` se regenera desde la policy ejecutable; su bloque generado
   no fue editado manualmente.
6. El contrato de workflow security registra el digest revisado
   `487637098c386db777c63673a590d4f9bd11c301a2f890937c4aaaae830f2235` para `.github/workflows/frontend-ci.yml`.
7. La revisión confirmó que el workflow difiere de `main` únicamente por
   sustituir las cuatro invocaciones E2E por `pnpm --dir frontend e2e:ci`.

## Validaciones observadas en fase GREEN focal

- `pnpm typecheck:test`: `PASSED`.
- Suite focal de catálogo, workflow, readiness y governance: `PASSED`.
- `pnpm --dir frontend e2e:ci -- --list`: `PASSED`.
- Selección del runner: 43 specs.
- Descubrimiento Playwright: 568 tests en 43 archivos.
- `git diff --check`: `PASSED`.

## Validaciones locales completas

- `pnpm typecheck`: `PASSED`.
- `pnpm typecheck:test`: `PASSED`.
- `pnpm --dir frontend lint`: `PASSED`.
- `pnpm --dir frontend typecheck`: `PASSED`.
- `pnpm --dir frontend build`: `PASSED`.
- `pnpm security:public-surface`: `PASSED`.
- `pnpm --dir frontend e2e:verify-catalog`: `PASSED`.
- Suite focal de catálogo, workflow, readiness y governance: `44/44 PASSED`.
- Ejecución real de `pnpm --dir frontend e2e:ci`: `PASSED`.
- Selección efectiva: 43 specs y 568 tests en una invocación Playwright.
- Validador workflow-security parser-backed: `PASSED`.
- Contrato de digest canónico workflow-security: `PASSED`.
- Suite completa `pnpm test`: `PASSED`.
- Build backend `pnpm build`: `PASSED`.
- CI remoto: `NOT_RUN`.

## Seguridad

La promoción incorpora al gate el contrato que verifica logout y cabeceras
`no-store` de superficies privadas. No se modifica la implementación de auth,
las cookies, los realms ni las respuestas productivas.

## Rollback

Revertir conjuntamente:

1. el comando único del workflow;
2. la membresía de logout en el catálogo;
3. la consolidación de la taxonomy;
4. el bloque generado de `test/README.md`;
5. los contratos y este documento.

El rollback no tiene impacto de datos ni requiere migraciones.