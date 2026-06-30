# PR-VIS-8 implementation report

## Scope exacto detectado

PR-VIS-8 corresponde a VIS-P1-007: agregar scanning automatizado de accesibilidad con axe-core en rutas clave, registrando contraste mediante axe y sin cambios visuales salvo hallazgo concreto.

Rutas cubiertas:

- `/`
- `/login`
- `/dashboard`
- `/dashboard/admin`

Cada ruta se valida en desktop `1440x900` y mobile `390x844`.

## Criterio de razonamiento usado

MEDIO.

El alcance estuvo explícito en `docs/audit/total-engineering-roadmap.md` y `docs/audit/total-visual-engineering-audit.md`. No se subió a ALTO porque no hubo corrección visual ni decisión UX subjetiva; axe quedó verde en las rutas cubiertas.

## IA usada

Codex.

## Archivos modificados

- `frontend/package.json`
- `pnpm-lock.yaml`
- `frontend/e2e/accessibility-axe-key-routes.spec.ts`
- `docs/audit/pr-vis-8-implementation.md`

## Tokens/contratos visuales usados

No se agregaron tokens ni colores. El PR sólo introduce medición axe sobre la UI existente y preserva:

- contrato de design system governance PR-VIS-0,
- theme único sin dark mode muerto PR-VIS-1,
- badges tokenizados PR-VIS-2,
- tokens visuales PR-VIS-3,
- selección limitada al chrome PR-VIS-4,
- primitivas `Select`, `Textarea`, `Label` PR-VIS-5,
- contrato `FilterBar`/`FilterField` PR-VIS-6,
- primitivas `ParticularTokensCardPrimitives` PR-VIS-7.

## Componentes/primitivas

Creado:

- Spec e2e `accessibility-axe-key-routes.spec.ts`.

Usado:

- `@axe-core/playwright` con `AxeBuilder`.
- Playwright existente.

No se crearon primitivas UI nuevas. No se migraron call-sites visuales.

## Qué se evitó tocar

- Backend.
- API.
- Auth.
- DB.
- Migraciones.
- CI/workflows.
- Rutas funcionales.
- Query params.
- Permisos.
- Contratos de datos.
- CSS global.
- Tokens visuales.
- Copy visible de UI.
- Correcciones de contraste sin hallazgo axe.

## Validaciones ejecutadas

- `git branch --show-current`: pasó, rama `chore/pr-vis-8-visual-roadmap-next`.
- `git status --short`: base inicial limpia.
- `git log -1 --oneline`: pasó, `f288c80 refactor(dashboard): extract particular token card primitives (#1203)`.
- `pnpm --filter portal-vetneb-frontend add -D @axe-core/playwright`: falló por `ERR_PNPM_PUBLIC_HOIST_PATTERN_DIFF`.
- `pnpm --filter portal-vetneb-frontend add -D @axe-core/playwright --lockfile-only`: ejecutó con PNPM 11, pero se descartó por drift de lockfile no mínimo.
- `corepack pnpm --filter portal-vetneb-frontend add -D @axe-core/playwright --lockfile-only`: pasó con PNPM 10.8.1 y dejó diff mínimo.
- `corepack pnpm install --frozen-lockfile`: pasó; sincronizó instalación local sin cambiar lockfile.
- `pnpm --dir frontend dev --hostname 127.0.0.1`: falló por `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` usando PNPM global 11; no se forzó purga de `node_modules`.
- `corepack pnpm --dir frontend exec playwright test e2e/accessibility-axe-key-routes.spec.ts`: pasó, 8/8 tests.
- `corepack pnpm --filter portal-vetneb-frontend lint`: pasó.
- `corepack pnpm --filter portal-vetneb-frontend typecheck`: pasó.
- `corepack pnpm --filter portal-vetneb-frontend run test`: script no disponible en `frontend/package.json`; el comando no ejecutó suite.
- `corepack pnpm --filter portal-vetneb-frontend build`: pasó.
- `corepack pnpm test`: pasó, 2905/2905 tests.
- `corepack pnpm build`: pasó.
- `corepack pnpm security:public-surface`: pasó, sin findings de exposición pública; reportó notas server-only existentes para `CLINIC_SESSION_COOKIE_NAME` y `ADMIN_SESSION_COOKIE_NAME` en `frontend/src/proxy.ts`.
- `git diff --check`: pasó.

## Resultado

PR-VIS-8 queda implementado como red e2e axe en rutas clave. No hubo violaciones axe en las rutas y viewports cubiertos. No se hicieron cambios visuales.

## Riesgos residuales

- La cobertura axe inicial queda limitada a Chromium, igual que el proyecto Playwright actual. Cross-browser sigue fuera de scope y corresponde a PR-VIS-10.
- No se agregó gate CI porque CI/workflows quedó fuera de scope.
- Axe automatiza parte de WCAG; no reemplaza revisión manual completa con lector de pantalla.

## Confirmación de exclusiones críticas

No se tocó backend, API, auth, DB, migraciones, dependencias no autorizadas, lockfiles fuera de la actualización permitida ni CI/workflows.
