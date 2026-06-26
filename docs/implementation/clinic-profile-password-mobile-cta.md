# Clinic Profile Password Mobile CTA

## Estado base

- Rama: `fix/clinic-profile-password-mobile-cta`.
- HEAD inicial auditado: `272afdd docs(dashboard): audit runtime visual evidence post ux1 (#1149)`.
- Estado inicial: `git status --short` limpio.
- Entorno usado: Windows, PowerShell, PNPM.

## Problema P1

- En Android 360x740, dentro de Clinica -> Perfil -> `Cambiar contrasena`, el CTA `Actualizar contrasena` quedaba fuera del viewport.
- Evidencia previa: `docs/audit/evidence/dashboard-runtime-post-ux1/clinic-profile-android-360x740-cambiar-contrasena.png`.
- Metrica previa documentada: `panelDelta=81`.

## Scope incluido

- Ajuste frontend acotado a Clinica -> Perfil y al componente reutilizado `PasswordChangePanel`.
- Variante compacta mobile para el panel de cambio de contrasena cuando se renderiza dentro de Perfil Clinica.
- Assertions E2E para validar campos y CTA dentro del viewport en mobile.
- Evidencia visual post UX1 generada por el spec existente.

## Scope excluido

- Backend, API, auth, DB, migraciones, dependencias, `package.json`, `pnpm-lock.yaml`, CI y workflows.
- Restaurar scroll global en `html`, `body` o `main`.
- Reintroducir `Acceso | Perfil publico`.
- Crear tabs `Acceso` o `Perfil publico`.
- Eliminar tabs existentes: `Estado`, `Datos`, `Contacto`, `Contenido`, `Cambiar contrasena`.
- Redisenar globalmente los tabs del dashboard.

## Auditoria previa

- Se confirmo rama esperada y base limpia.
- Se confirmaron scripts reales en raiz y `frontend/package.json`.
- Se leyeron `ClinicPublicProfileCard`, `PasswordChangePanel`, `ModuleSurface`, `ModuleTabs`, specs E2E indicados y el test nativo de password change.
- Se buscaron referencias legacy de `Acceso | Perfil publico`, `Acceso`, `Perfil publico`, `Cambiar contrasena`, `Actualizar contrasena` y `PasswordChangePanel`.
- Riesgo identificado: `PasswordChangePanel` tambien se usa en Admin, por eso el default queda sin cambios y la densidad compacta se aplica solo en Perfil Clinica.

## Cambio realizado

- `PasswordChangePanel` agrega `density="compact"` con default `default`.
- La densidad compacta:
  - oculta el header/copy interno solo en mobile y lo mantiene accesible para screen readers;
  - conserva el header visible desde `sm` para no degradar desktop/tablet;
  - reduce padding, gaps, labels y CTA solo en mobile;
  - mantiene los tres campos, labels, autocomplete, validaciones, live regions y handler API existentes.
- `ClinicPublicProfileCard` renderiza `PasswordChangePanel` con `density="compact"` solo en el tab `Cambiar contrasena`.
- Los E2E ahora validan que `Contraseña actual`, `Nueva contraseña`, `Confirmar nueva contraseña` y `Actualizar contraseña` esten dentro del viewport y que no haya scroll global.

## Archivos tocados

- `frontend/src/components/dashboard/PasswordChangePanel.tsx`
- `frontend/src/components/dashboard/ClinicPublicProfileCard.tsx`
- `frontend/e2e/dashboard-clinic-perfil-mobile-operability.spec.ts`
- `frontend/e2e/dashboard-runtime-post-ux1-visual-evidence.spec.ts`
- `docs/audit/evidence/dashboard-runtime-post-ux1/clinic-profile-android-360x740-cambiar-contrasena.png`
- `docs/audit/evidence/dashboard-runtime-post-ux1/clinic-profile-iphone-390x844-cambiar-contrasena.png`
- `docs/audit/evidence/dashboard-runtime-post-ux1/clinic-profile-iphone-pro-max-430x932-cambiar-contrasena.png`
- `docs/audit/evidence/dashboard-runtime-post-ux1/clinic-profile-desktop-1366x768-cambiar-contrasena.png`
- `docs/audit/evidence/dashboard-runtime-post-ux1/dashboard-runtime-post-ux1-metrics.json`
- `docs/implementation/clinic-profile-password-mobile-cta.md`

## Validaciones

- Desde `frontend`: `corepack pnpm lint`: ejecutado, paso.
- Desde `frontend`: `corepack pnpm typecheck`: ejecutado, paso.
- Desde `frontend`: `corepack pnpm build`: ejecutado, paso.
- Desde `frontend`: `corepack pnpm exec playwright test "e2e/dashboard-clinic-perfil-mobile-operability.spec.ts"`: ejecutado, paso; 3/3.
- Desde `frontend`: `corepack pnpm exec playwright test "e2e/dashboard-runtime-post-ux1-visual-evidence.spec.ts"`: ejecutado, paso; 1/1.
- Desde raiz: `corepack pnpm test`: ejecutado, paso en segundo intento; 2841/2841.
- Desde raiz: `corepack pnpm build`: ejecutado, paso.
- Desde raiz: `corepack pnpm security:public-surface`: ejecutado, paso; findings server-only informativos existentes en `frontend/src/proxy.ts`.

Nota: el primer intento de `corepack pnpm test` fallo porque `next build` habia reescrito `frontend/next-env.d.ts` hacia `.next/dev/types/routes.d.ts`. Se restauro manualmente al contrato productivo `.next/types/routes.d.ts`; `frontend/next-env.d.ts` quedo sin diff y el segundo intento paso.

## Resultado

- En Android 360x740, `Cambiar contrasena` queda sin overflow de panel: `panelDelta=0`.
- `Actualizar contrasena` queda dentro del viewport: bottom `587.703125` sobre viewport de alto `740`.
- Los tres campos del formulario quedan visibles y operables.
- `html`, `body` y `main.dashboard-main` siguen sin scroll global.
- `Cambiar contrasena` sigue como tab interno de Perfil Clinica.
- `Acceso | Perfil publico` sigue ausente.

## Riesgo residual

- La evidencia visual se genera con Chromium Playwright; no reemplaza smoke fisico en Android/iOS.

## Estado final

- Implementacion completada y validada.
- Sin cambios en backend, API, auth, DB, migraciones, dependencias, lockfiles, CI ni workflows.
