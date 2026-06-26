# Clínica perfil — ubicación de cambiar contraseña

Fecha: 2026-06-26

## Cambio realizado

- Se quitó el selector superior interno `Acceso | Perfil público` del módulo `Perfil` del dashboard Clínica.
- El módulo `Perfil` renderiza directamente `ClinicPublicProfileCard`.
- El formulario existente `PasswordChangePanel` queda reutilizado dentro de la navegación interna del perfil público como tab `Cambiar contraseña`.
- La navegación interna queda: `Estado`, `Datos`, `Contacto`, `Contenido`, `Cambiar contraseña`.

## Archivos tocados

- `frontend/src/app/dashboard/page.tsx`
- `frontend/src/components/dashboard/ClinicPublicProfileCard.tsx`
- `frontend/e2e/dashboard-clinic-perfil-mobile-operability.spec.ts`
- `frontend/e2e/dashboard-clinic-module-state-parity.spec.ts`
- `frontend/e2e/dashboard-real-app-shell-no-scroll-contract.spec.ts`
- `test/frontend-dashboard-password-change-ui.test.ts`
- `docs/audit/clinic-profile-change-password-tab-placement.md`

## Validaciones ejecutadas

- `corepack pnpm lint` desde `frontend`: falla antes de lint por `ERR_MODULE_NOT_FOUND` resolviendo `eslint-config-next/core-web-vitals` desde `frontend/eslint.config.mjs`; no se modifica configuración por estar fuera de scope.
- `corepack pnpm typecheck` desde `frontend`: OK.
- `corepack pnpm build` desde `frontend`: OK.
- `corepack pnpm e2e -- dashboard-clinic-perfil-mobile-operability.spec.ts` desde `frontend`: OK, 3/3.
- `corepack pnpm test` desde raíz: OK, 2841/2841. Primer intento falló porque `next build` había regenerado `frontend/next-env.d.ts` hacia `.next/dev`; se restauró el artefacto generado y la repetición pasó.
- `corepack pnpm build` desde raíz: OK.
- `corepack pnpm security:public-surface` desde raíz: OK.

## Alcance excluido

- Sin cambios en backend, API, auth, DB, migraciones, dependencias, lockfiles, CI o workflows.
- Sin cambios de endpoints ni contratos de cookies/sesión.
- Sin crear tabs `Acceso` o módulos nuevos.
